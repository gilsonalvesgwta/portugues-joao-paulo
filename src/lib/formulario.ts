import type { Bloco } from './anotacoes';
import type { Erros } from './conteudo';
import type { QuizNoEditor } from './quiz-editor';
import type { DiaDaTrilha } from './trilha-editor';

// O que uma ação de formulário devolve quando há erro: a mensagem de cada campo e o que a
// pessoa tinha digitado, para a tela não perder nada. "vez" muda a cada resposta, e a tela
// usa isso para remontar os campos com os valores devolvidos.
export type EstadoDoFormulario = { vez: number; erros: Erros; valores: Record<string, string> };

export const ESTADO_INICIAL: EstadoDoFormulario = { vez: 0, erros: {}, valores: {} };

// Resposta da gravação das anotações. Em caso de erro, "erros" traz a mensagem de cada bloco
// (pelo id) e "geral" para o que não é de um bloco só. Ao salvar, "blocos" devolve o que ficou
// gravado, já arrumado, para a tela mostrar exatamente o que está no banco.
export type EstadoDasAnotacoes = {
  vez: number;
  situacao: 'inicial' | 'salvo' | 'erro';
  erros: Record<string, string>;
  blocos: Bloco[] | null;
};

export const ANOTACOES_INICIAL: EstadoDasAnotacoes = { vez: 0, situacao: 'inicial', erros: {}, blocos: null };

// Resposta da gravação do quiz, no mesmo espírito das anotações: erro por pergunta (pelo id)
// ou "geral"; ao salvar, devolve o quiz como ficou gravado e se ficou publicado.
export type EstadoDoQuiz = {
  vez: number;
  situacao: 'inicial' | 'salvo' | 'erro';
  erros: Record<string, string>;
  quiz: QuizNoEditor | null;
  publicado: boolean;
};

export const QUIZ_INICIAL: EstadoDoQuiz = { vez: 0, situacao: 'inicial', erros: {}, quiz: null, publicado: false };

// Resposta da gravação da trilha por dia. Ao salvar, "dias" devolve a trilha como ficou gravada,
// já com o identificador de cada item.
export type EstadoDaTrilha = {
  vez: number;
  situacao: 'inicial' | 'salvo' | 'erro';
  erro: string | null;
  dias: DiaDaTrilha[] | null;
};

export const TRILHA_INICIAL: EstadoDaTrilha = { vez: 0, situacao: 'inicial', erro: null, dias: null };
