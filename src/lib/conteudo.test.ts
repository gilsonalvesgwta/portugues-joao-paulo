import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ehUuid, formatarDuracao, incorporarYoutube, lerDuracao, lerLink, lerVideoDoYoutube, limpar, limparTexto, linkDoYoutube, mover, proximoNumero, validarAula, validarCurso, validarMaterial, validarModulo, validarTarefa,
} from './conteudo.ts';

const MODULO = '3f2b8a1c-0d4e-4f6a-9b7c-1a2b3c4d5e6f';
const aulaBoa = {
  modulo_id: MODULO, numero: '18', titulo_pt: 'Verbo ser', titulo_es: 'El verbo ser',
  video_id: 'https://www.youtube.com/watch?v=aB3dE6gH9jK', duracao: '12:30', situacao: 'publicado',
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

test('lerVideoDoYoutube tira o código de qualquer formato de link', () => {
  const codigo = 'aB3dE6gH9jK';
  for (const link of [
    codigo,
    `https://www.youtube.com/watch?v=${codigo}`,
    `https://www.youtube.com/watch?v=${codigo}&t=42s&list=PL123`,
    `https://youtu.be/${codigo}?si=AbCdEf`,
    `youtu.be/${codigo}`,
    `www.youtube.com/watch?v=${codigo}`,
    `https://m.youtube.com/watch?v=${codigo}`,
    `https://www.youtube.com/embed/${codigo}`,
    `https://www.youtube-nocookie.com/embed/${codigo}?rel=0`,
    `https://www.youtube.com/shorts/${codigo}`,
    `https://www.youtube.com/live/${codigo}`,
    `  https://youtu.be/${codigo}  `,
  ]) {
    assert.equal(lerVideoDoYoutube(link), codigo, link);
  }
  assert.equal(lerVideoDoYoutube(''), null);
  assert.equal(lerVideoDoYoutube(undefined), null);
});

test('lerVideoDoYoutube recusa o que não é vídeo do YouTube', () => {
  for (const link of [
    'https://vimeo.com/123456789',
    'https://www.youtube.com/playlist?list=PL123',
    'https://www.youtube.com/@canal',
    'https://www.youtube.com/watch?v=curto',
    'https://youtube.com.exemplo.com/watch?v=aB3dE6gH9jK',
    'https://exemplo.com/?u=https://youtu.be/aB3dE6gH9jK',
    'tem espaço',
    'javascript:alert(1)',
  ]) {
    assert.equal(lerVideoDoYoutube(link), 'invalido', link);
  }
});

test('os endereços montados a partir do código', () => {
  assert.equal(linkDoYoutube('aB3dE6gH9jK'), 'https://youtu.be/aB3dE6gH9jK');
  assert.equal(incorporarYoutube('aB3dE6gH9jK'), 'https://www.youtube-nocookie.com/embed/aB3dE6gH9jK');
});

test('aula válida passa com número e duração convertidos', () => {
  assert.deepEqual(validarAula(aulaBoa, [1, 2, 17]), {
    ok: true,
    valor: { modulo_id: MODULO, numero: 18, titulo_pt: 'Verbo ser', titulo_es: 'El verbo ser', video_id: 'aB3dE6gH9jK', duracao_seg: 750, situacao: 'publicado' },
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
  const r = validarAula({ modulo_id: 'x', numero: '0', titulo_pt: '', titulo_es: '', video_id: 'https://vimeo.com/1', duracao: '99', situacao: 'apagada' });
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

test('lerLink aceita https e completa o que veio sem o começo', () => {
  assert.equal(lerLink('https://drive.google.com/file/d/abc123/view?usp=sharing'), 'https://drive.google.com/file/d/abc123/view?usp=sharing');
  assert.equal(lerLink('  drive.google.com/file/d/abc123/view  '), 'https://drive.google.com/file/d/abc123/view');
  assert.equal(lerLink('https://www.dropbox.com/s/x/Lição%201.pdf'), 'https://www.dropbox.com/s/x/Li%C3%A7%C3%A3o%201.pdf');
  assert.equal(lerLink(''), null);
  assert.equal(lerLink(undefined), null);
});

test('lerLink recusa o que não é um endereço https de verdade', () => {
  for (const ruim of [
    'http://exemplo.com/a.pdf',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://exemplo.com/a.pdf',
    'https://usuario:senha@exemplo.com/a.pdf',
    'https://semponto/a.pdf',
    'tem espaço.com/a.pdf',
    'https://exemplo.com/' + 'a'.repeat(500),
    'file:///etc/passwd',
  ]) {
    assert.equal(lerLink(ruim), 'invalido', ruim);
  }
});

test('material válido passa; sem link ou com link ruim é recusado', () => {
  assert.deepEqual(validarMaterial({ titulo_pt: ' Lista de verbos ', titulo_es: 'Lista de verbos', descricao_es: '', link: 'drive.google.com/x' }), {
    ok: true,
    valor: { titulo_pt: 'Lista de verbos', titulo_es: 'Lista de verbos', descricao_es: null, link: 'https://drive.google.com/x' },
  });
  const semLink = validarMaterial({ titulo_pt: 'A', titulo_es: 'A', link: '' });
  assert.equal(semLink.ok, false);
  if (!semLink.ok) assert.equal(semLink.erros.link, 'Cole o link do material.');
  const ruim = validarMaterial({ titulo_pt: '', titulo_es: 'A', descricao_es: 'x'.repeat(301), link: 'http://x.com' });
  assert.equal(ruim.ok, false);
  if (!ruim.ok) assert.deepEqual(Object.keys(ruim.erros).sort(), ['descricao_es', 'link', 'titulo_pt']);
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

test('limparTexto mantém as quebras de linha e tira o que sobra', () => {
  assert.equal(limparTexto('  Uma linha.  \r\n\r\n\r\n\r\n  Outra   linha. \n'), 'Uma linha.\n\nOutra linha.');
  assert.equal(limparTexto(undefined), '');
});

test('tarefa válida passa, com aula e link opcionais', () => {
  const aula = '3f2b8a1c-0d4e-4f6a-9b7c-1a2b3c4d5e6f';
  assert.deepEqual(validarTarefa({ aula_id: aula, titulo_es: ' Escribe  5 frases ', instrucao_es: 'Usa el verbo ser.\n\n\n\nEnvíalas.', link: 'docs.google.com/document/d/abc' }), {
    ok: true,
    valor: { aula_id: aula, titulo_es: 'Escribe 5 frases', instrucao_es: 'Usa el verbo ser.\n\nEnvíalas.', link: 'https://docs.google.com/document/d/abc' },
  });
  assert.deepEqual(validarTarefa({ aula_id: '', titulo_es: 'Repasa', instrucao_es: 'Lee tus apuntes.', link: '' }), {
    ok: true,
    valor: { aula_id: null, titulo_es: 'Repasa', instrucao_es: 'Lee tus apuntes.', link: null },
  });
});

test('tarefa com campos errados aponta cada um', () => {
  const r = validarTarefa({ aula_id: 'x', titulo_es: '', instrucao_es: '  \n ', link: 'http://exemplo.com' });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(Object.keys(r.erros).sort(), ['aula_id', 'instrucao_es', 'link', 'titulo_es']);
  const longa = validarTarefa({ titulo_es: 'T', instrucao_es: 'a'.repeat(2001), link: '' });
  assert.equal(longa.ok, false);
  if (!longa.ok) assert.equal(longa.erros.instrucao_es, 'A instrução pode ter até 2000 letras.');
});
