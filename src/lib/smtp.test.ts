import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configDoSmtp, ErroDeConfiguracao, motivoDaFalha } from './smtp.ts';

const hostinger = { SMTP_HOST: 'smtp.hostinger.com', SMTP_USER: 'aulas@exemplo.com', SMTP_PASS: ' senha com espaço ' };

test('configuração típica da caixa de e-mail: porta 465 cifrada, remetente igual ao usuário', () => {
  assert.deepEqual(configDoSmtp(hostinger), {
    host: 'smtp.hostinger.com',
    porta: 465,
    cifradaDesdeOInicio: true,
    exigirCifra: true,
    usuario: 'aulas@exemplo.com',
    senha: ' senha com espaço ',
    remetente: 'aulas@exemplo.com',
    nomeDoRemetente: 'Português com João Paulo',
  });
});

test('porta 587 começa aberta e exige cifrar antes da senha', () => {
  const c = configDoSmtp({ ...hostinger, SMTP_PORT: '587', EMAIL_REMETENTE: 'contato@exemplo.com', EMAIL_NOME_REMETENTE: 'João Paulo' });
  assert.equal(c.porta, 587);
  assert.equal(c.cifradaDesdeOInicio, false);
  assert.equal(c.exigirCifra, true);
  assert.equal(c.remetente, 'contato@exemplo.com');
  assert.equal(c.nomeDoRemetente, 'João Paulo');
});

test('no próprio computador (testes) dispensa senha e cifra', () => {
  const c = configDoSmtp({ SMTP_HOST: '127.0.0.1', SMTP_PORT: '54325', EMAIL_REMETENTE: 'teste@exemplo.test' });
  assert.equal(c.usuario, null);
  assert.equal(c.senha, null);
  assert.equal(c.exigirCifra, false);
});

test('o que falta ou está errado vira erro de configuração com mensagem clara', () => {
  const casos: [Record<string, string>, RegExp][] = [
    [{}, /Falta SMTP_HOST/],
    [{ ...hostinger, SMTP_PORT: 'abc' }, /SMTP_PORT/],
    [{ ...hostinger, SMTP_PORT: '70000' }, /SMTP_PORT/],
    [{ SMTP_HOST: 'smtp.hostinger.com' }, /Faltam SMTP_USER e SMTP_PASS/],
    [{ SMTP_HOST: 'smtp.hostinger.com', SMTP_USER: 'aulas@exemplo.com' }, /andam juntos/],
    [{ ...hostinger, EMAIL_REMETENTE: 'sem-arroba' }, /EMAIL_REMETENTE/],
    [{ SMTP_HOST: '127.0.0.1' }, /EMAIL_REMETENTE/],
  ];
  for (const [ambiente, mensagem] of casos) {
    assert.throws(() => configDoSmtp(ambiente), (erro) => erro instanceof ErroDeConfiguracao && mensagem.test(erro.message), JSON.stringify(Object.keys(ambiente)));
  }
});

test('a mensagem de erro nunca traz a senha', () => {
  try {
    configDoSmtp({ ...hostinger, SMTP_PASS: 'segredo-123', EMAIL_REMETENTE: 'errado' });
    assert.fail('deveria falhar');
  } catch (erro) {
    assert.equal(String((erro as Error).message).includes('segredo-123'), false);
  }
});

test('motivoDaFalha traduz o código do erro de envio', () => {
  assert.equal(motivoDaFalha(new ErroDeConfiguracao('x')), 'configuracao');
  assert.equal(motivoDaFalha({ code: 'EAUTH' }), 'senha');
  assert.equal(motivoDaFalha({ code: 'ETIMEDOUT' }), 'conexao');
  assert.equal(motivoDaFalha({ code: 'ECONNREFUSED' }), 'conexao');
  assert.equal(motivoDaFalha({ code: 'EENVELOPE' }), 'recusado');
  assert.equal(motivoDaFalha(new Error('qualquer')), 'outro');
  assert.equal(motivoDaFalha(null), 'outro');
});
