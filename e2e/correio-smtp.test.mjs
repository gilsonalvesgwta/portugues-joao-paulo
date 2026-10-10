// Envio de e-mail por SMTP, de verdade: o mesmo código que a produção usa manda a mensagem
// para a caixa de teste (Mailpit, que sobe junto com o Supabase local) e o teste lê o que chegou.
// A caixa de teste não pede senha nem cifra; usuário, senha e cifra são conferidos na instalação,
// com o botão "Enviar e-mail de teste" do painel.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emailDeTeste } from './apoio.mjs';
import { emailBienvenida } from '../src/lib/emails.ts';
import { motivoDaFalha } from '../src/lib/smtp.ts';

const caixa = process.env.CAIXA_DE_TESTE_URL;
const portaSmtp = process.env.CAIXA_DE_TESTE_SMTP;
assert.ok(caixa && portaSmtp, 'faltam CAIXA_DE_TESTE_URL e CAIXA_DE_TESTE_SMTP');

// O aplicativo dos outros testes usa EMAIL_DRIVER=arquivo; aqui o envio é chamado direto, por SMTP.
process.env.EMAIL_DRIVER = 'smtp';
process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = portaSmtp;
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.EMAIL_REMETENTE = 'aulas@exemplo.test';
process.env.EMAIL_NOME_REMETENTE = 'Português com João Paulo';
const { enviarEmail } = await import('../src/lib/correio.ts');

async function mensagemPara(destinatario) {
  for (let tentativa = 0; tentativa < 20; tentativa += 1) {
    const busca = await fetch(`${caixa}/api/v1/search?query=${encodeURIComponent(`to:${destinatario}`)}`);
    assert.equal(busca.status, 200, 'a caixa de teste deveria responder');
    const { messages } = await busca.json();
    if (messages.length > 0) {
      const inteira = await fetch(`${caixa}/api/v1/message/${messages[0].ID}`);
      return inteira.json();
    }
    await new Promise((feito) => setTimeout(feito, 250));
  }
  assert.fail(`nenhuma mensagem chegou para ${destinatario}`);
}

test('o e-mail de boas-vindas chega com remetente, assunto com acento, texto e HTML', async () => {
  const destinatario = emailDeTeste('smtp');
  const enlace = 'https://aulas.exemplo.test/auth/confirmar?token_hash=abc123';
  await enviarEmail(destinatario, emailBienvenida({ nombre: 'Lucía Peña', enlace }));

  const mensagem = await mensagemPara(destinatario);
  assert.equal(mensagem.Subject, 'Tu acceso al curso de portugués');
  assert.equal(mensagem.From.Name, 'Português com João Paulo');
  assert.equal(mensagem.From.Address, 'aulas@exemplo.test');
  assert.equal(mensagem.To.length, 1);
  assert.equal(mensagem.To[0].Address, destinatario);
  assert.ok(mensagem.Text.startsWith('Hola, Lucía Peña:'), 'o texto chega com os acentos certos');
  assert.ok(mensagem.Text.includes(enlace), 'o link chega inteiro no texto');
  assert.ok(mensagem.HTML.includes('Crear mi contraseña'), 'a versão em HTML chega junto');
  assert.ok(mensagem.HTML.includes('token_hash=abc123'));
});

test('só aceita um destinatário: quebra de linha, vírgula e nome com <> são recusados sem enviar', async () => {
  const intruso = emailDeTeste('intruso');
  const email = emailBienvenida({ nombre: 'Ana', enlace: 'https://aulas.exemplo.test/x' });
  for (const para of [
    `${emailDeTeste('a')}\r\nBcc: ${intruso}`,
    `${emailDeTeste('b')},${intruso}`,
    `${emailDeTeste('c')}; ${intruso}`,
    `Ana <${intruso}>`,
    '',
  ]) {
    await assert.rejects(enviarEmail(para, email), JSON.stringify(para));
  }
  const lista = await (await fetch(`${caixa}/api/v1/messages?limit=200`)).json();
  assert.equal(JSON.stringify(lista.messages).includes(intruso), false, 'o endereço a mais não recebe nada');
});

test('servidor fora do ar vira falha de conexão, sem travar', async () => {
  process.env.SMTP_PORT = '9'; // porta sem ninguém ouvindo
  const inicio = Date.now();
  let erro = null;
  try {
    await enviarEmail(emailDeTeste('ninguem'), emailBienvenida({ nombre: 'Ana', enlace: 'https://aulas.exemplo.test/x' }));
  } catch (falha) {
    erro = falha;
  }
  process.env.SMTP_PORT = portaSmtp;
  assert.notEqual(erro, null, 'deveria falhar');
  assert.equal(motivoDaFalha(erro), 'conexao');
  assert.ok(Date.now() - inicio < 15_000, 'falha rápido');
});

test('configuração incompleta é recusada antes de tentar enviar', async () => {
  process.env.EMAIL_REMETENTE = '';
  let erro = null;
  try {
    await enviarEmail(emailDeTeste('ninguem'), emailBienvenida({ nombre: 'Ana', enlace: 'https://aulas.exemplo.test/x' }));
  } catch (falha) {
    erro = falha;
  }
  process.env.EMAIL_REMETENTE = 'aulas@exemplo.test';
  assert.equal(motivoDaFalha(erro), 'configuracao');
});
