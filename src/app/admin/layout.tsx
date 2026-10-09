import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { CabecalhoInterno } from '@/components/Cabecalho';
import { ehEquipe } from '@/lib/supabase/config';
import { pessoaLogada } from '@/lib/supabase/servidor';

export const metadata: Metadata = { title: 'Administração' };

// A administração é só para professor e administrador. Aluno logado volta para a área dele.
// Esta é a tranca da tela; os dados continuam protegidos pelas regras do banco.
export default async function LayoutDaAdministracao({ children }: { children: ReactNode }) {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  if (!ehEquipe(pessoa.papel)) redirect('/inicio');

  return (
    <div className="min-h-dvh" lang="pt-BR">
      <CabecalhoInterno inicio="/admin" rotuloDaArea="ADMINISTRAÇÃO" nome={pessoa.nome || pessoa.email} rotuloSair="Sair" />
      <main className="mx-auto max-w-[1208px] px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
