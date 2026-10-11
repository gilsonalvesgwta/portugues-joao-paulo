import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acaoDoEvento, lerEventoGreenn, nomeDoAviso, normalizarEmail, segredoConfere, semDadosSensiveis, situacaoDoAviso } from './greenn.ts';

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

// Mesmos campos de um aviso de venda de verdade (recebido em outubro de 2026), com dados inventados.
const vendaDeVerdade = {
  type: 'sale', event: 'saleUpdated', oldStatus: 'paid', currentStatus: 'paid',
  sale: {
    id: 10000001, type: 'TRANSACTION', status: 'paid', created_at: '2026-10-10T18:18:30.000000Z', updated_at: '2026-10-10T18:18:32.000000Z',
    seller_id: 900001, installments: 4, method: 'CREDIT_CARD', client_id: 6000001, fee: 2.98, seller_balance: 36.72, total: 43.12, amount: 39.7,
    proposal_id: null, subscription_id: null, boleto_url: 'https://boleto.exemplo.test/abc', boleto_barcode: '0000', boleto_expiration_date: null,
    qrcode: '000201', imgQrcode: 'data:image/png;base64,AAAA', paid_at: '2026-10-10T18:18:31.000000Z', bump_id: null, is_smart_sale: 0,
    shipping_amount: null, shipping_selected: null, base_currency_id: 1, coupon: null,
  },
  currency_id: 1, currency: 'BRL',
  client: {
    id: 6000001, name: 'Pessoa de Exemplo', email: 'Pessoa.Exemplo@Exemplo.test', cellphone: '+5500000000000', document: '000.000.000-00',
    zipcode: null, street: '', number: '', complement: '', neighborhood: '', city: '', uf: '',
    created_at: '2026-10-10T18:18:30.000000Z', updated_at: '2026-10-10T18:18:30.000000Z', document_type: 'cpf', cpf_cnpj: '000.000.000-00',
  },
  product: {
    id: 180001, name: 'Produto de exemplo', description: 'Texto longo de venda.', type: 'TRANSACTION', amount: 39.7, period: 30,
    thank_you_page: 'https://exemplo.test/obrigado', method: 'CREDIT_CARD,BOLETO,PIX', url_callback: null, trial: null, is_active: 1, deleted_at: null,
  },
  oferta: 'Produto de exemplo',
  offer: { hash: 'aBcDeF', amount: 39.7, method: 'CREDIT_CARD,BOLETO,PIX', name: 'Produto de exemplo', created_at: '2026-08-13T11:09:16.000000Z' },
  seller: { id: 900001, name: 'Vendedor', email: 'vendedor@exemplo.test', cellphone: '+5500000000001' },
  affiliate: null,
  productMetas: { utm_source: '{get.utm_source}' },
  proposalMetas: [],
  saleMetas: [{ id: 1, sale_id: 10000001, meta_key: 'fbp', meta_value: 'fb.2.0.0' }, { id: 2, sale_id: 10000001, meta_key: 'authorization', meta_value: '000000' }],
  sf_trk: null,
  client_has_contract_id: null,
};

test('aviso de venda no formato de verdade: é lido, libera o acesso e é guardado sem o que é sensível', () => {
  const guardado = semDadosSensiveis(vendaDeVerdade) as Record<string, Record<string, unknown>>;
  assert.deepEqual(guardado.client, {
    id: 6000001, name: 'Pessoa de Exemplo', email: 'Pessoa.Exemplo@Exemplo.test',
    created_at: '2026-10-10T18:18:30.000000Z', updated_at: '2026-10-10T18:18:30.000000Z',
  });
  const texto = JSON.stringify(guardado);
  for (const sensivel of ['000.000.000-00', '+5500000000000', 'boleto.exemplo.test', 'data:image', 'fb.2.0.0', 'Texto longo de venda']) {
    assert.equal(texto.includes(sensivel), false, sensivel);
  }
  assert.equal('saleMetas' in guardado, false);
  assert.equal(guardado.offer?.hash, 'aBcDeF', 'o código da oferta fica, para conferência');

  const evento = ler(guardado);
  assert.deepEqual(evento, {
    tipo: 'sale', status: 'paid', produtoId: 180001, assinatura: false, vendaId: 10000001, contratoId: null, fimDoPeriodo: null,
    cliente: { email: 'pessoa.exemplo@exemplo.test', nome: 'Pessoa de Exemplo', telefone: null },
  });
  assert.equal(acaoDoEvento(evento), 'liberar');
});

