import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { QuizDelAlumno } from '@/components/aluno/QuizDelAlumno';
import { IconoAtras } from '@/components/aluno/iconos';
import { Antetitulo, Tarjeta, TITULO_DE_PAGINA } from '@/components/aluno/ui';
import { es } from '@/i18n/es';
import { montarPainel } from '@/lib/aluno';
import { carregarAulaNoCurso, carregarQuiz } from '@/lib/aluno/dados';
import { ehEquipe } from '@/lib/papeis';
import { entregar, type LinhaDePergunta } from '@/lib/quiz-aluno';
import { clienteDeServico } from '@/lib/supabase/servico';
import { pessoaLogada } from '@/lib/supabase/servidor';

export const metadata: Metadata = { title: es.quiz.titulo };
// As opções são embaralhadas a cada visita: a página nunca é guardada pronta.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

// O quiz de uma aula. O aluno não lê a tabela de perguntas (ela guarda o gabarito): depois de
// conferir, com a sessão dele, que o quiz é de uma aula que ele pode ver, o servidor lê as
// perguntas e entrega só o que pode ir para o navegador.
export default async function PaginaDoQuiz({ params }: Props) {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  const { id } = await params;

  const quiz = await carregarQuiz(id);
  const contexto = quiz ? await carregarAulaNoCurso(quiz.aula_id) : null;
  if (!quiz || !contexto) redirect('/inicio?aviso=no_encontrada');
  const { aula, curso, progresso } = contexto;
  const equipe = ehEquipe(pessoa.papel);
  if (montarPainel(curso, progresso, equipe).fechados.has(quiz.id)) redirect(`/inicio?curso=${curso.curso.id}&aviso=bloqueada`);

  const { data: linhas } = await clienteDeServico().from('perguntas').select('id, tipo, conteudo').eq('quiz_id', quiz.id).order('ordem').order('id');
  const perguntas = entregar((linhas ?? []) as unknown as LinhaDePergunta[]);

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-5 lg:gap-6">
      <Link href={`/clase/${aula.id}`} className="-my-2 inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-semibold text-verde-link no-underline hover:text-verde">
        <IconoAtras />
        <span>{es.quiz.volverClase}</span>
      </Link>
      <header className="flex flex-col gap-1.5">
        <Antetitulo>
          {es.quiz.deLaClase} {aula.numero}
        </Antetitulo>
        <h1 className={TITULO_DE_PAGINA}>{aula.titulo_es}</h1>
      </header>
      {perguntas.length === 0 ? (
        <Tarjeta>
          <p className="text-base text-apoio">{es.quiz.sinPreguntas}</p>
        </Tarjeta>
      ) : (
        <QuizDelAlumno quizId={quiz.id} notaMinima={quiz.nota_minima} perguntas={perguntas} previa={equipe} />
      )}
    </div>
  );
}
