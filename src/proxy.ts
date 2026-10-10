import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { configDoSupabase } from '@/lib/supabase/config';

type CookieParaGravar = { name: string; value: string; options: CookieOptions };

// Telas que qualquer pessoa abre sem estar logada.
const PUBLICAS = ['/entrar', '/primer-acceso', '/recuperar', '/auth', '/bienvenida', '/api/saude'];
// Telas de acesso: quem já está logado não precisa vê-las.
const SO_PARA_VISITANTE = ['/entrar', '/primer-acceso', '/recuperar'];

function comeca(caminho: string, prefixos: string[]): boolean {
  return prefixos.some((p) => caminho === p || caminho.startsWith(`${p}/`));
}

// Roda antes de cada página: renova a sessão do Supabase e barra quem não está logado.
// A regra fina (matrícula, papel) fica no banco e nas páginas; aqui é só a porta de entrada.
export async function proxy(pedido: NextRequest) {
  const { url, chavePublica } = configDoSupabase();
  let resposta = NextResponse.next({ request: pedido });

  const supabase = createServerClient(url, chavePublica, {
    cookies: {
      getAll() {
        return pedido.cookies.getAll();
      },
      setAll(lista: CookieParaGravar[]) {
        for (const { name, value } of lista) pedido.cookies.set(name, value);
        resposta = NextResponse.next({ request: pedido });
        for (const { name, value, options } of lista) resposta.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const logado = data.user !== null;
  const caminho = pedido.nextUrl.pathname;

  let destino: string | null = null;
  if (!logado && caminho !== '/' && !comeca(caminho, PUBLICAS)) destino = '/entrar';
  if (logado && comeca(caminho, SO_PARA_VISITANTE)) destino = '/inicio';
  if (destino === null) return resposta;

  const endereco = pedido.nextUrl.clone();
  endereco.pathname = destino;
  endereco.search = '';
  const redirecionamento = NextResponse.redirect(endereco);
  // Leva junto os cookies que a renovação da sessão acabou de gravar.
  for (const cookie of resposta.cookies.getAll()) redirecionamento.cookies.set(cookie);
  return redirecionamento;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|marca/|icon.png|favicon.ico).*)'],
};
