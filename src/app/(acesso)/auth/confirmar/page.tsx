import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BotaoPrincipal, Cabecalho } from '@/components/acesso/campos';
import { es } from '@/i18n/es';
import { confirmarEnlace } from '../../acoes';

export const metadata: Metadata = { title: es.confirmar.titulo, referrer: 'no-referrer' };

type Props = { searchParams: Promise<{ token_hash?: string | string[] }> };

// Destino do link enviado por e-mail. Abrir a página não gasta o link: só o clique no
// botão o confirma. Isso protege contra programas de e-mail que visitam os links sozinhos.
export default async function PaginaConfirmar({ searchParams }: Props) {
  const { token_hash: tokenHash } = await searchParams;
  if (typeof tokenHash !== 'string' || tokenHash === '') redirect('/recuperar?error=enlace');

  return (
    <>
      <Cabecalho area={es.acesso.area} titulo={es.confirmar.titulo} texto={es.confirmar.texto} />
      <form action={confirmarEnlace} className="flex flex-col gap-5">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <BotaoPrincipal>{es.confirmar.boton}</BotaoPrincipal>
      </form>
    </>
  );
}
