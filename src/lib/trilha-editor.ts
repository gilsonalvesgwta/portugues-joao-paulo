// A trilha por dia como o editor da administração a enxerga: uma lista de dias, cada dia com
// seus itens (aula, quiz ou tarefa). Este arquivo confere o que o editor manda gravar e reúne as
// operações do editor (mover, montar sozinho, ver o que ficou de fora).
// Sem dependências: vale na tela, no servidor e nos testes.

export type TipoDeItem = 'aula' | 'quiz' | 'tarefa';

// id: o do item já gravado (null enquanto é novo). alvo: a aula, o quiz ou a tarefa.
export type ItemDaTrilha = { id: string | null; tipo: TipoDeItem; alvo: string; obrigatorio: boolean };
export type DiaDaTrilha = { itens: ItemDaTrilha[] };

// O que pode entrar na trilha de um curso.
export type Disponivel = {
  tipo: TipoDeItem;
  alvo: string;
  rotulo: string;
  // Aula a que o item se refere (a própria aula, a aula do quiz ou a aula ligada à tarefa).
  aulaId: string | null;
  numeroDaAula: number | null;
  // false = em rascunho: está na trilha, mas o aluno ainda não vê.
  publicado: boolean;
};

export const LIMITES_DA_TRILHA = { dias: 400, itensPorDia: 12 } as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS: readonly TipoDeItem[] = ['aula', 'quiz', 'tarefa'];

