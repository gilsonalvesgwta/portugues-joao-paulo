import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { sair } from '@/app/(acesso)/acoes';
import { MenuAdmin } from '@/components/admin/MenuAdmin';
import { ehEquipe } from '@/lib/papeis';
import { pessoaLogada } from '@/lib/supabase/servidor';

export const metadata: Metadata = { title: { default: 'Administração', template: '%s · Administração' } };

// A administração é só para professor e administrador. Aluno logado volta para a área dele.
// Esta é a tranca da tela; os dados continuam protegidos pelas regras do banco.
export default async function LayoutDaAdministracao({ children }: { children: ReactNode }) {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  if (!ehEquipe(pessoa.papel)) redirect('/inicio');

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row" lang="pt-BR">
      <aside className="flex flex-col gap-4 bg-verde px-3.5 py-4 lg:w-60 lg:shrink-0 lg:gap-5 lg:py-5">
        <Link href="/admin" className="flex items-center gap-2.5 px-1.5 text-fundo no-underline">
          <img src="/marca/icone.png" alt="" width={40} height={40} className="block size-10 rounded-[10px]" />
          <span className="flex flex-col gap-0.5">
            <span className="font-titulo text-[17px] font-bold leading-tight">Português</span>
            <span className="text-xs font-semibold tracking-[0.1em]">ADMINISTRAÇÃO</span>
          </span>
        </Link>
        <MenuAdmin admin={pessoa.papel === 'admin'} />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-verde-link px-1.5 pt-4 lg:mt-auto">
          <span className="min-w-0 break-words text-sm text-fundo">{pessoa.nome || pessoa.email}</span>
          <form action={sair}>
            <button
              type="submit"
              className="min-h-11 cursor-pointer rounded-[10px] border border-fundo bg-transparent px-4 text-[15px] font-semibold text-fundo hover:bg-verde-link"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto flex max-w-[1040px] flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
