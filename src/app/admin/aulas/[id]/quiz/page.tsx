import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { EditorDeQuiz } from '@/components/admin/EditorDeQuiz';
import { TituloDaPagina, Trilha } from '@/components/admin/ui';
import { carregarAulaComAnotacoes, carregarQuizDaAula } from '@/lib/admin/dados';
import { ehUuid } from '@/lib/conteudo';
import { doBanco, QUIZ_VAZIO } from '@/lib/quiz-editor';

export const metadata: Metadata = { title: 'Quiz da aula' };

type Props = { params: Promise<{ id: string }> };

export default async function PaginaQuiz({ params }: Props) {
  const { id } = await params;
  const aula = ehUuid(id) ? await carregarAulaComAnotacoes(id) : null;
  if (!aula) redirect('/admin/aulas?aviso=nao_encontrado');
  const quiz = await carregarQuizDaAula(aula.id);

  return (
    <>
      <Trilha href={`/admin/aulas/${aula.id}`} rotulo={`Editar aula ${aula.numero}`} />
      <TituloDaPagina
        titulo={`Quiz da aula ${aula.numero}`}
        texto={`${aula.titulo_pt}. O aluno responde depois de assistir à aula. Em rascunho, o quiz não aparece para ele.`}
      />
      <EditorDeQuiz
        aulaId={aula.id}
        numero={aula.numero}
        existeNoInicio={quiz !== null}
        publicadoNoInicio={quiz?.situacao === 'publicado'}
        inicial={quiz ? { dificuldade: quiz.dificuldade, nota_minima: quiz.nota_minima, perguntas: doBanco(quiz.perguntas) } : QUIZ_VAZIO}
      />
    </>
  );
}
