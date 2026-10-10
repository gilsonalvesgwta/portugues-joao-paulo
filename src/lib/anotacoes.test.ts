import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  blocoVazio, CAMPOS_DA_LISTA, contarBlocos, lerAnotacoes, LIMITES, nomeDoTipo, novoId, numerosDasSecoes, paragrafos, paraPrevia, TIPOS,
  trechos, validarAnotacoes,
} from './anotacoes.ts';

const completo = [
  { id: 'capa000001', tipo: 'capa', titulo: '  El verbo   ser ', resumo: 'Cómo decir quién eres.\r\n\r\n\r\n\r\nY de dónde.' },
  { id: 'secao00001', tipo: 'secao', titulo: 'En la práctica' },
  { id: 'pares00001', tipo: 'pares', itens: [{ pt: 'Ele é professor.', es: 'Él es profesor.' }, { pt: '', es: '' }] },
  { id: 'nota000001', tipo: 'nota', texto: 'En portugués **no** se dice "yo soy" así.' },
  { id: 'vocab00001', tipo: 'vocabulario', itens: [{ pt: 'cidade', es: 'ciudad' }] },
  { id: 'termo00001', tipo: 'termos', itens: [{ termo: 'ser', explicacao: 'Identidad y origen.' }] },
  { id: 'certo00001', tipo: 'certo_errado', itens: [{ errado: 'Eu sou em casa', certo: 'Eu estou em casa', nota: '' }] },
  { id: 'texto00001', tipo: 'texto', texto: 'Primeiro parágrafo.\n\nSegundo.' },
  { id: 'tabel00001', tipo: 'tabela', colunas: ['Pessoa', 'Ser'], linhas: [['eu', 'sou'], ['', ''], ['você', 'é', 'sobra']] },
];

test('anotações completas passam, com textos arrumados e linhas vazias descartadas', () => {
  const r = validarAnotacoes(completo);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.blocos.length, 9);
  assert.deepEqual(r.blocos[0], { id: 'capa000001', tipo: 'capa', titulo: 'El verbo ser', resumo: 'Cómo decir quién eres.\n\nY de dónde.' });
  assert.deepEqual(r.blocos[2], { id: 'pares00001', tipo: 'pares', itens: [{ pt: 'Ele é professor.', es: 'Él es profesor.' }] });
  assert.deepEqual(r.blocos[8], { id: 'tabel00001', tipo: 'tabela', colunas: ['Pessoa', 'Ser'], linhas: [['eu', 'sou'], ['você', 'é']] });
});

test('o que foi conferido passa de novo sem mudar nada', () => {
  const primeira = validarAnotacoes(completo);
  assert.equal(primeira.ok, true);
  if (!primeira.ok) return;
  assert.deepEqual(validarAnotacoes(primeira.blocos), primeira);
  assert.deepEqual(lerAnotacoes(primeira.blocos), primeira.blocos);
});

test('lista vazia é válida: aula sem anotações', () => {
  assert.deepEqual(validarAnotacoes([]), { ok: true, blocos: [] });
});

test('campo obrigatório vazio aponta o bloco pelo id', () => {
  const r = validarAnotacoes([
    { id: 'secao00001', tipo: 'secao', titulo: '   ' },
    { id: 'pares00001', tipo: 'pares', itens: [{ pt: 'Só português', es: '' }] },
    { id: 'vocab00001', tipo: 'vocabulario', itens: [] },
    { id: 'texto00001', tipo: 'texto', texto: '\n \n' },
    { id: 'tabel00001', tipo: 'tabela', colunas: ['A', ''], linhas: [['x', 'y']] },
    { id: 'tabel00002', tipo: 'tabela', colunas: ['A'], linhas: [['x']] },
    { id: 'certo00001', tipo: 'certo_errado', itens: [{ errado: 'x', certo: 'y' }] },
  ]);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(r.erros, {
    secao00001: 'Preencha: título da seção.',
    pares00001: 'Preencha: tradução em espanhol.',
    vocab00001: 'Preencha pelo menos uma linha.',
    texto00001: 'Preencha: o texto.',
    tabel00001: 'Dê um título a cada coluna da tabela.',
    tabel00002: 'A tabela tem de 2 a 6 colunas.',
  });
});

test('capa só no começo, e só uma', () => {
  const fora = validarAnotacoes([{ id: 'secao00001', tipo: 'secao', titulo: 'A' }, { id: 'capa000001', tipo: 'capa', titulo: 'T', resumo: '' }]);
  assert.equal(fora.ok, false);
  if (!fora.ok) assert.match(fora.erros.capa000001 ?? '', /capa fica no começo/);

  const duas = validarAnotacoes([{ id: 'capa000001', tipo: 'capa', titulo: 'T', resumo: '' }, { id: 'capa000002', tipo: 'capa', titulo: 'U', resumo: '' }]);
  assert.equal(duas.ok, false);
  if (!duas.ok) assert.equal(duas.erros.geral, 'As anotações só podem ter uma capa.');
});

