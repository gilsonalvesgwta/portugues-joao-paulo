import type { ReactNode } from 'react';
import { es } from '@/i18n/es';

// A marca: no computador vai sobre o fundo claro; no celular, sobre a faixa verde.
function Marca({ clara = false, className = '' }: { clara?: boolean; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 lg:gap-3 ${className}`}>
      <img src="/marca/icone.png" alt="" width={48} height={48} className="block size-10 rounded-[10px] lg:size-12 lg:rounded-xl" />
      <div className="flex flex-col gap-0.5 font-titulo">
        <span className="text-xl font-bold leading-none lg:text-2xl">{es.marca.nome}</span>
        <span className={`text-[13px] font-semibold leading-[1.1] lg:text-[15px] ${clara ? 'text-dourado-claro' : 'text-dourado-texto'}`}>
          {es.marca.com} {es.marca.professor}
        </span>
      </div>
    </div>
  );
}

// A foto do professor, recortada, direto sobre o verde. O arquivo menor serve ao celular; o
// inteiro, ao computador e às telas de alta definição.
function Retrato({ className, tamanhos }: { className: string; tamanhos: string }) {
  return (
    <img
      src="/marca/professor-retrato.webp"
      srcSet="/marca/professor-retrato-640.webp 640w, /marca/professor-retrato.webp 1229w"
      sizes={tamanhos}
      alt={es.acesso.fotoAlt}
      width={1229}
      height={1280}
      className={className}
    />
  );
}

// Moldura das telas de acesso. No computador, o formulário à esquerda e o professor à direita,
// cada um com metade da tela. No celular e no tablet, o professor vira uma faixa no topo e o
// formulário vem logo abaixo, sem rolar até ele.
export function MolduraDeAcesso({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-fundo lg:flex-row">
      <div className="relative h-[276px] shrink-0 overflow-hidden bg-verde px-6 pt-6 text-fundo lg:hidden">
        {/* A foto ocupa a altura da faixa, encostada embaixo e à direita, com o ombro saindo um pouco da tela. */}
        <Retrato tamanhos="261px" className="absolute -right-2.5 bottom-0 block h-auto w-[67vw] max-w-[261px]" />
        <Marca clara className="relative" />
        <div className="relative mt-[30px] flex w-[164px] flex-col gap-3 min-[380px]:w-[178px] sm:w-[300px]">
          <div className="h-[3px] w-10 bg-dourado" />
          <p className="font-titulo text-[25px] font-semibold italic leading-[1.14] min-[380px]:text-[27px]">{es.acesso.lema}</p>
        </div>
      </div>

      <main className="flex min-w-0 flex-1 flex-col gap-6 px-6 pb-8 pt-[26px] lg:w-1/2 lg:flex-none lg:justify-between lg:gap-12 lg:px-14 lg:pb-10 lg:pt-12">
        <Marca className="hidden lg:flex" />
        <div className="mx-auto flex w-full max-w-[420px] flex-col gap-5 lg:gap-7">{children}</div>
        <p className="mx-auto w-full max-w-[420px] text-sm leading-normal text-apoio lg:mx-0 lg:max-w-none">{es.acesso.ayuda}</p>
      </main>

      <aside className="hidden w-1/2 min-w-0 flex-none flex-col overflow-hidden bg-verde pt-[72px] text-fundo lg:flex">
        <div className="flex max-w-[648px] flex-col gap-5 px-12 xl:px-16">
          <div className="h-[3px] w-14 bg-dourado" />
          <p className="font-titulo text-[40px] font-semibold italic leading-[1.12] tracking-[-0.01em] xl:text-[46px]">{es.acesso.lema}</p>
          <p className="text-lg leading-normal text-menta">{es.acesso.professor}</p>
        </div>
        {/* A foto enche o espaço que sobra abaixo do texto, encostada embaixo e à direita. */}
        <div className="relative mt-[3px] min-h-[340px] flex-1">
          <Retrato tamanhos="(min-width: 1024px) 560px, 1px" className="absolute inset-0 block size-full object-contain object-right-bottom" />
        </div>
      </aside>
    </div>
  );
}