export function chave(item: { tipo: TipoDeItem; alvo: string }): string {
  return `${item.tipo}:${item.alvo}`;
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export type ResultadoDaTrilha = { ok: true; dias: DiaDaTrilha[] } | { ok: false; erro: string };

const INESPERADO = 'A trilha chegou em um formato inesperado.';

// Confere o que veio do editor. "validos" são as chaves (tipo:alvo) do que existe no curso.
// Dias sem nenhum item são descartados, e os dias seguintes sobem.
export function validarTrilha(entrada: unknown, validos: ReadonlySet<string>): ResultadoDaTrilha {
  if (!Array.isArray(entrada)) return { ok: false, erro: INESPERADO };
  const dias: DiaDaTrilha[] = [];
  const usados = new Set<string>();
  const ids = new Set<string>();

  for (const bruto of entrada) {
    if (!ehObjeto(bruto) || !Array.isArray(bruto.itens)) return { ok: false, erro: INESPERADO };
    const itens: ItemDaTrilha[] = [];
    for (const item of bruto.itens) {
      if (!ehObjeto(item)) return { ok: false, erro: INESPERADO };
      const tipo = TIPOS.find((t) => t === item.tipo);
      const alvo = typeof item.alvo === 'string' && UUID.test(item.alvo) ? item.alvo : null;
      const id = item.id === null || item.id === undefined ? null : typeof item.id === 'string' && UUID.test(item.id) ? item.id : undefined;
      if (!tipo || alvo === null || id === undefined || typeof item.obrigatorio !== 'boolean') return { ok: false, erro: INESPERADO };

      const k = chave({ tipo, alvo });
      if (!validos.has(k)) {
        return { ok: false, erro: 'Um item da trilha não existe mais neste curso. Recarregue a tela e monte de novo.' };
      }
      if (usados.has(k)) return { ok: false, erro: 'Um mesmo item aparece duas vezes na trilha. Cada aula, quiz ou tarefa entra uma vez só.' };
      usados.add(k);
      if (id !== null) {
        if (ids.has(id)) return { ok: false, erro: INESPERADO };
        ids.add(id);
      }
      itens.push({ id, tipo, alvo, obrigatorio: item.obrigatorio });
    }
    if (itens.length > LIMITES_DA_TRILHA.itensPorDia) {
      return { ok: false, erro: `Cada dia pode ter até ${LIMITES_DA_TRILHA.itensPorDia} itens.` };
    }
    if (itens.length > 0) dias.push({ itens });
  }
  if (dias.length > LIMITES_DA_TRILHA.dias) return { ok: false, erro: `A trilha pode ter até ${LIMITES_DA_TRILHA.dias} dias.` };
  return { ok: true, dias };
}

// O que existe no curso e ainda não está em nenhum dia, na ordem das aulas.
export function foraDaTrilha(dias: readonly DiaDaTrilha[], disponiveis: readonly Disponivel[]): Disponivel[] {
  const dentro = new Set(dias.flatMap((dia) => dia.itens.map(chave)));
  const ordemDoTipo: Record<TipoDeItem, number> = { aula: 0, quiz: 1, tarefa: 2 };
  return disponiveis
    .filter((d) => !dentro.has(chave(d)))
    .sort(
      (a, b) =>
        (a.numeroDaAula ?? Number.MAX_SAFE_INTEGER) - (b.numeroDaAula ?? Number.MAX_SAFE_INTEGER) ||
        ordemDoTipo[a.tipo] - ordemDoTipo[b.tipo] ||
        a.rotulo.localeCompare(b.rotulo),
    );
}

// Item novo para um disponível. Se ele já esteve na trilha gravada, volta com o mesmo id:
// assim o que o aluno marcou naquele item continua valendo.
export function itemPara(disponivel: { tipo: TipoDeItem; alvo: string }, idsGravados: ReadonlyMap<string, string>): ItemDaTrilha {
  return { id: idsGravados.get(chave(disponivel)) ?? null, tipo: disponivel.tipo, alvo: disponivel.alvo, obrigatorio: true };
}

// Monta sozinho o que falta: um dia para cada aula que ainda está fora da trilha, com a aula,
// o quiz dela e as tarefas ligadas a ela. O que não tem aula (tarefa do curso todo) ou é de uma
// aula que já está na trilha fica de fora, para o professor colocar onde quiser.
export function montarSozinho(
  dias: readonly DiaDaTrilha[],
  disponiveis: readonly Disponivel[],
  idsGravados: ReadonlyMap<string, string>,
): DiaDaTrilha[] {
  const fora = foraDaTrilha(dias, disponiveis);
  const novos: DiaDaTrilha[] = [];
  for (const aula of fora.filter((d) => d.tipo === 'aula')) {
    const doDia = [aula, ...fora.filter((d) => d.tipo !== 'aula' && d.aulaId === aula.alvo)];
    novos.push({ itens: doDia.slice(0, LIMITES_DA_TRILHA.itensPorDia).map((d) => itemPara(d, idsGravados)) });
  }
  return [...dias.map((dia) => ({ itens: [...dia.itens] })), ...novos];
}

// Sobe ou desce um item. Na ponta do dia, ele passa para o dia vizinho (se houver).
export function moverItem(dias: readonly DiaDaTrilha[], dia: number, posicao: number, direcao: 'subir' | 'descer'): DiaDaTrilha[] {
  const copia = dias.map((d) => ({ itens: [...d.itens] }));
  const origem = copia[dia];
  const item = origem?.itens[posicao];
  if (!origem || !item) return copia;

  if (direcao === 'subir') {
    if (posicao > 0) {
      origem.itens.splice(posicao, 1);
      origem.itens.splice(posicao - 1, 0, item);
    } else {
      const anterior = copia[dia - 1];
      if (!anterior || anterior.itens.length >= LIMITES_DA_TRILHA.itensPorDia) return copia;
      origem.itens.splice(posicao, 1);
      anterior.itens.push(item);
    }
  } else if (posicao < origem.itens.length - 1) {
    origem.itens.splice(posicao, 1);
    origem.itens.splice(posicao + 1, 0, item);
  } else {
    const seguinte = copia[dia + 1];
    if (!seguinte || seguinte.itens.length >= LIMITES_DA_TRILHA.itensPorDia) return copia;
    origem.itens.splice(posicao, 1);
    seguinte.itens.unshift(item);
  }
  return copia;
}

// Troca um dia inteiro de lugar com o vizinho.
export function moverDia(dias: readonly DiaDaTrilha[], dia: number, direcao: 'subir' | 'descer'): DiaDaTrilha[] {
  const copia = dias.map((d) => ({ itens: [...d.itens] }));
  const destino = direcao === 'subir' ? dia - 1 : dia + 1;
  const a = copia[dia];
  const b = copia[destino];
  if (!a || !b) return copia;
  copia[dia] = b;
  copia[destino] = a;
  return copia;
}

// Do banco (função ler_trilha) para o editor. O que não reconhecer é ignorado.
export function doBancoParaTrilha(gravado: unknown): DiaDaTrilha[] {
  if (!Array.isArray(gravado)) return [];
  const dias: DiaDaTrilha[] = [];
  for (const dia of gravado) {
    const itens: ItemDaTrilha[] = [];
    for (const item of ehObjeto(dia) && Array.isArray(dia.itens) ? dia.itens : []) {
      if (!ehObjeto(item)) continue;
      const tipo = TIPOS.find((t) => t === item.tipo);
      if (!tipo || typeof item.id !== 'string' || typeof item.alvo !== 'string') continue;
      itens.push({ id: item.id, tipo, alvo: item.alvo, obrigatorio: item.obrigatorio !== false });
    }
    dias.push({ itens });
  }
  return dias;
}
