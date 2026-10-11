'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Só entram no menu as partes que já funcionam. As próximas (quizzes, tarefas, trilha por dia,
// conversação, alunos, pagamentos e configurações) aparecem aqui conforme forem construídas.
const ITENS = [
  { href: '/admin', rotulo: 'Painel', prefixos: [] as string[] },
  { href: '/admin/cursos', rotulo: 'Cursos e módulos', prefixos: ['/admin/cursos', '/admin/modulos'] },
  { href: '/admin/aulas', rotulo: 'Aulas', prefixos: ['/admin/aulas', '/admin/materiais'] },
  { href: '/admin/tarefas', rotulo: 'Tarefas', prefixos: ['/admin/tarefas'] },
  { href: '/admin/lixeira', rotulo: 'Lixeira', prefixos: ['/admin/lixeira'] },
];

export function MenuAdmin() {
  const caminho = usePathname();

  return (
    <nav aria-label="Administração" className="flex flex-row flex-wrap gap-1 lg:flex-col lg:gap-0.5">
      {ITENS.map((item) => {
        const atual =
          caminho === item.href || item.prefixos.some((p) => caminho === p || caminho.startsWith(`${p}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={atual ? 'page' : undefined}
            className={
              atual
                ? 'flex min-h-11 items-center rounded-[10px] bg-fundo px-3.5 text-[15px] font-bold text-verde no-underline'
                : 'flex min-h-11 items-center rounded-[10px] px-3.5 text-[15px] font-medium text-fundo no-underline hover:bg-verde-link'
            }
          >
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
