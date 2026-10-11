// Para onde mandar a pessoa quando o servidor redireciona (quem não está logado vai para a tela
// de acesso, por exemplo). O endereço é montado a partir do endereço público da plataforma
// (SITE_URL), e não do pedido: atrás do Traefik o pedido chega por um endereço interno, e um
// redirecionamento montado a partir dele poderia apontar para fora da plataforma.
// Sem dependências, para valer igual no servidor e nos testes.

export function enderecoPublico(caminho: string, doPedido: { href: string }, ambiente: Record<string, string | undefined> = process.env): URL {
  const site = (ambiente.SITE_URL ?? '').trim();
  if (/^https?:\/\//i.test(site)) {
    try {
      const base = new URL(site);
      return new URL(caminho, base.origin);
    } catch {
      // SITE_URL mal escrito: vale o endereço do pedido, abaixo.
    }
  }
  const endereco = new URL(doPedido.href);
  endereco.pathname = caminho;
  endereco.search = '';
  endereco.hash = '';
  return endereco;
}
