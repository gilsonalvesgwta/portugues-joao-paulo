// Apoio aos testes de ponta a ponta: cliente de serviço do Supabase, criação de pessoas
// de teste, passos comuns no navegador e leitura dos e-mails gravados em arquivo.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

export const base = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
export const url = process.env.SUPABASE_URL;
export const chavePublica = process.env.SUPABASE_ANON_KEY;
const chaveDeServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && chavePublica && chaveDeServico, 'faltam as variáveis do Supabase (veja .env.example)');

export const admin = createClient(url, chaveDeServico, { auth: { persistSession: false, autoRefreshToken: false } });
export const senha = 'senha-de-teste-123';

// Cada arquivo de teste usa e-mails próprios, para poder rodar ao mesmo tempo que os outros.
export function emailDeTeste(prefixo) {
  return `${prefixo}-${randomBytes(5).toString('hex')}@exemplo.test`;
}

// Com senha: pessoa que já usa a plataforma. Sem senha: como a conta nasce depois da compra.
export async function criarPessoa({ email, nome = '', papel = 'aluno', comSenha = true }) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { nome },
    ...(comSenha ? { password: senha } : {}),
  });
  assert.equal(error, null, `criar ${email}: ${error?.message}`);
  if (papel !== 'aluno') {
    const { error: erroPapel } = await admin.from('perfis').update({ papel }).eq('id', data.user.id);
    assert.equal(erroPapel, null, `definir papel: ${erroPapel?.message}`);
  }
  return data.user.id;
}

// Os testes não dependem de sites de fora: a prévia do YouTube fica sem carregar.
export async function novoContexto(navegador, largura = 1280, altura = 800) {
  const contexto = await navegador.newContext({ viewport: { width: largura, height: altura } });
  await contexto.route(/^https?:\/\/([^/]+\.)?(youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com)\//, (rota) => rota.abort());
  return contexto;
}

export async function novaPagina(navegador) {
  return (await novoContexto(navegador)).newPage();
}

export async function entrar(pagina, email, clave) {
  await pagina.goto(`${base}/entrar`);
  await pagina.getByLabel('Correo electrónico de tu compra').fill(email);
  await pagina.getByLabel('Tu contraseña', { exact: true }).fill(clave);
  await pagina.getByRole('button', { name: 'Acceder a mis clases' }).click();
}

export function caminho(pagina) {
  return new URL(pagina.url()).pathname;
}

export async function textoDoAviso(pagina, papel = 'alert') {
  return pagina.locator(`main [role="${papel}"]`).first().innerText();
}

// E-mails gravados pelo aplicativo (EMAIL_DRIVER=arquivo) para um destinatário, do mais antigo ao mais novo.
export async function emailsPara(destinatario) {
  const pasta = process.env.EMAIL_PASTA;
  assert.ok(pasta, 'falta EMAIL_PASTA');
  let nomes = [];
  try {
    nomes = (await readdir(pasta)).filter((n) => n.endsWith('.json')).sort();
  } catch {
    return [];
  }
  const emails = [];
  for (const nome of nomes) {
    const email = JSON.parse(await readFile(join(pasta, nome), 'utf8'));
    if (email.para === destinatario) emails.push(email);
  }
  return emails;
}

export function linkDoEmail(email) {
  const achado = email.texto.match(/https?:\/\/\S+\/auth\/confirmar\?token_hash=\S+/);
  assert.ok(achado, 'o e-mail deveria trazer o link de confirmação');
  return achado[0];
}
