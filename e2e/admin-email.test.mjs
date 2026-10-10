// O botão "Enviar e-mail de teste" do painel da administração.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { criarPessoa, emailDeTeste, emailsPara, entrar, novaPagina, senha, textoDoAviso } from './apoio.mjs';

const admin = { email: emailDeTeste('admin-email'), nome: 'Admin Correio', papel: 'admin' };
let navegador;

before(async () => {
  navegador = await chromium.launch();
  await criarPessoa(admin);
});

after(async () => {
  await navegador?.close();
});

test('o painel manda um e-mail de teste para quem está logado', async () => {
  const pagina = await novaPagina(navegador);
  await entrar(pagina, admin.email, senha);
  await pagina.waitForURL('**/admin');
  await pagina.getByRole('button', { name: 'Enviar e-mail de teste' }).click();
  await pagina.waitForURL('**/admin?aviso=email_enviado');
  assert.equal(await textoDoAviso(pagina, 'status'), 'E-mail de teste enviado. Confira a sua caixa de entrada e a pasta de spam.');

  const emails = await emailsPara(admin.email);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].asunto, 'Teste de envio de e-mail');
  assert.ok(emails[0].texto.includes('o envio de e-mails está funcionando'));
});
