'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { es } from '@/i18n/es';
import { IconoCuenta, IconoCurso, IconoEnVivo, IconoPapo } from './iconos';

// As seções da área do aluno. No computador, uma fileira de botões no meio da faixa do topo; no
// celular e no tablet, uma barra fixa no pé da tela, ao alcance do polegar. Só uma das duas fica
// visível de cada vez.
const SECOES = [
  { href: '/inicio', rotulo: es.comum.curso, curto: es.comum.curso, Icono: IconoCurso, prefixos: ['/inicio', '/clase', '/quiz'] },
  { href: '/conversacion', rotulo: es.comum.conversacion, curto: es.comum.enVivo, Icono: IconoEnVivo, prefixos: ['/conversacion'] },
  { href: '/papo', rotulo: es.comum.papo, curto: es.comum.papo, Icono: IconoPapo, prefixos: ['/papo'] },
  { href: '/cuenta', rotulo: es.comum.cuenta, curto: es.comum.cuenta, Icono: IconoCuenta, prefixos: ['/cuenta'] },
];

// "conPapo": o tutor só entra no menu quando a instalação tem a chave dele.
export function MenuDelAlumno({ conPapo }: { conPapo: boolean }) {
  const caminho = usePathname();
  const secoes = SECOES.filter((secao) => conPapo || secao.href !== '/papo').map((secao) => ({
    ...secao,
    atual: secao.prefixos.some((prefixo) => caminho === prefixo || caminho.startsWith(`${prefixo}/`)),
  }));

  return (
    <>
      <nav aria-label={es.comum.menu} className="hidden gap-1.5 lg:flex">
        {secoes.map((secao) => (
          <Link
            key={secao.href}
            href={secao.href}
            aria-current={secao.atual ? 'page' : undefined}
            className={
              secao.atual
                ? 'flex h-11 items-center rounded-full bg-verde px-[18px] text-base font-bold text-white no-underline'
                : 'flex h-11 items-center rounded-full px-[18px] text-base font-semibold text-texto no-underline transition-colors hover:bg-fundo'
            }
          >
            {secao.rotulo}
          </Link>
        ))}
      </nav>
      <nav
        aria-label={es.comum.menu}
        className={`fixed inset-x-0 bottom-0 z-40 grid h-[76px] items-center border-t border-borda bg-cartao px-2 lg:hidden ${secoes.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}
      >
        {secoes.map((secao) => (
          <Link
            key={secao.href}
            href={secao.href}
            aria-current={secao.atual ? 'page' : undefined}
            className={`flex h-[60px] flex-col items-center justify-center gap-1 rounded-[14px] text-xs no-underline ${
              secao.atual ? 'bg-verde-suave font-bold text-verde' : 'font-semibold text-apoio'
            }`}
          >
            <secao.Icono />
            <span>{secao.curto}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
