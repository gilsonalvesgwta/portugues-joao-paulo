import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { AvisoDaAcao } from '@/lib/admin/avisos';

// Peças visuais da administração (em português). O mesmo visual da área do aluno: cartões de
// canto largo com sombra leve, botões e campos altos, títulos em Playfair.

const classeDaEntrada =
  'box-border h-12 w-full min-w-0 rounded-xl border border-borda-campo bg-cartao px-3.5 text-base text-texto placeholder:text-apoio aria-[invalid=true]:border-perigo';

export function TituloDaPagina({ titulo, texto, children }: { titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col gap-1.5 lg:gap-2">
        <h1 className="break-words font-titulo text-[32px] font-bold leading-[1.1] lg:text-[40px] lg:tracking-[-0.01em]">{titulo}</h1>
        {texto ? <p className="text-base leading-normal text-apoio">{texto}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2.5">{children}</div> : null}
    </div>
  );
}

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[22px] border border-borda bg-cartao px-[18px] py-[22px] sm:rounded-3xl sm:p-7 sm:shadow-cartao ${className}`}>{children}</section>;
}

export function AvisoDaPagina({ aviso }: { aviso: AvisoDaAcao | null }) {
  if (!aviso) return null;
  return aviso.tipo === 'erro' ? (
    <p role="alert" className="rounded-2xl border border-perigo bg-cartao px-4 py-3 text-[15px] font-semibold leading-normal text-perigo">
      {aviso.texto}
    </p>
  ) : (
    <p role="status" className="rounded-2xl border border-verde bg-verde-suave px-4 py-3 text-[15px] font-semibold leading-normal text-verde">
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
    <span className={`inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-bold ${CLASSE_DO_TOM[tom]}`}>
      {children}
    </span>
  );
}

type Variante = 'principal' | 'secundario' | 'discreto';
const CLASSE_DA_VARIANTE: Record<Variante, string> = {
  principal: 'bg-verde text-white no-underline hover:bg-verde-link border border-verde shadow-botao',
  secundario: 'bg-cartao text-texto no-underline border border-linha hover:bg-fundo',
  discreto: 'bg-transparent text-verde-link border border-transparent underline hover:text-verde',
};
const classeDoBotao =
  'inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl text-[15px] font-bold transition-colors disabled:cursor-default disabled:opacity-50';

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
      className={`${classeDoBotao} ${CLASSE_DA_VARIANTE[variante]} ${quadrado ? 'w-12' : variante === 'discreto' ? 'px-1' : 'px-[18px]'}`}
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
    <Link href={href} className={`${classeDoBotao} ${CLASSE_DA_VARIANTE[variante]} ${variante === 'discreto' ? 'px-1' : 'px-[18px]'}`}>
      {children}
    </Link>
  );
}

// "nome" é o nome com que o campo é enviado. Em geral é o próprio id; só precisa ser dito quando
// a mesma tela tem dois formulários com o mesmo campo (os ids não podem se repetir).
type PropsDoCampo = { id: string; nome?: string; rotulo: string; erro?: string; ajuda?: string };

function Moldura({ id, rotulo, erro, ajuda, children }: PropsDoCampo & { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold sm:text-[15px]">
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
  nome,
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
        name={nome ?? id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(id, erro, ajuda)}
        className={classeDaEntrada}
      />
    </Moldura>
  );
}

export function Selecao({
  id,
  nome,
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
        name={nome ?? id}
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
        className="box-border min-h-32 w-full min-w-0 rounded-xl border border-borda-campo bg-cartao px-3.5 py-3 text-base leading-normal text-texto placeholder:text-apoio aria-[invalid=true]:border-perigo"
      />
    </Moldura>
  );
}

// Caixa de marcar com rótulo e ajuda. Marcada, envia "on"; desmarcada, não envia nada.
export function Caixa({
  id,
  nome,
  rotulo,
  ajuda,
  ...resto
}: { id: string; nome?: string; rotulo: string; ajuda?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'name' | 'type'>) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] font-semibold">
        <input
          {...resto}
          type="checkbox"
          id={id}
          name={nome ?? id}
          aria-describedby={ajuda ? `${id}-ajuda` : undefined}
          className="size-5 shrink-0 cursor-pointer accent-verde"
        />
        {rotulo}
      </label>
      {ajuda ? (
        <p id={`${id}-ajuda`} className="text-[13px] leading-normal text-apoio">
          {ajuda}
        </p>
      ) : null}
    </div>
  );
}

// Caminho de volta no topo dos formulários: "Aulas / Editar aula 18".
export function Trilha({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <Link href={href} className="-my-2 inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-semibold text-verde-link no-underline hover:text-verde">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      <span>{rotulo}</span>
    </Link>
  );
}

// Título de cartão, igual em todas as telas.
export const TITULO_DO_CARTAO = 'text-[21px] font-bold leading-tight';

// Uma linha de lista dentro de um cartão: o quadradinho com o número (verde se publicado, areia
// se rascunho), o título e a linha de apoio. Serve às listas do painel e das aulas.
export function NumeroDaAula({ numero, publicada }: { numero: number | string; publicada: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-11 shrink-0 items-center justify-center rounded-xl font-titulo text-xl font-bold italic ${publicada ? 'bg-verde-fundo text-dourado-claro' : 'bg-areia text-pedra'}`}
    >
      {numero}
    </span>
  );
}

// Selo pequeno e neutro, para dizer o que uma aula tem (duração, blocos, quiz).
export function Pilula({ alerta = false, children }: { alerta?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex h-7 items-center whitespace-nowrap rounded-full px-2.5 text-[13px] ${alerta ? 'bg-aviso-suave font-bold text-aviso' : 'bg-fundo font-semibold text-texto-suave'}`}>
      {children}
    </span>
  );
}
