import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lerConfig, lerHistorico, lerTrabalhando, nomeDaEnviada, pareceCopia, quandoEmPalavras, saudeDasCopias, servicoNoAr,
  tamanhoEmPalavras, tipoDaCopia,
} from './copias.ts';

const agora = new Date('2026-10-14T15:00:00Z'); // meio-dia em Brasília

test('nome da cópia: o tipo vem do fim do nome, e nome estranho é recusado', () => {
  assert.equal(tipoDaCopia('portuguesjp-2026-10-14-030000-automatica.sql.gz'), 'automatica');
  assert.equal(tipoDaCopia('portuguesjp-2026-10-14-101500-manual.sql.gz'), 'manual');
  assert.equal(tipoDaCopia('portuguesjp-2026-10-14-101500-antes-de-restaurar.sql.gz'), 'antes-de-restaurar');
  assert.equal(tipoDaCopia('portuguesjp-2026-10-14-101500-enviada.sql.gz'), 'enviada');
  // As do roteiro da VPS (copia-de-seguranca.sh) não têm tipo no nome.
  assert.equal(tipoDaCopia('portuguesjp-2026-10-14-101500.sql.gz'), 'outra');
  for (const ruim of ['../etc/passwd', 'portuguesjp-../../x.sql.gz', '.parcial-portuguesjp-2026.sql.gz', 'portuguesjp-a/b.sql.gz', 'outra.sql.gz', 'portuguesjp-x.sql']) {
    assert.equal(tipoDaCopia(ruim), null, ruim);
  }
});

test('cópia enviada ganha nome com a data e a hora de Brasília', () => {
  assert.equal(nomeDaEnviada(new Date('2026-10-14T02:05:09Z')), 'portuguesjp-2026-10-13-230509-enviada.sql.gz');
  assert.equal(tipoDaCopia(nomeDaEnviada(agora)), 'enviada');
});

test('tamanho em palavras', () => {
  assert.equal(tamanhoEmPalavras(800), '800 bytes');
  assert.equal(tamanhoEmPalavras(4096), '4 KB');
  assert.equal(tamanhoEmPalavras(1536), '1,5 KB');
  assert.equal(tamanhoEmPalavras(15 * 1024 * 1024), '15 MB');
  assert.equal(tamanhoEmPalavras(1.25 * 1024 * 1024 * 1024), '1,3 GB');
});

test('histórico: o mais novo primeiro; linhas estranhas ficam de fora', () => {
  const texto = [
    '1792019404\tcopiar\tok\tportuguesjp-2026-10-14-030000-automatica.sql.gz\tCópia pronta (4.0K).',
    'lixo',
    '1792019436\trestaurar\terro\tportuguesjp-x.sql.gz\tNada foi mudado.',
    '1792019437\tapagar\tok\tx\ty',
    '',
  ].join('\n');
  const lista = lerHistorico(texto);
  assert.equal(lista.length, 2);
  assert.equal(lista[0]?.acao, 'restaurar');
  assert.equal(lista[0]?.ok, false);
  assert.equal(lista[0]?.mensagem, 'Nada foi mudado.');
  assert.equal(lista[1]?.quando.getTime(), 1792019404000);
});

test('trabalho em andamento e configuração do serviço', () => {
  assert.deepEqual(lerTrabalhando('1792019436\trestaurar\tportuguesjp-x.sql.gz\n'), {
    desde: new Date(1792019436000), acao: 'restaurar', arquivo: 'portuguesjp-x.sql.gz',
  });
  assert.equal(lerTrabalhando(''), null);
  assert.equal(lerTrabalhando('x\tcopiar\t'), null);
  assert.deepEqual(lerConfig('hora=4\nmanter=30\nfuso=America/Sao_Paulo\n'), { hora: 4, manterDias: 30 });
  assert.deepEqual(lerConfig(''), { hora: 3, manterDias: 14 });
  assert.deepEqual(lerConfig('hora=99\nmanter=0'), { hora: 3, manterDias: 14 });
});

test('saúde das cópias', () => {
  const ha = (horas: number) => new Date(agora.getTime() - horas * 3_600_000);
  assert.equal(servicoNoAr(new Date(agora.getTime() - 10_000), agora), true);
  assert.equal(servicoNoAr(new Date(agora.getTime() - 300_000), agora), false);
  assert.equal(servicoNoAr(null, agora), false);
  const vivo = new Date(agora.getTime() - 5000);
  assert.equal(saudeDasCopias({ ligado: false, vivo, ultimaCopia: ha(1), agora }), 'desligado');
  assert.equal(saudeDasCopias({ ligado: true, vivo: ha(1), ultimaCopia: ha(1), agora }), 'parado');
  assert.equal(saudeDasCopias({ ligado: true, vivo, ultimaCopia: null, agora }), 'atrasada');
  assert.equal(saudeDasCopias({ ligado: true, vivo, ultimaCopia: ha(30), agora }), 'em_dia');
  assert.equal(saudeDasCopias({ ligado: true, vivo, ultimaCopia: ha(40), agora }), 'atrasada');
});

test('conferência rápida de um arquivo enviado', () => {
  const comeco = '-- Cópia de segurança\n--\n-- PostgreSQL database dump\n--\n';
  assert.equal(pareceCopia(comeco, 'x\n--\n-- PostgreSQL database dump complete\n--\n\n'), true);
  assert.equal(pareceCopia(comeco, 'COPY public.x (a) FROM stdin;\n1\n'), false);
  assert.equal(pareceCopia('<html>', '-- PostgreSQL database dump complete'), false);
});

test('quando, em palavras, no horário de Brasília', () => {
  assert.equal(quandoEmPalavras(new Date('2026-10-14T06:00:00Z'), agora), 'hoje, 03:00');
  assert.equal(quandoEmPalavras(new Date('2026-10-14T02:30:00Z'), agora), 'ontem, 23:30');
  assert.equal(quandoEmPalavras(new Date('2026-10-01T06:00:00Z'), agora), '1 de outubro, 03:00');
  assert.equal(quandoEmPalavras(new Date('2025-12-31T12:00:00Z'), agora), '31 de dezembro de 2025, 09:00');
});
