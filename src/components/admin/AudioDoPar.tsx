'use client';

import { useEffect, useRef, useState } from 'react';
import { tocar } from '@/components/aluno/JogoDePares';
import { AUDIO_MAX_BYTES } from '@/lib/audios';
import { gravacaoParaWav } from '@/lib/wav';

// O som de uma palavra do jogo de pares, no editor do quiz: gravar pelo microfone (o arquivo sai
// em WAV, com o silêncio das pontas cortado), enviar um arquivo pronto, ouvir e apagar. A
// gravação é guardada assim que termina; o par passa a apontar para ela, e o quiz a usa depois de
// salvo. Sem gravação, o aluno ouve a voz do navegador.

const GRAVACAO_MAX_SEG = 10;

const classeDoBotao =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-linha bg-cartao px-3 text-sm font-semibold text-texto hover:bg-fundo disabled:cursor-default disabled:opacity-40';

const MOTIVOS: Record<string, string> = {
  formato: 'Esse arquivo não é de áudio. Use MP3, WAV, M4A ou OGG.',
  grande_demais: 'O arquivo passa de 2 MB. Use um trecho curto, só com a palavra.',
  recusado: 'A plataforma recusou o áudio. Entre de novo e tente outra vez.',
  aula: 'Não encontrei esta aula. Ela pode ter ido para a lixeira.',
};

async function enviar(aulaId: string, corpo: Blob): Promise<{ id: string } | { erro: string }> {
  try {
    const resposta = await fetch(`/api/admin/audios?aula=${encodeURIComponent(aulaId)}`, {
      method: 'POST',
      headers: { 'x-audio-do-quiz': '1', 'content-type': 'application/octet-stream' },
      body: corpo,
    });
    const lida = (await resposta.json().catch(() => ({}))) as { ok?: boolean; id?: string; motivo?: string };
    if (resposta.ok && lida.ok && typeof lida.id === 'string') return { id: lida.id };
    return { erro: (lida.motivo && MOTIVOS[lida.motivo]) || 'O áudio não foi guardado. Tente de novo.' };
  } catch {
    return { erro: 'O áudio não foi guardado. Confira a internet e tente de novo.' };
  }
}

type Gravador = { parar: () => void };

// Liga o microfone e junta as amostras até "parar". O WAV é montado no fim.
async function comecarAGravar(aoTerminar: (amostras: Float32Array, taxa: number) => void): Promise<Gravador> {
  const fluxo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const contexto = new AudioContext();
  const fonte = contexto.createMediaStreamSource(fluxo);
  const processador = contexto.createScriptProcessor(4096, 1, 1);
  const pedacos: Float32Array[] = [];
  processador.onaudioprocess = (evento) => pedacos.push(new Float32Array(evento.inputBuffer.getChannelData(0)));
  fonte.connect(processador);
  processador.connect(contexto.destination);
  let parado = false;
  return {
    parar() {
      if (parado) return;
      parado = true;
      processador.disconnect();
      fonte.disconnect();
      for (const trilha of fluxo.getTracks()) trilha.stop();
      const total = pedacos.reduce((soma, pedaco) => soma + pedaco.length, 0);
      const amostras = new Float32Array(total);
      let posicao = 0;
      for (const pedaco of pedacos) {
        amostras.set(pedaco, posicao);
        posicao += pedaco.length;
      }
      const taxa = contexto.sampleRate;
      void contexto.close();
      aoTerminar(amostras, taxa);
    },
  };
}

type Props = {
  aulaId: string;
  numero: number;
  palavra: string;
  audio: string | null;
  aoMudar: (audio: string | null) => void;
};

