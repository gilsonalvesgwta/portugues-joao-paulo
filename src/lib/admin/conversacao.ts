import { lerAprendizados, lerConfiguracoes, type Configuracoes } from '@/lib/conversacao';
import { clienteDoServidor } from '@/lib/supabase/servidor';

// Leitura dos temas e das turmas de conversação para as telas da equipe. Usa a sessão de quem
// está logado. O link da sala não é lido direto na tabela de turmas: vem pelas funções do banco,
// que só respondem à equipe.

export type Tema = {
  id: string;
  titulo_es: string;
  nivel: string;
  descricao_es: string | null;
  aprendizados: string[];
  material: string | null;
  arquivado_em: string | null;
};

const COLUNAS_DO_TEMA = 'id, titulo_es, nivel, descricao_es, aprendizados, material, arquivado_em';
const ORDEM_DOS_NIVEIS: Record<string, number> = { basico: 1, intermediario: 2, avancado: 3 };

function paraTema(linha: Record<string, unknown>): Tema {
  return { ...(linha as unknown as Tema), aprendizados: lerAprendizados(linha.aprendizados) };
}

// Todos os temas (inclusive os arquivados), por nível e depois por título.
export async function carregarTemas(): Promise<Tema[]> {
  const supabase = await clienteDoServidor();
  const { data, error } = await supabase.from('temas_conversacao').select(COLUNAS_DO_TEMA).order('titulo_es');
  if (error) throw new Error(`Não foi possível ler os temas: ${error.message}`);
  return ((data ?? []) as unknown as Record<string, unknown>[])
    .map(paraTema)
    .sort((a, b) => (ORDEM_DOS_NIVEIS[a.nivel] ?? 9) - (ORDEM_DOS_NIVEIS[b.nivel] ?? 9));
}

export async function carregarTema(id: string): Promise<Tema | null> {
  const supabase = await clienteDoServidor();
  const { data, error } = await supabase.from('temas_conversacao').select(COLUNAS_DO_TEMA).eq('id', id).maybeSingle();
  if (error) throw new Error(`Não foi possível ler o tema: ${error.message}`);
  return data ? paraTema(data as unknown as Record<string, unknown>) : null;
}

export type TurmaDaLista = {
  id: string;
  inicio: string;
  duracao_min: number;
  vagas: number;
  situacao: string;
  titulo_es: string;
  nivel: string;
  reservas: number;
};

export const TURMAS_POR_PAGINA = 50;

export async function carregarTurmas(quando: 'proximas' | 'passadas', pagina: number): Promise<{ total: number; turmas: TurmaDaLista[] }> {
  const supabase = await clienteDoServidor();
  const { data, error } = await supabase.rpc('lista_de_turmas', {
    p_quando: quando,
    p_limite: TURMAS_POR_PAGINA,
    p_pulo: (pagina - 1) * TURMAS_POR_PAGINA,
  });
  if (error) throw new Error(`Não foi possível ler as turmas: ${error.message}`);
  const lido = (data ?? {}) as { total?: number; turmas?: TurmaDaLista[] };
  return { total: Number(lido.total ?? 0), turmas: lido.turmas ?? [] };
}

export type Inscrito = {
  reserva_id: string;
  aluno_id: string;
  nome: string;
  email: string;
  criada_em: string;
  presente: boolean | null;
  nota: number | null;
  comentario: string | null;
};

export type TurmaCompleta = {
  turma: { id: string; tema_id: string; inicio: string; duracao_min: number; vagas: number; situacao: string; meet_url: string | null };
  tema: { titulo_es: string; nivel: string };
  reservas: Inscrito[];
};

export async function carregarTurma(id: string): Promise<TurmaCompleta | null> {
  const supabase = await clienteDoServidor();
  const { data, error } = await supabase.rpc('turma_da_equipe', { p_turma: id });
  if (error) throw new Error(`Não foi possível ler a turma: ${error.message}`);
  return data ? (data as unknown as TurmaCompleta) : null;
}

export async function carregarConfiguracoes(): Promise<Configuracoes> {
  const supabase = await clienteDoServidor();
  const { data } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', ['agenda_janela_dias', 'reserva_fecha_min_antes', 'cancelamento_min_antes']);
  return lerConfiguracoes((data ?? []) as unknown as { chave: string; valor: unknown }[]);
}
