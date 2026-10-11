import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarTentativas, REGRA_DE_ENTRADA, tentativasDeEntrada } from './tentativas.ts';

const MIN = 60 * 1000;

function comRelogio(regra = { maximo: 3, janelaMs: 10 * MIN }) {
  let agora = 1_000_000;
  const tentativas = criarTentativas(regra, () => agora);
  return { tentativas, passar: (ms: number) => void (agora += ms) };
}

test('bloqueia só depois do número de falhas da regra, e só aquele e-mail', () => {
  const { tentativas } = comRelogio();
  tentativas.registrarFalha('ana@exemplo.test');
  tentativas.registrarFalha('ana@exemplo.test');
  assert.equal(tentativas.bloqueado('ana@exemplo.test'), false);
  tentativas.registrarFalha('ana@exemplo.test');
  assert.equal(tentativas.bloqueado('ana@exemplo.test'), true);
  assert.equal(tentativas.bloqueado('bia@exemplo.test'), false);
});

test('o bloqueio acaba quando as falhas saem do tempo da regra', () => {
  const { tentativas, passar } = comRelogio();
  tentativas.registrarFalha('ana@exemplo.test');
  passar(6 * MIN);
  tentativas.registrarFalha('ana@exemplo.test');
  tentativas.registrarFalha('ana@exemplo.test');
  assert.equal(tentativas.bloqueado('ana@exemplo.test'), true);
  passar(4 * MIN + 1); // a primeira falha fez 10 minutos
  assert.equal(tentativas.bloqueado('ana@exemplo.test'), false);
  tentativas.registrarFalha('ana@exemplo.test');
  assert.equal(tentativas.bloqueado('ana@exemplo.test'), true);
  passar(10 * MIN + 1);
  assert.equal(tentativas.bloqueado('ana@exemplo.test'), false);
  assert.equal(tentativas.contas(), 0, 'contagem vencida sai da memória');
});

test('entrar com a senha certa zera a contagem', () => {
  const { tentativas } = comRelogio();
  tentativas.registrarFalha('ana@exemplo.test');
  tentativas.registrarFalha('ana@exemplo.test');
  tentativas.limpar('ana@exemplo.test');
  tentativas.registrarFalha('ana@exemplo.test');
  tentativas.registrarFalha('ana@exemplo.test');
  assert.equal(tentativas.bloqueado('ana@exemplo.test'), false);
});

test('a memória tem teto: saem as contagens vencidas e depois as mais antigas', () => {
  const { tentativas, passar } = comRelogio({ maximo: 3, janelaMs: 10 * MIN, contasMax: 3 });
  tentativas.registrarFalha('velha@exemplo.test');
  passar(11 * MIN);
  for (const nome of ['a', 'b', 'c']) tentativas.registrarFalha(`${nome}@exemplo.test`);
  assert.equal(tentativas.contas(), 3);
  tentativas.registrarFalha('d@exemplo.test');
  assert.equal(tentativas.contas(), 3);
  tentativas.registrarFalha('d@exemplo.test');
  tentativas.registrarFalha('d@exemplo.test');
  assert.equal(tentativas.bloqueado('d@exemplo.test'), true, 'a mais recente continua contada');
});

test('a regra de entrada é de 8 falhas em 15 minutos, e a contagem do servidor é uma só', () => {
  assert.deepEqual(REGRA_DE_ENTRADA, { maximo: 8, janelaMs: 15 * MIN });
  assert.equal(tentativasDeEntrada(), tentativasDeEntrada());
});
