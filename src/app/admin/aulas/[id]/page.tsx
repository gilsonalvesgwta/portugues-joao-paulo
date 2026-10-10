import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { moverParaLixeira } from '@/app/admin/acoes';
import { FormularioDaAula } from '@/components/admin/FormularioDaAula';
import { AvisoDaPagina, Botao, Cartao, Etiqueta, LinkBotao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { gruposParaAula } from '@/lib/admin/aulas';
import { avisoDe } from '@/lib/admin/avisos';
import { ativos, blocosPorAula, carregarConteudo } from '@/lib/admin/dados';
import { formatarDuracao, incorporarYoutube, lerVideoDoYoutube, linkDoYoutube } from '@/lib/conteudo';

export const metadata: Metadata = { title: 'Editar aula' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string | string[] }> };

export default async function PaginaEditarAula({ params, searchParams }: Props) {
  const { id } = await params;
  const { aviso } = await searchParams;
  const [conteudo, blocos] = await Promise.all([carregarConteudo(), blocosPorAula()]);
  const aula = ativos(conteudo.aulas).find((item) => item.id === id);
  if (!aula) redirect('/admin/aulas?aviso=nao_encontrado');
  // Só monta link e prévia se o que está salvo for mesmo um código do YouTube.
  const codigo = lerVideoDoYoutube(aula.video_id);
  const video = codigo !== null && codigo !== 'invalido' ? codigo : null;
  const quantos = blocos.get(aula.id) ?? 0;

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
        {/* A chave muda a cada gravação: o formulário recomeça com o que ficou salvo no banco. */}
        <FormularioDaAula
          key={aula.atualizado_em}
          grupos={gruposParaAula(conteudo)}
          previa={video ? incorporarYoutube(video) : null}
          aula={{
            id: aula.id,
            modulo_id: aula.modulo_id,
            numero: String(aula.numero),
            titulo_pt: aula.titulo_pt,
            titulo_es: aula.titulo_es,
            video_id: video ? linkDoYoutube(video) : (aula.video_id ?? ''),
            duracao: formatarDuracao(aula.duracao_seg),
          }}
        />
      </Cartao>
      <Cartao>
        <h2 className="text-lg font-bold">Anotações da aula</h2>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] leading-normal text-apoio">
            {quantos === 0
              ? 'Esta aula ainda não tem anotações. É o resumo que o aluno lê junto com o vídeo.'
              : `${quantos === 1 ? '1 bloco' : `${quantos} blocos`} de anotações.`}
          </p>
          <LinkBotao href={`/admin/aulas/${aula.id}/anotacoes`} variante="secundario">
            {quantos === 0 ? 'Criar anotações' : 'Editar anotações'}
          </LinkBotao>
        </div>
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
