import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormularioDoCurso } from '@/components/admin/FormularioDoCurso';
import { Cartao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { ativos, carregarConteudo } from '@/lib/admin/dados';

export const metadata: Metadata = { title: 'Editar curso' };

type Props = { params: Promise<{ id: string }> };

export default async function PaginaEditarCurso({ params }: Props) {
  const { id } = await params;
  const conteudo = await carregarConteudo();
  const curso = ativos(conteudo.cursos).find((item) => item.id === id);
  if (!curso) redirect('/admin/cursos?aviso=nao_encontrado');

  return (
    <>
      <Trilha href="/admin/cursos" rotulo="Cursos e módulos" />
      <TituloDaPagina titulo="Editar curso" texto={curso.titulo_pt} />
      <Cartao>
        <FormularioDoCurso
          curso={{
            id: curso.id,
            titulo_pt: curso.titulo_pt,
            titulo_es: curso.titulo_es,
            tipo: curso.tipo,
            modo: curso.modo,
            situacao: curso.situacao,
          }}
        />
      </Cartao>
    </>
  );
}
