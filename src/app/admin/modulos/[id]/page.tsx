import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { moverParaLixeira } from '@/app/admin/acoes';
import { FormularioDoModulo } from '@/components/admin/FormularioDoModulo';
import { Botao, Cartao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { ativos, carregarConteudo } from '@/lib/admin/dados';

export const metadata: Metadata = { title: 'Editar módulo' };

type Props = { params: Promise<{ id: string }> };

export default async function PaginaEditarModulo({ params }: Props) {
  const { id } = await params;
  const conteudo = await carregarConteudo();
  const modulo = ativos(conteudo.modulos).find((item) => item.id === id);
  if (!modulo) redirect('/admin/cursos?aviso=nao_encontrado');
  const quantas = ativos(conteudo.aulas).filter((aula) => aula.modulo_id === modulo.id).length;

  return (
    <>
      <Trilha href="/admin/cursos" rotulo="Cursos e módulos" />
      <TituloDaPagina titulo="Editar módulo" texto={modulo.titulo_pt} />
      <Cartao>
        <FormularioDoModulo
          modulo={{ id: modulo.id, curso_id: modulo.curso_id, titulo_pt: modulo.titulo_pt, titulo_es: modulo.titulo_es }}
        />
      </Cartao>
      <Cartao>
        <h2 className="text-lg font-bold">Lixeira</h2>
        {quantas > 0 ? (
          <p className="mt-2 text-[15px] leading-normal text-apoio">
            Este módulo tem {quantas === 1 ? '1 aula' : `${quantas} aulas`}. Para movê-lo para a lixeira, antes mova as
            aulas para outro módulo ou para a lixeira.
          </p>
        ) : (
          <form action={moverParaLixeira} className="mt-3 flex flex-col items-start gap-3">
            <p className="text-[15px] leading-normal text-apoio">
              O módulo sai das listas e pode ser restaurado depois.
            </p>
            <input type="hidden" name="tipo" value="modulo" />
            <input type="hidden" name="id" value={modulo.id} />
            <Botao variante="secundario">Mover o módulo para a lixeira</Botao>
          </form>
        )}
      </Cartao>
    </>
  );
}
