import type { ReactNode } from 'react';
import { es } from '@/i18n/es';

function Marca() {
  return (
    <div className="flex items-center gap-3.5">
      <img src="/marca/icone.png" alt="" width={56} height={56} className="block size-14 rounded-[14px]" />
      <div className="flex flex-col gap-0.5">
        <span className="font-titulo text-[28px] font-bold leading-none">{es.marca.nome}</span>
        <span className="font-titulo text-lg font-semibold leading-tight">
          {es.marca.com} <span className="text-dourado-texto">{es.marca.professor}</span>
        </span>
      </div>
    </div>
  );
}

// Moldura das telas de acesso: formulário à esquerda e o professor à direita.
// Em telas estreitas, o painel do professor vai para baixo do formulário.
export function MolduraDeAcesso({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex w-full max-w-[1120px] flex-wrap overflow-hidden rounded-3xl border border-linha bg-cartao">
        <main className="flex min-w-0 flex-[1_1_400px] flex-col gap-7 px-6 py-10 sm:px-14 sm:py-14">
          <Marca />
          {children}
        </main>
        <aside className="flex min-w-0 flex-[1_1_400px] flex-col justify-between gap-6 bg-verde px-6 pt-10 text-fundo sm:px-12 sm:pt-14">
          <div className="flex flex-col gap-4">
            <div className="h-[3px] w-12 bg-dourado" />
            <p className="font-titulo text-[32px] font-semibold italic leading-tight">{es.acesso.lema}</p>
            <p className="text-base leading-normal">{es.acesso.professor}</p>
          </div>
          <img
            src="/marca/professor-joao-paulo.png"
            alt={es.acesso.fotoAlt}
            width={490}
            height={510}
            className="block h-auto w-full max-w-[400px] self-center"
          />
        </aside>
      </div>
    </div>
  );
}
