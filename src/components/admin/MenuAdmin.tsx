'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { sair } from '@/app/(acesso)/acoes';

// O menu da administração, em dois grupos. No computador fica na faixa verde da esquerda; no
// celular e no tablet, uma faixa fina no topo com o botão "Menu", que abre a lista por cima da
// tela. "soAdmin": o professor não vê.

type Item = { href: string; rotulo: string; prefixos: string[]; soAdmin: boolean; icone: ReactNode };

function Icone({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {children}
    </svg>
  );
}

const GRUPOS: { titulo: string; itens: Item[] }[] = [
  {
    titulo: 'Conteúdo',
    itens: [
      { href: '/admin', rotulo: 'Painel', prefixos: [], soAdmin: false, icone: <Icone><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></Icone> },
      { href: '/admin/cursos', rotulo: 'Cursos e módulos', prefixos: ['/admin/cursos', '/admin/modulos'], soAdmin: false, icone: <Icone><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z" /></Icone> },
      { href: '/admin/aulas', rotulo: 'Aulas', prefixos: ['/admin/aulas', '/admin/materiais'], soAdmin: false, icone: <Icone><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10 9.5v5l4.5-2.5z" /></Icone> },
      { href: '/admin/tarefas', rotulo: 'Tarefas', prefixos: ['/admin/tarefas'], soAdmin: false, icone: <Icone><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></Icone> },
      { href: '/admin/trilha', rotulo: 'Trilha por dia', prefixos: ['/admin/trilha'], soAdmin: false, icone: <Icone><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16" /><path d="M9 3v4" /><path d="M15 3v4" /></Icone> },
    ],
  },
  {
    titulo: 'Turmas e alunos',
    itens: [
      { href: '/admin/conversacao', rotulo: 'Conversação', prefixos: ['/admin/conversacao'], soAdmin: false, icone: <Icone><rect x="3" y="6" width="13" height="12" rx="2.5" /><path d="M16 10.5l5-3v9l-5-3z" /></Icone> },
      { href: '/admin/alunos', rotulo: 'Alunos', prefixos: ['/admin/alunos'], soAdmin: true, icone: <Icone><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c.7-3.4 3.2-5 6.5-5s5.8 1.6 6.5 5" /><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6" /><path d="M18.5 15.3c1.6.7 2.6 2.3 3 4.7" /></Icone> },
      { href: '/admin/pagamentos', rotulo: 'Pagamentos', prefixos: ['/admin/pagamentos'], soAdmin: true, icone: <Icone><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><path d="M7 15h4" /></Icone> },
      { href: '/admin/lixeira', rotulo: 'Lixeira', prefixos: ['/admin/lixeira'], soAdmin: false, icone: <Icone><path d="M4 7h16" /><path d="M9 7V4.5h6V7" /><path d="M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5L18 7" /></Icone> },
    ],
  },
];

function Lista({ admin }: { admin: boolean }) {
  const caminho = usePathname();
  return (
    <nav aria-label="Administração" className="flex flex-col gap-[22px]">
      {GRUPOS.map((grupo) => (
        <div key={grupo.titulo} className="flex flex-col gap-0.5">
          <p className="mb-1.5 px-3 text-[13px] font-semibold text-menta-escura">{grupo.titulo}</p>
          {grupo.itens
            .filter((item) => admin || !item.soAdmin)
            .map((item) => {
              const atual = caminho === item.href || item.prefixos.some((p) => caminho === p || caminho.startsWith(`${p}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={atual ? 'page' : undefined}
                  className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] no-underline transition-colors ${
                    atual ? 'bg-fundo font-bold text-verde' : 'font-medium text-fundo hover:bg-verde-link'
                  }`}
                >
                  {item.icone}
                  <span>{item.rotulo}</span>
                </Link>
              );
            })}
        </div>
      ))}
    </nav>
  );
}

function Marca() {
  return (
    <Link href="/admin" className="flex min-h-11 items-center gap-2.5 text-fundo no-underline lg:gap-3 lg:px-2">
      <img src="/marca/icone.png" alt="" width={44} height={44} className="block size-9 rounded-[9px] lg:size-11 lg:rounded-[11px]" />
      <span className="flex flex-col gap-0.5 lg:gap-[3px]">
        <span className="font-titulo text-lg font-bold leading-none lg:text-xl">Português</span>
        <span className="text-xs font-semibold leading-tight text-dourado-claro lg:text-[13px]">Administração</span>
      </span>
    </Link>
  );
}

function Pessoa({ nome, papel }: { nome: string; papel: string }) {
  return (
    <div className="flex items-center gap-2.5 border-t border-verde-link px-2 pt-4">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-verde-fundo text-base font-bold text-dourado-claro">
        {([...nome.trim()].find((letra) => /\p{L}/u.test(letra)) ?? '?').toLocaleUpperCase('pt-BR')}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{nome}</span>
        <span className="text-[13px] text-menta-escura">{papel}</span>
      </span>
      <form action={sair}>
        <button type="submit" className="h-10 cursor-pointer rounded-full border border-menta-escura bg-transparent px-3.5 text-sm font-semibold text-fundo transition-colors hover:bg-verde-link">
          Sair
        </button>
      </form>
    </div>
  );
}

type Props = { admin: boolean; nome: string; papel: string };

// A faixa verde da esquerda, no computador.
export function MenuAdmin({ admin, nome, papel }: Props) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-7 overflow-y-auto bg-verde px-4 pb-5 pt-6 text-fundo lg:flex">
      <Marca />
      <Lista admin={admin} />
      <div className="mt-auto">
        <Pessoa nome={nome} papel={papel} />
      </div>
    </aside>
  );
}

// A faixa do topo, no celular e no tablet, com o menu que abre por cima da tela.
export function MenuAdminCelular({ admin, nome, papel }: Props) {
  const [aberto, setAberto] = useState(false);
  const caminho = usePathname();
  // Ao trocar de tela, o menu fecha.
  useEffect(() => setAberto(false), [caminho]);
  // Com o menu aberto, a página de trás não rola, e o Esc fecha.
  useEffect(() => {
    if (!aberto) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberto(false);
    };
    window.addEventListener('keydown', tecla);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  return (
    <div className="lg:hidden">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 bg-verde pl-4 pr-3 text-fundo">
        <Marca />
        <button
          type="button"
          aria-expanded={aberto}
          aria-controls="menu-da-administracao"
          onClick={() => setAberto((atual) => !atual)}
          className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-menta-escura bg-transparent px-3.5 text-[15px] font-semibold text-fundo"
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            {aberto ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
          <span>{aberto ? 'Fechar' : 'Menu'}</span>
        </button>
      </header>
      {aberto ? (
        <div id="menu-da-administracao" className="fixed inset-x-0 bottom-0 top-16 z-30 flex flex-col gap-6 overflow-y-auto bg-verde px-4 pb-6 pt-4 text-fundo">
          <Lista admin={admin} />
          <div className="mt-auto">
            <Pessoa nome={nome} papel={papel} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
