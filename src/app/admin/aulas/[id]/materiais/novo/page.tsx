import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormularioDoMaterial } from '@/components/admin/FormularioDoMaterial';
import { Cartao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { carregarAulaComAnotacoes } from '@/lib/admin/dados';
import { ehUuid } from '@/lib/conteudo';

export const metadata: Metadata = { title: 'Novo material' };

type Props = { params: Promise<{ id: string }> };

export default async function PaginaNovoMaterial({ params }: Props) {
  const { id } = await params;
  const aula = ehUuid(id) ? await carregarAulaComAnotacoes(id) : null;
  if (!aula) redirect('/admin/aulas?aviso=nao_encontrado');

  return (
    <>
      <Trilha href={`/admin/aulas/${aula.id}#materiais`} rotulo={`Editar aula ${aula.numero}`} />
      <TituloDaPagina titulo="Novo material de apoio" texto={`Para a aula ${aula.numero}: ${aula.titulo_pt}.`} />
      <Cartao>
        <FormularioDoMaterial material={{ id: '', aula_id: aula.id, titulo_pt: '', titulo_es: '', descricao_es: '', link: '' }} />
      </Cartao>
    </>
  );
}