test('documento, endereço e telefone do comprador saem antes de o aviso ser guardado', () => {
  const bruto = {
    type: 'sale', currentStatus: 'paid',
    product: { id: 5001, name: 'Curso', number: 3 },
    sale: { id: 777, amount: 99, coupon: { id: 1, name: 'BEMVINDO' } },
    seller: { id: 1, name: 'Vendedor', email: 'vendedor@exemplo.com', cellphone: '+5511999990000' },
    client: {
      id: 1, name: 'Lucía Martín', email: 'lucia@exemplo.com', cellphone: '+34600000000', cpf_cnpj: '00000000000',
      street: 'Calle Mayor', number: '10', complement: '2B', neighborhood: 'Centro', zipcode: '28001', city: 'Madrid', uf: 'MD',
    },
    saleMetas: [{ id: 1, meta_key: 'utm_source', meta_value: 'instagram', phone: '123' }],
  };
  const limpo = semDadosSensiveis(bruto);
  assert.deepEqual(limpo, {
    type: 'sale', currentStatus: 'paid',
    product: { id: 5001, name: 'Curso' },
    sale: { id: 777, amount: 99, coupon: { id: 1, name: 'BEMVINDO' } },
    seller: { id: 1, name: 'Vendedor', email: 'vendedor@exemplo.com' },
    client: { id: 1, name: 'Lucía Martín', email: 'lucia@exemplo.com' },
  });
  // O que o servidor precisa continua lá.
  const lido = lerEventoGreenn(limpo);
  assert.equal(lido.ok && lido.evento.cliente?.email, 'lucia@exemplo.com');
  assert.equal(lido.ok && lido.evento.vendaId, 777);
  assert.equal(semDadosSensiveis('texto'), 'texto');
  assert.equal(semDadosSensiveis(null), null);
  // Um aviso aninhado demais não derruba o servidor: o excesso é cortado.
  let fundo: Record<string, unknown> = { fim: true };
  for (let i = 0; i < 50; i += 1) fundo = { dentro: fundo };
  assert.equal(JSON.stringify(semDadosSensiveis(fundo)).includes('fim'), false);
});

test('nome do aviso e situação, como aparecem na administração', () => {
  assert.equal(nomeDoAviso('sale', 'paid'), 'Venda paga');
  assert.equal(nomeDoAviso('sale', 'chargedback'), 'Venda estornada pelo cartão');
  assert.equal(nomeDoAviso('contract', 'canceled'), 'Assinatura cancelada');
  assert.equal(nomeDoAviso('lead', null), 'Carrinho abandonado');
  assert.equal(nomeDoAviso('sale', 'novo_status'), 'sale (novo_status)');
  assert.equal(nomeDoAviso('outro', null), 'outro');

  assert.deepEqual(situacaoDoAviso({ processado_em: '2026-10-10T12:00:00Z', erro: null }), { pendente: false, texto: 'Processado' });
  assert.deepEqual(situacaoDoAviso({ processado_em: '2026-10-10T12:00:00Z', erro: 'aluno_desconhecido' }), {
    pendente: false, texto: 'Processado: não havia conta com esse e-mail',
  });
  assert.deepEqual(situacaoDoAviso({ processado_em: '2026-10-10T12:00:00Z', erro: 'dispensado' }), { pendente: false, texto: 'Dispensado pela administração' });
  assert.deepEqual(situacaoDoAviso({ processado_em: '2026-10-10T12:00:00Z', erro: 'tipo_desconhecido' }), {
    pendente: false, texto: 'Guardado: tipo de aviso que a plataforma não usa',
  });
  assert.deepEqual(situacaoDoAviso({ processado_em: null, erro: 'oferta_desconhecida' }), {
    pendente: true, texto: 'Produto sem oferta cadastrada (ou com a oferta desativada)',
  });
  assert.deepEqual(situacaoDoAviso({ processado_em: null, erro: null }), { pendente: true, texto: 'Recebido, ainda não processado' });
  assert.deepEqual(situacaoDoAviso({ processado_em: null, erro: 'coisa_nova' }), { pendente: true, texto: 'Não processado (coisa_nova)' });
});
