import type { Metadata } from 'next';
import Link from 'next/link';
import { apagarCopia, fazerCopiaAgora } from '@/app/admin/copias/acoes';
import { Acompanhar } from '@/components/admin/Acompanhar';
import { BotaoComConfirmacao } from '@/components/admin/BotaoComConfirmacao';
import { EnviarCopia } from '@/components/admin/EnviarCopia';
import { AvisoDaPagina, Botao, Cartao, Etiqueta, TITULO_DO_CARTAO, TituloDaPagina } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { carregarCopias, type Copia } from '@/lib/admin/copias';
import { exigirAdmin } from '@/lib/admin/guarda';
import { quandoEmPalavras, ROTULO_DO_TIPO, saudeDasCopias, tamanhoEmPalavras, type Acontecimento, type Saude } from '@/lib/copias';

export const metadata: Metadata = { title: 'Cópias de segurança' };

type Props = { searchParams: Promise<{ aviso?: string | string[] }> };

const SAUDE: Record<Saude, { tom: 'verde' | 'aviso' | 'neutro'; rotulo: string }> = {
  em_dia: { tom: 'verde', rotulo: 'Em dia' },
  atrasada: { tom: 'aviso', rotulo: 'Sem cópia recente' },
  parado: { tom: 'aviso', rotulo: 'Serviço parado' },
  desligado: { tom: 'neutro', rotulo: 'Desligado' },
};

function maiuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1);
}

function horaCheia(hora: number): string {
  return `${String(hora).padStart(2, '0')}:00`;
}

// O que cada acontecimento do histórico quer dizer, em uma frase.
function tituloDoAcontecimento(item: Acontecimento): string {
  if (item.acao === 'restaurar') return item.ok ? 'Restauração feita' : 'Restauração não feita';
  if (!item.ok) return 'Cópia não feita';
  if (item.arquivo.endsWith('-antes-de-restaurar.sql.gz')) return 'Cópia antes de restaurar';
  if (item.arquivo.endsWith('-automatica.sql.gz')) return 'Cópia automática';
  return 'Cópia feita na hora';
}

