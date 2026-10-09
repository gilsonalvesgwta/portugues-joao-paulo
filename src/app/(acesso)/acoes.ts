'use server';

import { redirect } from 'next/navigation';
import { clienteDoServidor } from '@/lib/supabase/servidor';
import { ehEquipe } from '@/lib/supabase/config';

// Ações dos formulários de acesso. Os formulários enviam por aqui (POST), então a
// senha nunca aparece no endereço da página. Erros voltam como ?error=codigo e a
// tela mostra a mensagem correspondente em espanhol.

function texto(dados: FormData, campo: string): string {
  const valor = dados.get(campo);
  return typeof valor === 'string' ? valor : '';
}

export async function entrar(dados: FormData): Promise<void> {
  const correo = texto(dados, 'correo').trim().toLowerCase();
  const clave = texto(dados, 'clave');
  if (correo === '' || clave.length < 8) redirect('/entrar?error=datos');

  const supabase = await clienteDoServidor();
  const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
  // Mesma mensagem para e-mail desconhecido e senha errada: não revela quem tem conta.
  if (error || !data.user) redirect('/entrar?error=credenciales');

  // O mesmo cliente já está com a sessão nova: consulta o papel para decidir o destino.
  const { data: perfil } = await supabase.from('perfis').select('papel').eq('id', data.user.id).maybeSingle();
  redirect(ehEquipe(typeof perfil?.papel === 'string' ? perfil.papel : null) ? '/admin' : '/inicio');
}

export async function sair(): Promise<void> {
  const supabase = await clienteDoServidor();
  await supabase.auth.signOut();
  redirect('/entrar');
}

// AINDA SEM EFEITO: o envio do link de primeiro acesso e de nova senha entra na próxima etapa.
export async function pedirPrimeiroAcesso(_dados: FormData): Promise<void> {}

export async function pedirNovaSenha(_dados: FormData): Promise<void> {}
