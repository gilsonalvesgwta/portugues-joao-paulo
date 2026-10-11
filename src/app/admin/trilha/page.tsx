import type { Metadata } from 'next';
import { EditorDaTrilha } from '@/components/admin/EditorDaTrilha';
import { Botao, Cartao, LinkBotao, Selecao, TituloDaPagina } from '@/components/admin/ui';
import { ativos, carregarConteudo, carregarDisponiveis, carregarTrilha } from '@/lib/admin/dados';

export const metadata: Metadata = { title: 'Trilha por dia' };

type Props = { searchParams: Promise<{ curso?: string | string[] }> };

const TEXTO = 'O que o aluno faz em cada dia. O dia 1 começa na matrícula de cada aluno, e ele só passa para o dia seguinte quando conclui o que é obrigatório.';

export default async function PaginaTrilha({ searchParams }: Props) {
  const { curso: pedido } = await searchParams;
  const conteudo = await carregarConteudo();
  const cursos = ativos(conteudo.cursos);
  const curso = cursos.find((item) => item.id === pedido) ?? cursos[0];

  if (!curso) {
    return (
      <>
        <TituloDaPagina titulo="Trilha por dia" texto={TEXTO} />
        <Cartao>
          <p className="text-[15px] leading-normal text-apoio">Para montar a trilha, primeiro crie um curso com aulas.</p>
          <div className="mt-4">
            <LinkBotao href="/admin/cursos">Ir para cursos e módulos</LinkBotao>
          </div>
        </Cartao>
      </>
    );
  }

  const [disponiveis, dias] = await Promise.all([carregarDisponiveis(curso.id), carregarTrilha(curso.id)]);

  return (
    <>
      <TituloDaPagina titulo="Trilha por dia" texto={TEXTO} />
      {cursos.length > 1 ? (
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-80">
            <Selecao id="curso" rotulo="Curso" defaultValue={curso.id}>
              {cursos.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.titulo_pt}
                </option>
              ))}
            </Selecao>
          </div>
          <Botao variante="secundario">Ver trilha</Botao>
        </form>
      ) : null}
      {/* A chave garante que trocar de curso recomeça o editor do zero. */}
      <EditorDaTrilha key={curso.id} cursoId={curso.id} iniciais={dias} disponiveis={disponiveis} />
    </>
  );
}
