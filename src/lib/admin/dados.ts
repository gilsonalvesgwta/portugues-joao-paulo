import { clienteDoServidor } from '@/lib/supabase/servidor';
import type { Situacao } from '@/lib/conteudo';
import { doBancoParaTrilha, type DiaDaTrilha, type Disponivel } from '@/lib/trilha-editor';

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

export type Material = {
  id: string;
  aula_id: string | null;
  titulo_pt: string;
  titulo_es: string;
  descricao_es: string | null;
  link: string;
  ordem: number;
};

const COLUNAS_DO_MATERIAL = 'id, aula_id, titulo_pt, titulo_es, descricao_es, link, ordem';

// Materiais de apoio de uma aula, na ordem em que o aluno os vê.
export async function carregarMateriaisDaAula(aulaId: string): Promise<Material[]> {
  const supabase = await clienteDoServidor();
  const { data, error } = await supabase.from('materiais').select(COLUNAS_DO_MATERIAL).eq('aula_id', aulaId).order('ordem').order('id');
  if (error) throw new Error(`Não foi possível ler os materiais: ${error.message}`);
  return (data ?? []) as unknown as Material[];
}

export async function carregarMaterial(id: string): Promise<Material | null> {
  const supabase = await clienteDoServidor();
  const { data, error } = await supabase.from('materiais').select(COLUNAS_DO_MATERIAL).eq('id', id).maybeSingle();
  if (error) throw new Error(`Não foi possível ler o material: ${error.message}`);
  return (data ?? null) as unknown as Material | null;
}

export type QuizDaAula = {
  dificuldade: 'facil' | 'medio' | 'dificil';
  nota_minima: number;
  situacao: Situacao;
  perguntas: { tipo: string; conteudo: unknown }[];
};