function LinhaDaCopia({ copia, agora, ocupada }: { copia: Copia; agora: Date; ocupada: boolean }) {
  const quando = quandoEmPalavras(copia.quando, agora);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-borda py-4 first:pt-1 last:border-b-0 last:pb-1">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-base font-bold">{maiuscula(quando)}</span>
        <span className="flex flex-wrap items-center gap-2 text-sm text-apoio">
          <Etiqueta tom={copia.tipo === 'automatica' ? 'verde' : 'neutro'}>{ROTULO_DO_TIPO[copia.tipo]}</Etiqueta>
          <span>{tamanhoEmPalavras(copia.bytes)}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/api/admin/copias/${encodeURIComponent(copia.nome)}`}
          download={copia.nome}
          aria-label={`Baixar a cópia de ${quando}`}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-linha bg-cartao px-4 text-[15px] font-bold text-texto no-underline hover:bg-fundo"
        >
          Baixar
        </a>
        <Link
          href={`/admin/copias/restaurar?arquivo=${encodeURIComponent(copia.nome)}`}
          aria-label={`Restaurar a cópia de ${quando}`}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-linha bg-cartao px-4 text-[15px] font-bold text-texto no-underline hover:bg-fundo"
        >
          Restaurar
        </Link>
        {ocupada ? null : (
          <BotaoComConfirmacao
            acao={apagarCopia}
            campos={{ arquivo: copia.nome }}
            pergunta={`Apagar a cópia de ${quando}? Não dá para desfazer.`}
            rotulo={`Apagar a cópia de ${quando}`}
          >
            Apagar
          </BotaoComConfirmacao>
        )}
      </div>
    </li>
  );
}

export default async function PaginaDasCopias({ searchParams }: Props) {
  await exigirAdmin();
  const { aviso } = await searchParams;
  const situacao = await carregarCopias();
  const agora = new Date();
  const feitasAqui = situacao.copias.filter((copia) => copia.tipo !== 'enviada');
  const ultima = feitasAqui[0] ?? null;
  const saude = saudeDasCopias({ ligado: situacao.ligado, vivo: situacao.vivo, ultimaCopia: ultima?.quando ?? null, agora });
  const ocupado = situacao.trabalhando !== null || situacao.pendentes > 0;
  const { hora, manterDias } = situacao.config;
  // O resultado da última restauração fica em destaque por meia hora.
  const restauracao = situacao.historico.find((item) => item.acao === 'restaurar');
  const restauracaoRecente = restauracao && agora.getTime() - restauracao.quando.getTime() < 30 * 60_000 ? restauracao : null;

  return (
    <>
      <TituloDaPagina
        titulo="Cópias de segurança"
        texto={
          situacao.ligado
            ? `Todo dia, às ${horaCheia(hora)}, a plataforma guarda uma cópia de todos os dados: contas e senhas, alunos, matrículas, progresso, reservas, cursos e aulas.`
            : undefined
        }
      >
        {situacao.ligado ? (
          <form action={fazerCopiaAgora}>
            <Botao disabled={ocupado}>Fazer uma cópia agora</Botao>
          </form>
        ) : null}
      </TituloDaPagina>
      <AvisoDaPagina aviso={avisoDe(aviso)} />
      <Acompanhar ligado={ocupado} />

      {!situacao.ligado ? (
        <Cartao>
          <h2 className={TITULO_DO_CARTAO}>O serviço de cópias ainda não está nesta instalação</h2>
          <p className="mt-3 text-[15px] leading-normal text-apoio">
            Para ligar, atualize a stack no Portainer com a versão mais nova do arquivo da stack (ela traz o serviço
            portuguesjp_copias e a pasta das cópias). Depois disso, esta tela mostra as cópias.
          </p>
        </Cartao>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-6">
            <Cartao>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="copias" className={TITULO_DO_CARTAO}>
                  Cópias guardadas
                </h2>
                <span className="text-sm text-apoio">
                  {situacao.copias.length === 1 ? '1 cópia' : `${situacao.copias.length} cópias`}
                </span>
              </div>
              {situacao.copias.length === 0 ? (
                <p className="mt-3 text-[15px] leading-normal text-apoio">
                  Ainda não há cópias. A primeira automática sai às {horaCheia(hora)}; se preferir, faça uma agora.
                </p>
              ) : (
                <ul aria-labelledby="copias" className="mt-3 flex flex-col">
                  {situacao.copias.map((copia) => (
                    <LinhaDaCopia key={copia.nome} copia={copia} agora={agora} ocupada={situacao.trabalhando?.arquivo === copia.nome} />
                  ))}
                </ul>
              )}
              <p className="mt-4 text-sm leading-normal text-apoio">
                As automáticas ficam guardadas por {manterDias} dias. As outras ficam até você apagar.
              </p>
            </Cartao>

            {situacao.historico.length > 0 ? (
              <Cartao>
                <h2 className={TITULO_DO_CARTAO}>Últimos acontecimentos</h2>
                <ul className="mt-3 flex flex-col">
                  {situacao.historico.slice(0, 8).map((item, i) => (
                    <li key={`${item.quando.getTime()}-${i}`} className="flex gap-3 border-b border-borda py-3 last:border-b-0 last:pb-1">
                      <span aria-hidden="true" className={`mt-2 size-2.5 shrink-0 rounded-full ${item.ok ? 'bg-verde' : 'bg-perigo'}`} />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[15px] font-bold">
                          {tituloDoAcontecimento(item)}
                          <span className="font-normal text-apoio">, {quandoEmPalavras(item.quando, agora)}</span>
                        </span>
                        {item.ok && item.acao === 'copiar' ? null : (
                          <span className="break-words text-sm leading-snug text-apoio">{item.mensagem}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </Cartao>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-10">
            <Cartao>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="andamento" className={`scroll-mt-6 ${TITULO_DO_CARTAO}`}>
                  Situação
                </h2>
                <Etiqueta tom={SAUDE[saude].tom}>{SAUDE[saude].rotulo}</Etiqueta>
              </div>
              <div role="status" className="mt-3 flex flex-col gap-2 text-[15px] leading-normal">
                {situacao.trabalhando ? (
                  <p className="font-semibold text-verde">
                    {situacao.trabalhando.acao === 'restaurar'
                      ? 'Restaurando a cópia… A tela se atualiza sozinha.'
                      : 'Fazendo uma cópia… A tela se atualiza sozinha.'}
                  </p>
                ) : situacao.pendentes > 0 ? (
                  <p className="font-semibold text-verde">Pedido recebido. Começa em alguns segundos…</p>
                ) : null}
                {restauracaoRecente && !situacao.trabalhando ? (
                  <p className={`font-semibold ${restauracaoRecente.ok ? 'text-verde' : 'text-perigo'}`}>{restauracaoRecente.mensagem}</p>
                ) : null}
                {saude === 'parado' ? (
                  <p className="text-perigo">
                    O serviço de cópias não está respondendo. No Portainer, confira se o serviço portuguesjp_copias está
                    rodando (1/1).
                  </p>
                ) : null}
                <p className="text-apoio">
                  Última cópia: <span className="font-semibold text-texto">{ultima ? quandoEmPalavras(ultima.quando, agora) : 'nenhuma ainda'}</span>
                </p>
                <p className="text-apoio">Cópia automática: todo dia às {horaCheia(hora)}, horário de Brasília.</p>
              </div>
            </Cartao>

            <Cartao>
              <h2 className={TITULO_DO_CARTAO}>Enviar uma cópia</h2>
              <p className="mt-2 mb-4 text-[15px] leading-normal text-apoio">
                Para trazer os dados de outra instalação, ou uma cópia que você baixou antes. Ela entra na lista; restaurar é
                outro passo.
              </p>
              <EnviarCopia />
            </Cartao>

            <section className="rounded-[22px] border border-borda bg-papel px-[18px] py-[22px] sm:rounded-3xl sm:p-7">
              <h2 className="text-lg font-bold leading-tight">Guarde também fora da VPS</h2>
              <p className="mt-2 text-[15px] leading-normal text-apoio">
                Uma cópia que só existe na VPS se perde junto com ela. De vez em quando, baixe a mais recente e guarde em um
                lugar seguro: o arquivo tem os dados dos alunos.
              </p>
              <p className="mt-3 text-[15px] leading-normal text-apoio">
                Para mudar de VPS: instale a plataforma na nova, entre como administrador, envie a cópia nesta tela e clique
                em “Restaurar”.
              </p>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
