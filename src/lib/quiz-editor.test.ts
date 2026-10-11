import assert from 'node:assert/strict';
import { test } from 'node:test';
import { corrigir } from './quiz.ts';
import { doBanco, palavrasDe, paraOBanco, perguntaVazia, TIPOS_DE_PERGUNTA, validarQuiz } from './quiz-editor.ts';

const bom = {
  dificuldade: 'medio',
  nota_minima: 80,
  perguntas: [
    { id: 'multipla01', tipo: 'multipla_escolha', enunciado: ' ¿Cómo se dice  "gracias"? ', opcoes: ['', 'obrigado', 'por favor', ' '], correta: 1 },
    { id: 'completa01', tipo: 'completar', frase: 'Eu ____ brasileiro.', opcoes: ['estou', 'sou'], correta: 1 },
    { id: 'ordenar001', tipo: 'ordenar', frase: '  Ela mora   no Brasil. ', traducao: 'Ella vive en Brasil.' },
  ],
};

test('quiz válido passa: textos arrumados, opções em branco fora e a correta acompanha', () => {
  const r = validarQuiz(bom, true);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.quiz, {
    dificuldade: 'medio',
    nota_minima: 80,
    perguntas: [
      { id: 'multipla01', tipo: 'multipla_escolha', enunciado: '¿Cómo se dice "gracias"?', opcoes: ['obrigado', 'por favor'], correta: 0 },
      { id: 'completa01', tipo: 'completar', frase: 'Eu ___ brasileiro.', opcoes: ['estou', 'sou'], correta: 1 },
      { id: 'ordenar001', tipo: 'ordenar', frase: 'Ela mora no Brasil.', traducao: 'Ella vive en Brasil.' },
    ],
  });
  assert.deepEqual(validarQuiz(r.quiz, true), r, 'o que foi conferido passa de novo igual');
});

test('o formato gravado no banco é o que a correção usa', () => {
  const r = validarQuiz(bom, true);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const [multipla, completar, ordenar] = r.quiz.perguntas.map(paraOBanco);
  assert.deepEqual(ordenar, { tipo: 'ordenar', palavras: ['Ela', 'mora', 'no', 'Brasil.'], traducao: 'Ella vive en Brasil.' });
  assert.ok(multipla && completar && ordenar);
  assert.equal(corrigir(multipla, 'obrigado').correta, true);
  assert.equal(corrigir(multipla, 'por favor').correta, false);
  assert.equal(corrigir(completar, 'sou').correta, true);
  assert.equal(corrigir(ordenar, ['Ela', 'mora', 'no', 'Brasil.']).correta, true);
  assert.equal(corrigir(ordenar, ['mora', 'Ela', 'no', 'Brasil.']).correta, false);
});

test('do banco para o editor e de volta, sem perder nada', () => {
  const r = validarQuiz(bom, true);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const linhas = r.quiz.perguntas.map(paraOBanco).map(({ tipo, ...conteudo }) => ({ tipo, conteudo }));
  const semId = (lista: { id: string }[]) => lista.map(({ id: _id, ...resto }) => resto);
  assert.deepEqual(semId(doBanco(linhas)), semId(r.quiz.perguntas));
  assert.deepEqual(doBanco([{ tipo: 'ouvir_escrever', conteudo: { audio: 'x', texto: 'y' } }, { tipo: 'ordenar', conteudo: null }]).length, 1);
});

