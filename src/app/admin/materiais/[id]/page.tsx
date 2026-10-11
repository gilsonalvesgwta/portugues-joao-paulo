import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormularioDoMaterial } from '@/components/admin/FormularioDoMaterial';
import { Cartao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { carregarMaterial } from '@/lib/admin/dados';
import { ehUuid } from '@/lib/conteudo';

export const metadata: Metadata = { title: 'Editar material' };

type Props = { params: Promise<{ id: string }> };

export default async function PaginaEditarMaterial({ params }: Props) {
  const { id } = await params;
  const material = ehUuid(id) ? await carregarMaterial(id) : null;
  // O material é de uma aula ou do curso inteiro.
  if (!material || (material.aula_id === null && material.curso_id === null)) redirect('/admin/aulas?aviso=nao_encontrado');
  const daAula = material.aula_id !== null;

  return (
    <>
      <Trilha
        href={daAula ? `/admin/aulas/${material.aula_id}#materiais` : `/admin/cursos/${material.curso_id}#materiais`}
        rotulo={daAula ? 'Voltar para a aula' : 'Voltar para o curso'}
      />
      <TituloDaPagina titulo="Editar material de apoio" texto={material.titulo_pt} />
      <Cartao>
        <FormularioDoMaterial
          material={{
            id: material.id,
            aula_id: material.aula_id ?? '',
            curso_id: daAula ? '' : (material.curso_id ?? ''),
            titulo_pt: material.titulo_pt,
            titulo_es: material.titulo_es,
            descricao_es: material.descricao_es ?? '',
            link: material.link,
          }}
        />
      </Cartao>
    </>
  );
}
