import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { CabecalhoInterno } from '@/components/Cabecalho';
import { es } from '@/i18n/es';
import { pessoaLogada } from '@/lib/supabase/servidor';

// Moldura da área do aluno. O proxy já barra quem não está logado; a checagem aqui
// é a segunda tranca, para o caso de a sessão ter expirado entre um e outro.
export default async function LayoutDoAluno({ children }: { children: ReactNode }) {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');

  return (
    <div className="min-h-dvh">
      <CabecalhoInterno inicio="/inicio" nome={pessoa.nome || pessoa.email} rotuloSair={es.comum.salir} />
      <main className="mx-auto max-w-[1208px] px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
