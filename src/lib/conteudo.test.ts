import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ehUuid, formatarDuracao, lerDuracao, limpar, mover, proximoNumero, validarAula, validarCurso, validarModulo,
} from './conteudo.ts';

const MODULO = '3f2b8a1c-0d4e-4f6a-9b7c-1a2b3c4d5e6f';
const aulaBoa = {
  modulo_id: MODULO, numero: '18', titulo_pt: 'Verbo ser', titulo_es: 'El verbo ser',
  video_id: 'a1b2c3d4-e5f6', duracao: '12:30', situacao: 'publicado',
};

test('limpar tira espaços das pontas e junta os repetidos', () => {
  assert.equal(limpar('  Verbo   ser \n'), 'Verbo ser');
  assert.equal(limpar(undefined), '');
  assert.equal(limpar(12), '');
});

test('ehUuid aceita só o formato de identificador do banco', () => {
  assert.equal(ehUuid(MODULO), true);
  assert.equal(ehUuid('1 or 1=1'), false);
  assert.equal(ehUuid(null), false);
});

test('curso válido passa com os títulos limpos', () => {
  const r = validarCurso({ titulo_pt: ' Português do zero ', titulo_es: 'Portugués desde cero', tipo: 'principal', modo: 'livre', situacao: 'rascunho' });
  assert.deepEqual(r, { ok: true, valor: { titulo_pt: 'Português do zero', titulo_es: 'Portugués desde cero', tipo: 'principal', modo: 'livre', situacao: 'rascunho' } });
});

test('curso sem título ou com opção inventada é recusado, com o erro em cada campo', () => {
  const r = validarCurso({ titulo_pt: '', titulo_es: '   ', tipo: 'outro', modo: 'livre', situacao: 'publicado' });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(Object.keys(r.erros).sort(), ['tipo', 'titulo_es', 'titulo_pt']);
});

test('título longo demais é recusado', () => {
  const r = validarModulo({ titulo_pt: 'a'.repeat(161), titulo_es: 'Módulo 1' });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.erros.titulo_pt, 'O título pode ter até 160 letras.');
});

test('módulo válido passa', () => {
  assert.deepEqual(validarModulo({ titulo_pt: 'Módulo 1', titulo_es: 'Módulo 1' }), { ok: true, valor: { titulo_pt: 'Módulo 1', titulo_es: 'Módulo 1' } });
});

test('lerDuracao entende minutos:segundos e horas:minutos:segundos', () => {
  assert.equal(lerDuracao('12:30'), 750);
  assert.equal(lerDuracao('1:02:03'), 3723);
  assert.equal(lerDuracao('90:00'), 5400);
  assert.equal(lerDuracao(''), null);
  assert.equal(lerDuracao('12'), 'invalida');
  assert.equal(lerDuracao('12:75'), 'invalida');
  assert.equal(lerDuracao('1:75:00'), 'invalida');
  assert.equal(lerDuracao('doze'), 'invalida');
  assert.equal(lerDuracao('-1:00'), 'invalida');
});

test('formatarDuracao desfaz o que lerDuracao leu', () => {
  assert.equal(formatarDuracao(750), '12:30');
  assert.equal(formatarDuracao(3723), '1:02:03');
  assert.equal(formatarDuracao(5), '0:05');
  assert.equal(formatarDuracao(null), '');
});

test('aula válida passa com número e duração convertidos', () => {
  assert.deepEqual(validarAula(aulaBoa, [1, 2, 17]), {
    ok: true,
    valor: { modulo_id: MODULO, numero: 18, titulo_pt: 'Verbo ser', titulo_es: 'El verbo ser', video_id: 'a1b2c3d4-e5f6', duracao_seg: 750, situacao: 'publicado' },
  });
});

test('aula em rascunho pode ficar sem vídeo e sem duração', () => {
  const r = validarAula({ ...aulaBoa, video_id: '', duracao: '', situacao: 'rascunho' });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.valor.video_id, null);
  assert.equal(r.valor.duracao_seg, null);
});

test('aula não é publicada sem vídeo', () => {
  const r = validarAula({ ...aulaBoa, video_id: '' });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.erros.video_id, 'Para publicar, a aula precisa de um vídeo. Sem vídeo, salve como rascunho.');
});

test('número repetido no curso é recusado', () => {
  const r = validarAula(aulaBoa, [18]);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.erros.numero, 'Já existe a aula nº 18 neste curso.');
});

test('aula com campos errados aponta cada um', () => {
  const r = validarAula({ modulo_id: 'x', numero: '0', titulo_pt: '', titulo_es: '', video_id: 'tem espaço', duracao: '99', situacao: 'apagada' });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(Object.keys(r.erros).sort(), ['duracao', 'modulo_id', 'numero', 'situacao', 'titulo_es', 'titulo_pt', 'video_id']);
});

test('número da aula não aceita letras, sinal nem vírgula', () => {
  for (const numero of ['dois', '-3', '1,5', '1e3', '12345']) {
    const r = validarAula({ ...aulaBoa, numero });
    assert.equal(r.ok, false, numero);
  }
});

test('proximoNumero é um a mais que o maior', () => {
  assert.equal(proximoNumero([]), 1);
  assert.equal(proximoNumero([1, 2, 18]), 19);
});

test('mover troca com o vizinho e não passa das pontas', () => {
  assert.deepEqual(mover(['a', 'b', 'c'], 1, 'subir'), ['b', 'a', 'c']);
  assert.deepEqual(mover(['a', 'b', 'c'], 1, 'descer'), ['a', 'c', 'b']);
  assert.deepEqual(mover(['a', 'b', 'c'], 0, 'subir'), ['a', 'b', 'c']);
  assert.deepEqual(mover(['a', 'b', 'c'], 2, 'descer'), ['a', 'b', 'c']);
  assert.deepEqual(mover(['a', 'b', 'c'], 7, 'subir'), ['a', 'b', 'c']);
});
