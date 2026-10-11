'use server';

import { redirect } from 'next/navigation';
import { enviarLinkDeSenha } from '@/lib/link-de-acesso';
import { ehEquipe } from '@/lib/papeis';
import { clienteDoServidor } from '@/lib/supabase/servidor';

// Ações dos formulários de acesso. Os formulários enviam por aqui (POST), então a
// senha nunca aparece no endereço da página. Erros voltam como ?error=codigo e a
// tela mostra a mensagem correspondente em espanhol.

function texto(dados: FormData, campo: string): string {
  const valor = dados.get(campo);
  return typeof valor === 'string' ? valor : '';
}

function destinoPorPapel(papel: unknown): string {
  return ehEquipe(typeof papel === 'string' ? papel : null) ? '/admin' : '/inicio';
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
  redirect(destinoPorPapel(perfil?.papel));
}

export async function sair(): Promise<void> {
  const supabase = await clienteDoServidor();
  await supabase.auth.signOut();
  redirect('/entrar');
}

function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

// As duas ações abaixo respondem sempre igual, exista ou não uma conta com aquele e-mail e
// tenha o envio dado certo ou não: a tela não revela quem tem conta.
export async function pedirPrimeiroAcesso(dados: FormData): Promise<void> {
  const correo = texto(dados, 'correo').trim().toLowerCase();
  if (!correoValido(correo)) redirect('/primer-acceso?error=correo');
  await enviarLinkDeSenha(correo, 'primeiro_acesso');
  redirect('/primer-acceso?enviado=1');
}

export async function pedirNovaSenha(dados: FormData): Promise<void> {
  const correo = texto(dados, 'correo').trim().toLowerCase();
  if (!correoValido(correo)) redirect('/recuperar?error=correo');
  await enviarLinkDeSenha(correo, 'nova_senha');
  redirect('/recuperar?enviado=1');
}

// O link do e-mail abre uma tela com um botão, e só o clique no botão gasta o link.
// Assim, programas de e-mail que "visitam" os links para conferir não o invalidam.
export async function confirmarEnlace(dados: FormData): Promise<void> {
  const tokenHash = texto(dados, 'token_hash');
  if (tokenHash === '') redirect('/recuperar?error=enlace');

  const supabase = await clienteDoServidor();
  const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
  if (error) redirect('/recuperar?error=enlace');
  redirect('/nueva-contrasena');
}

export async function definirSenha(dados: FormData): Promise<void> {
  const nueva = texto(dados, 'nueva');
  const repetida = texto(dados, 'repetida');
  if (nueva.length < 8) redirect('/nueva-contrasena?error=corta');
  if (nueva !== repetida) redirect('/nueva-contrasena?error=distintas');

  const supabase = await clienteDoServidor();
  const { data: sessao } = await supabase.auth.getUser();
  if (!sessao.user) redirect('/entrar');

  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) redirect('/nueva-contrasena?error=fallo');

  const { data: perfil } = await supabase.from('perfis').select('papel').eq('id', sessao.user.id).maybeSingle();
  redirect(destinoPorPapel(perfil?.papel));
}
