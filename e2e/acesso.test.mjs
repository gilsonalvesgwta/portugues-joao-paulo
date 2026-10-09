// Teste de ponta a ponta do acesso: um navegador de verdade contra o aplicativo compilado
// e um Supabase local. Exige o aplicativo no ar em BASE_URL e as variáveis do Supabase.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { admin, base, caminho, chavePublica, criarPessoa, emailDeTeste, entrar, novaPagina, senha, textoDoAviso, url } from './apoio.mjs';

const aluna = { email: emailDeTeste('aluna'), nome: 'Lucía Prueba' };
const professor = { email: emailDeTeste('professor'), nome: 'Professor Teste', papel: 'professor' };

let navegador;

before(async () => {
  await mkdir('capturas', { recursive: true });
  navegador = await chromium.launch();
  await criarPessoa(aluna);
  await criarPessoa(professor);
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
  const pagina = await novaPagina(navegador);
  for (const rota of ['/inicio', '/admin', '/nueva-contrasena', '/qualquer-coisa']) {
    await pagina.goto(`${base}${rota}`);
    assert.equal(caminho(pagina), '/entrar', rota);
  }
  await pagina.goto(`${base}/`);
  assert.equal(caminho(pagina), '/entrar', 'raiz');
});

test('senha errada e e-mail desconhecido mostram o mesmo aviso e não entram', async () => {
  const pagina = await novaPagina(navegador);
  for (const email of [aluna.email, emailDeTeste('ninguem')]) {
    await entrar(pagina, email, 'senha-errada-999');
    await pagina.waitForURL('**/entrar?error=credenciales');
    assert.equal(await textoDoAviso(pagina), 'El correo o la contraseña no coinciden.');
  }
  await pagina.goto(`${base}/inicio`);
  assert.equal(caminho(pagina), '/entrar');
});

test('a senha nunca aparece no endereço da página', async () => {
  const pagina = await novaPagina(navegador);
  const enderecos = [];
  pagina.on('request', (pedido) => enderecos.push(pedido.url()));
  await entrar(pagina, aluna.email, senha);
  await pagina.waitForURL('**/inicio');
  assert.equal(enderecos.some((endereco) => endereco.includes(senha)), false);
});

test('aluna entra, vê a própria área, não entra na administração e sai', async () => {
  const pagina = await novaPagina(navegador);
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
  const pagina = await novaPagina(navegador);
  await entrar(pagina, professor.email, senha);
  await pagina.waitForURL('**/admin');
  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), 'Administração');
  assert.match(await pagina.locator('main').innerText(), /Você entrou como Professor/);
  await pagina.screenshot({ path: 'capturas/admin-computador.png', fullPage: true });
});

test('ninguém se cadastra sozinho pelo Supabase', async () => {
  const publico = createClient(url, chavePublica, { auth: { persistSession: false } });
  const { data, error } = await publico.auth.signUp({ email: emailDeTeste('intruso'), password: senha });
  assert.notEqual(error, null, 'o cadastro deveria ser recusado');
  assert.equal(data.user, null);
});

test('visitante sem login não lê nenhuma tabela pela API', async () => {
  const publico = createClient(url, chavePublica, { auth: { persistSession: false } });
  for (const tabela of ['perfis', 'matriculas', 'aulas', 'perguntas', 'eventos_pagamento', 'notificacoes']) {
    const { data, error } = await publico.from(tabela).select('*').limit(1);
    assert.ok(error !== null || (data ?? []).length === 0, `${tabela} não pode devolver linhas a um visitante`);
  }
});
