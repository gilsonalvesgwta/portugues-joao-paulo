import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tipoDoAudio } from './audios.ts';
import { ajustarVolume, escreverWav, gravacaoParaWav, reduzirTaxa, semSilencio } from './wav.ts';

const TAXA = 48_000;

// Silêncio, meio segundo de um tom de 440 Hz, silêncio.
function gravacao(): Float32Array {
  const amostras = new Float32Array(TAXA * 2);
  for (let i = TAXA / 2; i < TAXA; i += 1) amostras[i] = 0.3 * Math.sin((2 * Math.PI * 440 * i) / TAXA);
  return amostras;
}

test('o silêncio das pontas sai, com uma folga pequena', () => {
  const cortada = semSilencio(gravacao(), TAXA);
  const folga = Math.round(0.12 * TAXA);
  assert.ok(cortada.length > TAXA / 2 && cortada.length <= TAXA / 2 + 2 * folga + 1, `${cortada.length}`);
  assert.equal(semSilencio(new Float32Array(1000), TAXA).length, 0);
});

test('taxa menor e volume ajustado', () => {
  assert.equal(reduzirTaxa(new Float32Array(48_000), 48_000, 22_050).length, 22_050);
  const baixa = ajustarVolume(new Float32Array([0.1, -0.2, 0.05]));
  assert.ok(Math.abs((baixa[1] ?? 0) + 0.9) < 1e-6);
});

test('o arquivo sai como WAV que a plataforma aceita', () => {
  const wav = escreverWav(new Float32Array([0, 0.5, -0.5, 1]), 22_050);
  assert.equal(wav.length, 44 + 8);
  assert.equal(tipoDoAudio(wav), 'audio/wav');
  const pronto = gravacaoParaWav(gravacao(), TAXA);
  assert.ok(pronto && tipoDoAudio(pronto) === 'audio/wav');
  assert.ok(pronto.length < 60_000, `meio segundo de voz fica pequeno: ${pronto.length} bytes`);
  assert.equal(gravacaoParaWav(new Float32Array(TAXA), TAXA), null, 'sem som, sem arquivo');
});
