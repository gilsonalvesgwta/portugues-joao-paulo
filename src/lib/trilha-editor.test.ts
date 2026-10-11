import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chave, doBancoParaTrilha, foraDaTrilha, itemPara, montarSozinho, moverDia, moverItem, validarTrilha, type Disponivel, type ItemDaTrilha,
} from './trilha-editor.ts';

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const aula = (n: number, publicado = true): Disponivel => ({ tipo: 'aula', alvo: u(n), rotulo: `Aula ${n}`, aulaId: u(n), numeroDaAula: n, publicado });
const quiz = (n: number): Disponivel => ({ tipo: 'quiz', alvo: u(100 + n), rotulo: `Quiz da aula ${n}`, aulaId: u(n), numeroDaAula: n, publicado: true });
const tarefa = (n: number, daAula: number | null): Disponivel => ({
  tipo: 'tarefa', alvo: u(200 + n), rotulo: `Tarefa ${n}`, aulaId: daAula === null ? null : u(daAula), numeroDaAula: daAula, publicado: true,
});
const disponiveis = [aula(2), aula(1), quiz(1), tarefa(1, 1), tarefa(2, null), aula(3, false), quiz(3)];
const validos = new Set(disponiveis.map(chave));
const item = (d: Disponivel, id: string | null = null, obrigatorio = true): ItemDaTrilha => ({ id, tipo: d.tipo, alvo: d.alvo, obrigatorio });

test('trilha válida passa; dias vazios somem e os seguintes sobem', () => {
  const r = validarTrilha([{ itens: [item(aula(1), u(900)), item(quiz(1))] }, { itens: [] }, { itens: [item(aula(2), null, false)] }], validos);
  assert.deepEqual(r, {
    ok: true,
    dias: [{ itens: [item(aula(1), u(900)), item(quiz(1))] }, { itens: [item(aula(2), null, false)] }],
  });
  assert.deepEqual(validarTrilha([], validos), { ok: true, dias: [] });
});

test('item repetido, de fora do curso ou malformado é recusado', () => {
  const repetido = validarTrilha([{ itens: [item(aula(1))] }, { itens: [item(aula(1))] }], validos);
  assert.equal(repetido.ok, false);
  if (!repetido.ok) assert.match(repetido.erro, /duas vezes/);

  const deFora = validarTrilha([{ itens: [item(aula(99))] }], validos);
  assert.equal(deFora.ok, false);
  if (!deFora.ok) assert.match(deFora.erro, /não existe mais neste curso/);

  for (const ruim of [null, {}, [null], [{ itens: 'x' }], [{ itens: [null] }], [{ itens: [{ ...item(aula(1)), tipo: 'prova' }] }],
    [{ itens: [{ ...item(aula(1)), alvo: 'x' }] }], [{ itens: [{ ...item(aula(1)), id: 'x' }] }], [{ itens: [{ ...item(aula(1)), obrigatorio: 'sim' }] }],
    [{ itens: [item(aula(1), u(900)), item(aula(2), u(900))] }]]) {
    const r = validarTrilha(ruim, validos);
    assert.equal(r.ok, false, JSON.stringify(ruim));
    if (!r.ok) assert.equal(r.erro, 'A trilha chegou em um formato inesperado.');
  }
});

test('limite de itens por dia', () => {
  const muitos = Array.from({ length: 13 }, (_, i) => aula(500 + i));
  const r = validarTrilha([{ itens: muitos.map((d) => item(d)) }], new Set(muitos.map(chave)));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erro, 'Cada dia pode ter até 12 itens.');
});

test('foraDaTrilha lista o que falta, na ordem das aulas, com as tarefas sem aula no fim', () => {
  const dias = [{ itens: [item(aula(1)), item(quiz(1))] }];
  assert.deepEqual(foraDaTrilha(dias, disponiveis).map((d) => d.rotulo), ['Tarefa 1', 'Aula 2', 'Aula 3', 'Quiz da aula 3', 'Tarefa 2']);
  assert.deepEqual(foraDaTrilha([], []).length, 0);
});

