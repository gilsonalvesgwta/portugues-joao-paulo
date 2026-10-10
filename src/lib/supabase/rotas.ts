// A biblioteca do Supabase espera um endereço só, com o login em /auth/v1 e os dados em /rest/v1
// (é o que a "porta de entrada" Kong faz em uma instalação completa). Na instalação enxuta não há
// porta de entrada: o aplicativo fala direto com cada serviço, e esta função troca o endereço.

export type Rotas = { auth: string; rest: string };

const PREFIXOS = [
  ['/auth/v1', 'auth'],
  ['/rest/v1', 'rest'],
] as const;

export function reescrever(pedida: string, base: string, rotas: Rotas): string {
  if (!pedida.startsWith(base)) return pedida;
  const resto = pedida.slice(base.length);
  for (const [prefixo, destino] of PREFIXOS) {
    if (resto === prefixo || resto.startsWith(`${prefixo}/`) || resto.startsWith(`${prefixo}?`)) {
      return rotas[destino] + resto.slice(prefixo.length);
    }
  }
  // Arquivos, tempo real e funções não fazem parte da instalação enxuta. Melhor um erro claro
  // do que um pedido para um endereço que não existe.
  throw new Error(`Este serviço do Supabase não está instalado: ${resto.split('?')[0]}`);
}

export function buscaComRotas(base: string, rotas: Rotas): typeof fetch {
  return (entrada: RequestInfo | URL, opcoes?: RequestInit) => {
    if (typeof entrada === 'string' || entrada instanceof URL) {
      return fetch(reescrever(String(entrada), base, rotas), opcoes);
    }
    return fetch(new Request(reescrever(entrada.url, base, rotas), entrada), opcoes);
  };
}
