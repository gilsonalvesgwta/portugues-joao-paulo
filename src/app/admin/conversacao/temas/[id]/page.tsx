import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { arquivarTema } from '@/app/admin/conversacao/acoes';
import { FormularioDoTema } from '@/components/admin/FormulariosDaConversacao';
import { AvisoDaPagina, Botao, Cartao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { exigirEquipe } from '@/lib/admin/guarda';
import { carregarTema } from '@/lib/admin/conversacao';
import { ehUuid } from '@/lib/conteudo';

export const metadata: Metadata = { title: 'Editar tema' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string | string[] }> };

export default async function PaginaEditarTema({ params, searchParams }: Props) {
  const { id } = await params;
  await exigirEquipe();
  const { aviso } = await searchParams;
  if (!ehUuid(id)) redirect('/admin/conversacao/temas?aviso=nao_encontrado');
  const tema = await carregarTema(id);
  if (!tema) redirect('/admin/conversacao/temas?aviso=nao_encontrado');
  const arquivado = tema.arquivado_em !== null;

  return (
    <>
      <Trilha href="/admin/conversacao/temas" rotulo="Temas" />
      <TituloDaPagina titulo="Editar tema" texto={tema.titulo_es} />
      <AvisoDaPagina aviso={avisoDe(aviso)} />
      <Cartao>
        <FormularioDoTema
          tema={{
            id: tema.id,
            titulo_es: tema.titulo_es,
            nivel: tema.nivel,
            descricao_es: tema.descricao_es ?? '',
            aprendizados: tema.aprendizados.join('\n'),
            material: tema.material ?? '',
          }}
        />
      </Cartao>
      <Cartao>
        <h2 className="text-[21px] font-bold leading-tight">{arquivado ? 'Tema arquivado' : 'Arquivar'}</h2>
        <form action={arquivarTema} className="mt-3 flex flex-col items-start gap-3">
          <p className="text-[15px] leading-normal text-apoio">
            {arquivado
              ? 'Este tema não aparece para escolher em turmas novas. Restaure para voltar a usar.'
              : 'O tema sai da lista de escolha das turmas novas. As turmas que já aconteceram continuam no histórico.'}
          </p>
          <input type="hidden" name="id" value={tema.id} />
          <input type="hidden" name="arquivar" value={arquivado ? '0' : '1'} />
          <Botao variante="secundario">{arquivado ? 'Restaurar o tema' : 'Arquivar o tema'}</Botao>
        </form>
      </Cartao>
    </>
  );
}
