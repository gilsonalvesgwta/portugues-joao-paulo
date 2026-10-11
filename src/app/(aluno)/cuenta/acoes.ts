'use server';

import { redirect } from 'next/navigation';
import { limpar } from '@/lib/conteudo';
import { zonaValida } from '@/lib/reservas';
import { clienteDoServidor, pessoaLogada } from '@/lib/supabase/servidor';

// Ações da tela "Mi cuenta": o aluno muda o próprio nome, o fuso e a senha. As regras do banco
// só deixam cada pessoa alterar o próprio perfil, e só esses campos (nunca o papel nem o e-mail).

const TELA = '/cuenta';

function texto(dados: FormData, campo: string): string {
  const valor = dados.get(campo);
  return typeof valor === 'string' ? valor : '';
}

export async function guardarCuenta(dados: FormData): Promise<void> {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  const nome = limpar(texto(dados, 'nombre'));
  const fuso = texto(dados, 'fuso');
  if (nome === '' || nome.length > 120) redirect(`${TELA}?error=nombre`);
  if (!zonaValida(fuso)) redirect(`${TELA}?error=zona`);

  const supabase = await clienteDoServidor();
  // Guardar o fuso por aqui também vale como confirmação dele.
  const { error } = await supabase.from('perfis').update({ nome, fuso, fuso_confirmado_em: new Date().toISOString() }).eq('id', pessoa.id);
  redirect(error ? `${TELA}?error=fallo` : `${TELA}?aviso=guardado`);
}

export async function cambiarClave(dados: FormData): Promise<void> {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  const nueva = texto(dados, 'nueva');
  const repetida = texto(dados, 'repetida');
  if (nueva.length < 8) redirect(`${TELA}?error=corta#clave`);
  if (nueva !== repetida) redirect(`${TELA}?error=distintas#clave`);

  const supabase = await clienteDoServidor();
  const { error } = await supabase.auth.updateUser({ password: nueva });
  redirect(error ? `${TELA}?error=clave#clave` : `${TELA}?aviso=clave`);
}
