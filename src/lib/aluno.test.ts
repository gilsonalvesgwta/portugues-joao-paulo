import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  diaDeApertura, duracaoCurta, duracionEnPalabras, fraseDeHoy, inicialDe, itemDaTarefa, lerPosicao, miniaturaDoYoutube, montarDias, montarPainel, nombreCorto,
  pendientesDeHoy, pontoDeRetomada, SEM_PROGRESSO, videoConcluido, vizinhas,
  type CursoDoAluno, type Progresso,
} from './aluno.ts';

// Curso com 3 aulas publicadas (a aula "rascunho" não vem do banco), quiz na aula 1 e duas tarefas.
// Trilha do professor: dia 1 = aula 1, quiz 1, tarefa 1 (opcional a tarefa 2); dia 2 = só uma aula
// em rascunho (some); dia 3 = aula 2 e o quiz de uma aula em rascunho (some); dia 4 = aula 3.
function curso(modo: 'livre' | 'sequencial' = 'livre'): CursoDoAluno {
  return {
    curso: { id: 'c', titulo_pt: 'Português', titulo_es: 'Portugués', tipo: 'principal', modo },
    modulos: [{ id: 'm1', ordem: 1, titulo_pt: 'Módulo 1', titulo_es: 'Módulo 1' }],
    aulas: [
      { id: 'a2', modulo_id: 'm1', numero: 2, titulo_pt: 'Aula 2', titulo_es: 'Clase 2', duracao_seg: 600 },
      { id: 'a1', modulo_id: 'm1', numero: 1, titulo_pt: 'Aula 1', titulo_es: 'Clase 1', duracao_seg: null },
      { id: 'a3', modulo_id: 'm1', numero: 3, titulo_pt: 'Aula 3', titulo_es: 'Clase 3', duracao_seg: 60 },
    ],
    quizzes: [{ id: 'q1', aula_id: 'a1', nota_minima: 70 }],
    tarefas: [
      { id: 't1', aula_id: 'a1', titulo_es: 'Tarea 1', instrucao_es: 'Haz esto.', link: null },
      { id: 't2', aula_id: null, titulo_es: 'Tarea 2', instrucao_es: 'Haz aquello.', link: 'https://exemplo.test/t2' },
    ],
    trilha: [
      { numero: 3, itens: [{ id: 'i-a2', tipo: 'aula', alvo: 'a2', obrigatorio: true }, { id: 'i-qr', tipo: 'quiz', alvo: 'quiz-de-rascunho', obrigatorio: true }] },
      { numero: 1, itens: [
        { id: 'i-a1', tipo: 'aula', alvo: 'a1', obrigatorio: true },
        { id: 'i-q1', tipo: 'quiz', alvo: 'q1', obrigatorio: true },
        { id: 'i-t1', tipo: 'tarefa', alvo: 't1', obrigatorio: true },
        { id: 'i-t2', tipo: 'tarefa', alvo: 't2', obrigatorio: false },
      ] },
      { numero: 2, itens: [{ id: 'i-ar', tipo: 'aula', alvo: 'aula-em-rascunho', obrigatorio: true }] },
      { numero: 4, itens: [{ id: 'i-a3', tipo: 'aula', alvo: 'a3', obrigatorio: true }] },
    ],
  };
}

function progresso(parcial: Partial<Progresso>): Progresso {
  return { ...SEM_PROGRESSO, ...parcial };
}
const vista = (id: string) => ({ aula_id: id, posicao_seg: 0, concluida: true });

