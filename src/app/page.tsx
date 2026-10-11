import { redirect } from 'next/navigation';
import { ehEquipe } from '@/lib/papeis';
import { pessoaLogada } from '@/lib/supabase/servidor';

// A raiz não tem conteúdo próprio: leva cada um para o seu lugar.
export default async function Raiz(): Promise<never> {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  redirect(ehEquipe(pessoa.papel) ? '/admin' : '/inicio');
}
