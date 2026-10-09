import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acaoDoEvento, lerEventoGreenn, normalizarEmail, segredoConfere } from './greenn.ts';

// Formato do exemplo da documentação pública do webhook de vendas.
const venda = {
  oldStatus: 'waiting_payment',
  currentStatus: 'paid',
  type: 'sale',
  event: 'saleUpdated',
  product: { id: 5001, name: 'Curso', type: 'TRANSACTION', amount: 99 },
  sale: { id: 777, status: 'paid', method: 'CREDIT_CARD', client_id: 1 },
  seller: { id: 1, name: '', email: '' },
  client: { id: 1, name: ' Lucía Martín ', email: ' Lucia@Example.COM ', cellphone: '+34 600 000 000', cpf_cnpj: '', uf: '' },
  saleMetas: [],
};

const contrato = {
  currentStatus: 'paid',
  type: 'contract',
  event: 'contractUpdated',
  product: { id: 5002, type: 'SUBSCRIPTION' },
  currentSale: { id: 900, status: 'paid' },
  contract: { id: 888, status: 'paid', current_period_end: '2026-11-08 12:00:00' },
  client: { id: 2, name: 'Diego', email: 'diego@example.com', cellphone: '' },
};

function ler(corpo: unknown) {
  const r = lerEventoGreenn(corpo);
  assert.equal(r.ok, true, r.ok ? '' : r.motivo);
  if (!r.ok) throw new Error('inalcançável');
  return r.evento;
}

test('lê uma venda paga e normaliza o cliente', () => {
  const e = ler(venda);
  assert.equal(e.tipo, 'sale');
  assert.equal(e.status, 'paid');
  assert.equal(e.produtoId, 5001);
  assert.equal(e.vendaId, 777);
  assert.equal(e.assinatura, false);
  assert.deepEqual(e.cliente, { email: 'lucia@example.com', nome: 'Lucía Martín', telefone: '+34 600 000 000' });
});

test('comprador de fora do Brasil, sem CPF nem estado, é aceito', () => {
  const e = ler({ ...venda, client: { name: 'Ana', email: 'ana@example.es' } });
  assert.equal(e.cliente?.email, 'ana@example.es');
  assert.equal(e.cliente?.telefone, null);
});

test('lê um contrato de assinatura com o fim do período', () => {
  const e = ler(contrato);
  assert.equal(e.tipo, 'contract');
  assert.equal(e.assinatura, true);
  assert.equal(e.contratoId, 888);
  assert.equal(e.fimDoPeriodo, '2026-11-08 12:00:00');
});

test('recusa corpo que não é um evento reconhecível', () => {
  assert.deepEqual(lerEventoGreenn(null), { ok: false, motivo: 'corpo_invalido' });
  assert.deepEqual(lerEventoGreenn('texto'), { ok: false, motivo: 'corpo_invalido' });
  assert.deepEqual(lerEventoGreenn([venda]), { ok: false, motivo: 'corpo_invalido' });
  assert.deepEqual(lerEventoGreenn({ type: 'outro' }), { ok: false, motivo: 'tipo_desconhecido' });
});

test('recusa venda sem produto, sem cliente, sem id ou com e-mail inválido', () => {
  assert.deepEqual(lerEventoGreenn({ ...venda, product: {} }), { ok: false, motivo: 'produto_ausente' });
  assert.deepEqual(lerEventoGreenn({ ...venda, client: { name: 'Sem e-mail' } }), { ok: false, motivo: 'cliente_ausente' });
  assert.deepEqual(lerEventoGreenn({ ...venda, sale: {} }), { ok: false, motivo: 'venda_ausente' });
  assert.deepEqual(lerEventoGreenn({ ...venda, client: { email: 'sem-arroba' } }), { ok: false, motivo: 'email_invalido' });
  assert.deepEqual(lerEventoGreenn({ ...contrato, contract: {} }), { ok: false, motivo: 'contrato_ausente' });
});

test('carrinho abandonado é lido, mas não gera ação', () => {
  const e = ler({ type: 'lead', event: 'checkoutAbandoned', lead: { email: 'x@example.com', step: 1 }, product: { id: 5001 } });
  assert.equal(e.tipo, 'lead');
  assert.equal(acaoDoEvento(e), 'nenhuma');
});

test('a ação segue o status: mesma regra do banco', () => {
  const com = (base: object, status: string) => acaoDoEvento(ler({ ...base, currentStatus: status }));
  assert.equal(com(venda, 'paid'), 'liberar');
  assert.equal(com(venda, 'refunded'), 'encerrar');
  assert.equal(com(venda, 'chargedback'), 'encerrar');
  assert.equal(com(venda, 'waiting_payment'), 'nenhuma');
  assert.equal(com(venda, 'refused'), 'nenhuma');
  assert.equal(com(contrato, 'paid'), 'liberar');
  assert.equal(com(contrato, 'trialing'), 'liberar');
  assert.equal(com(contrato, 'unpaid'), 'ate_fim_do_periodo');
  assert.equal(com(contrato, 'canceled'), 'ate_fim_do_periodo');
  assert.equal(com(contrato, 'pending_payment'), 'nenhuma');
});

test('venda paga de produto de assinatura não libera: quem decide é o contrato', () => {
  const e = ler({ ...venda, product: { id: 5002, type: 'SUBSCRIPTION' } });
  assert.equal(acaoDoEvento(e), 'nenhuma');
});

test('normaliza e-mail e confere o segredo do webhook', () => {
  assert.equal(normalizarEmail('  Ana@Example.ES '), 'ana@example.es');
  assert.equal(segredoConfere('s3gr3d0-longo', 's3gr3d0-longo'), true);
  assert.equal(segredoConfere('s3gr3d0-longX', 's3gr3d0-longo'), false);
  assert.equal(segredoConfere('s3gr3d0', 's3gr3d0-longo'), false);
  assert.equal(segredoConfere('s3gr3d0-longo-extra', 's3gr3d0-longo'), false);
  assert.equal(segredoConfere('', 's3gr3d0-longo'), false);
  assert.equal(segredoConfere('', ''), false);
});
