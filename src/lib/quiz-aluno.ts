// O quiz como o aluno o recebe e como o servidor o corrige. A tabela de perguntas guarda o
// gabarito e o aluno nunca a lê: o servidor entrega as perguntas sem a resposta, recebe o que o
// aluno escolheu e devolve a correção. Sem dependências, para valer igual no servidor e nos testes.

import { corrigir, paraAluno, type Pergunta, type PerguntaDoAluno } from './quiz.ts';

export type LinhaDePergunta = { id: string; tipo: string; conteudo: unknown };

function objeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null;
}

function textos(valor: unknown): string[] | null {
  return Array.isArray(valor) && valor.length > 0 && valor.every((v) => typeof v === 'string' && v.trim() !== '') ? (valor as string[]) : null;
}

// Pergunta gravada -> pergunta conferida. null para o que não dá para mostrar (tipo com áudio,
// que esta versão não tem, ou conteúdo quebrado): a pergunta é pulada em vez de derrubar o quiz.
export function perguntaDoBanco(linha: LinhaDePergunta): Pergunta | null {
  const c = objeto(linha.conteudo);
  if (!c) return null;
  if (linha.tipo === 'multipla_escolha' || linha.tipo === 'completar') {
    const opcoes = textos(c.opcoes);
    const correta = c.correta;
    if (!opcoes || opcoes.length < 2 || typeof correta !== 'number' || !Number.isInteger(correta) || correta < 0 || correta >= opcoes.length) return null;
    if (linha.tipo === 'multipla_escolha') {
      return typeof c.enunciado === 'string' && c.enunciado.trim() !== '' ? { tipo: 'multipla_escolha', enunciado: c.enunciado, opcoes, correta } : null;
    }
    return typeof c.frase === 'string' && c.frase.trim() !== '' ? { tipo: 'completar', frase: c.frase, opcoes, correta } : null;
  }
  if (linha.tipo === 'ordenar') {
    const palavras = textos(c.palavras);
    if (!palavras || palavras.length < 2 || typeof c.traducao !== 'string') return null;
    return { tipo: 'ordenar', palavras, traducao: c.traducao };
  }
  return null;
}

// Só os três tipos de texto chegam ao aluno (esta versão não tem perguntas com áudio).
export type PerguntaEntregue = Extract<PerguntaDoAluno, { tipo: 'multipla_escolha' | 'completar' | 'ordenar' }> & { id: string };

// O que vai para o navegador: cada pergunta sem a resposta e com as opções embaralhadas.
export function entregar(linhas: readonly LinhaDePergunta[], sorteio: () => number = Math.random): PerguntaEntregue[] {
  const entregues: PerguntaEntregue[] = [];
  for (const linha of linhas) {
    const pergunta = perguntaDoBanco(linha);
    if (!pergunta) continue;
    const doAluno = paraAluno(pergunta, sorteio);
    if (doAluno.tipo === 'multipla_escolha' || doAluno.tipo === 'completar' || doAluno.tipo === 'ordenar') {
      entregues.push({ ...doAluno, id: linha.id });
    }
  }
  return entregues;
}

export const RESPOSTAS_MAX = 200;

// O que o navegador manda: lista de { id, resposta }. Qualquer outra coisa vira "sem resposta".
export function lerRespostas(recebido: unknown): Map<string, unknown> {
  const respostas = new Map<string, unknown>();
  if (!Array.isArray(recebido)) return respostas;
  for (const item of recebido.slice(0, RESPOSTAS_MAX)) {
    const o = objeto(item);
    if (o && typeof o.id === 'string') respostas.set(o.id, o.resposta);
  }
  return respostas;
}

export type Conferencia = { id: string; correta: boolean; certa: string };

export type Correcao = {
  acertos: number;
  total: number;
  percentual: number;
  aprovado: boolean;
  // Uma linha por pergunta, na ordem do professor: se acertou e qual era a resposta certa.
  conferencia: Conferencia[];
};

// A resposta certa em texto, para mostrar ao aluno depois de corrigir.
function respostaCerta(pergunta: Pergunta): string {
  if (pergunta.tipo === 'multipla_escolha' || pergunta.tipo === 'completar') return pergunta.opcoes[pergunta.correta] ?? '';
  if (pergunta.tipo === 'ordenar') return pergunta.palavras.join(' ');
  return '';
}

// Pergunta sem resposta conta como errada. As perguntas que não puderam ser entregues ficam de fora.
export function corrigirEntrega(linhas: readonly LinhaDePergunta[], respostas: ReadonlyMap<string, unknown>, notaMinima: number): Correcao {
  const conferencia: Conferencia[] = [];
  for (const linha of linhas) {
    const pergunta = perguntaDoBanco(linha);
    if (!pergunta) continue;
    conferencia.push({ id: linha.id, correta: corrigir(pergunta, respostas.get(linha.id)).correta, certa: respostaCerta(pergunta) });
  }
  const total = conferencia.length;
  const acertos = conferencia.filter((c) => c.correta).length;
  const percentual = total === 0 ? 0 : Math.round((acertos / total) * 100);
  return { acertos, total, percentual, aprovado: total > 0 && percentual >= notaMinima, conferencia };
}

// Resposta do servidor à tela do quiz. "guardado" é falso na visão da equipe (o envio não fica gravado).
export type EstadoDaResposta = {
  vez: number;
  situacao: 'inicial' | 'corregido' | 'error';
  error: 'formato' | 'no_encontrado' | 'bloqueado' | 'no_guardado' | null;
  correcao: Correcao | null;
  guardado: boolean;
};

export const RESPOSTA_INICIAL: EstadoDaResposta = { vez: 0, situacao: 'inicial', error: null, correcao: null, guardado: false };

// O que fica gravado de cada resposta: o texto escolhido ou a lista de palavras, com limite de
// tamanho. Qualquer outra coisa é gravada como "sem resposta".
export function respostaParaGuardar(resposta: unknown): string | string[] | null {
  if (typeof resposta === 'string') return resposta.length <= 500 ? resposta : null;
  if (Array.isArray(resposta) && resposta.length <= 60 && resposta.every((p) => typeof p === 'string' && p.length <= 100)) return resposta as string[];
  return null;
}