test('a trilha do aluno só tem o que ele pode ver; dia que fica vazio some e os dias são renumerados', () => {
  const dias = montarDias(curso());
  assert.deepEqual(dias.map((dia) => [dia.numero, dia.itens.map((item) => item.id)]), [
    [1, ['i-a1', 'i-q1', 'i-t1', 'i-t2']],
    [2, ['i-a2']],
    [3, ['i-a3']],
  ]);
  assert.deepEqual(dias[0]?.itens.map((item) => [item.tipo, item.aulaId ?? item.quizId ?? item.tarefaId, item.ordem, item.obrigatorio]), [
    ['aula', 'a1', 1, true], ['quiz', 'q1', 2, true], ['tarefa', 't1', 3, true], ['tarefa', 't2', 4, false],
  ]);
  assert.equal(itemDaTarefa(dias, 't1'), 'i-t1');
  assert.equal(itemDaTarefa(dias, 'fora-da-trilha'), null);
  assert.deepEqual(montarDias({ ...curso(), trilha: [] }), []);
});

test('começo do curso: hoje é o dia 1, nada feito, e Continuar leva à primeira aula', () => {
  const painel = montarPainel(curso(), SEM_PROGRESSO);
  assert.equal(painel.resumo.hoje, 1);
  assert.equal(painel.resumo.totalDias, 3);
  assert.equal(painel.percentual, 0);
  assert.deepEqual(painel.continuar, { tipo: 'aula', id: 'a1' });
  assert.equal(painel.fechados.size, 0, 'curso livre não fecha nada');
});

test('o dia só vira quando os obrigatórios estão feitos; a tarefa opcional não segura', () => {
  let painel = montarPainel(curso(), progresso({ aulas: [vista('a1')] }));
  assert.equal(painel.resumo.hoje, 1);
  assert.deepEqual(painel.continuar, { tipo: 'quiz', id: 'q1' }, 'vista a aula, o que falta é o quiz');
  assert.equal(painel.percentual, 33);

  painel = montarPainel(curso(), progresso({ aulas: [vista('a1')], quizzes: [{ quiz_id: 'q1', tentativas: 2, melhor: 50 }] }));
  assert.equal(painel.resumo.hoje, 1);
  assert.equal(painel.continuar, null, 'só falta a tarefa, que está na tela de início');
  assert.deepEqual(painel.quizzes.get('q1'), { melhor: 50, tentativas: 2 });

  painel = montarPainel(curso(), progresso({ aulas: [vista('a1')], quizzes: [{ quiz_id: 'q1', tentativas: 1, melhor: 0 }], itens: ['i-t1'] }));
  assert.equal(painel.resumo.hoje, 2, 'quiz respondido conta mesmo sem acertar; a tarefa opcional ficou por fazer');
  assert.deepEqual(painel.continuar, { tipo: 'aula', id: 'a2' });
  assert.deepEqual([...painel.feitos].sort(), ['i-a1', 'i-q1', 'i-t1']);
});

test('curso em sequência: o que está em um dia depois de hoje fica fechado, e abre conforme o aluno avança', () => {
  let painel = montarPainel(curso('sequencial'), SEM_PROGRESSO);
  assert.deepEqual([...painel.fechados].sort(), ['a2', 'a3']);
  painel = montarPainel(curso('sequencial'), progresso({ aulas: [vista('a1')], quizzes: [{ quiz_id: 'q1', tentativas: 1, melhor: 100 }], itens: ['i-t1'] }));
  assert.deepEqual([...painel.fechados], ['a3']);
  assert.equal(montarPainel(curso('sequencial'), SEM_PROGRESSO, true).fechados.size, 0, 'para a equipe, nada fica fechado');
  // Aula fora da trilha nunca fica fechada.
  const comAulaSolta = curso('sequencial');
  comAulaSolta.aulas.push({ id: 'a9', modulo_id: 'm1', numero: 9, titulo_pt: 'Extra', titulo_es: 'Extra', duracao_seg: null });
  assert.equal(montarPainel(comAulaSolta, SEM_PROGRESSO).fechados.has('a9'), false);
});

