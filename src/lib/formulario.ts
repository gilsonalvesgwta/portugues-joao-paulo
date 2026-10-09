import type { Erros } from './conteudo';

// O que uma ação de formulário devolve quando há erro: a mensagem de cada campo e o que a
// pessoa tinha digitado, para a tela não perder nada. "vez" muda a cada resposta, e a tela
// usa isso para remontar os campos com os valores devolvidos.
export type EstadoDoFormulario = { vez: number; erros: Erros; valores: Record<string, string> };

export const ESTADO_INICIAL: EstadoDoFormulario = { vez: 0, erros: {}, valores: {} };
