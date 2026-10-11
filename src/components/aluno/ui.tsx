import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { IconoArchivo, IconoHecho } from './iconos';

// Peças visuais da área do aluno (em espanhol): cartões de canto largo com sombra leve, botões
// altos, fáceis de tocar no celular, e as cores da marca.

// Estilos de texto e de campo usados em todas as telas da área.
export const TITULO_DE_PAGINA = 'break-words font-titulo text-[34px] font-bold leading-[1.1] lg:text-[46px] lg:leading-[1.08] lg:tracking-[-0.01em]';
export const TEXTO_DE_PAGINA = 'text-base leading-normal text-apoio lg:text-lg';
export const TITULO_DE_TARJETA = 'text-[21px] font-bold leading-tight lg:text-[22px]';
export const CLASE_DEL_CAMPO = 'box-border h-[52px] w-full min-w-0 rounded-[14px] border border-borda-campo bg-cartao px-4 text-[17px] text-texto placeholder:text-apoio';
export const CLASE_DEL_ROTULO = 'text-[15px] font-semibold';

type Fundo = 'blanco' | 'papel';
const FUNDO: Record<Fundo, string> = { blanco: 'bg-cartao sm:shadow-cartao', papel: 'bg-papel' };

export function Tarjeta({
  children,
  className = '',
  id,
  fondo = 'blanco',
  rotulo,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  fondo?: Fundo;
  // id do título que dá nome ao cartão, para leitor de tela.
  rotulo?: string;
}) {
  return (
    <section id={id} aria-labelledby={rotulo} className={`rounded-3xl border border-borda px-[18px] py-[22px] sm:rounded-[28px] sm:p-7 ${FUNDO[fondo]} ${className}`}>
      {children}
    </section>
  );
}

type Variante = 'principal' | 'secundario' | 'contorno';
const BASE =
  'inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[14px] px-5 text-base font-bold no-underline transition-colors disabled:cursor-default disabled:opacity-50';
const VARIANTE: Record<Variante, string> = {
  principal: 'border border-verde bg-verde text-white hover:border-verde-link hover:bg-verde-link',
  secundario: 'border border-linha bg-cartao text-texto hover:bg-fundo',
  contorno: 'border border-verde bg-cartao text-verde hover:bg-verde-suave',
};

export function Boton({
  variante = 'principal',
  className = '',
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return <button type="submit" {...resto} className={`${BASE} ${VARIANTE[variante]} ${className}`} />;
}

export function EnlaceBoton({
  href,
  variante = 'principal',
  className = '',
  children,
}: {
  href: string;
  variante?: Variante;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTE[variante]} ${className}`}>
      {children}
    </Link>
  );
}

// Link de texto, com área de toque de 44 px no celular.
export const CLASE_DEL_ENLACE = 'inline-flex min-h-11 items-center text-[15px] font-semibold text-verde-link underline underline-offset-2 hover:text-verde';

type Tom = 'verde' | 'neutro' | 'aviso' | 'dorado';
const TOM: Record<Tom, string> = {
  verde: 'bg-verde-suave text-verde',
  neutro: 'bg-fundo text-apoio',
  aviso: 'bg-aviso-suave text-aviso',
  dorado: 'bg-aviso-suave text-dourado-texto',
};

export function Sello({ tom = 'neutro', children }: { tom?: Tom; children: ReactNode }) {
  return <span className={`inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-bold ${TOM[tom]}`}>{children}</span>;
}

// Faixa de aviso no topo da tela: erro (vermelho) ou informação (verde).
export function Aviso({ tipo, children }: { tipo: 'error' | 'info'; children: ReactNode }) {
  return tipo === 'error' ? (
    <p role="alert" className="rounded-2xl border border-perigo bg-cartao px-4 py-3 text-[15px] font-semibold leading-normal text-perigo">
      {children}
    </p>
  ) : (
    <p role="status" className="rounded-2xl border border-verde bg-verde-suave px-4 py-3 text-[15px] font-semibold leading-normal text-verde">
      {children}
    </p>
  );
}

// Rótulo pequeno acima dos títulos ("Tu curso", "Apuntes de la clase").
export function Antetitulo({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} className="text-sm font-semibold text-dourado-texto sm:text-[15px]">
      {children}
    </p>
  );
}

// Marca de feito ou por fazer, com texto para leitor de tela.
export function Marca({ hecho, textoHecho, textoPendiente, destacada = false }: { hecho: boolean; textoHecho: string; textoPendiente: string; destacada?: boolean }) {
  return (
    <span
      className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${
        hecho ? 'border-verde bg-verde text-white' : destacada ? 'border-verde bg-cartao' : 'border-borda-campo bg-cartao'
      }`}
    >
      {hecho ? <IconoHecho tamano={14} /> : null}
      <span className="sr-only">{hecho ? textoHecho : textoPendiente}</span>
    </span>
  );
}

// Um material para abrir ou baixar (PDF, planilha...): o cartão inteiro é o link.
export function Material({ titulo, descripcion, enlace, aviso }: { titulo: string; descripcion: string | null; enlace: string; aviso: string }) {
  const detalhe = descripcion ? `${descripcion.trim().replace(/\.$/, '')}. ${aviso}` : aviso;
  return (
    <a
      href={enlace}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-borda px-2.5 py-2 text-texto no-underline transition-colors hover:border-verde sm:gap-3.5 sm:px-3"
    >
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-aviso-suave text-dourado-texto">
        <IconoArchivo />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="break-words text-base font-bold leading-snug">{titulo}</span>
        <span className="text-sm leading-snug text-apoio">{detalhe}</span>
      </span>
    </a>
  );
}
