import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormularioDoCurso } from '@/components/admin/FormularioDoCurso';
import { ListaDeMateriais } from '@/components/admin/ListaDeMateriais';
import { AvisoDaPagina, Cartao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { ativos, carregarConteudo, carregarMateriaisDoCurso } from '@/lib/admin/dados';

export const metadata: Metadata = { title: 'Editar curso' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string | string[] }> };

export default async function PaginaEditarCurso({ params, searchParams }: Props) {
  const { id } = await params;
  const { aviso } = await searchParams;
  const conteudo = await carregarConteudo();
  const curso = ativos(conteudo.cursos).find((item) => item.id === id);
  if (!curso) redirect('/admin/cursos?aviso=nao_encontrado');
  const materiais = await carregarMateriaisDoCurso(curso.id);

  return (
    <>
      <Trilha href="/admin/cursos" rotulo="Cursos e módulos" />
      <TituloDaPagina titulo="Editar curso" texto={curso.titulo_pt} />
      <AvisoDaPagina aviso={avisoDe(aviso)} />
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
      <Cartao>
        <ListaDeMateriais
          titulo="Materiais do curso"
          materiais={materiais}
          novo={`/admin/cursos/${curso.id}/materiais/novo`}
          vazio="Este curso ainda não tem materiais gerais. São os que valem para o curso inteiro (um guia de estudo, uma lista de verbos); o aluno vê na tela inicial. Os de uma aula só ficam na própria aula."
        />
      </Cartao>
    </>
  );
}
