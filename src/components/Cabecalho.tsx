import Link from 'next/link';
import type { ReactNode } from 'react';
import { sair } from '@/app/(acesso)/acoes';
import { es } from '@/i18n/es';
import { inicialDe, nombreCorto } from '@/lib/aluno';

type Props = {
  inicio: string;
  nome: string;
  email: string;
  rotuloSair: string;
  // As seções da área (Curso, Conversación...), quando houver. No computador ficam no meio da
  // faixa; no celular, o próprio menu se desenha como barra fixa no pé da tela.
  menu?: ReactNode;
};

// Faixa do topo da área do aluno: a marca, as seções e quem está logado.
// No celular fica só a marca e a inicial da pessoa (que leva a «Mi cuenta», onde está o «Salir»).
export function CabecalhoInterno({ inicio, nome, email, rotuloSair, menu }: Props) {
  const inicial = inicialDe(nome, email);
  const claseDaInicial = 'size-11 shrink-0 items-center justify-center rounded-full bg-verde-suave text-base font-bold text-verde no-underline lg:size-10';
  return (
    <header className="border-b border-borda bg-cartao">
      <div className="mx-auto flex h-[60px] max-w-[1240px] items-center justify-between gap-x-6 px-5 sm:px-8 lg:h-[72px] lg:px-10">
        <Link href={inicio} className="flex min-h-11 items-center gap-2.5 text-texto no-underline lg:gap-3">
          <img src="/marca/icone.png" alt="" width={44} height={44} className="block size-9 rounded-[9px] lg:size-11 lg:rounded-[11px]" />
          <span className="flex items-baseline gap-1.5 font-titulo lg:flex-col lg:items-start lg:gap-0.5">
            <span className="text-lg font-bold leading-none lg:text-[21px]">{es.marca.nome}</span>
            <span className="whitespace-nowrap text-[13px] font-semibold leading-none text-dourado-texto">
              {es.marca.com} {es.marca.professor}
            </span>
          </span>
        </Link>
        {menu}
        <div className="flex items-center gap-3">
          {menu ? (
            <Link href="/cuenta" aria-label={`${es.comum.cuenta}, ${nome || email}`} className={`flex ${claseDaInicial}`}>
              {inicial}
            </Link>
          ) : (
            // Sem as seções (tela de confirmar o fuso), o «Salir» fica à vista; no celular ele toma o lugar da inicial.
            <span aria-hidden="true" className={`hidden sm:flex ${claseDaInicial}`}>
              {inicial}
            </span>
          )}
          <span className="hidden text-[15px] font-semibold xl:inline">{nombreCorto(nome, email)}</span>
          <form action={sair} className={menu ? 'hidden lg:block' : ''}>
            <button
              type="submit"
              className="h-11 cursor-pointer rounded-full border border-linha bg-cartao px-4 text-[15px] font-semibold text-apoio transition-colors hover:bg-fundo hover:text-texto lg:h-10"
            >
              {rotuloSair}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