test('montarSozinho cria um dia por aula que falta, com o quiz e as tarefas dela', () => {
  const gravados = new Map([[chave(quiz(3)), u(950)]]);
  const montado = montarSozinho([{ itens: [item(aula(1))] }], disponiveis, gravados);
  assert.deepEqual(montado.map((dia) => dia.itens.map((i) => disponiveis.find((d) => chave(d) === chave(i))?.rotulo)), [
    ['Aula 1'],
    ['Aula 2'],
    ['Aula 3', 'Quiz da aula 3'],
  ]);
  assert.equal(montado[2]?.itens[1]?.id, u(950), 'item que já esteve na trilha volta com o mesmo id');
  // O quiz e a tarefa da aula 1 (que já estava na trilha) e a tarefa sem aula continuam de fora.
  assert.deepEqual(foraDaTrilha(montado, disponiveis).map((d) => d.rotulo), ['Quiz da aula 1', 'Tarefa 1', 'Tarefa 2']);
  assert.deepEqual(montarSozinho(montado, disponiveis, gravados), montado, 'montar de novo não muda nada');
});

test('itemPara reaproveita o id gravado e nasce obrigatório', () => {
  assert.deepEqual(itemPara(aula(1), new Map()), { id: null, tipo: 'aula', alvo: u(1), obrigatorio: true });
  assert.deepEqual(itemPara(aula(1), new Map([[chave(aula(1)), u(901)]])).id, u(901));
});

test('moverItem troca dentro do dia e, na ponta, passa para o dia vizinho', () => {
  const [a, b, c, d] = [item(aula(1)), item(quiz(1)), item(aula(2)), item(aula(3))];
  const dias = [{ itens: [a, b] }, { itens: [c, d] }];
  assert.deepEqual(moverItem(dias, 0, 0, 'descer'), [{ itens: [b, a] }, { itens: [c, d] }]);
  assert.deepEqual(moverItem(dias, 0, 1, 'descer'), [{ itens: [a] }, { itens: [b, c, d] }]);
  assert.deepEqual(moverItem(dias, 1, 0, 'subir'), [{ itens: [a, b, c] }, { itens: [d] }]);
  assert.deepEqual(moverItem(dias, 0, 0, 'subir'), dias, 'no topo do primeiro dia, fica');
  assert.deepEqual(moverItem(dias, 1, 1, 'descer'), dias, 'no fim do último dia, fica');
  assert.deepEqual(moverItem(dias, 5, 0, 'subir'), dias);
  assert.deepEqual(dias, [{ itens: [a, b] }, { itens: [c, d] }], 'a lista original não é alterada');
});

test('moverDia troca dias inteiros', () => {
  const dias = [{ itens: [item(aula(1))] }, { itens: [item(aula(2))] }, { itens: [item(aula(3))] }];
  assert.deepEqual(moverDia(dias, 2, 'subir').map((d) => d.itens[0]?.alvo), [u(1), u(3), u(2)]);
  assert.deepEqual(moverDia(dias, 0, 'descer').map((d) => d.itens[0]?.alvo), [u(2), u(1), u(3)]);
  assert.deepEqual(moverDia(dias, 0, 'subir'), dias);
  assert.deepEqual(moverDia(dias, 2, 'descer'), dias);
});

test('doBancoParaTrilha lê o formato da função ler_trilha e ignora o que não reconhece', () => {
  const lido = doBancoParaTrilha([
    { numero: 1, itens: [{ id: u(900), tipo: 'aula', alvo: u(1), obrigatorio: true }, { id: u(901), tipo: 'prova', alvo: u(2), obrigatorio: true }] },
    { numero: 2, itens: [{ id: u(902), tipo: 'tarefa', alvo: u(201), obrigatorio: false }, null] },
  ]);
  assert.deepEqual(lido, [
    { itens: [{ id: u(900), tipo: 'aula', alvo: u(1), obrigatorio: true }] },
    { itens: [{ id: u(902), tipo: 'tarefa', alvo: u(201), obrigatorio: false }] },
  ]);
  assert.deepEqual(doBancoParaTrilha(null), []);
});
