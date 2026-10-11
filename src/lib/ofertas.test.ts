import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prazoDaOferta, validarOferta } from './ofertas.ts';

const curso = '11111111-2222-3333-4444-555555555555';
const boa = { nome: ' Acesso  anual ', greenn_product_id: ' 12345 ', curso_id: curso, dias_de_acesso: '365', inclui_conversacao: 'on', reservas_por_semana: '2', ativa: 'on' };

test('oferta completa: nome arrumado, números lidos, caixas marcadas', () => {
  assert.deepEqual(validarOferta(boa), {
    ok: true,
    valor: { nome: 'Acesso anual', greenn_product_id: 12345, curso_id: curso, dias_de_acesso: 365, inclui_conversacao: true, reservas_por_semana: 2, ativa: true },
  });
});

test('sem prazo, sem conversação e desativada', () => {
  assert.deepEqual(validarOferta({ ...boa, dias_de_acesso: '', inclui_conversacao: '', reservas_por_semana: 'tanto faz', ativa: '' }), {
    ok: true,
    valor: { nome: 'Acesso anual', greenn_product_id: 12345, curso_id: curso, dias_de_acesso: null, inclui_conversacao: false, reservas_por_semana: 0, ativa: false },
  });
});

test('cada campo errado ganha a sua mensagem', () => {
  const r = validarOferta({ nome: '', greenn_product_id: 'abc', curso_id: 'x', dias_de_acesso: '0', inclui_conversacao: 'on', reservas_por_semana: '15' });
  assert.equal(r.ok, false);
  assert.deepEqual(!r.ok && r.erros, {
    nome: 'Escreva um nome para reconhecer a oferta.',
    greenn_product_id: 'Escreva o código do produto na Greenn: só números.',
    curso_id: 'Escolha o curso que a compra libera.',
    dias_de_acesso: 'Escreva um número de 1 a 3660, ou deixe em branco para acesso sem prazo.',
    reservas_por_semana: 'Escreva um número de 0 a 14.',
  });
  for (const codigo of ['', '0', '-5', '1.5', '12 34', '1234567890123456']) {
    assert.equal(validarOferta({ ...boa, greenn_product_id: codigo }).ok, false, codigo);
  }
  for (const dias of ['-1', '3661', '1,5', 'um ano']) assert.equal(validarOferta({ ...boa, dias_de_acesso: dias }).ok, false, dias);
  assert.equal(validarOferta({ ...boa, nome: 'a'.repeat(121) }).ok, false);
});

test('prazo por extenso', () => {
  assert.equal(prazoDaOferta(null), 'acesso sem prazo');
  assert.equal(prazoDaOferta(1), '1 dia de acesso');
  assert.equal(prazoDaOferta(365), '365 dias de acesso');
});
