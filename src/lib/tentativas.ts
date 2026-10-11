// Limite de tentativas de senha por e-mail: depois de várias senhas erradas seguidas, aquele
// e-mail fica um tempo sem poder tentar. Protege cada conta de quem fica testando senhas.
// A contagem fica na memória do servidor (um servidor só); reiniciar o servidor zera.
// Sem dependências, para valer igual no servidor e nos testes.

export type RegraDeTentativas = { maximo: number; janelaMs: number; contasMax?: number };

export type Tentativas = {
  // true quando aquele e-mail já errou demais dentro do tempo e ainda não pode tentar.
  bloqueado(chave: string): boolean;
  registrarFalha(chave: string): void;
  // Chamado quando a pessoa entra: as falhas antigas deixam de contar.
  limpar(chave: string): void;
  contas(): number;
};

export const REGRA_DE_ENTRADA: RegraDeTentativas = { maximo: 8, janelaMs: 15 * 60 * 1000 };

export function criarTentativas(regra: RegraDeTentativas, agora: () => number = Date.now): Tentativas {
  const falhas = new Map<string, number[]>();
  const contasMax = regra.contasMax ?? 20_000;

  const recentes = (chave: string): number[] => {
    const limite = agora() - regra.janelaMs;
    const lista = (falhas.get(chave) ?? []).filter((quando) => quando > limite);
    if (lista.length === 0) falhas.delete(chave);
    else falhas.set(chave, lista);
    return lista;
  };

  // A memória não cresce sem fim: quando passa do teto, saem primeiro as contagens vencidas
  // e, se ainda assim sobrar demais, as mais antigas.
  const enxugar = (): void => {
    if (falhas.size <= contasMax) return;
    for (const chave of [...falhas.keys()]) recentes(chave);
    for (const chave of falhas.keys()) {
      if (falhas.size <= contasMax) break;
      falhas.delete(chave);
    }
  };

  return {
    bloqueado: (chave) => recentes(chave).length >= regra.maximo,
    registrarFalha(chave) {
      const lista = recentes(chave);
      // Reinsere no fim: as contas com falha mais recente são as últimas a sair.
      falhas.delete(chave);
      falhas.set(chave, [...lista, agora()].slice(-regra.maximo));
      enxugar();
    },
    limpar: (chave) => void falhas.delete(chave),
    contas: () => falhas.size,
  };
}

// Uma contagem só para o servidor inteiro, mesmo que este arquivo seja carregado mais de uma vez.
const CHAVE_GLOBAL = '__portuguesjp_tentativas_de_entrada__';

export function tentativasDeEntrada(): Tentativas {
  const global = globalThis as unknown as Record<string, Tentativas | undefined>;
  const existente = global[CHAVE_GLOBAL];
  if (existente) return existente;
  const nova = criarTentativas(REGRA_DE_ENTRADA);
  global[CHAVE_GLOBAL] = nova;
  return nova;
}
