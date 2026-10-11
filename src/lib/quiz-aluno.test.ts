import { test } from 'node:test';
import assert from 'node:assert/strict';
import { corrigirEntrega, entregar, lerRespostas, perguntaDoBanco, respostaParaGuardar, type LinhaDePergunta } from './quiz-aluno.ts';

const linhas: LinhaDePergunta[] = [
  { id: 'p1', tipo: 'multipla_escolha', conteudo: { enunciado: '¿Cómo se dice "gracias"?', opcoes: ['por favor', 'obrigado', 'desculpa'], correta: 1 } },
  { id: 'p2', tipo: 'completar', conteudo: { frase: 'Eu ___ brasileiro.', opcoes: ['sou', 'estou'], correta: 0 } },
  { id: 'p3', tipo: 'ordenar', conteudo: { palavras: ['Ela', 'mora', 'no', 'Brasil.'], traducao: 'Ella vive en Brasil.' } },
];

// Sorteio fixo, para o teste dar sempre o mesmo resultado.
function sorteioFixo(): () => number {
  let n = 0;
  return () => {
    n = (n * 9301 + 49297) % 233280;
    return n / 233280;
  };
}

test('o que vai para o navegador não leva a resposta: nem a opção certa, nem a frase em ordem', () => {
  const entregues = entregar(linhas, sorteioFixo());
  assert.deepEqual(entregues.map((p) => [p.id, p.tipo]), [['p1', 'multipla_escolha'], ['p2', 'completar'], ['p3', 'ordenar']]);
  const texto = JSON.stringify(entregues);
  assert.equal(texto.includes('correta'), false);
  assert.equal(texto.includes('"Ela","mora","no","Brasil."'), false, 'a frase não vai na ordem certa');
  const [p1, , p3] = entregues;
  assert.deepEqual(p1 && p1.tipo === 'multipla_escolha' && [...p1.opcoes].sort(), ['desculpa', 'obrigado', 'por favor']);
  assert.deepEqual(p3 && p3.tipo === 'ordenar' && [...p3.palavras].sort(), ['Brasil.', 'Ela', 'mora', 'no']);
});

test('pergunta com áudio ou com conteúdo quebrado é pulada, sem derrubar o quiz', () => {
  const ruins: LinhaDePergunta[] = [
    { id: 'x1', tipo: 'ouvir_escrever', conteudo: { audio: 'a.mp3', texto: 'Bom dia' } },
    { id: 'x2', tipo: 'multipla_escolha', conteudo: { enunciado: 'Sem opções', opcoes: [], correta: 0 } },
    { id: 'x3', tipo: 'multipla_escolha', conteudo: { enunciado: 'Correta fora da lista', opcoes: ['a', 'b'], correta: 5 } },
    { id: 'x4', tipo: 'completar', conteudo: { frase: '', opcoes: ['a', 'b'], correta: 0 } },
    { id: 'x5', tipo: 'ordenar', conteudo: { palavras: ['Só'], traducao: 'Solo' } },
    { id: 'x6', tipo: 'ordenar', conteudo: null },
    { id: 'x7', tipo: 'multipla_escolha', conteudo: { enunciado: 'Opção vazia', opcoes: ['a', ' '], correta: 0 } },
  ];
  for (const linha of ruins) assert.equal(perguntaDoBanco(linha), null, linha.id);
  assert.deepEqual(entregar([...ruins, ...linhas], sorteioFixo()).map((p) => p.id), ['p1', 'p2', 'p3']);
  const correcao = corrigirEntrega([...ruins, ...linhas], new Map(), 70);
  assert.equal(correcao.total, 3, 'as puladas não entram na conta');
});

test('respostas do navegador: lista de id e resposta; o resto é ignorado', () => {
  const lidas = lerRespostas([{ id: 'p1', resposta: 'obrigado' }, { id: 5, resposta: 'x' }, 'solto', null, { id: 'p3', resposta: ['Ela'] }]);
  assert.deepEqual([...lidas.keys()], ['p1', 'p3']);
  assert.equal(lerRespostas('nada').size, 0);
  assert.equal(lerRespostas(Array.from({ length: 500 }, (_, i) => ({ id: `p${i}`, resposta: '' }))).size, 200);
});

test('correção: acertos, percentual, aprovação e a resposta certa de cada pergunta', () => {
  const tudoCerto = lerRespostas([
    { id: 'p3', resposta: ['Ela', 'mora', 'no', 'Brasil.'] },
    { id: 'p1', resposta: 'obrigado' },
    { id: 'p2', resposta: 'sou' },
  ]);
  assert.deepEqual(corrigirEntrega(linhas, tudoCerto, 70), {
    acertos: 3, total: 3, percentual: 100, aprovado: true,
    conferencia: [
      { id: 'p1', correta: true, certa: 'obrigado' },
      { id: 'p2', correta: true, certa: 'sou' },
      { id: 'p3', correta: true, certa: 'Ela mora no Brasil.' },
    ],
  });

  const umCerto = lerRespostas([{ id: 'p1', resposta: 'obrigado' }, { id: 'p2', resposta: 'estou' }, { id: 'p3', resposta: ['mora', 'Ela', 'no', 'Brasil.'] }]);
  const parcial = corrigirEntrega(linhas, umCerto, 70);
  assert.deepEqual([parcial.acertos, parcial.percentual, parcial.aprovado], [1, 33, false]);
  assert.deepEqual(parcial.conferencia.map((c) => c.correta), [true, false, false]);
  assert.equal(corrigirEntrega(linhas, umCerto, 30).aprovado, true, 'a nota mínima é a do quiz');

  // Sem resposta, com a posição em vez do texto ou com formato estranho: errada, sem erro.
  const estranhas = lerRespostas([{ id: 'p1', resposta: 1 }, { id: 'p2' }, { id: 'p3', resposta: 'Ela mora no Brasil.' }]);
  assert.equal(corrigirEntrega(linhas, estranhas, 70).acertos, 0);
  assert.deepEqual(corrigirEntrega([], new Map(), 70), { acertos: 0, total: 0, percentual: 0, aprovado: false, conferencia: [] });
});

test('o que fica gravado da resposta: texto ou lista de palavras, dentro do limite', () => {
  assert.equal(respostaParaGuardar('obrigado'), 'obrigado');
  assert.deepEqual(respostaParaGuardar(['Ela', 'mora']), ['Ela', 'mora']);
  assert.equal(respostaParaGuardar('x'.repeat(501)), null);
  assert.equal(respostaParaGuardar(Array.from({ length: 61 }, () => 'a')), null);
  assert.equal(respostaParaGuardar(['a', 5]), null);
  assert.equal(respostaParaGuardar({ texto: 'a' }), null);
  assert.equal(respostaParaGuardar(undefined), null);
});