// O quiz de uma aula com as perguntas em ordem, ou null se a aula ainda não tem quiz.
// Só a equipe recebe as perguntas: elas guardam o gabarito.
export async function carregarQuizDaAula(aulaId: string): Promise<QuizDaAula | null> {
  const supabase = await clienteDoServidor();
  const { data: quiz, error } = await supabase
    .from('quizzes')
    .select('id, dificuldade, nota_minima, situacao')
    .eq('aula_id', aulaId)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível ler o quiz: ${error.message}`);
  if (!quiz) return null;
  const { data: perguntas, error: erroDasPerguntas } = await supabase
    .from('perguntas')
    .select('tipo, conteudo')
    .eq('quiz_id', quiz.id)
    .order('ordem');
  if (erroDasPerguntas) throw new Error(`Não foi possível ler as perguntas: ${erroDasPerguntas.message}`);
  return {
    dificuldade: quiz.dificuldade as QuizDaAula['dificuldade'],
    nota_minima: Number(quiz.nota_minima),
    situacao: quiz.situacao as Situacao,
    perguntas: (perguntas ?? []) as unknown as QuizDaAula['perguntas'],
  };
}

export type ResumoDoQuiz = { perguntas: number; situacao: Situacao };

// Quantas perguntas tem o quiz de cada aula, para a lista de aulas e a tela da aula.
// A contagem vem pronta do banco (função resumo_dos_quizzes), uma linha por quiz.
export async function quizzesPorAula(): Promise<Map<string, ResumoDoQuiz>> {
  const supabase = await clienteDoServidor();
  const { data, error } = await supabase.rpc('resumo_dos_quizzes');
  if (error) throw new Error(`Não foi possível ler os quizzes: ${error.message}`);
  const linhas = (data ?? []) as unknown as { aula_id: string; situacao: Situacao; perguntas: number }[];
  return new Map(linhas.map((linha) => [linha.aula_id, { perguntas: Number(linha.perguntas), situacao: linha.situacao }]));
}

export type Tarefa = {
  id: string;
  curso_id: string;
  aula_id: string | null;
  titulo_es: string;
  instrucao_es: string;
  link: string | null;
  arquivado_em: string | null;
};

const COLUNAS_DA_TAREFA = 'id, curso_id, aula_id, titulo_es, instrucao_es, link, arquivado_em';

// Todas as tarefas, inclusive as da lixeira (as telas filtram com "ativos").
export async function carregarTarefas(): Promise<Tarefa[]> {
  const supabase = await clienteDoServidor();
  const { data, error } = await supabase.from('tarefas').select(COLUNAS_DA_TAREFA).order('titulo_es');
  if (error) throw new Error(`Não foi possível ler as tarefas: ${error.message}`);
  return (data ?? []) as unknown as Tarefa[];
}

// Aulas (fora da lixeira) de um curso, em ordem de número.
export function aulasDoCurso(conteudo: Conteudo, cursoId: string): Aula[] {
  const modulos = new Set(conteudo.modulos.filter((modulo) => modulo.curso_id === cursoId).map((modulo) => modulo.id));
  return ativos(conteudo.aulas)
    .filter((aula) => modulos.has(aula.modulo_id))
    .sort((a, b) => a.numero - b.numero);
}

// Curso a que uma aula pertence, ou null.
export function cursoDaAula(conteudo: Conteudo, aulaId: string): string | null {
  const moduloId = conteudo.aulas.find((aula) => aula.id === aulaId)?.modulo_id;
  return conteudo.modulos.find((modulo) => modulo.id === moduloId)?.curso_id ?? null;
}

// Tudo o que pode entrar na trilha de um curso: as aulas, os quizzes dessas aulas e as tarefas,
// sempre fora da lixeira. É também a lista usada para conferir o que o editor manda gravar.
export async function carregarDisponiveis(cursoId: string): Promise<Disponivel[]> {
  const supabase = await clienteDoServidor();
  const [conteudo, tarefas, quizzes] = await Promise.all([
    carregarConteudo(),
    carregarTarefas(),
    supabase.from('quizzes').select('id, aula_id, situacao'),
  ]);
  if (quizzes.error) throw new Error(`Não foi possível ler os quizzes: ${quizzes.error.message}`);
  const aulas = aulasDoCurso(conteudo, cursoId);
  const aulaPorId = new Map(aulas.map((aula) => [aula.id, aula]));

  const disponiveis: Disponivel[] = aulas.map((aula) => ({
    tipo: 'aula',
    alvo: aula.id,
    rotulo: `Aula ${aula.numero} — ${aula.titulo_pt}`,
    aulaId: aula.id,
    numeroDaAula: aula.numero,
    publicado: aula.situacao === 'publicado',
  }));
  for (const quiz of (quizzes.data ?? []) as unknown as { id: string; aula_id: string; situacao: Situacao }[]) {
    const aula = aulaPorId.get(quiz.aula_id);
    if (!aula) continue;
    disponiveis.push({
      tipo: 'quiz',
      alvo: quiz.id,
      rotulo: `Quiz da aula ${aula.numero}`,
      aulaId: aula.id,
      numeroDaAula: aula.numero,
      publicado: quiz.situacao === 'publicado' && aula.situacao === 'publicado',
    });
  }
  for (const tarefa of ativos(tarefas)) {
    if (tarefa.curso_id !== cursoId) continue;
    const aula = tarefa.aula_id ? aulaPorId.get(tarefa.aula_id) : undefined;
    disponiveis.push({
      tipo: 'tarefa',
      alvo: tarefa.id,
      rotulo: `Tarefa: ${tarefa.titulo_es}`,
      aulaId: aula?.id ?? null,
      numeroDaAula: aula?.numero ?? null,
      publicado: true,
    });
  }
  return disponiveis;
}

// A trilha gravada de um curso, pronta para o editor.
export async function carregarTrilha(cursoId: string): Promise<DiaDaTrilha[]> {
  const supabase = await clienteDoServidor();
  const { data, error } = await supabase.rpc('ler_trilha', { p_curso: cursoId });
  if (error) throw new Error(`Não foi possível ler a trilha: ${error.message}`);
  return doBancoParaTrilha(data);
}
