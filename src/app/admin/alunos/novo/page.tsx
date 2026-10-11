import type { Metadata } from 'next';
import { FormularioNovoAluno } from '@/components/admin/FormulariosDoAluno';
import { Cartao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { ativos, carregarConteudo } from '@/lib/admin/dados';
import { exigirAdmin } from '@/lib/admin/guarda';
import { rotuloDoCurso } from '@/lib/admin/pessoas';
import { lerPapel } from '@/lib/alunos';

export const metadata: Metadata = { title: 'Nova pessoa' };

type Props = { searchParams: Promise<{ papel?: string | string[] }> };

// Com ?papel=admin (ou professor) no endereço, o formulário já abre com esse papel escolhido: é o
// caminho do botão "Novo administrador ou professor" da lista.
export default async function PaginaNovoAluno({ searchParams }: Props) {
  await exigirAdmin();
  const papelInicial = lerPapel((await searchParams).papel) ?? 'aluno';
  const daEquipe = papelInicial !== 'aluno';
  const conteudo = await carregarConteudo();
  const cursos = ativos(conteudo.cursos).map((curso) => ({ id: curso.id, rotulo: rotuloDoCurso(curso) }));

  return (
    <>
      <Trilha href="/admin/alunos" rotulo="Alunos" />
      <TituloDaPagina
        titulo={daEquipe ? 'Novo administrador ou professor' : 'Novo aluno'}
        texto="A conta nasce sem senha: a pessoa cria a própria senha pelo link que chega por e-mail."
      />
      <Cartao>
        <FormularioNovoAluno cursos={cursos} papelInicial={papelInicial} />
      </Cartao>
    </>
  );
}
