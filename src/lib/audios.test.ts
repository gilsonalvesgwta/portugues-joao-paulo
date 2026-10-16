import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bytesDoBanco, paraOBanco, pedacoPedido, tipoDoAudio } from './audios.ts';

const com = (inicio: number[] | string, deslocamento = 0) => {
  const bytes = new Uint8Array(64);
  const lista = typeof inicio === 'string' ? [...inicio].map((l) => l.charCodeAt(0)) : inicio;
  bytes.set(lista, deslocamento);
  return bytes;
};

test('o formato do áudio vem do conteúdo do arquivo', () => {
  const wav = com('RIFF');
  wav.set([...'WAVE'].map((l) => l.charCodeAt(0)), 8);
  assert.equal(tipoDoAudio(wav), 'audio/wav');
  assert.equal(tipoDoAudio(com('ID3')), 'audio/mpeg');
  assert.equal(tipoDoAudio(com([0xff, 0xfb])), 'audio/mpeg');
  assert.equal(tipoDoAudio(com('ftyp', 4)), 'audio/mp4');
  assert.equal(tipoDoAudio(com('OggS')), 'audio/ogg');
  assert.equal(tipoDoAudio(com([0x1a, 0x45, 0xdf, 0xa3])), 'audio/webm');
  assert.equal(tipoDoAudio(com('<html>')), null);
  assert.equal(tipoDoAudio(com('RIFF')), null, 'RIFF sem WAVE (um vídeo AVI, por exemplo) não é áudio');
  assert.equal(tipoDoAudio(new Uint8Array(10)), null);
});

test('pedaço pedido pelo navegador (Range)', () => {
  assert.equal(pedacoPedido(null, 100), null);
  assert.deepEqual(pedacoPedido('bytes=0-', 100), { inicio: 0, fim: 99 });
  assert.deepEqual(pedacoPedido('bytes=0-1', 100), { inicio: 0, fim: 1 });
  assert.deepEqual(pedacoPedido('bytes=10-500', 100), { inicio: 10, fim: 99 });
  assert.deepEqual(pedacoPedido('bytes=-20', 100), { inicio: 80, fim: 99 });
  assert.equal(pedacoPedido('bytes=100-', 100), 'fora');
  assert.equal(pedacoPedido('bytes=50-10', 100), 'fora');
  assert.equal(pedacoPedido('itens=0-1', 100), null);
  assert.equal(pedacoPedido('bytes=0-1,5-6', 100), null);
});

test('conteúdo binário de ida e volta do banco', () => {
  const bytes = new Uint8Array([0, 1, 127, 128, 255]);
  assert.equal(paraOBanco(bytes), '\\x00017f80ff');
  assert.deepEqual(bytesDoBanco(paraOBanco(bytes)), bytes);
  assert.equal(bytesDoBanco('00017f'), null);
  assert.equal(bytesDoBanco('\\x0g'), null);
  assert.equal(bytesDoBanco(null), null);
});
