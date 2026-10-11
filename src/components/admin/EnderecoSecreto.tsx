'use client';

import { useState } from 'react';
import { enderecoDoWebhook } from '@/app/admin/pagamentos/acoes';
import { usePronto } from '@/components/usePronto';

// O endereço do webhook de pagamento funciona como senha. Por isso ele não vem escrito na página:
// aparece com o trecho secreto escondido, e o endereço completo só é pedido ao servidor quando o
// administrador clica em "Mostrar" ou em "Copiar o endereço".
export function EnderecoSecreto({ escondido, rotulo }: { escondido: string; rotulo: string }) {
  const pronto = usePronto();
  const [endereco, setEndereco] = useState<string | null>(null);
  const [visivel, setVisivel] = useState(false);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function buscar(): Promise<string | null> {
    if (endereco !== null) return endereco;
    setOcupado(true);
    try {
      const lido = await enderecoDoWebhook();
      if (lido === null) setAviso('Não consegui ler o endereço. Recarregue a página e tente de novo.');
      else setEndereco(lido);
      return lido;
    } catch {
      setAviso('Não consegui ler o endereço. Recarregue a página e tente de novo.');
      return null;
    } finally {
      setOcupado(false);
    }
  }

  async function mostrar() {
    if (visivel) {
      setVisivel(false);
      return;
    }
    if ((await buscar()) !== null) setVisivel(true);
  }

  async function copiar() {
    const lido = await buscar();
    if (lido === null) return;
    try {
      await navigator.clipboard.writeText(lido);
      setAviso('Endereço copiado.');
    } catch {
      // Navegador que não deixa copiar por aqui: o endereço aparece para ser copiado à mão.
      setVisivel(true);
      setAviso('Selecione o endereço acima e copie.');
    }
  }

  const classeDoBotao =
    'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border border-borda-campo bg-cartao px-4 text-[15px] font-bold text-texto hover:bg-fundo disabled:cursor-default disabled:opacity-50';

  return (
    <div className="flex flex-col gap-2">
      <p aria-label={rotulo} className="select-all break-all rounded-[10px] bg-fundo px-3 py-2 font-mono text-sm text-texto">
        {visivel && endereco !== null ? endereco : escondido}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={!pronto || ocupado} onClick={copiar} className={classeDoBotao}>
          Copiar o endereço
        </button>
        <button type="button" disabled={!pronto || ocupado} onClick={mostrar} aria-pressed={visivel} className={classeDoBotao}>
          {visivel ? 'Esconder' : 'Mostrar'}
        </button>
        <span role="status" className="text-[15px] font-semibold text-verde">
          {aviso}
        </span>
      </div>
    </div>
  );
}
