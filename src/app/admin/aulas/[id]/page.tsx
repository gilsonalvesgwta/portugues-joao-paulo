import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { moverParaLixeira } from '@/app/admin/acoes';
import { FormularioDaAula } from '@/components/admin/FormularioDaAula';
import { ListaDeMateriais } from '@/components/admin/ListaDeMateriais';
import { AvisoDaPagina, Cartao, Etiqueta, LinkBotao, TituloDaPagina, TITULO_DO_CARTAO, Trilha } from '@/components/admin/ui';
import { gruposParaAula } from '@/lib/admin/aulas';
import { avisoDe } from '@/lib/admin/avisos';
import {
  ativos, blocosPorAula, carregarConteudo, carregarMateriaisDaAula, carregarTarefas, cursoDaAula, quizzesPorAula,
} from '@/lib/admin/dados';
import { formatarDuracao, incorporarYoutube, lerVideoDoYoutube, linkDoYoutube } from '@/lib/conteudo';

export const metadata: Metadata = { title: 'Editar aula' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string | string[] }> };

// Uma linha de "O que a aula tem": o visto (ou o círculo tracejado, se falta), o nome, o detalhe
// e o botão da ação.
function Item({ feito, nome, detalhe, acao }: { feito: boolean; nome: string; detalhe: string; acao?: ReactNode }) {
  return (
    <li className="flex items-start gap-3 border-b border-borda py-3 last:border-b-0 last:pb-1">
      {feito ? (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-verde text-white">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          <span className="sr-only">Tem</span>
        </span>
      ) : (
        <span className="size-8 shrink-0 rounded-full border-2 border-dashed border-borda-campo">
          <span className="sr-only">Ainda não tem</span>
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="flex min-w-[9.5rem] flex-1 flex-col gap-px">
          <span className="text-base font-bold">{nome}</span>
          <span className="text-sm leading-snug text-apoio">{detalhe}</span>
        </span>
        {acao}
      </span>
    </li>
  );
}

const classeDaAcao = (destaque: boolean) =>
  `inline-flex min-h-11 shrink-0 items-center rounded-xl border px-3.5 text-sm font-bold no-underline transition-colors sm:min-h-10 ${
    destaque ? 'border-verde text-verde hover:bg-verde-suave' : 'border-linha text-texto hover:bg-fundo'
  }`;

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
  const quiz = (await quizzesPorAula()).get(aula.id) ?? null;
  const tarefas = ativos(await carregarTarefas()).filter((tarefa) => tarefa.aula_id === aula.id);
  const cursoId = cursoDaAula(conteudo, aula.id);
  const materiais = await carregarMateriaisDaAula(aula.id);

  const publicada = aula.situacao === 'publicado';
  const dono = conteudo.modulos.find((modulo) => modulo.id === aula.modulo_id);

  return (
    <>
      <Trilha href="/admin/aulas" rotulo="Aulas" />
      <TituloDaPagina titulo={`Editar aula ${aula.numero}`} texto={`${aula.titulo_pt}${dono ? `, módulo ${dono.titulo_pt}` : ''}`}>
        <Etiqueta tom={publicada ? 'verde' : 'aviso'}>{publicada ? 'Publicada' : 'Rascunho'}</Etiqueta>
      </TituloDaPagina>
      <AvisoDaPagina aviso={avisoDe(aviso)} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
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
            <ListaDeMateriais
              materiais={materiais}
              novo={`/admin/aulas/${aula.id}/materiais/novo`}
              vazio="Esta aula ainda não tem materiais. O arquivo fica no Google Drive (ou parecido) e aqui entra só o link."
            />
          </Cartao>
          <Cartao>
            <div id="tarefas" className="flex scroll-mt-6 flex-wrap items-center justify-between gap-3">
              <h2 className={TITULO_DO_CARTAO}>Tarefas da aula</h2>
              {cursoId ? (
                <LinkBotao href={`/admin/tarefas/nova?curso=${cursoId}&aula=${aula.id}`} variante="secundario">
                  Nova tarefa
                </LinkBotao>
              ) : null}
            </div>
            {tarefas.length === 0 ? (
              <p className="mt-2 text-[15px] leading-normal text-apoio">
                Nenhuma tarefa ligada a esta aula. Tarefa é o que o aluno faz além do vídeo e do quiz.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-borda border-y border-borda">
                {tarefas.map((tarefa) => (
                  <li key={tarefa.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="min-w-0 text-base font-semibold" lang="es">
                      {tarefa.titulo_es}
                    </span>
                    <LinkBotao href={`/admin/tarefas/${tarefa.id}`} variante="secundario">
                      Editar<span className="sr-only"> a tarefa {tarefa.titulo_es}</span>
                    </LinkBotao>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6">
          <Cartao className="flex flex-col">
            <h2 className={`${TITULO_DO_CARTAO} pb-1.5`}>O que a aula tem</h2>
            <ul className="flex flex-col">
              <Item feito={video !== null} nome="Vídeo" detalhe={video ? formatarDuracao(aula.duracao_seg) || 'Link salvo' : 'Ainda sem link do YouTube'} />
              <Item
                feito={quantos > 0}
                nome="Anotações"
                detalhe={quantos === 0 ? 'Esta aula ainda não tem anotações.' : quantos === 1 ? '1 bloco' : `${quantos} blocos`}
                acao={
                  <Link href={`/admin/aulas/${aula.id}/anotacoes`} className={classeDaAcao(quantos === 0)}>
                    {quantos === 0 ? 'Criar anotações' : 'Editar anotações'}
                  </Link>
                }
              />
              <Item
                feito={quiz !== null}
                nome="Quiz"
                detalhe={
                  quiz === null
                    ? 'Esta aula ainda não tem quiz.'
                    : `${quiz.perguntas === 1 ? '1 pergunta' : `${quiz.perguntas} perguntas`}, ${quiz.situacao === 'publicado' ? 'publicado' : 'em rascunho'}`
                }
                acao={
                  <Link href={`/admin/aulas/${aula.id}/quiz`} className={classeDaAcao(quiz === null)}>
                    {quiz === null ? 'Criar quiz' : 'Editar quiz'}
                  </Link>
                }
              />
              <Item
                feito={materiais.length > 0}
                nome="Materiais"
                detalhe={materiais.length === 0 ? 'Nenhum ainda' : materiais.length === 1 ? (materiais[0]?.titulo_pt ?? '1 material') : `${materiais.length} materiais`}
                acao={
                  <a href="#materiais" className={classeDaAcao(false)}>
                    Ver<span className="sr-only"> os materiais da aula</span>
                  </a>
                }
              />
              <Item
                feito={tarefas.length > 0}
                nome="Tarefas"
                detalhe={tarefas.length === 0 ? 'Nenhuma ainda' : tarefas.length === 1 ? '1 tarefa' : `${tarefas.length} tarefas`}
                acao={
                  <a href="#tarefas" className={classeDaAcao(false)}>
                    Ver<span className="sr-only"> as tarefas da aula</span>
                  </a>
                }
              />
            </ul>
          </Cartao>

          {publicada ? (
            <Cartao className="flex flex-col gap-2 bg-papel">
              <h2 className="text-lg font-bold leading-tight">Ver como o aluno vê</h2>
              <p className="text-[15px] leading-normal text-apoio">Abre esta aula na área do aluno. O que você fizer lá não fica gravado.</p>
              <Link href={`/clase/${aula.id}`} className="inline-flex min-h-11 items-center self-start text-[15px] font-semibold text-verde-link underline underline-offset-2 hover:text-verde">
                Abrir a aula na área do aluno
              </Link>
            </Cartao>
          ) : null}

          <Cartao>
            <h2 className="text-lg font-bold leading-tight">Tirar do ar</h2>
            <form action={moverParaLixeira} className="mt-2 flex flex-col items-stretch gap-3 sm:items-start">
              <p className="text-[15px] leading-normal text-apoio">
                A aula vai para a lixeira e some para o aluno. Dá para restaurar depois, como rascunho.
              </p>
              <input type="hidden" name="tipo" value="aula" />
              <input type="hidden" name="id" value={aula.id} />
              <button
                type="submit"
                className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-perigo bg-cartao px-4 text-[15px] font-bold text-perigo transition-colors hover:bg-fundo"
              >
                Mover a aula para a lixeira
              </button>
            </form>
          </Cartao>
        </div>
      </div>
    </>
  );
}
