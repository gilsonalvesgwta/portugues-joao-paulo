import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { configDoSupabase } from './config';

type CookieParaGravar = { name: string; value: string; options: CookieOptions };

// Cliente do Supabase para páginas e ações do servidor. Age sempre como o usuário
// logado (sessão nos cookies), então todas as regras de acesso do banco valem.
export async function clienteDoServidor() {
  const { url, chavePublica } = configDoSupabase();
  const guardados = await cookies();

  return createServerClient(url, chavePublica, {
    cookies: {
      getAll() {
        return guardados.getAll();
      },
      setAll(lista: CookieParaGravar[]) {
        try {
          for (const { name, value, options } of lista) guardados.set(name, value, options);
        } catch {
          // Páginas (ao contrário das ações) não podem gravar cookies.
          // Sem problema: o proxy renova a sessão a cada pedido.
        }
      },
    },
  });
}

export type PessoaLogada = { id: string; email: string; nome: string; papel: string };

// Quem está logado, com o perfil. null quando não há sessão válida.
// O resultado vale para o pedido inteiro: moldura e página consultam uma vez só.
export const pessoaLogada = cache(async (): Promise<PessoaLogada | null> => {
  const supabase = await clienteDoServidor();
  const { data } = await supabase.auth.getUser();
  const usuario = data.user;
  if (!usuario) return null;

  const { data: perfil } = await supabase
    .from('perfis')
    .select('nome, papel')
    .eq('id', usuario.id)
    .maybeSingle();

  return {
    id: usuario.id,
    email: usuario.email ?? '',
    nome: typeof perfil?.nome === 'string' ? perfil.nome : '',
    papel: typeof perfil?.papel === 'string' ? perfil.papel : 'aluno',
  };
});