test('trilha concluída: nada fechado, 100% só com todas as aulas vistas, e Continuar some', () => {
  const tudo = progresso({ aulas: [vista('a1'), vista('a2'), vista('a3')], quizzes: [{ quiz_id: 'q1', tentativas: 1, melhor: 100 }], itens: ['i-t1'] });
  const painel = montarPainel(curso('sequencial'), tudo);
  assert.equal(painel.resumo.concluida, true);
  assert.equal(painel.resumo.diasConcluidos, 3);
  assert.equal(painel.percentual, 100);
  assert.equal(painel.fechados.size, 0);
  assert.equal(painel.continuar, null);
  // Duas de três aulas: 66%, nunca arredonda para cima.
  assert.equal(montarPainel(curso(), progresso({ aulas: [vista('a1'), vista('a2')] })).percentual, 66);
});

test('sem trilha: Continuar segue a ordem dos números; progresso de aula que saiu do ar não conta', () => {
  const semTrilha = { ...curso(), trilha: [] };
  let painel = montarPainel(semTrilha, progresso({ aulas: [vista('a1'), vista('aula-que-virou-rascunho')] }));
  assert.equal(painel.resumo.hoje, null);
  assert.deepEqual(painel.continuar, { tipo: 'aula', id: 'a2' });
  assert.equal(painel.percentual, 33);
  assert.deepEqual([...painel.aulasVistas], ['a1']);
  painel = montarPainel({ ...semTrilha, aulas: [] }, SEM_PROGRESSO);
  assert.equal(painel.continuar, null);
  assert.equal(painel.percentual, 0);
});

test('aula anterior e seguinte pela ordem dos números', () => {
  assert.deepEqual(vizinhas(curso(), 'a1'), { anterior: null, seguinte: 'a2' });
  assert.deepEqual(vizinhas(curso(), 'a2'), { anterior: 'a1', seguinte: 'a3' });
  assert.deepEqual(vizinhas(curso(), 'a3'), { anterior: 'a2', seguinte: null });
  assert.deepEqual(vizinhas(curso(), 'outra'), { anterior: null, seguinte: null });
});

test('vídeo: conta como visto aos 90%; retoma de onde parou; posição estranha é recusada', () => {
  assert.equal(videoConcluido(539, 600), false);
  assert.equal(videoConcluido(540, 600), true);
  assert.equal(videoConcluido(10, 0), false);
  assert.equal(videoConcluido(Number.NaN, 600), false);
  assert.equal(pontoDeRetomada(120.7, false), 120);
  assert.equal(pontoDeRetomada(10, false), 0, 'parou logo no começo: recomeça do zero');
  assert.equal(pontoDeRetomada(120, true), 0, 'aula já vista recomeça do zero');
  assert.equal(pontoDeRetomada(undefined, false), 0);
  assert.equal(lerPosicao(61.9), 61);
  for (const ruim of [-1, Number.NaN, Number.POSITIVE_INFINITY, 90000, '60', null]) assert.equal(lerPosicao(ruim), null, String(ruim));
});

test('duração curta', () => {
  assert.equal(duracaoCurta(null), '');
  assert.equal(duracaoCurta(20), '1 min');
  assert.equal(duracaoCurta(754), '13 min');
  assert.equal(duracaoCurta(3900), '1 h 05 min');
});

test('duração por extenso, para as frases', () => {
  assert.equal(duracionEnPalabras(null), '');
  assert.equal(duracionEnPalabras(0), '');
  assert.equal(duracionEnPalabras(40), '1 minuto');
  assert.equal(duracionEnPalabras(720), '12 minutos');
  assert.equal(duracionEnPalabras(3600), '1 hora');
  assert.equal(duracionEnPalabras(3900), '1 hora y 5 minutos');
  assert.equal(duracionEnPalabras(7260), '2 horas y 1 minuto');
});

