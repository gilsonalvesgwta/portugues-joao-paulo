'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { IconoHecho, IconoSonido } from '@/components/aluno/iconos';
import { es } from '@/i18n/es';
import type { CartaoDoPar, ModoDosPares } from '@/lib/quiz';

// O jogo de combinar pares (como o da Aloud): em cima, os cartões em português (o áudio com a
// voz do professor, ou a palavra escrita); embaixo, as traduções em espanhol. O aluno toca um de
// cima e um de baixo; quem diz se o par está certo é o servidor ("conferir"). Acertou: os dois
// ficam verdes e o cartão de cima passa a mostrar a palavra em português. Errou: os dois piscam
// em vermelho e ele tenta de novo.
//
// Em espaço largo, duas fileiras (como no modelo); em espaço estreito (celular, prévia da
// administração), duas colunas lado a lado.

export type Tentativa = { i: number; t: string };
export type Conferir = (indice: number, traducao: string) => Promise<{ certo: boolean; palavra?: string } | null>;

type Props = {
  modo: ModoDosPares;
  cartoes: CartaoDoPar[];
  traducoes: string[];
  conferir: Conferir;
  // Avisado a cada tentativa: a lista inteira, e se todos os pares já foram combinados.
  aoMudar?: (tentativas: Tentativa[], completo: boolean) => void;
  desativado?: boolean;
  // Rótulo do grupo, para leitor de tela (o enunciado da pergunta).
  rotulo: string;
};

// Toca a gravação; sem gravação, pede ao navegador para ler a palavra em português do Brasil.
let tocando: HTMLAudioElement | null = null;
export function tocar(cartao: Pick<CartaoDoPar, 'audio' | 'fala'>): void {
  tocando?.pause();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  if (cartao.audio) {
    tocando = new Audio(`/api/audio/${cartao.audio}`);
    void tocando.play().catch(() => undefined);
    return;
  }
  if (cartao.fala && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const fala = new SpeechSynthesisUtterance(cartao.fala);
    fala.lang = 'pt-BR';
    const vozes = window.speechSynthesis.getVoices();
    const voz =
      vozes.find((v) => v.lang.replace('_', '-').toLowerCase() === 'pt-br') ?? vozes.find((v) => v.lang.toLowerCase().startsWith('pt'));
    if (voz) fala.voice = voz;
    fala.rate = 0.9;
    window.speechSynthesis.speak(fala);
  }
}

const baseDoCartao =
  'relative flex min-h-[64px] w-full min-w-0 cursor-pointer items-center justify-center rounded-2xl border-2 px-2 py-2.5 text-center text-base font-bold leading-snug transition-colors @lg:min-h-[104px] disabled:cursor-default';

function corDoCartao(estado: 'livre' | 'escolhido' | 'certo' | 'errado'): string {
  if (estado === 'certo') return 'border-verde bg-verde-suave text-verde';
  if (estado === 'errado') return 'border-perigo bg-perigo-suave text-perigo';
  if (estado === 'escolhido') return 'border-verde-link bg-cartao text-texto shadow-[0_0_0_3px_var(--color-verde-suave)]';
  return 'border-linha bg-cartao text-texto hover:border-borda-campo hover:bg-papel';
}

