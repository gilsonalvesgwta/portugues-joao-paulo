// Regras das ofertas: cada produto vendido na Greenn aponta para um curso e diz o que a compra
// libera. Sem dependências, para valer igual na tela, no servidor e nos testes.

import { RESERVAS_MAX } from './alunos.ts';
import { ehUuid, limpar, type Entrada, type Erros, type Resultado } from './conteudo.ts';

export const NOME_DA_OFERTA_MAX = 120;
export const DIAS_MAX = 3660; // dez anos

export type DadosDaOferta = {
  nome: string;
  greenn_product_id: number;
  curso_id: string;
  dias_de_acesso: number | null;
  inclui_conversacao: boolean;
  reservas_por_semana: number;
  ativa: boolean;
};

// Campos do formulário: dias_de_acesso em branco = sem prazo; as caixas chegam como "on" ou vazias.
export function validarOferta(entrada: Entrada): Resultado<DadosDaOferta> {
  const erros: Erros = {};

  const nome = limpar(entrada.nome);
  if (nome === '') erros.nome = 'Escreva um nome para reconhecer a oferta.';
  else if (nome.length > NOME_DA_OFERTA_MAX) erros.nome = `O nome pode ter até ${NOME_DA_OFERTA_MAX} letras.`;

  const codigo = limpar(entrada.greenn_product_id);
  let greenn_product_id = 0;
  if (!/^\d{1,15}$/.test(codigo) || Number(codigo) === 0) {
    erros.greenn_product_id = 'Escreva o código do produto na Greenn: só números.';
  } else {
    greenn_product_id = Number(codigo);
  }

  const curso_id = limpar(entrada.curso_id);
  if (!ehUuid(curso_id)) erros.curso_id = 'Escolha o curso que a compra libera.';

  const dias = limpar(entrada.dias_de_acesso);
  let dias_de_acesso: number | null = null;
  if (dias !== '') {
    if (!/^\d{1,4}$/.test(dias) || Number(dias) < 1 || Number(dias) > DIAS_MAX) {
      erros.dias_de_acesso = `Escreva um número de 1 a ${DIAS_MAX}, ou deixe em branco para acesso sem prazo.`;
    } else {
      dias_de_acesso = Number(dias);
    }
  }

  const inclui_conversacao = entrada.inclui_conversacao === 'on';
  const reservas = limpar(entrada.reservas_por_semana);
  let reservas_por_semana = 0;
  if (inclui_conversacao) {
    if (!/^\d{1,2}$/.test(reservas) || Number(reservas) > RESERVAS_MAX) {
      erros.reservas_por_semana = `Escreva um número de 0 a ${RESERVAS_MAX}.`;
    } else {
      reservas_por_semana = Number(reservas);
    }
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return {
    ok: true,
    valor: { nome, greenn_product_id, curso_id, dias_de_acesso, inclui_conversacao, reservas_por_semana, ativa: entrada.ativa === 'on' },
  };
}

// "365 dias de acesso", "1 dia de acesso" ou "acesso sem prazo".
export function prazoDaOferta(dias: number | null): string {
  if (dias === null) return 'acesso sem prazo';
  return dias === 1 ? '1 dia de acesso' : `${dias} dias de acesso`;
}
