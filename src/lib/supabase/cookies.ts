import type { CookieOptions } from '@supabase/ssr';

// Como os cookies da sessão são gravados. Só o servidor fala com o login e com o banco, então o
// navegador não precisa ler a sessão: o cookie fica fora do alcance de qualquer programa da
// página ("httpOnly"). Em endereço https, ele só viaja cifrado ("secure").
export function cookieDaSessao(opcoes: CookieOptions, ambiente: Record<string, string | undefined> = process.env): CookieOptions {
  return {
    ...opcoes,
    httpOnly: true,
    sameSite: 'lax',
    secure: (ambiente.SITE_URL ?? '').trim().toLowerCase().startsWith('https://'),
  };
}