export function JogoDePares({ modo, cartoes, traducoes, conferir, aoMudar, desativado = false, rotulo }: Props) {
  const [deCima, setDeCima] = useState<number | null>(null);
  const [deBaixo, setDeBaixo] = useState<string | null>(null);
  // Pares já combinados: índice do cartão -> palavra em português e tradução.
  const [combinados, setCombinados] = useState<Map<number, { palavra: string; traducao: string }>>(new Map());
  const [errado, setErrado] = useState<{ i: number; t: string } | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const tentativas = useRef<Tentativa[]>([]);
  const relogio = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(relogio.current), []);

  const traducoesUsadas = new Set([...combinados.values()].map((par) => par.traducao));
  const completo = combinados.size === cartoes.length;

  async function tentar(i: number, t: string) {
    setConferindo(true);
    const resposta = await conferir(i, t);
    setConferindo(false);
    if (resposta === null) {
      setMensagem(es.quiz.sinConexion);
      return;
    }
    tentativas.current = [...tentativas.current, { i, t }];
    setDeCima(null);
    setDeBaixo(null);
    if (resposta.certo) {
      // Um erro de antes, ainda piscando, para de piscar: a mensagem agora é do acerto.
      window.clearTimeout(relogio.current);
      setErrado(null);
      const proximos = new Map(combinados).set(i, { palavra: resposta.palavra ?? '', traducao: t });
      setCombinados(proximos);
      const terminou = proximos.size === cartoes.length;
      const erros = tentativas.current.length - proximos.size;
      setMensagem(terminou ? (erros === 0 ? es.quiz.paresListos : es.quiz.paresConErrores) : `${es.quiz.combinado}: ${resposta.palavra ?? ''} = ${t}`);
      aoMudar?.(tentativas.current, terminou);
    } else {
      setErrado({ i, t });
      setMensagem(es.quiz.noEsEsa);
      window.clearTimeout(relogio.current);
      relogio.current = window.setTimeout(() => setErrado(null), 700);
      aoMudar?.(tentativas.current, false);
    }
  }

  function tocarCima(cartao: CartaoDoPar) {
    if (modo === 'audio') tocar(cartao);
    if (desativado || conferindo || combinados.has(cartao.indice)) return;
    if (deBaixo !== null) void tentar(cartao.indice, deBaixo);
    else setDeCima(deCima === cartao.indice ? null : cartao.indice);
  }

  function tocarBaixo(traducao: string) {
    if (desativado || conferindo || traducoesUsadas.has(traducao)) return;
    if (deCima !== null) void tentar(deCima, traducao);
    else setDeBaixo(deBaixo === traducao ? null : traducao);
  }

  const colunas = { '--colunas': String(Math.max(cartoes.length, 1)) } as CSSProperties;
  const grupo = 'flex min-w-0 flex-col gap-2.5 @lg:grid @lg:grid-cols-[repeat(var(--colunas),minmax(0,1fr))] @lg:gap-3';

  return (
    <div className="@container" style={colunas}>
      <p className="mb-3 text-[15px] text-apoio">{modo === 'audio' ? es.quiz.pistaPares : es.quiz.pistaParesEscrita}</p>
      <div role="group" aria-label={rotulo} className="grid grid-cols-2 gap-2.5 @lg:grid-cols-1 @lg:gap-3">
        <div className={grupo}>
          {cartoes.map((cartao, posicao) => {
            const par = combinados.get(cartao.indice);
            const estado = par ? 'certo' : errado?.i === cartao.indice ? 'errado' : deCima === cartao.indice ? 'escolhido' : 'livre';
            const texto = par?.palavra ?? cartao.palavra;
            return (
              <button
                key={cartao.indice}
                type="button"
                lang="pt-BR"
                // Qual par é (a posição na lista do professor): não diz a tradução, que vem embaralhada.
                data-indice={cartao.indice}
                onClick={() => tocarCima(cartao)}
                aria-pressed={estado === 'escolhido'}
                aria-label={
                  par
                    ? `${par.palavra}, ${es.quiz.combinado.toLowerCase()}`
                    : modo === 'audio'
                      ? `${es.quiz.escuchar} ${posicao + 1}`
                      : undefined
                }
                // Cartão já combinado continua tocando o som (para treinar a pronúncia), mas não
                // entra mais em outro par.
                disabled={desativado && !(par && modo === 'audio')}
                className={`${baseDoCartao} ${corDoCartao(estado)}`}
              >
                {par ? (
                  <span className="flex flex-col items-center gap-1">
                    {modo === 'audio' ? <IconoSonido tamano={18} /> : <IconoHecho tamano={16} />}
                    <span className="break-words">{par.palavra}</span>
                  </span>
                ) : modo === 'audio' ? (
                  <IconoSonido />
                ) : (
                  <span className="break-words">{texto}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className={grupo} lang="es">
          {traducoes.map((traducao) => {
            const usada = traducoesUsadas.has(traducao);
            const estado = usada ? 'certo' : errado?.t === traducao ? 'errado' : deBaixo === traducao ? 'escolhido' : 'livre';
            return (
              <button
                key={traducao}
                type="button"
                onClick={() => tocarBaixo(traducao)}
                aria-pressed={estado === 'escolhido'}
                aria-label={usada ? `${traducao}, ${es.quiz.combinado.toLowerCase()}` : undefined}
                disabled={desativado || usada}
                className={`${baseDoCartao} ${corDoCartao(estado)}`}
              >
                <span className="break-words">{traducao}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p aria-live="polite" className={`mt-3 min-h-6 text-[15px] font-semibold ${errado ? 'text-perigo' : completo ? 'text-verde' : 'text-apoio'}`}>
        {mensagem}
      </p>
    </div>
  );
}
