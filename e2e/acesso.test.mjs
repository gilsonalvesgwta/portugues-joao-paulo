// Teste de ponta a ponta do acesso: um navegador de verdade contra o aplicativo compilado
// e um Supabase local. Exige as variáveis NEXT_PUBLIC_SUPABASE_URL e
// SUPABASE_SERVICE_ROLE_KEY e o aplicativo no ar em BASE_URL.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chaveDeServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && chaveDeServico, 'faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');

const admin = createClient(url, chaveDeServico, { auth: { persistSession: false, autoRefreshToken: false } });
const marca = Date.now();
const senha = 'senha-de-teste-123';
const aluna = { email: `aluna-${marca}@exemplo.test`, nome: 'Lucía Prueba' };
const professor = { email: `professor-${marca}@exemplo.test`, nome: 'Professor Teste' };

let navegador;

async function criarPessoa(pessoa, papel) {
  const { data, error } = await admin.auth.admin.createUser({
    email: pessoa.email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome: pessoa.nome },
  });
  assert.equal(error, null, `criar ${pessoa.email}: ${error?.message}`);
  if (papel !== 'aluno') {
    const { error: erroPapel } = await admin.from('perfis').update({ papel }).eq('id', data.user.id);
    assert.equal(erroPapel, null, `definir papel: ${erroPapel?.message}`);
  }
  return data.user.id;
}

async function novaPagina() {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 800 } });
  return contexto.newPage();
}

async function entrar(pagina, email, clave) {
  await pagina.goto(`${base}/entrar`);
  await pagina.getByLabel('Correo electrónico de tu compra').fill(email);
  await pagina.getByLabel('Tu contraseña', { exact: true }).fill(clave);
  await pagina.getByRole('button', { name: 'Acceder a mis clases' }).click();
}

function caminho(pagina) {
  return new URL(pagina.url()).pathname;
}

before(async () => {
  await mkdir('capturas', { recursive: true });
  navegador = await chromium.launch();
  await criarPessoa(aluna, 'aluno');
  await criarPessoa(professor, 'professor');
});

after(async () => {
  await navegador?.close();
});

test('o perfil nasce junto com o usuário, como aluno e com o nome', async () => {
  const { data, error } = await admin.from('perfis').select('nome, papel, email').eq('email', aluna.email).single();
  assert.equal(error, null, error?.message);
  assert.deepEqual(data, { nome: aluna.nome, papel: 'aluno', email: aluna.email });
});

test('sem login, as áreas internas levam para a tela de acesso', async () => {
  const pagina = await novaPagina();
  for (const rota of ['/inicio', '/admin', '/qualquer-coisa']) {
    await pagina.goto(`${base}${rota}`);
    assert.equal(caminho(pagina), '/entrar', rota);
  }
  await pagina.goto(`${base}/`);
  assert.equal(caminho(pagina), '/entrar', 'raiz');
});

test('senha errada e e-mail desconhecido mostram o mesmo aviso e não entram', async () => {
  const pagina = await novaPagina();
  for (const email of [aluna.email, `ninguem-${marca}@exemplo.test`]) {
    await entrar(pagina, email, 'senha-errada-999');
    await pagina.waitForURL('**/entrar?error=credenciales');
    assert.equal(await pagina.getByRole('alert').first().innerText(), 'El correo o la contraseña no coinciden.');
  }
  await pagina.goto(`${base}/inicio`);
  assert.equal(caminho(pagina), '/entrar');
});

test('a senha nunca aparece no endereço da página', async () => {
  const pagina = await novaPagina();
  const enderecos = [];
  pagina.on('request', (pedido) => enderecos.push(pedido.url()));
  await entrar(pagina, aluna.email, senha);
  await pagina.waitForURL('**/inicio');
  assert.equal(enderecos.some((endereco) => endereco.includes(senha)), false);
});

test('aluna entra, vê a própria área, não entra na administração e sai', async () => {
  const pagina = await novaPagina();
  await entrar(pagina, aluna.email, senha);
  await pagina.waitForURL('**/inicio');
  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), 'Hola, Lucía');
  await pagina.screenshot({ path: 'capturas/inicio-computador.png', fullPage: true });

  await pagina.goto(`${base}/admin`);
  assert.equal(caminho(pagina), '/inicio', 'aluna não entra na administração');

  await pagina.goto(`${base}/entrar`);
  assert.equal(caminho(pagina), '/inicio', 'quem já entrou não vê de novo a tela de acesso');

  await pagina.getByRole('button', { name: 'Salir' }).click();
  await pagina.waitForURL('**/entrar');
  await pagina.goto(`${base}/inicio`);
  assert.equal(caminho(pagina), '/entrar', 'depois de sair, a área interna fecha');
});

test('professor entra direto na administração', async () => {
  const pagina = await novaPagina();
  await entrar(pagina, professor.email, senha);
  await pagina.waitForURL('**/admin');
  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), 'Administração');
  assert.match(await pagina.locator('main').innerText(), /Você entrou como Professor/);
  await pagina.screenshot({ path: 'capturas/admin-computador.png', fullPage: true });
});

test('ninguém se cadastra sozinho pelo Supabase', async () => {
  const publico = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await publico.auth.signUp({ email: `intruso-${marca}@exemplo.test`, password: senha });
  assert.notEqual(error, null, 'o cadastro deveria ser recusado');
  assert.equal(data.user, null);
});

test('visitante sem login não lê nenhuma tabela pela API', async () => {
  const publico = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  for (const tabela of ['perfis', 'matriculas', 'aulas', 'perguntas', 'eventos_pagamento']) {
    const { data, error } = await publico.from(tabela).select('*').limit(1);
    assert.ok(error !== null || (data ?? []).length === 0, `${tabela} não pode devolver linhas a um visitante`);
  }
});
