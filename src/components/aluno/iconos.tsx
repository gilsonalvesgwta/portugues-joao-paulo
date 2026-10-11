import type { ReactNode } from 'react';

// Ícones da área do aluno, desenhados em linha (sem biblioteca). Todos são enfeite: o texto ao
// lado diz o que o ícone mostra, então ficam fora da leitura de tela.

type Props = { tamano?: number; className?: string };

function Linea({ tamano = 20, grosor = 2, className, children }: Props & { grosor?: number; children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className ?? ''}`}
    >
      {children}
    </svg>
  );
}

export function IconoReproducir({ tamano = 20, className }: Props) {
  return (
    <svg aria-hidden="true" width={tamano} height={tamano} viewBox="0 0 24 24" fill="currentColor" className={`shrink-0 ${className ?? ''}`}>
      <path d="M8 5v14a1 1 0 0 0 1.5.86l11-7a1 1 0 0 0 0-1.72l-11-7A1 1 0 0 0 8 5z" />
    </svg>
  );
}

export function IconoHecho({ tamano = 16, className }: Props) {
  return (
    <Linea tamano={tamano} grosor={3} className={className}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Linea>
  );
}

export function IconoAtras({ tamano = 18, className }: Props) {
  return (
    <Linea tamano={tamano} grosor={2.2} className={className}>
      <path d="M15 6l-6 6 6 6" />
    </Linea>
  );
}

export function IconoAdelante({ tamano = 18, className }: Props) {
  return (
    <Linea tamano={tamano} grosor={2.2} className={className}>
      <path d="M9 6l6 6-6 6" />
    </Linea>
  );
}

export function IconoCandado({ tamano = 16, className }: Props) {
  return (
    <Linea tamano={tamano} className={className}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Linea>
  );
}

export function IconoArchivo({ tamano = 20, className }: Props) {
  return (
    <Linea tamano={tamano} grosor={1.8} className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </Linea>
  );
}

export function IconoLlave({ tamano = 22, className }: Props) {
  return (
    <Linea tamano={tamano} grosor={1.8} className={className}>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9" />
      <path d="M16 7l3 3" />
    </Linea>
  );
}

export function IconoCurso({ tamano = 24, className }: Props) {
  return (
    <Linea tamano={tamano} className={className}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z" />
    </Linea>
  );
}

export function IconoEnVivo({ tamano = 24, className }: Props) {
  return (
    <Linea tamano={tamano} className={className}>
      <rect x="3" y="6" width="13" height="12" rx="2.5" />
      <path d="M16 10.5l5-3v9l-5-3z" />
    </Linea>
  );
}

export function IconoPapo({ tamano = 24, className }: Props) {
  return (
    <Linea tamano={tamano} className={className}>
      <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    </Linea>
  );
}

export function IconoCuenta({ tamano = 24, className }: Props) {
  return (
    <Linea tamano={tamano} className={className}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.5 3.6-5 7-5s6.2 1.5 7 5" />
    </Linea>
  );
}
