'use client';

import type { ReactNode } from 'react';

// Botão para ações que não têm volta (apagar um material, por exemplo): pergunta antes de enviar.
// A ação vem do servidor; os campos escondidos dizem a ela o que apagar.
type Props = {
  acao: (dados: FormData) => Promise<void>;
  campos: Record<string, string>;
  pergunta: string;
  rotulo?: string;
  children: ReactNode;
};

export function BotaoComConfirmacao({ acao, campos, pergunta, rotulo, children }: Props) {
  return (
    <form
      action={acao}
      onSubmit={(evento) => {
        if (!window.confirm(pergunta)) evento.preventDefault();
      }}
    >
      {Object.entries(campos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      <button
        type="submit"
        aria-label={rotulo}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border border-perigo bg-cartao px-4 text-[15px] font-bold text-perigo hover:bg-fundo"
      >
        {children}
      </button>
    </form>
  );
}
