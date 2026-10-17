import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conferirPar, corrigir, corrigirQuiz, paraAluno, validarPergunta, type Pergunta } from './quiz.ts';

// Três pares com a gravação do professor e um sem (esse vai para a voz do navegador).
const parear: Pergunta = {
  tipo: 'parear_audio',
  modo: 'audio',
  pares: [
    { palavra: 'ele', traducao: 'él', audio: 'a1' },
    { palavra: 'ela', traducao: 'ella', audio: 'a2' },
    { palavra: 'eles', traducao: 'ellos', audio: 'a3' },
    { palavra: 'isso', traducao: 'eso' },
  ],
};
const escrita: Pergunta = { tipo: 'parear_audio', modo: 'escrita', pares: [{ palavra: 'tudo bem', traducao: 'todo bien' }, { palavra: 'oi', traducao: 'hola' }] };
const multipla: Pergunta = { tipo: 'multipla_escolha', enunciado: '¿Cómo se dice «gracias»?', opcoes: ['obrigado', 'por favor', 'desculpa'], correta: 0 };
const completar: Pergunta = { tipo: 'completar', frase: 'Ela ___ no Brasil.', opcoes: ['mora', 'moro', 'moram'], correta: 0 };
const ordenar: Pergunta = { tipo: 'ordenar', palavras: ['Ele', 'é', 'professor'], traducao: 'Él es profesor.' };
const ditado: Pergunta = { tipo: 'ouvir_escrever', audio: 'a/frase.mp3', texto: 'Você é médico?' };

