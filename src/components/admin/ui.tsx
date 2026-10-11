import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { AvisoDaAcao } from '@/lib/admin/avisos';

// Peças visuais da administração (em português). Mesma paleta da área do aluno,
// com campos e botões um pouco mais compactos, próprios de tela de trabalho.

const classeDaEntrada =
  'box-border h-11 w-full min-w-0 rounded-[10px] border border-borda-campo bg-cartao px-3 text-[15px] text-texto placeholder:text-apoio aria-[invalid=true]:border-perigo';

export function TituloDaPagina({ titulo, texto, children }: { titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="font-titulo text-[32px] font-bold leading-tight">{titulo}</h1>
        {texto ? <p className="text-[15px] leading-normal text-apoio">{texto}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-3">{children}</div> : null}
    </div>
  );
}

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-linha bg-cartao p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function AvisoDaPagina({ aviso }: { aviso: AvisoDaAcao | null }) {
  if (!aviso) return null;
  return aviso.tipo === 'erro' ? (
    <p role="alert" className="rounded-xl border border-perigo bg-cartao px-4 py-3 text-[15px] font-semibold text-perigo">
      {aviso.texto}
    </p>
  ) : (
    <p role="status" className="rounded-xl border border-verde bg-verde-suave px-4 py-3 text-[15px] font-semibold text-verde">
      {aviso.texto}
    </p>
  );
}

type Tom = 'verde' | 'neutro' | 'aviso';
const CLASSE_DO_TOM: Record<Tom, string> = {
  verde: 'bg-verde-suave text-verde',
  neutro: 'bg-fundo text-apoio',
  aviso: 'bg-aviso-suave text-aviso',
};

export function Etiqueta({ tom = 'neutro', children }: { tom?: Tom; children: ReactNode }) {
  return (
    <span className={`inline-flex h-7 items-center whitespace-nowrap rounded-full px-3 text-[13px] font-semibold ${CLASSE_DO_TOM[tom]}`}>
      {children}
    </span>
  );
}

type Variante = 'principal' | 'secundario' | 'discreto';
const CLASSE_DA_VARIANTE: Record<Variante, string> = {
  principal: 'bg-verde text-white no-underline hover:bg-verde-link border border-verde',
  secundario: 'bg-cartao text-texto no-underline border border-borda-campo hover:bg-fundo',
  discreto: 'bg-transparent text-verde-link border border-transparent underline hover:text-verde',
};
const classeDoBotao =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] text-[15px] font-bold disabled:cursor-default disabled:opacity-50';

// "quadrado": botão de um símbolo só (setas de subir e descer).
export function Botao({
  variante = 'principal',
  quadrado = false,
  ...resto
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & { variante?: Variante; quadrado?: boolean }) {
  return (
    <button
      type="submit"
      {...resto}
      className={`${classeDoBotao} ${CLASSE_DA_VARIANTE[variante]} ${quadrado ? 'w-11' : variante === 'discreto' ? 'px-1' : 'px-4'}`}
    />
  );
}

export function LinkBotao({
  href,
  variante = 'principal',
  children,
}: {
  href: string;
  variante?: Variante;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${classeDoBotao} ${CLASSE_DA_VARIANTE[variante]} ${variante === 'discreto' ? 'px-1' : 'px-4'}`}>
      {children}
    </Link>
  );
}

type PropsDoCampo = { id: string; rotulo: string; erro?: string; ajuda?: string };

function Moldura({ id, rotulo, erro, ajuda, children }: PropsDoCampo & { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {rotulo}
      </label>
      {children}
      {ajuda ? (
        <p id={`${id}-ajuda`} className="text-[13px] leading-normal text-apoio">
          {ajuda}
        </p>
      ) : null}
      {erro ? (
        <p id={`${id}-erro`} className="text-sm font-semibold text-perigo">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

function descricao(id: string, erro?: string, ajuda?: string): string | undefined {
  const partes = [ajuda ? `${id}-ajuda` : '', erro ? `${id}-erro` : ''].filter(Boolean);
  return partes.length > 0 ? partes.join(' ') : undefined;
}

// Campo de texto com rótulo, ajuda e erro. O "name" é o próprio id.
export function Entrada({
  id,
  rotulo,
  erro,
  ajuda,
  ...resto
}: PropsDoCampo & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'name'>) {
  return (
    <Moldura id={id} rotulo={rotulo} erro={erro} ajuda={ajuda}>
      <input
        type="text"
        {...resto}
        id={id}
        name={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(id, erro, ajuda)}
        className={classeDaEntrada}
      />
    </Moldura>
  );
}

export function Selecao({
  id,
  rotulo,
  erro,
  ajuda,
  children,
  ...resto
}: PropsDoCampo & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'name'>) {
  return (
    <Moldura id={id} rotulo={rotulo} erro={erro} ajuda={ajuda}>
      <select
        {...resto}
        id={id}
        name={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(id, erro, ajuda)}
        className={classeDaEntrada}
      >
        {children}
      </select>
    </Moldura>
  );
}

// Campo de texto de várias linhas.
export function AreaDeTexto({
  id,
  rotulo,
  erro,
  ajuda,
  ...resto
}: PropsDoCampo & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'name'>) {
  return (
    <Moldura id={id} rotulo={rotulo} erro={erro} ajuda={ajuda}>
      <textarea
        {...resto}
        id={id}
        name={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(id, erro, ajuda)}
        className="box-border min-h-32 w-full min-w-0 rounded-[10px] border border-borda-campo bg-cartao px-3 py-2.5 text-[15px] leading-normal text-texto placeholder:text-apoio aria-[invalid=true]:border-perigo"
      />
    </Moldura>
  );
}

// Caminho de volta no topo dos formulários: "Aulas / Editar aula 18".
export function Trilha({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <Link href={href} className="self-start text-[15px] font-semibold text-verde-link underline hover:text-verde">
      ← {rotulo}
    </Link>
  );
}