test('cada problema aponta a pergunta pelo id', () => {
  const r = validarQuiz({
    dificuldade: 'facil',
    nota_minima: 70,
    perguntas: [
      { id: 'semcorreta', tipo: 'multipla_escolha', enunciado: 'Pergunta', opcoes: ['a', 'b'], correta: -1 },
      { id: 'corretavaz', tipo: 'multipla_escolha', enunciado: 'Pergunta', opcoes: ['a', '', 'b'], correta: 1 },
      { id: 'umaopcao01', tipo: 'multipla_escolha', enunciado: 'Pergunta', opcoes: ['a', ''], correta: 0 },
      { id: 'repetida01', tipo: 'multipla_escolha', enunciado: 'Pergunta', opcoes: ['a', 'a'], correta: 0 },
      { id: 'semenuncia', tipo: 'multipla_escolha', enunciado: '  ', opcoes: ['a', 'b'], correta: 0 },
      { id: 'semlacuna1', tipo: 'completar', frase: 'Eu sou brasileiro.', opcoes: ['a', 'b'], correta: 0 },
      { id: 'duaslacuna', tipo: 'completar', frase: 'Eu ___ de ___.', opcoes: ['a', 'b'], correta: 0 },
      { id: 'umapalavra', tipo: 'ordenar', frase: 'Oi', traducao: 'Hola' },
      { id: 'semtraduca', tipo: 'ordenar', frase: 'Ela mora aqui', traducao: '' },
    ],
  }, false);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(r.erros, {
    semcorreta: 'Marque qual opção é a correta.',
    corretavaz: 'Marque qual opção é a correta.',
    umaopcao01: 'Inclua pelo menos 2 opções.',
    repetida01: 'As opções não podem se repetir.',
    semenuncia: 'Escreva o enunciado.',
    semlacuna1: 'A frase precisa de exatamente uma lacuna (___).',
    duaslacuna: 'A frase precisa de exatamente uma lacuna (___).',
    umapalavra: 'A frase precisa de pelo menos 2 palavras.',
    semtraduca: 'Escreva a tradução da frase.',
  });
});

test('quiz sem perguntas: rascunho pode, publicar não', () => {
  assert.deepEqual(validarQuiz({ dificuldade: 'facil', nota_minima: 70, perguntas: [] }, false), {
    ok: true, quiz: { dificuldade: 'facil', nota_minima: 70, perguntas: [] },
  });
  const r = validarQuiz({ dificuldade: 'facil', nota_minima: 70, perguntas: [] }, true);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erros.geral, 'Para publicar, o quiz precisa de pelo menos uma pergunta.');
});

test('configuração errada, formato inesperado, tipo com áudio e excesso são recusados', () => {
  const com = (mudanca: Record<string, unknown>) => validarQuiz({ ...bom, ...mudanca }, false);
  for (const ruim of [com({ dificuldade: 'impossivel' }), com({ nota_minima: 101 }), com({ nota_minima: 70.5 }), com({ nota_minima: '70' })]) {
    assert.equal(ruim.ok, false);
    if (!ruim.ok) assert.ok(ruim.erros.geral);
  }
  for (const ruim of [null, [], { perguntas: 'x' }, { ...bom, perguntas: [null] }, { ...bom, perguntas: [{ tipo: 'ouvir_escrever', audio: 'a', texto: 'b' }] }]) {
    const r = validarQuiz(ruim, false);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.erros.geral);
  }
  const muitas = com({ perguntas: Array.from({ length: 31 }, () => ({ tipo: 'ordenar', frase: 'a b', traducao: 'c' })) });
  assert.equal(muitas.ok, false);
  if (!muitas.ok) assert.match(muitas.erros.geral ?? '', /até 30 perguntas/);
});

test('limites de tamanho', () => {
  const r = validarQuiz({
    dificuldade: 'facil', nota_minima: 70,
    perguntas: [
      { id: 'opcoesdema', tipo: 'multipla_escolha', enunciado: 'P', opcoes: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], correta: 0 },
      { id: 'fraselonga', tipo: 'ordenar', frase: Array.from({ length: 16 }, (_, i) => `p${i}`).join(' '), traducao: 'x' },
    ],
  }, false);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.erros.opcoesdema, 'Até 6 opções por pergunta.');
  assert.equal(r.erros.fraselonga, 'A frase pode ter até 15 palavras.');
});

test('pergunta vazia de cada tipo e separação das palavras', () => {
  for (const { tipo } of TIPOS_DE_PERGUNTA) assert.equal(perguntaVazia(tipo).tipo, tipo);
  assert.deepEqual(palavrasDe('  Eu  sou   de São Paulo. '), ['Eu', 'sou', 'de', 'São', 'Paulo.']);
  assert.deepEqual(palavrasDe(''), []);
});
