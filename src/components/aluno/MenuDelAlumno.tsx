'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { es } from '@/i18n/es';

// As seções da área do aluno, no topo de todas as telas.
const SECOES = [
  { href: '/inicio', rotulo: es.comum.curso, prefixos: ['/inicio', '/clase', '/quiz'] },
  { href: '/conversacion', rotulo: es.comum.conversacion, prefixos: ['/conversacion'] },
  { href: '/cuenta', rotulo: es.comum.cuenta, prefixos: ['/cuenta'] },
];

export function MenuDelAlumno() {
  const caminho = usePathname();
  return (
    <nav aria-label={es.comum.menu} className="order-last flex w-full flex-wrap gap-1 sm:order-none sm:w-auto">
      {SECOES.map((secao) => {
        const atual = secao.prefixos.some((prefixo) => caminho === prefixo || caminho.startsWith(`${prefixo}/`));
        return (
          <Link
            key={secao.href}
            href={secao.href}
            aria-current={atual ? 'page' : undefined}
            className={
              atual
                ? 'flex min-h-11 items-center rounded-xl bg-verde-suave px-4 text-[15px] font-bold text-verde no-underline'
                : 'flex min-h-11 items-center rounded-xl px-4 text-[15px] font-semibold text-texto no-underline hover:bg-fundo'
            }
          >
            {secao.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