// Gerador fixo para os testes de embaralhamento serem repetíveis.
function sorteioFixo(semente: number) {
  let s = semente;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test('a versão do aluno não leva o gabarito', () => {
  for (const p of [parear, multipla, completar, ordenar, ditado]) {
    const json = JSON.stringify(paraAluno(p, sorteioFixo(7)));
    assert.equal(json.includes('correta'), false, p.tipo);
    assert.equal(json.includes('pares'), false, p.tipo);
  }
  assert.equal(JSON.stringify(paraAluno(ditado)).includes('Você'), false);
  // Com a gravação, a palavra em português (a resposta do par) não vai para o navegador.
  const json = JSON.stringify(paraAluno(parear, sorteioFixo(7)));
  for (const palavra of ['"ele"', '"ela"', '"eles"']) assert.equal(json.includes(palavra), false, palavra);
});

test('a versão do aluno mantém todas as opções e os áudios', () => {
  const p = paraAluno(parear, sorteioFixo(3));
  assert.equal(p.tipo, 'parear_audio');
  if (p.tipo !== 'parear_audio') return;
  assert.deepEqual([...p.cartoes].sort((a, b) => a.indice - b.indice), [
    { indice: 0, audio: 'a1' }, { indice: 1, audio: 'a2' }, { indice: 2, audio: 'a3' }, { indice: 3, fala: 'isso' },
  ]);
  assert.deepEqual([...p.traducoes].sort(), ['ella', 'ellos', 'eso', 'él'].sort());
  const e = paraAluno(escrita, sorteioFixo(3));
  assert.deepEqual(e.tipo === 'parear_audio' && [...e.cartoes].sort((a, b) => a.indice - b.indice), [{ indice: 0, palavra: 'tudo bem' }, { indice: 1, palavra: 'oi' }]);
  const m = paraAluno(multipla, sorteioFixo(3));
  assert.equal(m.tipo === 'multipla_escolha' && [...m.opcoes].sort().join(), ['desculpa', 'obrigado', 'por favor'].join());
});

test('ordenar nunca é entregue já na ordem certa', () => {
  for (let semente = 0; semente < 200; semente += 1) {
    const p = paraAluno(ordenar, sorteioFixo(semente));
    assert.equal(p.tipo === 'ordenar' && p.palavras.join(' ') !== 'Ele é professor', true, `semente ${semente}`);
    assert.equal(p.tipo === 'ordenar' && [...p.palavras].sort().join(), ['Ele', 'professor', 'é'].sort().join());
  }
});

test('parear: cada tentativa é conferida; a pergunta é certa com todos os pares e nenhum erro', () => {
  assert.deepEqual(conferirPar(parear, 1, 'ella'), { certo: true, palavra: 'ela' });
  assert.deepEqual(conferirPar(parear, 1, 'él'), { certo: false });
  assert.deepEqual(conferirPar(parear, 9, 'ella'), { certo: false });
  assert.deepEqual(conferirPar(parear, '1', 'ella'), { certo: false });
  assert.deepEqual(conferirPar(multipla, 0, 'obrigado'), { certo: false });

  const certo = [{ i: 0, t: 'él' }, { i: 1, t: 'ella' }, { i: 2, t: 'ellos' }, { i: 3, t: 'eso' }];
  assert.equal(corrigir(parear, certo).correta, true);
  assert.equal(corrigir(parear, [...certo].reverse()).correta, true);
  // Um erro no meio do caminho, mesmo terminando tudo certo: a pergunta conta como errada.
  assert.equal(corrigir(parear, [{ i: 0, t: 'ella' }, ...certo]).correta, false);
  assert.equal(corrigir(parear, certo.slice(0, 3)).correta, false);
  assert.equal(corrigir(parear, [certo[0], certo[0], certo[0], certo[0]]).correta, false);
});

test('múltipla escolha e completar corrigem pelo texto escolhido', () => {
  assert.equal(corrigir(multipla, 'obrigado').correta, true);
  assert.equal(corrigir(multipla, 'por favor').correta, false);
  assert.equal(corrigir(multipla, 0).correta, false);
  assert.equal(corrigir(completar, 'mora').correta, true);
  assert.equal(corrigir(completar, 'moro').correta, false);
});

test('ordenar exige a ordem exata', () => {
  assert.equal(corrigir(ordenar, ['Ele', 'é', 'professor']).correta, true);
  assert.equal(corrigir(ordenar, ['é', 'Ele', 'professor']).correta, false);
  assert.equal(corrigir(ordenar, ['Ele', 'é']).correta, false);
});

test('ditado ignora maiúsculas e pontuação; acento errado conta, com aviso', () => {
  assert.deepEqual(corrigir(ditado, 'Você é médico?'), { correta: true });
  assert.deepEqual(corrigir(ditado, '  voce   e medico '), { correta: true, aviso: 'acento' });
  assert.deepEqual(corrigir(ditado, 'você é médico'), { correta: true });
  assert.deepEqual(corrigir(ditado, 'Você é médica?'), { correta: false });
  assert.deepEqual(corrigir(ditado, ''), { correta: false });
});

test('resposta em formato inesperado é errada e não derruba a correção', () => {
  for (const p of [parear, multipla, completar, ordenar, ditado]) {
    for (const ruim of [undefined, null, 42, {}, [], [null], [{ audio: 1 }], 'x'.repeat(10000)]) {
      assert.equal(corrigir(p, ruim).correta, false, `${p.tipo} com ${JSON.stringify(ruim)?.slice(0, 20)}`);
    }
  }
});

test('nota do quiz: percentual e aprovação com 70%', () => {
  const perguntas = [multipla, completar, ordenar, ditado];
  const tudo = corrigirQuiz(perguntas, ['obrigado', 'mora', ['Ele', 'é', 'professor'], 'voce e medico']);
  assert.deepEqual([tudo.acertos, tudo.total, tudo.percentual, tudo.aprovado], [4, 4, 100, true]);
  assert.equal(tudo.correcoes[3]?.aviso, 'acento');
  const tres = corrigirQuiz(perguntas, ['obrigado', 'mora', ['Ele', 'é', 'professor'], 'errado']);
  assert.deepEqual([tres.acertos, tres.percentual, tres.aprovado], [3, 75, true]);
  const dois = corrigirQuiz(perguntas, ['obrigado', 'mora']);
  assert.deepEqual([dois.acertos, dois.percentual, dois.aprovado], [2, 50, false]);
  assert.deepEqual(corrigirQuiz([], []).aprovado, false);
  assert.equal(corrigirQuiz(perguntas, ['obrigado', 'mora', ['Ele', 'é', 'professor'], 'errado'], 80).aprovado, false);
});

test('validação da administração aponta o que falta', () => {
  for (const p of [parear, multipla, completar, ordenar, ditado]) assert.deepEqual(validarPergunta(p), [], p.tipo);
  assert.deepEqual(validarPergunta(escrita), []);
  assert.equal(validarPergunta({ tipo: 'parear_audio', modo: 'audio', pares: [{ palavra: 'ele', traducao: 'él' }] }).length, 1);
  assert.equal(validarPergunta({ tipo: 'parear_audio', modo: 'audio', pares: [{ palavra: 'ele', traducao: 'él' }, { palavra: 'Ele', traducao: 'Él' }] }).length, 2);
  assert.equal(validarPergunta({ tipo: 'parear_audio', modo: 'audio', pares: [{ palavra: '', traducao: 'él' }, { palavra: 'ela', traducao: ' ' }] }).length, 1);
  assert.equal(validarPergunta({ tipo: 'multipla_escolha', enunciado: '', opcoes: ['a'], correta: 3 }).length, 3);
  assert.equal(validarPergunta({ tipo: 'multipla_escolha', enunciado: 'x', opcoes: ['a', 'a '], correta: 0 }).length, 1);
  assert.equal(validarPergunta({ tipo: 'completar', frase: 'Sem lacuna.', opcoes: ['a', 'b'], correta: 0 }).length, 1);
  assert.equal(validarPergunta({ tipo: 'ordenar', palavras: ['Oi'], traducao: '' }).length, 2);
  assert.equal(validarPergunta({ tipo: 'ouvir_escrever', audio: '', texto: '?!' }).length, 2);
});
