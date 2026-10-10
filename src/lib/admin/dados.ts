import { clienteDoServidor } from '@/lib/supabase/servidor';
import type { Situacao } from '@/lib/conteudo';

// Leitura do conteúdo para as telas da administração. Usa a sessão de quem está logado,
// então as regras de acesso do banco valem: só a equipe recebe rascunhos e itens da lixeira.

export type Curso = {
  id: string;
  titulo_pt: string;
  titulo_es: string;
  tipo: 'principal' | 'complementar';
  situacao: Situacao;
  modo: 'livre' | 'sequencial';
  ordem: number;
  arquivado_em: string | null;
};

export type Modulo = {
  id: string;
  curso_id: string;
  ordem: number;
  titulo_pt: string;
  titulo_es: string;
  arquivado_em: string | null;
};

export type Aula = {
  id: string;
  modulo_id: string;
  numero: number;
  titulo_pt: string;
  titulo_es: string;
  video_id: string | null;
  duracao_seg: number | null;
  situacao: Situacao;
  arquivado_em: string | null;
  atualizado_em: string;
};

export type Conteudo = { cursos: Curso[]; modulos: Modulo[]; aulas: Aula[] };

export const COLUNAS_DO_CURSO = 'id, titulo_pt, titulo_es, tipo, situacao, modo, ordem, arquivado_em';
export const COLUNAS_DO_MODULO = 'id, curso_id, ordem, titulo_pt, titulo_es, arquivado_em';
export const COLUNAS_DA_AULA = 'id, modulo_id, numero, titulo_pt, titulo_es, video_id, duracao_seg, situacao, arquivado_em, atualizado_em';

// Tudo de uma vez: são poucas centenas de linhas, e as telas cruzam cursos, módulos e aulas.
export async function carregarConteudo(): Promise<Conteudo> {
  const supabase = await clienteDoServidor();
  const [cursos, modulos, aulas] = await Promise.all([
    supabase.from('cursos').select(COLUNAS_DO_CURSO).order('ordem').order('criado_em'),
    supabase.from('modulos').select(COLUNAS_DO_MODULO).order('ordem'),
    supabase.from('aulas').select(COLUNAS_DA_AULA).order('numero'),
  ]);
  const erro = cursos.error ?? modulos.error ?? aulas.error;
  if (erro) throw new Error(`Não foi possível ler o conteúdo: ${erro.message}`);
  return {
    cursos: (cursos.data ?? []) as unknown as Curso[],
    modulos: (modulos.data ?? []) as unknown as Modulo[],
    aulas: (aulas.data ?? []) as unknown as Aula[],
  };
}

export function ativos<T extends { arquivado_em: string | null }>(lista: readonly T[]): T[] {
  return lista.filter((item) => item.arquivado_em === null);
}

// Módulos fora da lixeira agrupados por curso (também fora da lixeira), na ordem de exibição.
export function modulosPorCurso(conteudo: Conteudo): { curso: Curso; modulos: Modulo[] }[] {
  const modulos = ativos(conteudo.modulos);
  return ativos(conteudo.cursos).map((curso) => ({
    curso,
    modulos: modulos.filter((modulo) => modulo.curso_id === curso.id),
  }));
}

export type AulaComAnotacoes = {
  id: string;
  numero: number;
  titulo_pt: string;
  titulo_es: string;
  anotacoes: unknown;
};

// Uma aula (fora da lixeira) com as anotações. As anotações não entram em carregarConteudo
// porque são o campo mais pesado e só duas telas precisam delas.
export async function carregarAulaComAnotacoes(id: string): Promise<AulaComAnotacoes | null> {
  const supabase = await clienteDoServidor();
  const { data, error } = await supabase
    .from('aulas')
    .select('id, numero, titulo_pt, titulo_es, anotacoes')
    .eq('id', id)
    .is('arquivado_em', null)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível ler a aula: ${error.message}`);
  return (data ?? null) as unknown as AulaComAnotacoes | null;
}

// Quantos blocos de anotação cada aula tem, para a lista de aulas.
export async function blocosPorAula(): Promise<Map<string, number>> {
  const supabase = await clienteDoServidor();
  const { data, error } = await supabase.from('aulas').select('id, anotacoes').is('arquivado_em', null);
  if (error) throw new Error(`Não foi possível ler as anotações: ${error.message}`);
  const linhas = (data ?? []) as unknown as { id: string; anotacoes: unknown }[];
  return new Map(linhas.map((linha) => [linha.id, Array.isArray(linha.anotacoes) ? linha.anotacoes.length : 0]));
}
