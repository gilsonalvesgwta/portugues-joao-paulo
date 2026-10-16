// O quiz como o aluno o recebe e como o servidor o corrige. A tabela de perguntas guarda o
// gabarito e o aluno nunca a lê: o servidor entrega as perguntas sem a resposta, recebe o que o
// aluno escolheu e devolve a correção. Sem dependências, para valer igual no servidor e nos testes.

import { conferirPar, corrigir, paraAluno, type Par, type Pergunta, type PerguntaDoAluno } from './quiz.ts';

export type LinhaDePergunta = { id: string; tipo: string; conteudo: unknown };

function objeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null;
}

function textos(valor: unknown): string[] | null {
  return Array.isArray(valor) && valor.length > 0 && valor.every((v) => typeof v === 'string' && v.trim() !== '') ? (valor as string[]) : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Pergunta gravada -> pergunta conferida. null para o que não dá para mostrar (o ditado, que esta
// versão não tem, ou conteúdo quebrado): a pergunta é pulada em vez de derrubar o quiz.
export function perguntaDoBanco(linha: LinhaDePergunta): Pergunta | null {
  const c = objeto(linha.conteudo);
  if (!c) return null;
  if (linha.tipo === 'parear_audio') {
    if ((c.modo !== 'audio' && c.modo !== 'escrita') || !Array.isArray(c.pares) || c.pares.length < 2) return null;
    const pares: Par[] = [];
    for (const bruto of c.pares) {
      const par = objeto(bruto);
      if (!par || typeof par.palavra !== 'string' || typeof par.traducao !== 'string' || par.palavra.trim() === '' || par.traducao.trim() === '') return null;
      pares.push(typeof par.audio === 'string' && UUID.test(par.audio) ? { palavra: par.palavra, traducao: par.traducao, audio: par.audio } : { palavra: par.palavra, traducao: par.traducao });
    }
    if (new Set(pares.map((par) => par.traducao)).size !== pares.length) return null;
    return { tipo: 'parear_audio', modo: c.modo, pares };
  }
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

// O ditado ainda não chega ao aluno; os outros quatro tipos, sim.
export type PerguntaEntregue = Extract<PerguntaDoAluno, { tipo: 'multipla_escolha' | 'completar' | 'ordenar' | 'parear_audio' }> & { id: string };

// O que vai para o navegador: cada pergunta sem a resposta e com as opções embaralhadas.
export function entregar(linhas: readonly LinhaDePergunta[], sorteio: () => number = Math.random): PerguntaEntregue[] {
  const entregues: PerguntaEntregue[] = [];
  for (const linha of linhas) {
    const pergunta = perguntaDoBanco(linha);
    if (!pergunta) continue;
    const doAluno = paraAluno(pergunta, sorteio);
    if (doAluno.tipo !== 'ouvir_escrever') {
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
  if (pergunta.tipo === 'parear_audio') return pergunta.pares.map((par) => `${par.palavra} = ${par.traducao}`).join(', ');
  return '';
}

// Uma tentativa no jogo de pares, conferida contra a pergunta gravada.
export function conferirTentativa(linha: LinhaDePergunta, indice: unknown, traducao: unknown): { certo: boolean; palavra?: string } {
  const pergunta = perguntaDoBanco(linha);
  return pergunta ? conferirPar(pergunta, indice, traducao) : { certo: false };
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

type Tentativa = { i: number; t: string };

// O que fica gravado de cada resposta: o texto escolhido, a lista de palavras ou (no jogo de pares)
// a lista de tentativas, com limite de tamanho. Qualquer outra coisa é gravada como "sem resposta".
export function respostaParaGuardar(resposta: unknown): string | string[] | Tentativa[] | null {
  if (typeof resposta === 'string') return resposta.length <= 500 ? resposta : null;
  if (!Array.isArray(resposta) || resposta.length > 60) return null;
  if (resposta.every((p) => typeof p === 'string' && p.length <= 100)) return resposta as string[];
  const tentativas: Tentativa[] = [];
  for (const item of resposta) {
    const o = objeto(item);
    if (!o || typeof o.i !== 'number' || !Number.isInteger(o.i) || o.i < 0 || o.i > 99 || typeof o.t !== 'string' || o.t.length > 100) return null;
    tentativas.push({ i: o.i, t: o.t });
  }
  return tentativas;
}
