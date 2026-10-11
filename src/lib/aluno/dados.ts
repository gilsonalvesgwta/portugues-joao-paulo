import { cache } from 'react';
import { SEM_PROGRESSO, type CursoDoAluno, type Progresso } from '@/lib/aluno';
import { lerAnotacoes, paraPrevia, type Bloco } from '@/lib/anotacoes';
import { ehUuid } from '@/lib/conteudo';
import { clienteDoServidor } from '@/lib/supabase/servidor';

// Leitura para as telas do aluno. Tudo com a sessão de quem está logado: as regras do banco só
// entregam o curso em que a pessoa está matriculada (ou qualquer curso, para a equipe, que usa
// estas telas para ver a plataforma como o aluno vê).

export type CursoDaLista = { id: string; titulo_pt: string; titulo_es: string; tipo: string };

// Cursos publicados que a pessoa pode abrir, na ordem de exibição (os principais primeiro).
export const cursosVisiveis = cache(async (): Promise<CursoDaLista[]> => {
  const supabase = await clienteDoServidor();
  const { data, error } = await supabase
    .from('cursos')
    .select('id, titulo_pt, titulo_es, tipo')
    .eq('situacao', 'publicado')
    .is('arquivado_em', null)
    .order('ordem')
    .order('criado_em');
  if (error) throw new Error(`No se pudo leer la lista de cursos: ${error.message}`);
  const cursos = (data ?? []) as unknown as CursoDaLista[];
  return [...cursos.filter((curso) => curso.tipo === 'principal'), ...cursos.filter((curso) => curso.tipo !== 'principal')];
});

// O curso inteiro como o aluno o vê, e o que ele já fez. null se o curso não existe para ele.
export const carregarCurso = cache(async (cursoId: string): Promise<{ curso: CursoDoAluno; progresso: Progresso } | null> => {
  if (!ehUuid(cursoId)) return null;
  const supabase = await clienteDoServidor();
  const [conteudo, feito] = await Promise.all([
    supabase.rpc('curso_do_aluno', { p_curso: cursoId }),
    supabase.rpc('meu_progresso', { p_curso: cursoId }),
  ]);
  if (conteudo.error) throw new Error(`No se pudo leer el curso: ${conteudo.error.message}`);
  if (!conteudo.data) return null;
  return {
    curso: conteudo.data as unknown as CursoDoAluno,
    progresso: feito.error || !feito.data ? SEM_PROGRESSO : (feito.data as unknown as Progresso),
  };
});

export type Material = { id: string; titulo_es: string; descricao_es: string | null; link: string };

// Materiais do curso inteiro (os que não são de nenhuma aula). As regras do banco só entregam
// os de curso que a pessoa pode ver.
export async function carregarMateriaisDoCurso(cursoId: string): Promise<Material[]> {
  if (!ehUuid(cursoId)) return [];
  const supabase = await clienteDoServidor();
  const { data } = await supabase
    .from('materiais')
    .select('id, titulo_es, descricao_es, link')
    .eq('curso_id', cursoId)
    .is('aula_id', null)
    .order('ordem')
    .order('id');
  return (data ?? []) as unknown as Material[];
}

export type AulaDoAluno = {
  id: string;
  curso_id: string;
  modulo_id: string;
  numero: number;
  titulo_pt: string;
  titulo_es: string;
  video_id: string | null;
  duracao_seg: number | null;
  blocos: Bloco[];
  materiais: Material[];
};

// Uma aula publicada, com as anotações e os materiais. null se a pessoa não pode vê-la.
export async function carregarAula(aulaId: string): Promise<AulaDoAluno | null> {
  if (!ehUuid(aulaId)) return null;
  const supabase = await clienteDoServidor();
  const { data: aula } = await supabase
    .from('aulas')
    .select('id, modulo_id, numero, titulo_pt, titulo_es, video_id, duracao_seg, anotacoes')
    .eq('id', aulaId)
    .eq('situacao', 'publicado')
    .is('arquivado_em', null)
    .maybeSingle();
  if (!aula) return null;

  const [modulo, materiais] = await Promise.all([
    supabase.from('modulos').select('curso_id').eq('id', aula.modulo_id).is('arquivado_em', null).maybeSingle(),
    supabase.from('materiais').select('id, titulo_es, descricao_es, link').eq('aula_id', aulaId).order('ordem').order('id'),
  ]);
  if (typeof modulo.data?.curso_id !== 'string') return null;

  return {
    id: aula.id as string,
    curso_id: modulo.data.curso_id,
    modulo_id: aula.modulo_id as string,
    numero: Number(aula.numero),
    titulo_pt: String(aula.titulo_pt),
    titulo_es: String(aula.titulo_es),
    video_id: typeof aula.video_id === 'string' ? aula.video_id : null,
    duracao_seg: typeof aula.duracao_seg === 'number' ? aula.duracao_seg : null,
    blocos: paraPrevia(lerAnotacoes(aula.anotacoes)),
    materiais: (materiais.data ?? []) as unknown as Material[],
  };
}

// A aula com o curso dela e o que a pessoa já fez nele. É o que a tela da aula, a do quiz e as
// ações precisam para saber se a aula está aberta para a pessoa.
export async function carregarAulaNoCurso(aulaId: string): Promise<{ aula: AulaDoAluno; curso: CursoDoAluno; progresso: Progresso } | null> {
  const aula = await carregarAula(aulaId);
  if (!aula) return null;
  const carregado = await carregarCurso(aula.curso_id);
  if (!carregado || !carregado.curso.aulas.some((item) => item.id === aula.id)) return null;
  return { aula, curso: carregado.curso, progresso: carregado.progresso };
}

export type QuizDoAluno = { id: string; aula_id: string; nota_minima: number };

// Um quiz publicado que a pessoa pode ver. As perguntas não vêm aqui: quem as lê é o servidor.
export async function carregarQuiz(quizId: string): Promise<QuizDoAluno | null> {
  if (!ehUuid(quizId)) return null;
  const supabase = await clienteDoServidor();
  const { data } = await supabase.from('quizzes').select('id, aula_id, nota_minima').eq('id', quizId).eq('situacao', 'publicado').maybeSingle();
  return data ? (data as unknown as QuizDoAluno) : null;
}
