// O curso como o aluno o vê: a trilha do dia, o que já foi feito, o que vem depois e o que
// ainda está fechado. Sem dependências, para valer igual na tela, no servidor e nos testes.

import { itensConcluidos, resumoDaTrilha, type Dia, type ItemDoDia, type ResumoDaTrilha } from './trilha.ts';

// Formato devolvido pela função curso_do_aluno do banco.
export type CursoDoAluno = {
  curso: { id: string; titulo_pt: string; titulo_es: string; tipo: string; modo: string };
  modulos: { id: string; ordem: number; titulo_pt: string; titulo_es: string }[];
  aulas: { id: string; modulo_id: string; numero: number; titulo_pt: string; titulo_es: string; duracao_seg: number | null }[];
  quizzes: { id: string; aula_id: string; nota_minima: number }[];
  tarefas: { id: string; aula_id: string | null; titulo_es: string; instrucao_es: string; link: string | null }[];
  trilha: { numero: number; itens: { id: string; tipo: string; alvo: string; obrigatorio: boolean }[] }[];
};

// Formato devolvido pela função meu_progresso do banco.
export type Progresso = {
  aulas: { aula_id: string; posicao_seg: number; concluida: boolean }[];
  quizzes: { quiz_id: string; tentativas: number; melhor: number }[];
  itens: string[];
};

export const SEM_PROGRESSO: Progresso = { aulas: [], quizzes: [], itens: [] };

export type ItemDoAluno = ItemDoDia & { tarefaId?: string };
export type DiaDoAluno = { numero: number; itens: ItemDoAluno[] };

// A trilha gravada pelo professor vira a trilha do aluno: só ficam os itens que o aluno pode
// ver. Aula ou quiz em rascunho, ou tarefa na lixeira, somem; um dia que fica vazio some junto,
// para não travar o "hoje". Os dias são renumerados de 1 em diante, sem buracos.
export function montarDias(curso: CursoDoAluno): DiaDoAluno[] {
  const aulas = new Set(curso.aulas.map((aula) => aula.id));
  const quizzes = new Set(curso.quizzes.map((quiz) => quiz.id));
  const tarefas = new Set(curso.tarefas.map((tarefa) => tarefa.id));

  const dias: DiaDoAluno[] = [];
  for (const dia of [...curso.trilha].sort((a, b) => a.numero - b.numero)) {
    const itens: ItemDoAluno[] = [];
    for (const item of dia.itens) {
      const base = { id: item.id, ordem: itens.length + 1, obrigatorio: item.obrigatorio };
      if (item.tipo === 'aula' && aulas.has(item.alvo)) itens.push({ ...base, tipo: 'aula', aulaId: item.alvo });
      else if (item.tipo === 'quiz' && quizzes.has(item.alvo)) itens.push({ ...base, tipo: 'quiz', quizId: item.alvo });
      else if (item.tipo === 'tarefa' && tarefas.has(item.alvo)) itens.push({ ...base, tipo: 'tarefa', tarefaId: item.alvo });
    }
    if (itens.length > 0) dias.push({ numero: dias.length + 1, itens });
  }
  return dias;
}

export type Painel = {
  dias: DiaDoAluno[];
  // Ids dos itens da trilha já feitos.
  feitos: Set<string>;
  resumo: ResumoDaTrilha;
  aulasVistas: Set<string>;
  // Quiz -> melhor nota (0 a 100) e número de tentativas.
  quizzes: Map<string, { melhor: number; tentativas: number }>;
  // Aulas e quizzes que ainda não abrem (curso em sequência): estão em um dia depois de hoje.
  fechados: Set<string>;
  // Para onde o botão "Continuar" leva; null quando não há aula nem quiz esperando.
  continuar: { tipo: 'aula' | 'quiz'; id: string } | null;
  // Percentual de aulas vistas, de 0 a 100 (só chega a 100 com todas vistas).
  percentual: number;
};

