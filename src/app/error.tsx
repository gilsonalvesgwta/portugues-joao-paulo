'use client';

import { useEffect } from 'react';

// Quando uma tela falha (o banco não respondeu, por exemplo): uma explicação e um jeito de tentar
// de novo, em vez da tela técnica do servidor. O detalhe do erro fica no registro do servidor.
export default function TelaDeErro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error.digest ?? error.message);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-[560px] flex-col items-start justify-center gap-4 px-5 py-10">
      <h1 className="font-titulo text-[34px] font-bold leading-[1.1] lg:text-[46px] lg:leading-[1.08]">Algo no salió bien</h1>
      <p role="alert" className="text-base leading-normal text-apoio">
        No pudimos cargar esta página. Suele resolverse en unos segundos: inténtalo de nuevo.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-[14px] border border-verde bg-verde px-6 text-base font-bold text-white hover:bg-verde-link"
        >
          Intentar de nuevo
        </button>
        <a
          href="/"
          className="inline-flex min-h-12 items-center justify-center rounded-[14px] border border-linha bg-cartao px-6 text-base font-bold text-texto no-underline hover:bg-fundo"
        >
          Volver al inicio
        </a>
      </div>
    </main>
  );
}
