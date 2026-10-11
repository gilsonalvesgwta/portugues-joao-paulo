import type { Metadata } from 'next';
import { AvisoDaPagina, Botao, Cartao, LinkBotao, Selecao, TituloDaPagina } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { ativos, aulasDoCurso, carregarConteudo, carregarTarefas } from '@/lib/admin/dados';

export const metadata: Metadata = { title: 'Tarefas' };

type Texto = string | string[] | undefined;
type Props = { searchParams: Promise<{ aviso?: Texto; curso?: Texto }> };

// "relative" prende à área que rola os textos só para leitor de tela da tabela.
const classeDaTabela = 'relative overflow-x-auto rounded-2xl border border-linha bg-cartao';

export default async function PaginaTarefas({ searchParams }: Props) {
  const { aviso, curso: pedido } = await searchParams;
  const [conteudo, todas] = await Promise.all([carregarConteudo(), carregarTarefas()]);
  const cursos = ativos(conteudo.cursos);
  const curso = cursos.find((item) => item.id === pedido) ?? cursos[0];

  if (!curso) {
    return (
      <>
        <TituloDaPagina titulo="Tarefas" texto="O que o aluno faz além do vídeo e do quiz." />
        <AvisoDaPagina aviso={avisoDe(aviso)} />
        <Cartao>
          <p className="text-[15px] leading-normal text-apoio">Para criar tarefas, primeiro crie um curso.</p>
          <div className="mt-4">
            <LinkBotao href="/admin/cursos">Ir para cursos e módulos</LinkBotao>
          </div>
        </Cartao>
      </>
    );
  }

  const aulaPorId = new Map(aulasDoCurso(conteudo, curso.id).map((aula) => [aula.id, aula]));
  const tarefas = ativos(todas).filter((tarefa) => tarefa.curso_id === curso.id);

  return (
    <>
      <TituloDaPagina titulo="Tarefas" texto="O que o aluno faz além do vídeo e do quiz. Cada tarefa entra em um dia da trilha.">
        <LinkBotao href={`/admin/tarefas/nova?curso=${curso.id}`}>Nova tarefa</LinkBotao>
      </TituloDaPagina>
      <AvisoDaPagina aviso={avisoDe(aviso)} />

      {cursos.length > 1 ? (
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-80">
            <Selecao id="curso" rotulo="Curso" defaultValue={curso.id}>
              {cursos.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.titulo_pt}
                </option>
              ))}
            </Selecao>
          </div>
          <Botao variante="secundario">Ver tarefas</Botao>
        </form>
      ) : null}

      {tarefas.length === 0 ? (
        <Cartao>
          <p className="text-[15px] leading-normal text-apoio">O curso {curso.titulo_pt} ainda não tem tarefas.</p>
        </Cartao>
      ) : (
        <div className={classeDaTabela}>
          <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
            <caption className="sr-only">Tarefas do curso {curso.titulo_pt}</caption>
            <thead>
              <tr className="border-b border-linha text-xs font-semibold tracking-[0.08em] text-apoio">
                <th scope="col" className="px-4 py-3">TAREFA</th>
                <th scope="col" className="px-4 py-3">AULA LIGADA</th>
                <th scope="col" className="px-4 py-3">LINK</th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tarefas.map((tarefa) => {
                const aula = tarefa.aula_id ? aulaPorId.get(tarefa.aula_id) : undefined;
                return (
                  <tr key={tarefa.id} className="border-b border-linha last:border-b-0">
                    <td className="px-4 py-3" lang="es">
                      <span className="block font-semibold">{tarefa.titulo_es}</span>
                      <span className="line-clamp-2 block text-sm text-apoio">{tarefa.instrucao_es}</span>
                    </td>
                    <td className="px-4 py-3">{aula ? `Aula ${aula.numero}` : <span className="text-apoio">Curso todo</span>}</td>
                    <td className="px-4 py-3">{tarefa.link ? 'Com link' : <span className="text-apoio">Sem link</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <LinkBotao href={`/admin/tarefas/${tarefa.id}`} variante="secundario">
                        Editar<span className="sr-only"> a tarefa {tarefa.titulo_es}</span>
                      </LinkBotao>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
