import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormularioDaTarefa } from '@/components/admin/FormularioDaTarefa';
import { Cartao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { ativos, aulasDoCurso, carregarConteudo } from '@/lib/admin/dados';

export const metadata: Metadata = { title: 'Nova tarefa' };

type Texto = string | string[] | undefined;
type Props = { searchParams: Promise<{ curso?: Texto; aula?: Texto }> };

export default async function PaginaNovaTarefa({ searchParams }: Props) {
  const { curso: cursoPedido, aula: aulaPedida } = await searchParams;
  const conteudo = await carregarConteudo();
  const curso = ativos(conteudo.cursos).find((item) => item.id === cursoPedido);
  if (!curso) redirect('/admin/tarefas?aviso=nao_encontrado');
  const aulas = aulasDoCurso(conteudo, curso.id);
  const aula = aulas.find((item) => item.id === aulaPedida);

  return (
    <>
      <Trilha href={`/admin/tarefas?curso=${curso.id}`} rotulo="Tarefas" />
      <TituloDaPagina titulo="Nova tarefa" texto={`No curso ${curso.titulo_pt}.`} />
      <Cartao>
        <FormularioDaTarefa
          aulas={aulas.map((item) => ({ id: item.id, rotulo: `Aula ${item.numero} — ${item.titulo_pt}` }))}
          tarefa={{ id: '', curso_id: curso.id, aula_id: aula?.id ?? '', titulo_es: '', instrucao_es: '', link: '' }}
        />
      </Cartao>
    </>
  );
}
