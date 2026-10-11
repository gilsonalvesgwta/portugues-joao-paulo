import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Página no encontrada' };

// Endereço que não existe. Quem não está logado nem chega aqui: é levado para a tela de acesso.
export default function PaginaNaoEncontrada() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-start justify-center gap-4 px-5 py-10">
      <p className="text-[15px] font-semibold text-dourado-texto">Error 404</p>
      <h1 className="font-titulo text-[34px] font-bold leading-[1.1] lg:text-[46px] lg:leading-[1.08]">No encontramos esa página</h1>
      <p className="text-base leading-normal text-apoio">
        Puede que el enlace esté incompleto o que la página haya cambiado de lugar.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-12 items-center justify-center rounded-[14px] border border-verde bg-verde px-6 text-base font-bold text-white no-underline hover:bg-verde-link"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
