import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { EditorDeAnotacoes } from '@/components/admin/EditorDeAnotacoes';
import { TituloDaPagina, Trilha } from '@/components/admin/ui';
import { carregarAulaComAnotacoes } from '@/lib/admin/dados';
import { lerAnotacoes } from '@/lib/anotacoes';
import { ehUuid } from '@/lib/conteudo';

export const metadata: Metadata = { title: 'Anotações da aula' };

type Props = { params: Promise<{ id: string }> };

export default async function PaginaAnotacoes({ params }: Props) {
  const { id } = await params;
  const aula = ehUuid(id) ? await carregarAulaComAnotacoes(id) : null;
  if (!aula) redirect('/admin/aulas?aviso=nao_encontrado');

  return (
    <>
      <Trilha href={`/admin/aulas/${aula.id}`} rotulo={`Editar aula ${aula.numero}`} />
      <TituloDaPagina
        titulo={`Anotações da aula ${aula.numero}`}
        texto={`${aula.titulo_pt}. É o resumo que o aluno lê junto com o vídeo. Monte em blocos; a prévia mostra como ele vê.`}
      />
      <EditorDeAnotacoes aulaId={aula.id} numero={aula.numero} tituloEs={aula.titulo_es} iniciais={lerAnotacoes(aula.anotacoes)} />
    </>
  );
}
