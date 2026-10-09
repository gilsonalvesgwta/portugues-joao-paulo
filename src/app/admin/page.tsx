import { redirect } from 'next/navigation';
import { pessoaLogada } from '@/lib/supabase/servidor';

const NOME_DO_PAPEL: Record<string, string> = { admin: 'Administrador', professor: 'Professor' };

// PROVISÓRIO: confirma o acesso da equipe. As telas de aulas, turmas e alunos entram na fase 2.
export default async function PaginaAdmin() {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');

  return (
    <section className="rounded-[20px] border border-linha bg-cartao p-8">
      <h1 className="font-titulo text-4xl font-bold leading-tight">Administração</h1>
      <p className="mt-3 text-base leading-normal text-apoio">
        Você entrou como {NOME_DO_PAPEL[pessoa.papel] ?? pessoa.papel}. As telas de aulas, turmas e alunos ainda
        estão em construção.
      </p>
    </section>
  );
}
