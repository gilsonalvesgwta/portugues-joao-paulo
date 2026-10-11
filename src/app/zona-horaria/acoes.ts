'use server';

import { redirect } from 'next/navigation';
import { zonaValida } from '@/lib/reservas';
import { clienteDoServidor, pessoaLogada } from '@/lib/supabase/servidor';

// A pessoa confirma em que fuso está. É a primeira coisa que a área do aluno pede: sem isso, as
// aulas ao vivo apareceriam na hora de Madri (o fuso com que toda conta nasce) para quem mora em
// outro lugar. As regras do banco só deixam cada um mexer no próprio perfil.
export async function confirmarZona(dados: FormData): Promise<void> {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  const fuso = dados.get('fuso');
  if (!zonaValida(fuso)) redirect('/zona-horaria?error=zona');

  const supabase = await clienteDoServidor();
  const { error } = await supabase.from('perfis').update({ fuso, fuso_confirmado_em: new Date().toISOString() }).eq('id', pessoa.id);
  if (error) {
    console.error('Não foi possível guardar o fuso confirmado:', error.message);
    redirect('/zona-horaria?error=fallo');
  }
  redirect('/inicio');
}