export function AudioDoPar({ aulaId, numero, palavra, audio, aoMudar }: Props) {
  const [situacao, setSituacao] = useState<'parado' | 'gravando' | 'guardando'>('parado');
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState('');
  const gravador = useRef<Gravador | null>(null);
  const relogio = useRef<number | undefined>(undefined);
  const arquivo = useRef<HTMLInputElement>(null);
  const desmontado = useRef(false);

  // Saindo da tela no meio de uma gravação: o microfone é desligado e nada é guardado.
  useEffect(() => {
    desmontado.current = false;
    return () => {
      desmontado.current = true;
      window.clearInterval(relogio.current);
      gravador.current?.parar();
    };
  }, []);

  async function guardar(corpo: Blob) {
    setSituacao('guardando');
    const resultado = await enviar(aulaId, corpo);
    setSituacao('parado');
    if ('id' in resultado) {
      setErro('');
      aoMudar(resultado.id);
    } else {
      setErro(resultado.erro);
    }
  }

  async function gravar() {
    setErro('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setErro('Este navegador não grava áudio. Use o Chrome, o Edge ou o Safari, ou envie um arquivo.');
      return;
    }
    try {
      gravador.current = await comecarAGravar((amostras, taxa) => {
        if (desmontado.current) return;
        const wav = gravacaoParaWav(amostras, taxa);
        if (!wav) {
          setSituacao('parado');
          setErro('Não ouvi nada. Fale mais perto do microfone e grave de novo.');
          return;
        }
        void guardar(new Blob([wav], { type: 'audio/wav' }));
      });
    } catch {
      setErro('O navegador não deixou usar o microfone. Libere o microfone para este site e tente de novo.');
      return;
    }
    setSituacao('gravando');
    setSegundos(0);
    const inicio = Date.now();
    relogio.current = window.setInterval(() => {
      const passados = Math.floor((Date.now() - inicio) / 1000);
      setSegundos(passados);
      if (passados >= GRAVACAO_MAX_SEG) parar();
    }, 250);
  }

  function parar() {
    window.clearInterval(relogio.current);
    const atual = gravador.current;
    gravador.current = null;
    if (atual) {
      setSituacao('guardando');
      atual.parar();
    }
  }

  function escolherArquivo(lista: FileList | null) {
    const escolhido = lista?.[0];
    if (arquivo.current) arquivo.current.value = '';
    if (!escolhido) return;
    if (escolhido.size > AUDIO_MAX_BYTES) {
      setErro(MOTIVOS.grande_demais ?? '');
      return;
    }
    void guardar(escolhido);
  }

  const ocupado = situacao !== 'parado';
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`mr-1 text-sm font-semibold ${audio ? 'text-verde' : 'text-apoio'}`}>
          {situacao === 'gravando'
            ? `Gravando… ${segundos}s de ${GRAVACAO_MAX_SEG}`
            : situacao === 'guardando'
              ? 'Guardando o áudio…'
              : audio
                ? 'Com a sua gravação'
                : 'Sem gravação: o navegador lê a palavra'}
        </span>
        {situacao === 'gravando' ? (
          <button type="button" onClick={parar} aria-label={`Parar a gravação da palavra ${numero}`} className={`${classeDoBotao} border-perigo text-perigo`}>
            <span aria-hidden="true" className="size-2.5 rounded-sm bg-perigo" />
            Parar
          </button>
        ) : (
          <button type="button" onClick={() => void gravar()} disabled={ocupado} aria-label={`${audio ? 'Gravar de novo' : 'Gravar'} a palavra ${numero}`} className={classeDoBotao}>
            <span aria-hidden="true" className="size-2.5 rounded-full bg-perigo" />
            {audio ? 'Gravar de novo' : 'Gravar'}
          </button>
        )}
        <button
          type="button"
          onClick={() => tocar(audio ? { audio } : { fala: palavra })}
          disabled={ocupado || (!audio && palavra.trim() === '')}
          aria-label={`Ouvir a palavra ${numero}`}
          className={classeDoBotao}
        >
          Ouvir
        </button>
        <button type="button" onClick={() => arquivo.current?.click()} disabled={ocupado} aria-label={`Enviar um arquivo de áudio para a palavra ${numero}`} className={classeDoBotao}>
          Enviar arquivo
        </button>
        <input
          ref={arquivo}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.ogg"
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
          data-arquivo-da-palavra={numero}
          onChange={(evento) => escolherArquivo(evento.target.files)}
        />
        {audio ? (
          <button type="button" onClick={() => aoMudar(null)} disabled={ocupado} aria-label={`Apagar a gravação da palavra ${numero}`} className={classeDoBotao}>
            Apagar gravação
          </button>
        ) : null}
      </div>
      {erro ? (
        <p role="alert" className="text-sm font-semibold text-perigo">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
