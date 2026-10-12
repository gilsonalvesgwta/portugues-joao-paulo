import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { MenuAdmin, MenuAdminCelular } from '@/components/admin/MenuAdmin';
import { ehEquipe } from '@/lib/papeis';
import { pessoaLogada } from '@/lib/supabase/servidor';

export const metadata: Metadata = { title: { default: 'Administração', template: '%s · Administração' } };

// A administração é só para professor e administrador. Aluno logado volta para a área dele.
// Esta é a tranca da tela; os dados continuam protegidos pelas regras do banco.
export default async function LayoutDaAdministracao({ children }: { children: ReactNode }) {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  if (!ehEquipe(pessoa.papel)) redirect('/inicio');

  const papel = pessoa.papel === 'admin' ? 'Administrador' : 'Professor';
  const nome = pessoa.nome || pessoa.email;
  return (
    <div className="min-h-dvh lg:flex" lang="pt-BR">
      <MenuAdmin admin={pessoa.papel === 'admin'} nome={nome} papel={papel} />
      <MenuAdminCelular admin={pessoa.papel === 'admin'} nome={nome} papel={papel} />
      <main className="min-w-0 flex-1 px-5 pb-12 pt-6 sm:px-8 lg:px-12 lg:pb-16 lg:pt-10">
        <div className="mx-auto flex max-w-[1040px] flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
