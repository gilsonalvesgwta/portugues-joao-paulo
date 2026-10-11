import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { moverParaLixeira } from '@/app/admin/acoes';
import { FormularioDaTarefa } from '@/components/admin/FormularioDaTarefa';
import { AvisoDaPagina, Botao, Cartao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { ativos, aulasDoCurso, carregarConteudo, carregarTarefas } from '@/lib/admin/dados';

export const metadata: Metadata = { title: 'Editar tarefa' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string | string[] }> };

export default async function PaginaEditarTarefa({ params, searchParams }: Props) {
  const { id } = await params;
  const { aviso } = await searchParams;
  const [conteudo, tarefas] = await Promise.all([carregarConteudo(), carregarTarefas()]);
  const tarefa = ativos(tarefas).find((item) => item.id === id);
  if (!tarefa) redirect('/admin/tarefas?aviso=nao_encontrado');
  const aulas = aulasDoCurso(conteudo, tarefa.curso_id);

  return (
    <>
      <Trilha href={`/admin/tarefas?curso=${tarefa.curso_id}`} rotulo="Tarefas" />
      <TituloDaPagina titulo="Editar tarefa" texto={tarefa.titulo_es} />
      <AvisoDaPagina aviso={avisoDe(aviso)} />
      <Cartao>
        <FormularioDaTarefa
          aulas={aulas.map((item) => ({ id: item.id, rotulo: `Aula ${item.numero} — ${item.titulo_pt}` }))}
          tarefa={{
            id: tarefa.id,
            curso_id: tarefa.curso_id,
            // Aula que foi para a lixeira deixa de aparecer na lista; a tarefa volta a valer para o curso todo ao salvar.
            aula_id: aulas.some((item) => item.id === tarefa.aula_id) ? (tarefa.aula_id ?? '') : '',
            titulo_es: tarefa.titulo_es,
            instrucao_es: tarefa.instrucao_es,
            link: tarefa.link ?? '',
          }}
        />
      </Cartao>
      <Cartao>
        <h2 className="text-lg font-bold">Lixeira</h2>
        <form action={moverParaLixeira} className="mt-3 flex flex-col items-start gap-3">
          <p className="text-[15px] leading-normal text-apoio">
            A tarefa sai das listas e deixa de aparecer para o aluno. Dá para restaurar depois.
          </p>
          <input type="hidden" name="tipo" value="tarefa" />
          <input type="hidden" name="id" value={tarefa.id} />
          <Botao variante="secundario">Mover a tarefa para a lixeira</Botao>
        </form>
      </Cartao>
    </>
  );
}
