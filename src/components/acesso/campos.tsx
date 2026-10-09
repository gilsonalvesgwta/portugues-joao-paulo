import Link from 'next/link';
import type { ReactNode } from 'react';

export const classeDoCampo =
  'box-border h-[52px] w-full min-w-0 rounded-xl border border-borda-campo bg-cartao px-4 text-base text-texto placeholder:text-apoio';

export function Cabecalho({ area, titulo, texto }: { area: string; titulo: string; texto?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold tracking-[0.16em] text-apoio">{area}</p>
      <h1 className="font-titulo text-4xl font-bold leading-[1.15]">{titulo}</h1>
      {texto ? <p className="text-base leading-normal text-apoio">{texto}</p> : null}
    </div>
  );
}

export function CampoDeCorreo({ rotulo, exemplo }: { rotulo: string; exemplo: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="correo" className="text-[15px] font-semibold">
        {rotulo}
      </label>
      <input
        id="correo"
        name="correo"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder={exemplo}
        className={classeDoCampo}
      />
    </div>
  );
}

export function BotaoPrincipal({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="flex h-14 w-full cursor-pointer items-center justify-center rounded-[14px] bg-verde text-base font-bold tracking-[0.02em] text-white hover:bg-verde-link"
    >
      {children}
    </button>
  );
}

export function LinkDeTexto({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="px-2 py-3 text-[15px] text-verde-link underline hover:text-verde">
      {children}
    </Link>
  );
}