test('formato inesperado, tipo desconhecido e excesso de blocos são recusados', () => {
  for (const ruim of [null, 'texto', { tipo: 'texto' }, [null], [['x']], [{ texto: 'sem tipo' }], [{ tipo: 'script', texto: 'x' }]]) {
    const r = validarAnotacoes(ruim);
    assert.equal(r.ok, false, JSON.stringify(ruim));
    if (!r.ok) assert.ok(r.erros.geral);
  }
  const muitos = Array.from({ length: LIMITES.blocos + 1 }, () => ({ tipo: 'secao', titulo: 'A' }));
  const r = validarAnotacoes(muitos);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.erros.geral ?? '', /até 80 blocos/);
});

test('texto longo demais é recusado', () => {
  const r = validarAnotacoes([
    { id: 'texto00001', tipo: 'texto', texto: 'a'.repeat(LIMITES.texto + 1) },
    { id: 'secao00001', tipo: 'secao', titulo: 'b'.repeat(LIMITES.linha + 1) },
  ]);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.erros.texto00001 ?? '', /até 3000 letras/);
  assert.match(r.erros.secao00001 ?? '', /até 300 letras/);
});

test('campos a mais são jogados fora, e HTML fica como texto comum', () => {
  const r = validarAnotacoes([{ id: 'texto00001', tipo: 'texto', texto: '<script>alert(1)</script>', html: '<b>x</b>', onclick: 'x' }]);
  assert.deepEqual(r, { ok: true, blocos: [{ id: 'texto00001', tipo: 'texto', texto: '<script>alert(1)</script>' }] });
});

test('id ausente, malformado ou repetido ganha um novo, sem repetir', () => {
  const r = validarAnotacoes([
    { tipo: 'secao', titulo: 'A' },
    { id: '<img>', tipo: 'secao', titulo: 'B' },
    { id: 'repetido01', tipo: 'secao', titulo: 'C' },
    { id: 'repetido01', tipo: 'secao', titulo: 'D' },
  ]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const ids = r.blocos.map((bloco) => bloco.id);
  assert.equal(new Set(ids).size, 4);
  assert.ok(ids.every((id) => /^[a-z0-9]{6,16}$/.test(id)));
  assert.equal(ids[2], 'repetido01');
});

test('lerAnotacoes devolve lista vazia para o que não passa na conferência', () => {
  assert.deepEqual(lerAnotacoes(null), []);
  assert.deepEqual(lerAnotacoes([{ tipo: 'secao', titulo: '' }]), []);
  assert.equal(contarBlocos([1, 2, 3]), 3);
  assert.equal(contarBlocos('x'), 0);
});

test('todo tipo tem nome, e o bloco vazio de cada tipo tem o formato certo', () => {
  assert.equal(TIPOS.length, 9);
  for (const { tipo } of TIPOS) {
    assert.notEqual(nomeDoTipo(tipo), tipo);
    const bloco = blocoVazio(tipo);
    assert.equal(bloco.tipo, tipo);
    assert.match(bloco.id, /^[a-z0-9]{10}$/);
  }
  const pares = blocoVazio('pares');
  assert.deepEqual('itens' in pares ? pares.itens : null, [{ pt: '', es: '' }, { pt: '', es: '' }]);
  assert.equal(CAMPOS_DA_LISTA.certo_errado.length, 3);
  assert.notEqual(novoId(), novoId());
});

test('a prévia esconde blocos ainda vazios e linhas em branco, sem mexer no que já foi escrito', () => {
  const previa = paraPrevia([
    blocoVazio('capa'),
    blocoVazio('secao'),
    blocoVazio('pares'),
    blocoVazio('tabela'),
    { id: 'pares00001', tipo: 'pares', itens: [{ pt: 'Oi', es: '' }, { pt: '', es: '' }] },
    { id: 'tabel00001', tipo: 'tabela', colunas: ['A', 'B'], linhas: [['', ''], ['x', '']] },
    { id: 'nota000001', tipo: 'nota', texto: ' escrevendo... ' },
  ]);
  assert.deepEqual(previa, [
    { id: 'pares00001', tipo: 'pares', itens: [{ pt: 'Oi', es: '' }] },
    { id: 'tabel00001', tipo: 'tabela', colunas: ['A', 'B'], linhas: [['x', '']] },
    { id: 'nota000001', tipo: 'nota', texto: ' escrevendo... ' },
  ]);
});

test('as seções são numeradas na ordem, pulando os outros blocos', () => {
  const r = validarAnotacoes(completo);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const extra = [...r.blocos, { id: 'secao00002', tipo: 'secao' as const, titulo: 'Vocabulario' }];
  assert.deepEqual([...numerosDasSecoes(extra)], [['secao00001', '01'], ['secao00002', '02']]);
});

test('trechos: só **assim** vira destaque', () => {
  assert.deepEqual(trechos('Diga **sou**, não **estou**.'), [
    { texto: 'Diga ', forte: false }, { texto: 'sou', forte: true }, { texto: ', não ', forte: false },
    { texto: 'estou', forte: true }, { texto: '.', forte: false },
  ]);
  assert.deepEqual(trechos('2 * 3 ** 4'), [{ texto: '2 * 3 ** 4', forte: false }]);
  assert.deepEqual(trechos('<b>x</b>'), [{ texto: '<b>x</b>', forte: false }]);
  assert.deepEqual(trechos(''), []);
});

test('paragrafos separa por linha em branco e mantém as quebras simples', () => {
  assert.deepEqual(paragrafos('Um.\nDois.\n\nTrês.'), [['Um.', 'Dois.'], ['Três.']]);
  assert.deepEqual(paragrafos(''), []);
});
