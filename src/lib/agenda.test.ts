import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diasDaAgenda, partesLocais, periodoDaHora, type TurmaDaAgenda } from './agenda.ts';

// Quinta-feira, 8 de outubro de 2026, 12:00 em Madri (10:00 UTC; Madri está em UTC+2 até 25/10).
const agora = new Date('2026-10-08T10:00:00Z');

const turma = (turmaId: string, inicio: string, vagasRestantes = 5, jaReservada = false): TurmaDaAgenda =>
  ({ turmaId, inicio, vagasRestantes, jaReservada });

// As turmas da tela de exemplo: 12:00, 14:00, 15:00 e 16:00 de Brasília.
const turmas = [
  turma('t-16', '2026-10-08T19:00:00Z', 0),
  turma('t-12', '2026-10-08T15:00:00Z', 4),
  turma('t-15', '2026-10-08T18:00:00Z', 5),
  turma('t-14', '2026-10-08T17:00:00Z', 7),
  turma('t-sab', '2026-10-10T08:30:00Z', 2),
];

test('converte o instante para a data e a hora do fuso', () => {
  assert.deepEqual(partesLocais(new Date('2026-10-08T18:00:00Z'), 'Europe/Madrid'), { data: '2026-10-08', hora: 20, minuto: 0 });
  assert.deepEqual(partesLocais(new Date('2026-10-08T18:00:00Z'), 'America/Mexico_City'), { data: '2026-10-08', hora: 12, minuto: 0 });
  assert.deepEqual(partesLocais(new Date('2026-10-08T18:00:00Z'), 'America/Bogota'), { data: '2026-10-08', hora: 13, minuto: 0 });
  assert.deepEqual(partesLocais(new Date('2026-10-08T18:00:00Z'), 'America/Sao_Paulo'), { data: '2026-10-08', hora: 15, minuto: 0 });
  assert.deepEqual(partesLocais(new Date('2026-10-08T23:30:00Z'), 'Europe/Madrid'), { data: '2026-10-09', hora: 1, minuto: 30 });
  assert.throws(() => partesLocais(agora, 'Lugar/Inexistente'), RangeError);
});

test('períodos: manhã até 11:59, tarde até 17:59, noite depois', () => {
  assert.deepEqual([0, 11, 12, 17, 18, 23].map(periodoDaHora), ['manha', 'manha', 'tarde', 'tarde', 'noite', 'noite']);
});

test('aluno em Madri vê 7 dias, com os horários da quinta em tarde e noite', () => {
  const dias = diasDaAgenda(turmas, 'Europe/Madrid', agora);
  assert.equal(dias.length, 7);
  assert.deepEqual(dias.map((d) => d.data), ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14']);
  assert.deepEqual(dias.map((d) => d.diaDaSemana), [4, 5, 6, 0, 1, 2, 3]);
  assert.deepEqual(dias.map((d) => d.ehHoje), [true, false, false, false, false, false, false]);

  const quinta = dias[0]!;
  assert.deepEqual(quinta.manha, []);
  assert.deepEqual(quinta.tarde.map((h) => h.hora), ['17:00']);
  assert.deepEqual(quinta.noite.map((h) => [h.hora, h.vagasRestantes, h.lotada]), [['19:00', 7, false], ['20:00', 5, false], ['21:00', 0, true]]);
  assert.equal(quinta.turmasComVaga, 3);

  const sabado = dias[2]!;
  assert.deepEqual(sabado.manha.map((h) => h.hora), ['10:30']);
  assert.equal(dias[1]!.turmasComVaga + dias[3]!.turmasComVaga, 0);
});

test('o mesmo horário cai em outro período para quem está no México', () => {
  const quinta = diasDaAgenda(turmas, 'America/Mexico_City', agora)[0]!;
  assert.deepEqual(quinta.manha.map((h) => h.hora), ['09:00', '11:00']);
  assert.deepEqual(quinta.tarde.map((h) => h.hora), ['12:00', '13:00']);
  assert.deepEqual(quinta.noite, []);
});

test('turma perto da meia-noite cai no dia certo de cada fuso', () => {
  const tarde = [turma('t', '2026-10-09T02:00:00Z')]; // 23:00 de quinta em Brasília, 04:00 de sexta em Madri
  assert.equal(diasDaAgenda(tarde, 'America/Sao_Paulo', agora)[0]!.noite.length, 1);
  const madri = diasDaAgenda(tarde, 'Europe/Madrid', agora);
  assert.equal(madri[0]!.noite.length, 0);
  assert.deepEqual(madri[1]!.manha.map((h) => h.hora), ['04:00']);
});

test('ignora turma que já começou, fora da janela ou com data inválida', () => {
  const dias = diasDaAgenda(
    [turma('passou', '2026-10-08T09:00:00Z'), turma('longe', '2026-10-16T18:00:00Z'), turma('ruim', 'não é data'), turma('ok', '2026-10-14T18:00:00Z')],
    'Europe/Madrid',
    agora,
  );
  const todas = dias.flatMap((d) => [...d.manha, ...d.tarde, ...d.noite]).map((h) => h.turmaId);
  assert.deepEqual(todas, ['ok']);
});

test('janela configurável e virada de mês', () => {
  const fimDoMes = new Date('2026-10-30T10:00:00Z');
  assert.deepEqual(diasDaAgenda([], 'Europe/Madrid', fimDoMes, 4).map((d) => d.data), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
});
