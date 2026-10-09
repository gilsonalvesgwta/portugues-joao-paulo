'use client';

// Tela mostrada quando uma página da administração falha (por exemplo, o banco fora do ar).
export default function ErroDaAdministracao({ reset }: { error: Error; reset: () => void }) {
  return (
    <section role="alert" className="rounded-2xl border border-perigo bg-cartao p-6">
      <h1 className="font-titulo text-2xl font-bold">Algo deu errado</h1>
      <p className="mt-2 text-[15px] leading-normal text-apoio">
        Não foi possível abrir esta tela agora. Nada do que já estava salvo foi perdido.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 min-h-11 cursor-pointer rounded-[10px] border border-verde bg-verde px-4 text-[15px] font-bold text-white hover:bg-verde-link"
      >
        Tentar de novo
      </button>
    </section>
  );
}
