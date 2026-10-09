// Trilha de estudo por dia. O dia 1 começa na matrícula de cada aluno e o "hoje"
// avança pelo ritmo dele: é o primeiro dia que ainda tem item obrigatório pendente.
// Não existe calendário igual para todos nem contagem por dias corridos.

export type ItemDoDia = {
  id: string;
  tipo: 'aula' | 'quiz' | 'tarefa';
  ordem: number;
  obrigatorio: boolean;
  aulaId?: string;
  quizId?: string;
};

// Junta as três fontes de conclusão em um único conjunto de ids de itens do dia:
// a aula conta quando o vídeo foi concluído, o quiz quando o aluno terminou uma tentativa
// e a tarefa quando ele mesmo marcou.
export function itensConcluidos(
  dias: readonly Dia[],
  aulasConcluidas: ReadonlySet<string>,
  quizzesFeitos: ReadonlySet<string>,
  itensMarcados: ReadonlySet<string>,
): Set<string> {
  const concluidos = new Set<string>();
  for (const dia of dias) {
    for (const item of dia.itens) {
      const feito =
        (item.tipo === 'aula' && item.aulaId !== undefined && aulasConcluidas.has(item.aulaId)) ||
        (item.tipo === 'quiz' && item.quizId !== undefined && quizzesFeitos.has(item.quizId)) ||
        (item.tipo === 'tarefa' && itensMarcados.has(item.id));
      if (feito) concluidos.add(item.id);
    }
  }
  return concluidos;
}

export type Dia = {
  numero: number;
  itens: ItemDoDia[];
};

export type ResumoDaTrilha = {
  // Número do dia de hoje; null quando a trilha ainda não tem dias.
  hoje: number | null;
  // true quando todos os itens obrigatórios de todos os dias foram concluídos.
  concluida: boolean;
  diasConcluidos: number;
  totalDias: number;
  // Aula que o botão "Continuar" abre: a primeira aula ainda não concluída, na ordem da trilha.
  proximaAulaId: string | null;
};

function diaConcluido(dia: Dia, concluidos: ReadonlySet<string>): boolean {
  return dia.itens.every((item) => !item.obrigatorio || concluidos.has(item.id));
}

export function resumoDaTrilha(dias: readonly Dia[], concluidos: ReadonlySet<string>): ResumoDaTrilha {
  const ordenados = [...dias].sort((a, b) => a.numero - b.numero);
  const totalDias = ordenados.length;
  if (totalDias === 0) {
    return { hoje: null, concluida: false, diasConcluidos: 0, totalDias: 0, proximaAulaId: null };
  }

  const pendente = ordenados.find((dia) => !diaConcluido(dia, concluidos));
  const diasConcluidos = ordenados.filter((dia) => diaConcluido(dia, concluidos)).length;

  let proximaAulaId: string | null = null;
  for (const dia of ordenados) {
    const aulas = dia.itens.filter((i) => i.tipo === 'aula').sort((a, b) => a.ordem - b.ordem);
    const aberta = aulas.find((aula) => !concluidos.has(aula.id));
    if (aberta) {
      proximaAulaId = aberta.aulaId ?? null;
      break;
    }
  }

  return {
    hoje: pendente ? pendente.numero : (ordenados[totalDias - 1] as Dia).numero,
    concluida: pendente === undefined,
    diasConcluidos,
    totalDias,
    proximaAulaId,
  };
}

// Itens de um dia na ordem de exibição, cada um com a marca de concluído.
export function itensDoDia(dia: Dia, concluidos: ReadonlySet<string>): (ItemDoDia & { concluido: boolean })[] {
  return [...dia.itens]
    .sort((a, b) => a.ordem - b.ordem)
    .map((item) => ({ ...item, concluido: concluidos.has(item.id) }));
}

// Percentual da barra de progresso do curso: aulas concluídas sobre aulas publicadas.
// Arredonda para baixo, para só mostrar 100% com tudo concluído.
export function progressoDoCurso(aulasConcluidas: number, totalDeAulas: number): number {
  if (totalDeAulas <= 0) return 0;
  const feitas = Math.min(Math.max(aulasConcluidas, 0), totalDeAulas);
  return Math.floor((feitas / totalDeAulas) * 100);
}
