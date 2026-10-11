// Leitura dos eventos do webhook da Greenn.
// PROVISÓRIO: segue a documentação pública (vendas e contratos). Os campos serão
// conferidos com eventos reais na fase 0, antes de ir para produção.
// A gravação e a matrícula ficam no banco (registrar_evento_pagamento e
// aplicar_evento_pagamento); aqui só se decide o que o servidor precisa fazer.

export type TipoEvento = 'sale' | 'contract' | 'lead';

export type Cliente = {
  email: string;
  nome: string;
  telefone: string | null;
};

export type EventoGreenn = {
  tipo: TipoEvento;
  status: string | null;
  produtoId: number | null;
  assinatura: boolean;
  vendaId: number | null;
  contratoId: number | null;
  fimDoPeriodo: string | null;
  cliente: Cliente | null;
};

export type Leitura = { ok: true; evento: EventoGreenn } | { ok: false; motivo: string };

// O que o servidor faz depois de gravar o evento:
// - 'liberar': garante que o usuário existe, aplica o evento e envia o e-mail de acesso;
// - 'encerrar' e 'ate_fim_do_periodo': aplica o evento, sem e-mail de acesso;
// - 'nenhuma': só guarda o evento (pagamento pendente, recusado, carrinho abandonado).
export type Acao = 'liberar' | 'encerrar' | 'ate_fim_do_periodo' | 'nenhuma';

function objeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

function texto(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpo = valor.trim();
  return limpo === '' ? null : limpo;
}

