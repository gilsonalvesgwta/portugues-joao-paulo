// Sinal de vida do aplicativo, usado pelo Docker e pelo Traefik para saber se o contêiner
// está de pé. Não toca no banco nem revela nada da instalação.
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
