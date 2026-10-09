import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormularioDoModulo } from '@/components/admin/FormularioDoModulo';
import { Cartao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { ativos, carregarConteudo } from '@/lib/admin/dados';

export const metadata: Metadata = { title: 'Novo módulo' };

type Props = { searchParams: Promise<{ curso?: string | string[] }> };

export default async function PaginaNovoModulo({ searchParams }: Props) {
  const { curso: cursoId } = await searchParams;
  const conteudo = await carregarConteudo();
  const curso = ativos(conteudo.cursos).find((item) => item.id === cursoId);
  if (!curso) redirect('/admin/cursos?aviso=nao_encontrado');

  return (
    <>
      <Trilha href="/admin/cursos" rotulo="Cursos e módulos" />
      <TituloDaPagina titulo="Novo módulo" texto={`No curso ${curso.titulo_pt}. Ele entra no fim da lista; depois dá para subir ou descer.`} />
      <Cartao>
        <FormularioDoModulo modulo={{ id: '', curso_id: curso.id, titulo_pt: '', titulo_es: '' }} />
      </Cartao>
    </>
  );
}
