import type { Metadata } from 'next';
import { FormularioNovoAluno } from '@/components/admin/FormulariosDoAluno';
import { Cartao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { ativos, carregarConteudo } from '@/lib/admin/dados';
import { exigirAdmin } from '@/lib/admin/guarda';
import { rotuloDoCurso } from '@/lib/admin/pessoas';

export const metadata: Metadata = { title: 'Novo aluno' };

export default async function PaginaNovoAluno() {
  await exigirAdmin();
  const conteudo = await carregarConteudo();
  const cursos = ativos(conteudo.cursos).map((curso) => ({ id: curso.id, rotulo: rotuloDoCurso(curso) }));

  return (
    <>
      <Trilha href="/admin/alunos" rotulo="Alunos" />
      <TituloDaPagina
        titulo="Novo aluno"
        texto="A conta nasce sem senha: a pessoa cria a própria senha pelo link que chega por e-mail."
      />
      <Cartao>
        <FormularioNovoAluno cursos={cursos} />
      </Cartao>
    </>
  );
}
