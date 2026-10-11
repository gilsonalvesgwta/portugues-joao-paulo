import { redirect } from 'next/navigation';
import { ehEquipe } from '@/lib/papeis';
import { pessoaLogada, type PessoaLogada } from '@/lib/supabase/servidor';

// Alunos, matrículas e pagamentos são só do administrador. O professor volta para o painel com
// um aviso; quem não é da equipe volta para a área do aluno. Vale para telas e para ações.
export async function exigirAdmin(): Promise<PessoaLogada> {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  if (pessoa.papel !== 'admin') redirect(ehEquipe(pessoa.papel) ? '/admin?aviso=so_administrador' : '/inicio');
  return pessoa;
}
