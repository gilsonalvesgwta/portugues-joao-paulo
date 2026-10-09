import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itensConcluidos, itensDoDia, progressoDoCurso, resumoDaTrilha, type Dia } from './trilha.ts';

// Três dias: cada um com aula, quiz e uma tarefa; a tarefa do dia 2 é opcional.
const dias: Dia[] = [1, 2, 3].map((n) => ({
  numero: n,
  itens: [
    { id: `t${n}`, tipo: 'tarefa', ordem: 3, obrigatorio: n !== 2 },
    { id: `a${n}`, tipo: 'aula', ordem: 1, obrigatorio: true, aulaId: `aula-${n}` },
    { id: `q${n}`, tipo: 'quiz', ordem: 2, obrigatorio: true, quizId: `quiz-${n}` },
  ],
}));

const feitos = (...ids: string[]) => new Set(ids);

test('aluno novo começa no dia 1, com a aula 1 no botão Continuar', () => {
  const r = resumoDaTrilha(dias, feitos());
  assert.deepEqual(r, { hoje: 1, concluida: false, diasConcluidos: 0, totalDias: 3, proximaAulaId: 'aula-1' });
});

test('o dia só avança com todos os itens obrigatórios concluídos', () => {
  assert.equal(resumoDaTrilha(dias, feitos('a1', 'q1')).hoje, 1);
  assert.equal(resumoDaTrilha(dias, feitos('a1', 'q1', 't1')).hoje, 2);
});

test('item opcional não segura o avanço', () => {
  const r = resumoDaTrilha(dias, feitos('a1', 'q1', 't1', 'a2', 'q2'));
  assert.equal(r.hoje, 3);
  assert.equal(r.diasConcluidos, 2);
});

test('adiantar um dia futuro não muda o dia de hoje', () => {
  const r = resumoDaTrilha(dias, feitos('a3', 'q3', 't3'));
  assert.equal(r.hoje, 1);
  assert.equal(r.diasConcluidos, 1);
  assert.equal(r.proximaAulaId, 'aula-1');
});

test('Continuar aponta a próxima aula não assistida, mesmo com o dia ainda aberto', () => {
  assert.equal(resumoDaTrilha(dias, feitos('a1')).proximaAulaId, 'aula-2');
  assert.equal(resumoDaTrilha(dias, feitos('a1')).hoje, 1);
});

test('trilha concluída fica no último dia e sem próxima aula', () => {
  const r = resumoDaTrilha(dias, feitos('a1', 'q1', 't1', 'a2', 'q2', 'a3', 'q3', 't3'));
  assert.deepEqual(r, { hoje: 3, concluida: true, diasConcluidos: 3, totalDias: 3, proximaAulaId: null });
});

test('trilha vazia e dias fora de ordem', () => {
  assert.deepEqual(resumoDaTrilha([], feitos()), { hoje: null, concluida: false, diasConcluidos: 0, totalDias: 0, proximaAulaId: null });
  assert.equal(resumoDaTrilha([...dias].reverse(), feitos('a1', 'q1', 't1')).hoje, 2);
});

test('itens do dia saem na ordem de exibição, com a marca de concluído', () => {
  const itens = itensDoDia(dias[0] as Dia, feitos('q1'));
  assert.deepEqual(itens.map((i) => [i.id, i.concluido]), [['a1', false], ['q1', true], ['t1', false]]);
});

test('conclusão vem de três fontes: vídeo assistido, quiz feito e tarefa marcada', () => {
  const c = itensConcluidos(dias, new Set(['aula-1']), new Set(['quiz-2']), new Set(['t3', 'a2']));
  assert.deepEqual([...c].sort(), ['a1', 'q2', 't3']);
});

test('barra de progresso arredonda para baixo e nunca passa de 100', () => {
  assert.equal(progressoDoCurso(17, 100), 17);
  assert.equal(progressoDoCurso(99, 100), 99);
  assert.equal(progressoDoCurso(199, 200), 99);
  assert.equal(progressoDoCurso(100, 100), 100);
  assert.equal(progressoDoCurso(120, 100), 100);
  assert.equal(progressoDoCurso(5, 0), 0);
  assert.equal(progressoDoCurso(-3, 10), 0);
});