// "abrirTudo": a equipe, que usa estas telas para ver o curso como o aluno, não tem progresso;
// para ela nada fica fechado.
export function montarPainel(curso: CursoDoAluno, progresso: Progresso, abrirTudo = false): Painel {
  const dias = montarDias(curso);
  const visiveis = new Set(curso.aulas.map((aula) => aula.id));
  const aulasVistas = new Set(progresso.aulas.filter((p) => p.concluida && visiveis.has(p.aula_id)).map((p) => p.aula_id));
  const quizzes = new Map(progresso.quizzes.map((q) => [q.quiz_id, { melhor: q.melhor, tentativas: q.tentativas }]));
  const feitos = itensConcluidos(dias as Dia[], aulasVistas, new Set(quizzes.keys()), new Set(progresso.itens));
  const resumo = resumoDaTrilha(dias as Dia[], feitos);

  // No curso em sequência, o que está em um dia depois de hoje fica fechado. O que não está na
  // trilha fica sempre aberto. Com a trilha toda concluída, nada fica fechado.
  const fechados = new Set<string>();
  if (!abrirTudo && curso.curso.modo === 'sequencial' && resumo.hoje !== null && !resumo.concluida) {
    for (const dia of dias) {
      if (dia.numero <= resumo.hoje) continue;
      for (const item of dia.itens) {
        const alvo = item.aulaId ?? item.quizId;
        if (alvo !== undefined) fechados.add(alvo);
      }
    }
  }

  // "Continuar": com trilha em andamento, a primeira aula ou o primeiro quiz que falta no dia de
  // hoje (se só faltam tarefas, não há para onde ir: elas estão na própria tela de início).
  // Sem trilha, ou com a trilha concluída, a primeira aula por ver na ordem dos números.
  let continuar: Painel['continuar'] = null;
  const hoje = resumo.concluida ? undefined : dias.find((dia) => dia.numero === resumo.hoje);
  if (hoje) {
    const falta = hoje.itens.find((item) => !feitos.has(item.id) && item.tipo !== 'tarefa');
    if (falta?.aulaId !== undefined) continuar = { tipo: 'aula', id: falta.aulaId };
    else if (falta?.quizId !== undefined) continuar = { tipo: 'quiz', id: falta.quizId };
  } else {
    const porVer = [...curso.aulas].sort((a, b) => a.numero - b.numero).find((aula) => !aulasVistas.has(aula.id));
    if (porVer) continuar = { tipo: 'aula', id: porVer.id };
  }

  const total = curso.aulas.length;
  const percentual = total === 0 ? 0 : Math.floor((aulasVistas.size / total) * 100);

  return { dias, feitos, resumo, aulasVistas, quizzes, fechados, continuar, percentual };
}

// A aula anterior e a seguinte, pela ordem dos números.
export function vizinhas(curso: CursoDoAluno, aulaId: string): { anterior: string | null; seguinte: string | null } {
  const porNumero = [...curso.aulas].sort((a, b) => a.numero - b.numero);
  const posicao = porNumero.findIndex((aula) => aula.id === aulaId);
  if (posicao === -1) return { anterior: null, seguinte: null };
  return { anterior: porNumero[posicao - 1]?.id ?? null, seguinte: porNumero[posicao + 1]?.id ?? null };
}

// O item da trilha (se houver) de uma tarefa: é por ele que a tarefa é marcada como feita.
export function itemDaTarefa(dias: readonly DiaDoAluno[], tarefaId: string): string | null {
  for (const dia of dias) {
    const item = dia.itens.find((i) => i.tarefaId === tarefaId);
    if (item) return item.id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Vídeo
// ---------------------------------------------------------------------------

// A aula conta como vista quando o vídeo chega a 90%: quase ninguém assiste aos últimos segundos.
export const FRACAO_PARA_CONCLUIR = 0.9;

export function videoConcluido(posicaoSeg: number, duracaoSeg: number): boolean {
  return Number.isFinite(posicaoSeg) && Number.isFinite(duracaoSeg) && duracaoSeg > 0 && posicaoSeg / duracaoSeg >= FRACAO_PARA_CONCLUIR;
}

// De onde o vídeo recomeça: do ponto em que a pessoa parou, se parou depois dos primeiros
// segundos e a aula ainda não foi vista. Senão, do começo.
export function pontoDeRetomada(posicaoSeg: number | undefined, vista: boolean): number {
  if (vista || posicaoSeg === undefined || !Number.isFinite(posicaoSeg) || posicaoSeg < 15) return 0;
  return Math.floor(posicaoSeg);
}

// Posição recebida do navegador -> segundos inteiros para gravar, ou null se não for um número aceitável.
export function lerPosicao(valor: unknown): number | null {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > 24 * 60 * 60) return null;
  return Math.floor(valor);
}

// "12 min", "1 h 05 min" ou "" (em espanhol e em português é igual).
export function duracaoCurta(segundos: number | null): string {
  if (segundos === null || segundos <= 0) return '';
  const minutos = Math.max(1, Math.round(segundos / 60));
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
}
