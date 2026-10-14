'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';

// Enviar uma cópia de segurança: escolhe o arquivo .sql.gz e manda para a plataforma, mostrando
// quanto já foi. A cópia entra na lista; restaurar é outro passo, com confirmação.

const MOTIVOS: Record<string, string> = {
  nao_e_copia: 'Esse arquivo não é uma cópia de segurança da plataforma (um arquivo .sql.gz baixado desta tela). Nada foi guardado.',
  grande_demais: 'O arquivo passa de 2 GB. Nada foi guardado.',
  desligado: 'O serviço de cópias não está ligado nesta instalação.',
  recusado: 'A plataforma recusou o envio. Entre de novo como administrador e tente outra vez.',
};
const FALHA = 'O envio não terminou. Confira a internet e tente de novo.';

export function EnviarCopia() {
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<{ erro: boolean; texto: string } | null>(null);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const arquivo = campo.current?.files?.[0];
    if (!arquivo) {
      setMensagem({ erro: true, texto: 'Escolha o arquivo da cópia (termina em .sql.gz).' });
      return;
    }
    if (!arquivo.name.endsWith('.gz')) {
      setMensagem({ erro: true, texto: MOTIVOS.nao_e_copia ?? FALHA });
      return;
    }
    setEnviando(true);
    setMensagem({ erro: false, texto: 'Enviando… 0%' });
    const pedido = new XMLHttpRequest();
    pedido.open('POST', '/api/admin/copias/enviar');
    pedido.setRequestHeader('x-copia-de-seguranca', '1');
    pedido.setRequestHeader('content-type', 'application/gzip');
    pedido.upload.onprogress = (progresso) => {
      if (progresso.lengthComputable) {
        const feito = Math.floor((progresso.loaded / progresso.total) * 100);
        setMensagem({ erro: false, texto: feito >= 100 ? 'Conferindo o arquivo…' : `Enviando… ${feito}%` });
      }
    };
    pedido.onload = () => {
      let resposta: { ok?: boolean; motivo?: string } = {};
      try {
        resposta = JSON.parse(pedido.responseText) as typeof resposta;
      } catch {
        // Resposta que não é da plataforma: vale a mensagem de falha.
      }
      if (pedido.status === 200 && resposta.ok) {
        if (campo.current) campo.current.value = '';
        setEnviando(false);
        setMensagem(null);
        router.push('/admin/copias?aviso=copia_enviada');
        router.refresh();
        return;
      }
      setEnviando(false);
      setMensagem({ erro: true, texto: (resposta.motivo && MOTIVOS[resposta.motivo]) || FALHA });
    };
    pedido.onerror = () => {
      setEnviando(false);
      setMensagem({ erro: true, texto: FALHA });
    };
    pedido.send(arquivo);
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor="arquivo_da_copia" className="text-sm font-semibold sm:text-[15px]">
          Arquivo da cópia
        </label>
        <input
          ref={campo}
          id="arquivo_da_copia"
          type="file"
          accept=".gz,application/gzip"
          disabled={enviando}
          className="block w-full min-w-0 cursor-pointer rounded-xl border border-borda-campo bg-cartao p-2 text-[15px] text-texto file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-fundo file:px-3 file:font-semibold file:text-texto"
        />
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex min-h-12 cursor-pointer items-center justify-center self-start rounded-xl border border-linha bg-cartao px-[18px] text-[15px] font-bold text-texto transition-colors hover:bg-fundo disabled:cursor-default disabled:opacity-50"
      >
        Enviar cópia
      </button>
      {mensagem ? (
        <p role={mensagem.erro ? 'alert' : 'status'} className={`text-[15px] font-semibold leading-normal ${mensagem.erro ? 'text-perigo' : 'text-verde'}`}>
          {mensagem.texto}
        </p>
      ) : null}
    </form>
  );
}
