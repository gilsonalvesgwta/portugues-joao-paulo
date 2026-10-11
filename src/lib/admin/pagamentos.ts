import { clienteDoServidor } from '@/lib/supabase/servidor';

// Leitura das ofertas e dos avisos de pagamento para a tela de pagamentos. Usa a sessão de quem
// está logado: as regras do banco só entregam essas tabelas ao administrador.

export type Oferta = {
  id: string;
  greenn_product_id: number;
  curso_id: string;
  nome: string;
  dias_de_acesso: number | null;
  inclui_conversacao: boolean;
  reservas_por_semana: number;
  ativa: boolean;
};

const COLUNAS_DA_OFERTA = 'id, greenn_product_id, curso_id, nome, dias_de_acesso, inclui_conversacao, reservas_por_semana, ativa';

export async function carregarOfertas(): Promise<Oferta[]> {
  const supabase = await clienteDoServidor();
  const { data, error } = await supabase.from('ofertas').select(COLUNAS_DA_OFERTA).order('criado_em');
  if (error) throw new Error(`Não foi possível ler as ofertas: ${error.message}`);
  return (data ?? []) as unknown as Oferta[];
}

export async function carregarOferta(id: string): Promise<Oferta | null> {
  const supabase = await clienteDoServidor();
  const { data, error } = await supabase.from('ofertas').select(COLUNAS_DA_OFERTA).eq('id', id).maybeSingle();
  if (error) throw new Error(`Não foi possível ler a oferta: ${error.message}`);
  return data ? (data as unknown as Oferta) : null;
}

export type Aviso = {
  id: number;
  recebido_em: string;
  tipo: string;
  status_atual: string | null;
  processado_em: string | null;
  erro: string | null;
  aluno_id: string | null;
  email: string | null;
  nome: string | null;
  produto: string | null;
  produto_id: string | null;
};

export const AVISOS_POR_PAGINA = 50;

// Do aviso guardado, a tela só precisa de quem comprou e de qual produto.
const COLUNAS_DO_AVISO =
  'id, recebido_em, tipo, status_atual, processado_em, erro, aluno_id, ' +
  'email:payload->client->>email, nome:payload->client->>name, produto:payload->product->>name, produto_id:payload->product->>id';

export async function carregarAvisos(soPendentes: boolean, pagina: number): Promise<{ total: number; avisos: Aviso[] }> {
  const supabase = await clienteDoServidor();
  const inicio = (pagina - 1) * AVISOS_POR_PAGINA;
  let consulta = supabase.from('eventos_pagamento').select(COLUNAS_DO_AVISO, { count: 'exact' });
  if (soPendentes) consulta = consulta.is('processado_em', null);
  const { data, count, error } = await consulta.order('id', { ascending: false }).range(inicio, inicio + AVISOS_POR_PAGINA - 1);
  // Pedir uma página além do fim não é erro: a tela volta para a última.
  if (error && error.code !== 'PGRST103') throw new Error(`Não foi possível ler os avisos de pagamento: ${error.message}`);
  return { total: count ?? 0, avisos: (data ?? []) as unknown as Aviso[] };
}

export async function contarPendentes(): Promise<number> {
  const supabase = await clienteDoServidor();
  const { count } = await supabase.from('eventos_pagamento').select('id', { count: 'exact', head: true }).is('processado_em', null);
  return count ?? 0;
}
