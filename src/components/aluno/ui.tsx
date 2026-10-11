import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

// Peças visuais da área do aluno (em espanhol). Mesma paleta da administração, com mais
// respiro: cartões de canto largo e botões altos, fáceis de tocar no celular.

export function Tarjeta({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`rounded-[20px] border border-linha bg-cartao p-5 sm:p-7 ${className}`}>
      {children}
    </section>
  );
}

type Variante = 'principal' | 'secundario';
const BASE =
  'inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-5 text-base font-bold no-underline disabled:cursor-default disabled:opacity-50';
const VARIANTE: Record<Variante, string> = {
  principal: 'border border-verde bg-verde text-white hover:bg-verde-link',
  secundario: 'border border-borda-campo bg-cartao text-texto hover:bg-fundo',
};

export function Boton({
  variante = 'principal',
  ...resto
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & { variante?: Variante }) {
  return <button type="submit" {...resto} className={`${BASE} ${VARIANTE[variante]}`} />;
}

export function EnlaceBoton({ href, variante = 'principal', children }: { href: string; variante?: Variante; children: ReactNode }) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTE[variante]}`}>
      {children}
    </Link>
  );
}

type Tom = 'verde' | 'neutro' | 'aviso';
const TOM: Record<Tom, string> = { verde: 'bg-verde-suave text-verde', neutro: 'bg-fundo text-apoio', aviso: 'bg-aviso-suave text-aviso' };

export function Sello({ tom = 'neutro', children }: { tom?: Tom; children: ReactNode }) {
  return <span className={`inline-flex h-7 items-center whitespace-nowrap rounded-full px-3 text-[13px] font-semibold ${TOM[tom]}`}>{children}</span>;
}

// Faixa de aviso no topo da tela: erro (vermelho) ou informação (verde).
export function Aviso({ tipo, children }: { tipo: 'error' | 'info'; children: ReactNode }) {
  return tipo === 'error' ? (
    <p role="alert" className="rounded-xl border border-perigo bg-cartao px-4 py-3 text-[15px] font-semibold text-perigo">
      {children}
    </p>
  ) : (
    <p role="status" className="rounded-xl border border-verde bg-verde-suave px-4 py-3 text-[15px] font-semibold text-verde">
      {children}
    </p>
  );
}

// Rótulo pequeno em maiúsculas, acima dos títulos ("TU CURSO", "MÓDULO 1 · CLASE 18").
export function Antetitulo({ children }: { children: ReactNode }) {
  return <p className="text-xs font-bold tracking-[0.14em] text-dourado-texto">{children}</p>;
}

// Marca de feito ou por fazer, com texto para leitor de tela.
export function Marca({ hecho, textoHecho, textoPendiente }: { hecho: boolean; textoHecho: string; textoPendiente: string }) {
  return (
    <span
      className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
        hecho ? 'border-verde bg-verde text-white' : 'border-borda-campo bg-cartao text-transparent'
      }`}
    >
      <span aria-hidden="true">✓</span>
      <span className="sr-only">{hecho ? textoHecho : textoPendiente}</span>
    </span>
  );
}
