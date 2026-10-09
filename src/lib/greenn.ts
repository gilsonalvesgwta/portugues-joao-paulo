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
