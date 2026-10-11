import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormularioDoMaterial } from '@/components/admin/FormularioDoMaterial';
import { Cartao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { ativos, carregarConteudo } from '@/lib/admin/dados';

export const metadata: Metadata = { title: 'Novo material do curso' };

type Props = { params: Promise<{ id: string }> };

export default async function PaginaNovoMaterialDoCurso({ params }: Props) {
  const { id } = await params;
  const curso = ativos((await carregarConteudo()).cursos).find((item) => item.id === id);
  if (!curso) redirect('/admin/cursos?aviso=nao_encontrado');

  return (
    <>
      <Trilha href={`/admin/cursos/${curso.id}#materiais`} rotulo="Editar curso" />
      <TituloDaPagina titulo="Novo material do curso" texto={`Para o curso inteiro: ${curso.titulo_pt}. O aluno vê na tela inicial.`} />
      <Cartao>
        <FormularioDoMaterial material={{ id: '', aula_id: '', curso_id: curso.id, titulo_pt: '', titulo_es: '', descricao_es: '', link: '' }} />
      </Cartao>
    </>
  );
}
