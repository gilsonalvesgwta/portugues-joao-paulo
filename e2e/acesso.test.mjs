// Teste de ponta a ponta do acesso: um navegador de verdade contra o aplicativo compilado
// e um Supabase local. Exige o aplicativo no ar em BASE_URL e as variáveis do Supabase.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { admin, base, caminho, clientePublico, criarPessoa, emailDeTeste, entrar, novaPagina, senha, textoDoAviso } from './apoio.mjs';

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

test('depois de 8 senhas erradas, aquele e-mail espera: nem a senha certa entra; as outras contas seguem normais', async () => {
  const teimosa = { email: emailDeTeste('aluna-teimosa'), nome: 'Tere Terca' };
  await criarPessoa(teimosa);
  const pagina = await novaPagina(navegador);
  for (let vez = 1; vez <= 8; vez += 1) {
    await entrar(pagina, teimosa.email, `senha-errada-${vez}`);
    await pagina.waitForURL('**/entrar?error=credenciales');
  }
  await entrar(pagina, teimosa.email, senha);
  await pagina.waitForURL('**/entrar?error=intentos');
  assert.equal(
    await textoDoAviso(pagina),
    'Demasiados intentos con este correo. Espera 15 minutos o crea una contraseña nueva con «Olvidé mi contraseña».',
  );
  await pagina.goto(`${base}/inicio`);
  assert.equal(caminho(pagina), '/entrar', 'continua de fora');

  // O bloqueio é só daquele e-mail.
  await entrar(pagina, aluna.email, senha);
  await pagina.waitForURL('**/inicio');
  await pagina.context().close();
});

test('toda resposta leva os cabeçalhos de segurança', async () => {
  const pagina = await novaPagina(navegador);
  const resposta = await pagina.goto(`${base}/entrar`);
  const cabecalhos = resposta.headers();
  assert.equal(cabecalhos['x-frame-options'], 'DENY', 'a plataforma não abre dentro de outra página');
  assert.equal(cabecalhos['x-content-type-options'], 'nosniff');
  assert.equal(cabecalhos['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.match(cabecalhos['content-security-policy'], /frame-ancestors 'none'/);
  assert.match(cabecalhos['content-security-policy'], /form-action 'self'/);
  assert.match(cabecalhos['permissions-policy'], /camera=\(\)/);
  assert.match(cabecalhos['strict-transport-security'], /max-age=\d+/);
  assert.equal(cabecalhos['x-powered-by'], undefined, 'não anuncia com o que foi feita');
  await pagina.context().close();
});

test('a sessão fica em cookie que os programas da página não leem', async () => {
  const pagina = await novaPagina(navegador);
  await entrar(pagina, aluna.email, senha);
  await pagina.waitForURL('**/inicio');
  const cookies = (await pagina.context().cookies()).filter((cookie) => cookie.name.startsWith('sb-'));
  assert.ok(cookies.length > 0, 'a sessão está em cookie');
  for (const cookie of cookies) {
    assert.equal(cookie.httpOnly, true, `${cookie.name} é só do servidor`);
    assert.equal(cookie.sameSite, 'Lax', cookie.name);
  }
  assert.equal(await pagina.evaluate(() => document.cookie.includes('sb-')), false, 'a página não enxerga a sessão');
  // E a sessão continua valendo nas telas seguintes.
  await pagina.goto(`${base}/cuenta`);
  assert.equal(caminho(pagina), '/cuenta');
  await pagina.context().close();
});

test('a raiz leva cada um para o seu lugar, e endereço que não existe tem tela própria', async () => {
  const dela = await novaPagina(navegador);
  await entrar(dela, aluna.email, senha);
  await dela.waitForURL('**/inicio');
  await dela.goto(`${base}/`);
  assert.equal(caminho(dela), '/inicio', 'aluna');
  const resposta = await dela.goto(`${base}/esta-pagina-nao-existe`);
  assert.equal(resposta.status(), 404);
  await dela.getByRole('heading', { name: 'No encontramos esa página' }).waitFor();
  await dela.getByRole('link', { name: 'Volver al inicio' }).click();
  await dela.waitForURL('**/inicio');
  await dela.context().close();

  const dele = await novaPagina(navegador);
  await entrar(dele, professor.email, senha);
  await dele.waitForURL('**/admin');
  await dele.goto(`${base}/`);
  assert.equal(caminho(dele), '/admin', 'professor');
  await dele.context().close();
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
  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), 'Painel');
  assert.match(await pagina.locator('main').innerText(), /Você entrou como Professor\./);
  assert.equal(await pagina.getByRole('navigation', { name: 'Administração' }).getByRole('link', { name: 'Painel' }).getAttribute('aria-current'), 'page');
  await pagina.screenshot({ path: 'capturas/admin-computador.png', fullPage: true });
});

test('o primeiro administrador nasce das variáveis da instalação e entra na administração', async (t) => {
  const email = process.env.ADMIN_EMAIL;
  const clave = process.env.ADMIN_SENHA_INICIAL;
  if (!email || !clave) return t.skip('sem ADMIN_EMAIL e ADMIN_SENHA_INICIAL');

  // O aplicativo cria a conta ao subir; pode levar alguns segundos depois de o banco ficar pronto.
  let perfil = null;
  for (let tentativa = 0; tentativa < 40 && !perfil; tentativa += 1) {
    const { data } = await admin.from('perfis').select('papel').eq('email', email).maybeSingle();
    perfil = data;
    if (!perfil) await new Promise((feito) => setTimeout(feito, 1500));
  }
  assert.deepEqual(perfil, { papel: 'admin' });

  const pagina = await novaPagina(navegador);
  await entrar(pagina, email, clave);
  await pagina.waitForURL('**/admin');
  assert.match(await pagina.locator('main').innerText(), /Você entrou como Administrador\./);
});

test('ninguém se cadastra sozinho pelo Supabase', async () => {
  const publico = clientePublico();
  const { data, error } = await publico.auth.signUp({ email: emailDeTeste('intruso'), password: senha });
  assert.notEqual(error, null, 'o cadastro deveria ser recusado');
  assert.equal(data.user, null);
});

test('visitante sem login não lê nenhuma tabela pela API', async () => {
  const publico = clientePublico();
  for (const tabela of ['perfis', 'matriculas', 'aulas', 'perguntas', 'eventos_pagamento', 'notificacoes']) {
    const { data, error } = await publico.from(tabela).select('*').limit(1);
    assert.ok(error !== null || (data ?? []).length === 0, `${tabela} não pode devolver linhas a um visitante`);
  }
});
