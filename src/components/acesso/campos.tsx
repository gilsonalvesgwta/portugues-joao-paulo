import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconoAtras } from '@/components/aluno/iconos';

export const classeDoCampo =
  'box-border h-[54px] w-full min-w-0 rounded-[14px] border border-borda-campo bg-cartao px-4 text-[17px] text-texto placeholder:text-apoio lg:h-14';

export const classeDoRotulo = 'text-[15px] font-semibold';

// "tituloOculto": a tela de entrada não mostra o título (o formulário já diz o que é); ele fica
// só para leitor de tela, que precisa de um título em cada página.
export function Cabecalho({ area, titulo, texto, tituloOculto = false }: { area: string; titulo: string; texto?: string; tituloOculto?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 lg:gap-2.5">
      <p className="text-sm font-semibold text-dourado-texto lg:text-[15px]">{area}</p>
      <h1 className={tituloOculto ? 'sr-only' : 'font-titulo text-[34px] font-bold leading-[1.1] lg:text-[46px] lg:leading-[1.08] lg:tracking-[-0.01em]'}>{titulo}</h1>
      {texto ? <p className="text-base leading-normal text-apoio lg:text-[17px]">{texto}</p> : null}
    </div>
  );
}

// Mensagem acima do formulário: aviso de erro (lido na hora pelo leitor de tela) ou confirmação.
export function Aviso({ tipo, children }: { tipo: 'erro' | 'ok'; children: ReactNode }) {
  if (tipo === 'erro') {
    return (
      <p role="alert" className="rounded-[14px] border border-perigo bg-cartao px-4 py-3 text-[15px] font-semibold leading-normal text-perigo">
        {children}
      </p>
    );
  }
  return (
    <p role="status" className="rounded-[14px] border border-verde bg-verde-suave px-4 py-3 text-[15px] font-semibold leading-normal text-verde">
      {children}
    </p>
  );
}

export function CampoDeCorreo({ rotulo, exemplo }: { rotulo: string; exemplo: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="correo" className={classeDoRotulo}>
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
      className="flex h-14 w-full cursor-pointer items-center justify-center rounded-[14px] bg-verde text-[17px] font-bold text-white shadow-botao transition-colors hover:bg-verde-link lg:h-[58px]"
    >
      {children}
    </button>
  );
}

export const classeDoLink = 'inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-verde-link underline underline-offset-2 hover:text-verde';

// Link de volta para a tela de acesso, abaixo do formulário.
export function LinkDeTexto({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={classeDoLink}>
      <IconoAtras />
      <span>{children}</span>
    </Link>
  );
}
