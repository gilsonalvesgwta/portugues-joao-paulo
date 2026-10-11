'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { registrarVideo } from '@/app/(aluno)/acoes';

// O vídeo da aula, no reprodutor do YouTube. O quadro do vídeo vem pronto do servidor e toca
// mesmo que o resto falhe. Por cima dele, se "registrar" estiver ligado, a página conversa com o
// reprodutor (pela ferramenta oficial do YouTube) para guardar onde o aluno parou e marcar a
// aula como vista quando o vídeo chega perto do fim. Se essa conversa não acontecer (bloqueador,
// rede), nada quebra: o aluno marca a aula no botão.

type Jogador = { getCurrentTime?: () => number; getDuration?: () => number };
type Evento = { data: number };
type FerramentaDoYoutube = { Player: new (id: string, opcoes: { events: { onStateChange: (evento: Evento) => void } }) => Jogador };

declare global {
  interface Window {
    YT?: FerramentaDoYoutube;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const TOCANDO = 1;
const PASSO_MS = 15_000; // de quanto em quanto tempo a posição é guardada enquanto o vídeo toca
const DIFERENCA_MIN = 5; // segundos: menos que isso desde a última gravação não vale outra

type Props = { aulaId: string; codigo: string; titulo: string; inicio: number; origem: string; registrar: boolean };

export function VideoDeLaClase({ aulaId, codigo, titulo, inicio, origem, registrar }: Props) {
  const router = useRouter();
  const idDoQuadro = `video-${aulaId}`;

  useEffect(() => {
    if (!registrar) return;
    let vivo = true;
    let jogador: Jogador | null = null;
    let relogio: ReturnType<typeof setInterval> | null = null;
    let ultima = -1;
    let vista = false;

    const medir = async () => {
      if (!vivo || !jogador || vista) return;
      let posicao = 0;
      let duracao = 0;
      try {
        posicao = jogador.getCurrentTime?.() ?? 0;
        duracao = jogador.getDuration?.() ?? 0;
      } catch {
        return;
      }
      if (!Number.isFinite(posicao) || Math.abs(posicao - ultima) < DIFERENCA_MIN) return;
      ultima = posicao;
      try {
        const resposta = await registrarVideo(aulaId, posicao, duracao);
        if (resposta.vista && vivo) {
          vista = true;
          router.refresh();
        }
      } catch {
        // Sem rede por um instante: a próxima medição tenta de novo.
        ultima = -1;
      }
    };

    const parar = () => {
      if (relogio !== null) clearInterval(relogio);
      relogio = null;
    };

    const ligar = () => {
      if (!vivo || jogador !== null || !window.YT?.Player) return;
      try {
        jogador = new window.YT.Player(idDoQuadro, {
          events: {
            onStateChange: (evento) => {
              if (evento.data === TOCANDO) {
                if (relogio === null) relogio = setInterval(medir, PASSO_MS);
              } else {
                // Pausa, fim ou troca de ponto: guarda na hora.
                parar();
                void medir();
              }
            },
          },
        });
      } catch {
        jogador = null;
      }
    };

    if (window.YT?.Player) {
      ligar();
    } else {
      const anterior = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        anterior?.();
        ligar();
      };
      if (!document.querySelector('script[data-ferramenta-do-youtube]')) {
        const ferramenta = document.createElement('script');
        ferramenta.src = 'https://www.youtube.com/iframe_api';
        ferramenta.async = true;
        ferramenta.dataset.ferramentaDoYoutube = '1';
        document.head.appendChild(ferramenta);
      }
    }

    return () => {
      vivo = false;
      parar();
    };
  }, [aulaId, idDoQuadro, registrar, router]);

  const parametros = new URLSearchParams({ rel: '0', enablejsapi: '1' });
  if (origem !== '') parametros.set('origin', origem);
  if (inicio > 0) parametros.set('start', String(inicio));

  return (
    <div className="aspect-video w-full overflow-hidden rounded-[20px] bg-carvao">
      <iframe
        id={idDoQuadro}
        src={`https://www.youtube-nocookie.com/embed/${codigo}?${parametros.toString()}`}
        title={titulo}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="block size-full border-0"
      />
    </div>
  );
}
