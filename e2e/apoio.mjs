// Apoio aos testes de ponta a ponta: cliente de serviço do Supabase, criação de pessoas
// de teste, passos comuns no navegador e leitura dos e-mails gravados em arquivo.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { configDeServico, configDoSupabase } from '../src/lib/supabase/config.ts';

export const base = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
// Os testes acham o login e os dados do mesmo jeito que o aplicativo (Supabase completo ou
// banco próprio), usando a mesma configuração.
const servico = configDeServico();
const publica = configDoSupabase();

export const admin = createClient(servico.url, servico.chaveDeServico, {
  ...servico.opcoes,
  auth: { persistSession: false, autoRefreshToken: false },
});

// Cliente como o de um visitante ou aluno: só a chave pública, sujeito às regras do banco.
export function clientePublico() {
  return createClient(publica.url, publica.chavePublica, { ...publica.opcoes, auth: { persistSession: false } });
}
export const senha = 'senha-de-teste-123';

// Cada arquivo de teste usa e-mails próprios, para poder rodar ao mesmo tempo que os outros.
export function emailDeTeste(prefixo) {
  return `${prefixo}-${randomBytes(5).toString('hex')}@exemplo.test`;
}

// Com senha: pessoa que já usa a plataforma. Sem senha: como a conta nasce depois da compra.
// "fusoConfirmado": a pessoa já passou pela confirmação do fuso horário (o fuso fica o do cadastro,
// Madri). Com false, a conta fica como nasce de verdade, e a área do aluno pede a confirmação.
export async function criarPessoa({ email, nome = '', papel = 'aluno', comSenha = true, fusoConfirmado = true }) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { nome },
    ...(comSenha ? { password: senha } : {}),
  });
  assert.equal(error, null, `criar ${email}: ${error?.message}`);
  const mudancas = { ...(papel !== 'aluno' ? { papel } : {}), ...(fusoConfirmado ? { fuso_confirmado_em: new Date().toISOString() } : {}) };
  if (Object.keys(mudancas).length > 0) {
    const { error: erroDoPerfil } = await admin.from('perfis').update(mudancas).eq('id', data.user.id);
    assert.equal(erroDoPerfil, null, `ajustar o perfil: ${erroDoPerfil?.message}`);
  }
  return data.user.id;
}

// A primeira tela de quem entra na área do aluno: confirmar o fuso horário. Escolhe o fuso pedido
// e segue para o início.
export async function confirmarZona(pagina, zona = 'Europe/Madrid') {
  await pagina.waitForURL('**/zona-horaria');
  await pagina.getByLabel('Tu zona horaria').selectOption(zona);
  await pagina.getByRole('button', { name: 'Confirmar zona horaria' }).click();
  await pagina.waitForURL('**/inicio');
}

// Os testes não dependem de sites de fora: a prévia do YouTube fica sem carregar.
export async function novoContexto(navegador, largura = 1280, altura = 800, opcoes = {}) {
  // Na passagem pelo Traefik de teste, o certificado é o de fábrica dele (não há um de verdade
  // para um endereço inventado): só nesse caso o navegador aceita certificado sem conferir.
  const contexto = await navegador.newContext({ viewport: { width: largura, height: altura }, ignoreHTTPSErrors: process.env.E2E_CERTIFICADO_DE_TESTE === '1', ...opcoes });
  await contexto.route(/^https?:\/\/([^/]+\.)?(youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com)\//, (rota) => rota.abort());
  return contexto;
}

export async function novaPagina(navegador) {
  return (await novoContexto(navegador)).newPage();
}

export async function entrar(pagina, email, clave) {
  await pagina.goto(`${base}/entrar`);
  await pagina.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await pagina.getByLabel('Contraseña', { exact: true }).fill(clave);
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
