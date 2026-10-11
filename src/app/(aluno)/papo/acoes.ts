'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { EstadoDoPapo } from '@/lib/papo';
import { enviarAoPapo, novaConversa } from '@/lib/papo-servidor';
import { pessoaLogada } from '@/lib/supabase/servidor';

// Ações da tela do Papo. O que a tela recebe de volta: se a mensagem foi respondida e, quando não
// foi, o que a pessoa tinha escrito (para não perder o texto).

export async function enviar(anterior: EstadoDoPapo, dados: FormData): Promise<EstadoDoPapo> {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  const escrito = dados.get('mensaje');
  const texto = typeof escrito === 'string' ? escrito : '';

  const resultado = await enviarAoPapo({ id: pessoa.id, nome: pessoa.nome }, texto);
  revalidatePath('/papo');
  if (resultado === 'ok') return { vez: anterior.vez + 1, erro: null, texto: '' };
  return { vez: anterior.vez + 1, erro: resultado, texto: texto.slice(0, 4000) };
}

export async function empezarDeNuevo(): Promise<void> {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  const criada = await novaConversa(pessoa.id);
  redirect(criada ? '/papo?aviso=nueva' : '/papo?aviso=fallo');
}