test('o que falta hoje: só o obrigatório conta, e a frase concorda em número', () => {
  const comeco = montarPainel(curso('sequencial'), SEM_PROGRESSO);
  assert.deepEqual(pendientesDeHoy(comeco), { clases: 1, quizzes: 1, tareas: 1 }, 'a tarefa opcional fica de fora');
  assert.equal(fraseDeHoy(pendientesDeHoy(comeco)), 'Hoy te esperan una clase, un quiz y una tarea.');

  const soTarefa = montarPainel(curso('sequencial'), progresso({ aulas: [vista('a1')], quizzes: [{ quiz_id: 'q1', tentativas: 1, melhor: 80 }] }));
  assert.deepEqual(pendientesDeHoy(soTarefa), { clases: 0, quizzes: 0, tareas: 1 });
  assert.equal(fraseDeHoy(pendientesDeHoy(soTarefa)), 'Hoy te espera una tarea.');

  const dia2 = montarPainel(curso('sequencial'), progresso({ aulas: [vista('a1')], quizzes: [{ quiz_id: 'q1', tentativas: 1, melhor: 80 }], itens: ['i-t1'] }));
  assert.equal(fraseDeHoy(pendientesDeHoy(dia2)), 'Hoy te espera una clase.');

  const fim = montarPainel(curso('sequencial'), progresso({ aulas: [vista('a1'), vista('a2'), vista('a3')], quizzes: [{ quiz_id: 'q1', tentativas: 1, melhor: 80 }], itens: ['i-t1'] }));
  assert.deepEqual(pendientesDeHoy(fim), { clases: 0, quizzes: 0, tareas: 0 });
  assert.equal(fraseDeHoy(pendientesDeHoy(fim)), '');

  assert.equal(fraseDeHoy({ clases: 2, quizzes: 0, tareas: 3 }), 'Hoy te esperan 2 clases y 3 tareas.');
  assert.equal(fraseDeHoy({ clases: 0, quizzes: 2, tareas: 0 }), 'Hoy te esperan 2 quizzes.');
});

test('o dia em que cada aula abre, pela trilha do aluno', () => {
  const dias = montarDias(curso());
  assert.equal(diaDeApertura(dias, 'a1'), 1);
  assert.equal(diaDeApertura(dias, 'q1'), 1);
  assert.equal(diaDeApertura(dias, 'a2'), 2, 'o dia que ficou vazio não conta');
  assert.equal(diaDeApertura(dias, 'a3'), 3);
  assert.equal(diaDeApertura(dias, 'fora-da-trilha'), null);
});

test('o nome que cabe no topo e a letra do círculo', () => {
  assert.equal(nombreCorto('Elena Ruiz', 'elena@exemplo.test'), 'Elena Ruiz');
  assert.equal(nombreCorto('  María   de los Ángeles Fernández-Villaverde ', 'm@exemplo.test'), 'María', 'nome comprido: só o primeiro');
  assert.equal(nombreCorto('', 'servocar.consorcios@exemplo.test'), 'servocar.consorcios', 'sem nome: o começo do e-mail');
  assert.equal(nombreCorto('Wolfeschlegelsteinhausenbergerdorff', 'w@exemplo.test'), 'Wolfeschlegelsteinhau…');
  assert.ok(nombreCorto('Wolfeschlegelsteinhausenbergerdorff', 'w@exemplo.test').length <= 22);
  assert.equal(inicialDe('elena ruiz', 'x@exemplo.test'), 'E');
  assert.equal(inicialDe(' ángela', 'x@exemplo.test'), 'Á');
  assert.equal(inicialDe('', 'julia@exemplo.test'), 'J');
  assert.equal(inicialDe('«Lola»', 'x@exemplo.test'), 'L', 'sinais não servem de inicial');
  assert.equal(inicialDe('', ''), '?');
});

test('miniatura do vídeo no YouTube', () => {
  assert.equal(miniaturaDoYoutube('aB3dE6gH9jK'), 'https://i.ytimg.com/vi/aB3dE6gH9jK/hqdefault.jpg');
  assert.equal(miniaturaDoYoutube('a/b?c'), 'https://i.ytimg.com/vi/a%2Fb%3Fc/hqdefault.jpg', 'o código nunca muda o endereço');
});
