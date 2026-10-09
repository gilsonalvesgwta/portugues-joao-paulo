// Teste de ponta a ponta do primeiro acesso e da nova senha por link.
// Os e-mails não são enviados: o aplicativo os grava em arquivo (EMAIL_DRIVER=arquivo)
// e o teste lê o link de lá, como o aluno leria na caixa de entrada.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { admin, base, caminho, criarPessoa, emailDeTeste, emailsPara, entrar, linkDoEmail, novaPagina, senha, textoDoAviso } from './apoio.mjs';

const CONFIRMACAO = 'Si ese correo tiene una compra, acabamos de enviarle un enlace. Revisa tu bandeja de entrada y la carpeta de spam.';
const LINK_INVALIDO = 'El enlace no es válido o ya caducó. Pide uno nuevo.';

// Conta recém-criada pela compra: existe, mas ainda não tem senha.
const compradora = { email: emailDeTeste('compradora'), nome: 'Ana Compradora', comSenha: false };
const esquecida = { email: emailDeTeste('esquecida'), nome: 'Marta Olvido' };
const insistente = { email: emailDeTeste('insistente'), nome: 'Pedro Insiste' };

let navegador;

async function pedirLink(pagina, rota, email) {
  await pagina.goto(`${base}${rota}`);
  await pagina.getByLabel('Correo electrónico de tu compra').fill(email);
  await pagina.getByRole('button', { name: 'Enviar enlace' }).click();
  await pagina.waitForURL(`**${rota}?enviado=1`);
}

async function definirSenha(pagina, nova, repetida) {
  await pagina.getByLabel('Contraseña nueva', { exact: true }).fill(nova);
  await pagina.getByLabel('Repite la contraseña', { exact: true }).fill(repetida);
  await pagina.getByRole('button', { name: 'Guardar y entrar' }).click();
}

before(async () => {
  await mkdir('capturas', { recursive: true });
  navegador = await chromium.launch();
  await criarPessoa(compradora);
  await criarPessoa(esquecida);
  await criarPessoa(insistente);
});

after(async () => {
  await navegador?.close();
});

test('e-mail sem conta recebe a mesma resposta na tela, e nenhum e-mail sai', async () => {
  const desconhecido = emailDeTeste('desconhecido');
  const pagina = await novaPagina(navegador);
  await pedirLink(pagina, '/primer-acceso', desconhecido);
  assert.equal(await textoDoAviso(pagina, 'status'), CONFIRMACAO);
  assert.equal((await emailsPara(desconhecido)).length, 0);
});

test('primeiro acesso: recebe o link, cria a senha, entra e a senha vale no login', async () => {
  const pagina = await novaPagina(navegador);
  await pedirLink(pagina, '/primer-acceso', compradora.email);
  assert.equal(await textoDoAviso(pagina, 'status'), CONFIRMACAO);

  const emails = await emailsPara(compradora.email);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].asunto, 'Tu acceso al curso de portugués');
  assert.ok(emails[0].texto.startsWith('Hola, Ana Compradora:'));
  const link = linkDoEmail(emails[0]);

  await pagina.goto(link);
  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), 'Ya casi está');
  await pagina.screenshot({ path: 'capturas/confirmar-computador.png', fullPage: true });
  await pagina.getByRole('button', { name: 'Continuar' }).click();
  await pagina.waitForURL('**/nueva-contrasena');
  await pagina.screenshot({ path: 'capturas/nueva-contrasena-computador.png', fullPage: true });

  await definirSenha(pagina, 'minha-senha-nova-1', 'minha-senha-nova-2');
  await pagina.waitForURL('**/nueva-contrasena?error=distintas');
  assert.equal(await textoDoAviso(pagina), 'Las contraseñas no coinciden.');

  await definirSenha(pagina, 'minha-senha-nova-1', 'minha-senha-nova-1');
  await pagina.waitForURL('**/inicio');
  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), 'Hola, Ana');

  await pagina.getByRole('button', { name: 'Salir' }).click();
  await pagina.waitForURL('**/entrar');
  await entrar(pagina, compradora.email, 'minha-senha-nova-1');
  await pagina.waitForURL('**/inicio');

  // O mesmo link, usado de novo em outro navegador, não vale mais.
  const outra = await novaPagina(navegador);
  await outra.goto(link);
  await outra.getByRole('button', { name: 'Continuar' }).click();
  await outra.waitForURL('**/recuperar?error=enlace');
  assert.equal(await textoDoAviso(outra), LINK_INVALIDO);
  await outra.goto(`${base}/inicio`);
  assert.equal(caminho(outra), '/entrar', 'link gasto não abre sessão');
});

test('nova senha: abrir o link sem clicar não o gasta; a senha antiga deixa de valer', async () => {
  const pagina = await novaPagina(navegador);
  await pedirLink(pagina, '/recuperar', esquecida.email);
  const emails = await emailsPara(esquecida.email);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].asunto, 'Restablece tu contraseña');
  const link = linkDoEmail(emails[0]);

  // Programas de e-mail costumam visitar os links sozinhos, antes da pessoa.
  for (let i = 0; i < 2; i += 1) {
    const visita = await fetch(link, { redirect: 'manual' });
    assert.equal(visita.status, 200, 'a visita automática só vê a tela com o botão');
  }

  await pagina.goto(link);
  await pagina.getByRole('button', { name: 'Continuar' }).click();
  await pagina.waitForURL('**/nueva-contrasena');
  await definirSenha(pagina, 'outra-senha-456', 'outra-senha-456');
  await pagina.waitForURL('**/inicio');

  const outra = await novaPagina(navegador);
  await entrar(outra, esquecida.email, senha);
  await outra.waitForURL('**/entrar?error=credenciales');
  await entrar(outra, esquecida.email, 'outra-senha-456');
  await outra.waitForURL('**/inicio');
});

test('link inventado é recusado', async () => {
  const pagina = await novaPagina(navegador);
  await pagina.goto(`${base}/auth/confirmar?token_hash=inventado123`);
  await pagina.getByRole('button', { name: 'Continuar' }).click();
  await pagina.waitForURL('**/recuperar?error=enlace');
  assert.equal(await textoDoAviso(pagina), LINK_INVALIDO);

  await pagina.goto(`${base}/auth/confirmar`);
  await pagina.waitForURL('**/recuperar?error=enlace');
});

test('no máximo 3 links por e-mail em 10 minutos, sem mudar a resposta na tela', async () => {
  const pagina = await novaPagina(navegador);
  for (let i = 0; i < 5; i += 1) {
    await pedirLink(pagina, '/recuperar', insistente.email);
    assert.equal(await textoDoAviso(pagina, 'status'), CONFIRMACAO);
  }
  assert.equal((await emailsPara(insistente.email)).length, 3);

  const { count } = await admin
    .from('notificacoes')
    .select('id', { count: 'exact', head: true })
    .eq('tipo', 'enlace_acceso')
    .eq('destinatario', insistente.email);
  assert.equal(count, 3, 'o histórico registra só os envios feitos');
});

test('o histórico de envios não guarda o link', async () => {
  const { data, error } = await admin.from('notificacoes').select('dados').eq('destinatario', compradora.email);
  assert.equal(error, null, error?.message);
  assert.ok(data.length >= 1);
  assert.equal(JSON.stringify(data).includes('token'), false);
});