function inteiro(valor: unknown): number | null {
  const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function lerEventoGreenn(corpo: unknown): Leitura {
  const raiz = objeto(corpo);
  if (!raiz) return { ok: false, motivo: 'corpo_invalido' };

  const tipo = texto(raiz.type);
  if (tipo !== 'sale' && tipo !== 'contract' && tipo !== 'lead') {
    return { ok: false, motivo: 'tipo_desconhecido' };
  }

  const produto = objeto(raiz.product);
  const venda = objeto(raiz.sale) ?? objeto(raiz.currentSale);
  const contrato = objeto(raiz.contract);
  const pessoa = objeto(raiz.client) ?? objeto(raiz.lead);

  let cliente: Cliente | null = null;
  const emailBruto = pessoa ? texto(pessoa.email) : null;
  if (emailBruto) {
    const email = normalizarEmail(emailBruto);
    if (!emailValido(email)) return { ok: false, motivo: 'email_invalido' };
    cliente = {
      email,
      nome: (pessoa && texto(pessoa.name)) ?? '',
      telefone: pessoa ? texto(pessoa.cellphone) : null,
    };
  }

  const evento: EventoGreenn = {
    tipo,
    status: texto(raiz.currentStatus),
    produtoId: produto ? inteiro(produto.id) : null,
    assinatura: (produto ? texto(produto.type) ?? '' : '').toUpperCase() === 'SUBSCRIPTION',
    vendaId: venda ? inteiro(venda.id) : null,
    contratoId: contrato ? inteiro(contrato.id) : null,
    fimDoPeriodo: contrato ? texto(contrato.current_period_end) : null,
    cliente,
  };

  if (tipo !== 'lead') {
    if (evento.produtoId === null) return { ok: false, motivo: 'produto_ausente' };
    if (evento.cliente === null) return { ok: false, motivo: 'cliente_ausente' };
    if (tipo === 'sale' && evento.vendaId === null) return { ok: false, motivo: 'venda_ausente' };
    if (tipo === 'contract' && evento.contratoId === null) return { ok: false, motivo: 'contrato_ausente' };
  }

  return { ok: true, evento };
}

// Mesma regra da função aplicar_evento_pagamento do banco.
export function acaoDoEvento(evento: EventoGreenn): Acao {
  if (evento.tipo === 'sale') {
    if (evento.status === 'paid' && !evento.assinatura) return 'liberar';
    if (evento.status === 'refunded' || evento.status === 'chargedback') return 'encerrar';
    return 'nenhuma';
  }
  if (evento.tipo === 'contract') {
    if (evento.status === 'paid' || evento.status === 'trialing') return 'liberar';
    if (evento.status === 'unpaid' || evento.status === 'canceled') return 'ate_fim_do_periodo';
    return 'nenhuma';
  }
  return 'nenhuma';
}

// Compara o segredo do endereço do webhook sem revelar, pelo tempo de resposta,
// quantos caracteres estavam certos.
export function segredoConfere(recebido: string, esperado: string): boolean {
  if (esperado.length === 0) return false;
  let diferenca = recebido.length ^ esperado.length;
  for (let i = 0; i < esperado.length; i += 1) {
    diferenca |= (recebido.charCodeAt(i % Math.max(recebido.length, 1)) || 0) ^ esperado.charCodeAt(i);
  }
  return diferenca === 0;
}

// ---------------------------------------------------------------------------
// O que fica guardado e como aparece na administração
// ---------------------------------------------------------------------------

// O aviso da Greenn traz documento, endereço e telefone do comprador, dados do boleto e do Pix,
// e os rastros de anúncio da venda (saleMetas). A plataforma não usa nada disso, então esses
// campos saem antes de o aviso ser guardado. O resto fica como veio.
const CAMPOS_QUE_NAO_FICAM = new Set([
  'cpf_cnpj', 'document', 'document_type', 'street', 'number', 'complement', 'neighborhood', 'zipcode', 'city', 'uf', 'cellphone', 'phone',
  'boleto_url', 'boleto_barcode', 'boleto_expiration_date', 'qrcode', 'imgQrcode',
  'saleMetas', 'productMetas', 'proposalMetas', 'sf_trk', 'description',
]);
const PROFUNDIDADE_MAX = 8;

export function semDadosSensiveis(valor: unknown, nivel = 0): unknown {
  if (valor === null || typeof valor !== 'object') return valor;
  if (nivel >= PROFUNDIDADE_MAX) return null;
  if (Array.isArray(valor)) return valor.map((item) => semDadosSensiveis(item, nivel + 1));
  const limpo: Record<string, unknown> = {};
  for (const [chave, item] of Object.entries(valor)) {
    if (!CAMPOS_QUE_NAO_FICAM.has(chave)) limpo[chave] = semDadosSensiveis(item, nivel + 1);
  }
  return limpo;
}

const NOME_DO_AVISO: Record<string, string> = {
  'sale:paid': 'Venda paga',
  'sale:refunded': 'Venda reembolsada',
  'sale:chargedback': 'Venda estornada pelo cartão',
  'sale:refused': 'Pagamento recusado',
  'sale:waiting_payment': 'Aguardando pagamento',
  'contract:paid': 'Assinatura paga',
  'contract:trialing': 'Assinatura em período de teste',
  'contract:pending_payment': 'Assinatura aguardando pagamento',
  'contract:unpaid': 'Assinatura sem pagamento',
  'contract:canceled': 'Assinatura cancelada',
};

export function nomeDoAviso(tipo: string, status: string | null): string {
  if (tipo === 'lead') return 'Carrinho abandonado';
  return NOME_DO_AVISO[`${tipo}:${status ?? ''}`] ?? `${tipo}${status ? ` (${status})` : ''}`;
}

// Como o aviso ficou depois de recebido. "pendente" é o que a administração precisa olhar:
// o aviso está guardado e pode ser processado de novo depois de corrigir a causa.
export type SituacaoDoAviso = { pendente: boolean; texto: string };

const MOTIVO_PENDENTE: Record<string, string> = {
  oferta_desconhecida: 'Produto sem oferta cadastrada (ou com a oferta desativada)',
  conta_nao_criada: 'Não foi possível criar a conta da pessoa',
  falha_ao_aplicar: 'Não foi possível gravar a matrícula',
  corpo_invalido: 'Aviso em formato inesperado',
  email_invalido: 'O e-mail do comprador não é um endereço válido',
  produto_ausente: 'O aviso veio sem o produto',
  cliente_ausente: 'O aviso veio sem o comprador',
  venda_ausente: 'O aviso veio sem o número da venda',
  contrato_ausente: 'O aviso veio sem o número da assinatura',
};

export function situacaoDoAviso(aviso: { processado_em: string | null; erro: string | null }): SituacaoDoAviso {
  if (aviso.processado_em !== null) {
    if (aviso.erro === 'aluno_desconhecido') return { pendente: false, texto: 'Processado: não havia conta com esse e-mail' };
    if (aviso.erro === 'dispensado') return { pendente: false, texto: 'Dispensado pela administração' };
    if (aviso.erro === 'tipo_desconhecido') return { pendente: false, texto: 'Guardado: tipo de aviso que a plataforma não usa' };
    return { pendente: false, texto: 'Processado' };
  }
  if (aviso.erro === null) return { pendente: true, texto: 'Recebido, ainda não processado' };
  return { pendente: true, texto: MOTIVO_PENDENTE[aviso.erro] ?? `Não processado (${aviso.erro})` };
}
