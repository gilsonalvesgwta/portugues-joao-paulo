import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conferirTentativa, corrigirEntrega, entregar, lerRespostas, perguntaDoBanco, respostaParaGuardar, type LinhaDePergunta } from './quiz-aluno.ts';

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

const AUDIO = '0b9c2f0e-1d2a-4c5b-8e6f-7a8b9c0d1e2f';
const pares: LinhaDePergunta = {
  id: 'p4',
  tipo: 'parear_audio',
  conteudo: { modo: 'audio', pares: [{ palavra: 'tudo bem', traducao: 'todo bien', audio: AUDIO }, { palavra: 'obrigado', traducao: 'gracias', audio: null }] },
};

test('jogo de pares: vai para o navegador sem a palavra gravada, e cada tentativa é conferida no servidor', () => {
  const [entregue] = entregar([pares], sorteioFixo());
  assert.ok(entregue && entregue.tipo === 'parear_audio');
  const texto = JSON.stringify(entregue);
  assert.equal(texto.includes('tudo bem'), false, 'a palavra com gravação não vai escrita');
  assert.equal(texto.includes(AUDIO), true);
  // Sem gravação, o navegador precisa do texto para ler em voz alta.
  assert.equal(texto.includes('"fala":"obrigado"'), true);
  assert.deepEqual([...entregue.traducoes].sort(), ['gracias', 'todo bien']);

  assert.deepEqual(conferirTentativa(pares, 0, 'todo bien'), { certo: true, palavra: 'tudo bem' });
  assert.deepEqual(conferirTentativa(pares, 0, 'gracias'), { certo: false });
  assert.deepEqual(conferirTentativa(linhas[0] as LinhaDePergunta, 0, 'obrigado'), { certo: false });

  const semErro = lerRespostas([{ id: 'p4', resposta: [{ i: 1, t: 'gracias' }, { i: 0, t: 'todo bien' }] }]);
  assert.deepEqual(corrigirEntrega([pares], semErro, 70).conferencia, [{ id: 'p4', correta: true, certa: 'tudo bem = todo bien, obrigado = gracias' }]);
  const comErro = lerRespostas([{ id: 'p4', resposta: [{ i: 1, t: 'todo bien' }, { i: 1, t: 'gracias' }, { i: 0, t: 'todo bien' }] }]);
  assert.equal(corrigirEntrega([pares], comErro, 70).acertos, 0);
});

test('jogo de pares com conteúdo quebrado é pulado; gravação que não é identificador vira voz do navegador', () => {
  for (const conteudo of [
    { modo: 'audio', pares: [{ palavra: 'oi', traducao: 'hola' }] },
    { modo: 'cantado', pares: [{ palavra: 'oi', traducao: 'hola' }, { palavra: 'tchau', traducao: 'chao' }] },
    { modo: 'audio', pares: [{ palavra: 'oi', traducao: 'hola' }, { palavra: 'olá', traducao: 'hola' }] },
    { modo: 'audio', pares: [{ palavra: 'oi', traducao: 'hola' }, { palavra: '', traducao: 'chao' }] },
  ]) {
    assert.equal(perguntaDoBanco({ id: 'x', tipo: 'parear_audio', conteudo }), null, JSON.stringify(conteudo));
  }
  const estranha = perguntaDoBanco({ id: 'x', tipo: 'parear_audio', conteudo: { modo: 'audio', pares: [{ palavra: 'oi', traducao: 'hola', audio: '../x' }, { palavra: 'tchau', traducao: 'chao' }] } });
  assert.deepEqual(estranha && estranha.tipo === 'parear_audio' && estranha.pares[0], { palavra: 'oi', traducao: 'hola' });
});

test('o que fica gravado do jogo de pares: a lista de tentativas', () => {
  assert.deepEqual(respostaParaGuardar([{ i: 0, t: 'hola' }, { i: 1, t: 'chao' }]), [{ i: 0, t: 'hola' }, { i: 1, t: 'chao' }]);
  assert.equal(respostaParaGuardar([{ i: -1, t: 'hola' }]), null);
  assert.equal(respostaParaGuardar([{ i: 0, t: 'x'.repeat(101) }]), null);
  assert.equal(respostaParaGuardar([{ i: 0 }]), null);
});
