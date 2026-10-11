import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Página no encontrada' };

// Endereço que não existe. Quem não está logado nem chega aqui: é levado para a tela de acesso.
export default function PaginaNaoEncontrada() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-start justify-center gap-4 px-4 py-10">
      <p className="text-xs font-bold tracking-[0.14em] text-dourado-texto">ERROR 404</p>
      <h1 className="font-titulo text-4xl font-bold leading-tight">No encontramos esa página</h1>
      <p className="text-base leading-normal text-apoio">
        Puede que el enlace esté incompleto o que la página haya cambiado de lugar.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-12 items-center justify-center rounded-xl border border-verde bg-verde px-5 text-base font-bold text-white no-underline hover:bg-verde-link"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
