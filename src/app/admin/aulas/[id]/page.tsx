import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { moverParaLixeira } from '@/app/admin/acoes';
import { FormularioDaAula } from '@/components/admin/FormularioDaAula';
import { AvisoDaPagina, Botao, Cartao, Etiqueta, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { gruposParaAula } from '@/lib/admin/aulas';
import { avisoDe } from '@/lib/admin/avisos';
import { ativos, carregarConteudo } from '@/lib/admin/dados';
import { formatarDuracao } from '@/lib/conteudo';

export const metadata: Metadata = { title: 'Editar aula' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string | string[] }> };

export default async function PaginaEditarAula({ params, searchParams }: Props) {
  const { id } = await params;
  const { aviso } = await searchParams;
  const conteudo = await carregarConteudo();
  const aula = ativos(conteudo.aulas).find((item) => item.id === id);
  if (!aula) redirect('/admin/aulas?aviso=nao_encontrado');

  return (
    <>
      <Trilha href="/admin/aulas" rotulo="Aulas" />
      <TituloDaPagina titulo={`Editar aula ${aula.numero}`} texto={aula.titulo_pt}>
        <Etiqueta tom={aula.situacao === 'publicado' ? 'verde' : 'aviso'}>
          {aula.situacao === 'publicado' ? 'Publicada' : 'Rascunho'}
        </Etiqueta>
      </TituloDaPagina>
      <AvisoDaPagina aviso={avisoDe(aviso)} />
      <Cartao>
        <FormularioDaAula
          grupos={gruposParaAula(conteudo)}
          aula={{
            id: aula.id,
            modulo_id: aula.modulo_id,
            numero: String(aula.numero),
            titulo_pt: aula.titulo_pt,
            titulo_es: aula.titulo_es,
            video_id: aula.video_id ?? '',
            duracao: formatarDuracao(aula.duracao_seg),
          }}
        />
      </Cartao>
      <Cartao>
        <h2 className="text-lg font-bold">Lixeira</h2>
        <form action={moverParaLixeira} className="mt-3 flex flex-col items-start gap-3">
          <p className="text-[15px] leading-normal text-apoio">
            A aula sai das listas e deixa de aparecer para o aluno. Dá para restaurar depois, e ela volta como rascunho.
          </p>
          <input type="hidden" name="tipo" value="aula" />
          <input type="hidden" name="id" value={aula.id} />
          <Botao variante="secundario">Mover a aula para a lixeira</Botao>
        </form>
      </Cartao>
    </>
  );
}
