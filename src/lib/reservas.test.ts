import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  codigoDoErro, fechaLarga, lerNota, partesDeLaFecha, podeCancelar, reservasNaSemana, reservasNaSemanaDoDia, rotuloDoFuso, segundaDaSemana, separarReservas, zonaValida, ZONAS_COMUNES,
} from './reservas.ts';

// Quinta-feira, 8 de outubro de 2026, 12:00 em Madri.
const agora = new Date('2026-10-08T10:00:00Z');

test('a semana vai de segunda a domingo, no fuso do aluno', () => {
  assert.equal(segundaDaSemana(agora, 'Europe/Madrid'), '2026-10-05');
  assert.equal(segundaDaSemana(new Date('2026-10-05T00:30:00+02:00'), 'Europe/Madrid'), '2026-10-05', 'segunda de madrugada já é a semana nova');
  assert.equal(segundaDaSemana(new Date('2026-10-11T23:30:00+02:00'), 'Europe/Madrid'), '2026-10-05', 'domingo à noite ainda é a mesma semana');
  // O mesmo instante cai em semanas diferentes conforme o fuso: domingo 23:30 em Bogotá já é segunda em Madri.
  const virada = new Date('2026-10-12T04:30:00Z');
  assert.equal(segundaDaSemana(virada, 'America/Bogota'), '2026-10-05');
  assert.equal(segundaDaSemana(virada, 'Europe/Madrid'), '2026-10-12');
});

test('reservas da semana: só contam as da mesma semana da aula', () => {
  const reservas = [{ inicio: '2026-10-06T18:00:00Z' }, { inicio: '2026-10-11T18:00:00Z' }, { inicio: '2026-10-12T18:00:00Z' }];
  assert.equal(reservasNaSemana(reservas, 'Europe/Madrid', agora), 2);
  assert.equal(reservasNaSemana(reservas, 'Europe/Madrid', new Date('2026-10-13T10:00:00Z')), 1);
  assert.equal(reservasNaSemana([], 'Europe/Madrid', agora), 0);
  assert.equal(reservasNaSemanaDoDia(reservas, 'Europe/Madrid', '2026-10-08'), 2);
  assert.equal(reservasNaSemanaDoDia(reservas, 'Europe/Madrid', '2026-10-11'), 2, 'domingo fecha a semana');
  assert.equal(reservasNaSemanaDoDia(reservas, 'Europe/Madrid', '2026-10-12'), 1, 'segunda abre a seguinte');
});

test('reservas separadas: as que vêm (inclusive a que está acontecendo) e as que já terminaram', () => {
  const reservas = [
    { id: 'depois', inicio: '2026-10-09T18:00:00Z', duracao_min: 60 },
    { id: 'ontem', inicio: '2026-10-07T18:00:00Z', duracao_min: 60 },
    { id: 'agora', inicio: '2026-10-08T09:30:00Z', duracao_min: 60 },
    { id: 'semana-passada', inicio: '2026-10-01T18:00:00Z', duracao_min: 60 },
    { id: 'acabou-agora', inicio: '2026-10-08T09:00:00Z', duracao_min: 60 },
  ];
  const { proximas, passadas } = separarReservas(reservas, agora);
  assert.deepEqual(proximas.map((r) => r.id), ['agora', 'depois']);
  assert.deepEqual(passadas.map((r) => r.id), ['acabou-agora', 'ontem', 'semana-passada']);
});

test('cancelar: até o prazo, contado em minutos antes do início', () => {
  assert.equal(podeCancelar('2026-10-08T12:00:00Z', agora, 120), true);
  assert.equal(podeCancelar('2026-10-08T11:59:59Z', agora, 120), false);
  assert.equal(podeCancelar('2026-10-08T10:00:00Z', agora, 0), true);
});

test('datas e fusos em espanhol', () => {
  assert.equal(fechaLarga('2026-10-08'), 'jueves 8 de octubre');
  assert.equal(fechaLarga('2026-01-01'), 'jueves 1 de enero');
  assert.equal(fechaLarga('nada'), '');
  assert.equal(rotuloDoFuso('Europe/Madrid', agora), 'Madrid (GMT+2)');
  assert.equal(rotuloDoFuso('Europe/Madrid', new Date('2026-12-01T10:00:00Z')), 'Madrid (GMT+1)', 'no inverno a diferença muda');
  assert.equal(rotuloDoFuso('America/Mexico_City', agora), 'Ciudad de México (GMT-6)');
  assert.equal(rotuloDoFuso('America/Argentina/Cordoba', agora), 'Cordoba (GMT-3)');
  assert.equal(rotuloDoFuso('Atlantic/Reykjavik', agora), 'Reykjavik (GMT+0)');
  assert.equal(zonaValida('America/Bogota'), true);
  for (const ruim of ['Lugar/Inexistente', '', null, 5, 'x'.repeat(80)]) assert.equal(zonaValida(ruim), false, String(ruim));
  assert.ok(ZONAS_COMUNES.every((zona) => zonaValida(zona)), 'todos os fusos da lista existem');
});

test('erro do banco vira código conhecido; nota de 1 a 5', () => {
  assert.equal(codigoDoErro('turma_lotada'), 'turma_lotada');
  assert.equal(codigoDoErro('ERROR: limite_semanal (SQLSTATE P0001)'), 'limite_semanal');
  assert.equal(codigoDoErro('connection refused'), 'fallo');
  assert.equal(codigoDoErro(null), 'fallo');
  assert.equal(codigoDoErro('nota fora do intervalo'), 'fallo', 'palavras soltas não viram código');
  assert.equal(lerNota('5'), 5);
  for (const ruim of ['0', '6', '4.5', '', undefined, 3]) assert.equal(lerNota(ruim), null, String(ruim));
});

test('as partes da data para o quadrinho de calendário, no fuso do aluno', () => {
  // 12 de outubro de 2026, 20:15 em UTC: 22:15 em Madri, 17:15 em São Paulo.
  assert.deepEqual(partesDeLaFecha('2026-10-12T20:15:00Z', 'Europe/Madrid'), { diaSemana: 'lun', dia: '12', mes: 'oct' });
  assert.deepEqual(partesDeLaFecha('2026-10-12T20:15:00Z', 'America/Sao_Paulo'), { diaSemana: 'lun', dia: '12', mes: 'oct' });
  // Aula às 23:30 de São Paulo: em Madri já é o dia seguinte.
  assert.deepEqual(partesDeLaFecha('2026-10-13T02:30:00Z', 'America/Sao_Paulo'), { diaSemana: 'lun', dia: '12', mes: 'oct' });
  assert.deepEqual(partesDeLaFecha('2026-10-13T02:30:00Z', 'Europe/Madrid'), { diaSemana: 'mar', dia: '13', mes: 'oct' });
  // Virada de mês e de ano.
  assert.deepEqual(partesDeLaFecha('2027-01-01T01:00:00Z', 'America/Bogota'), { diaSemana: 'jue', dia: '31', mes: 'dic' });
  for (const mes of ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']) {
    const partes = partesDeLaFecha(`2026-${mes}-15T12:00:00Z`, 'Europe/Madrid');
    assert.match(partes.mes, /^[a-zé]{3,4}$/, `mês ${mes}: ${partes.mes}`);
    assert.match(partes.diaSemana, /^[a-zéá]{3}$/, `mês ${mes}: ${partes.diaSemana}`);
  }
});
