// O caminho inteiro de um horário, do professor ao aluno: o professor escreve a data e a hora em
// Brasília, o banco guarda o instante, e cada aluno vê a aula no próprio fuso — na agenda, em
// "Mis reservas", nos e-mails e na conta da semana. Aqui ficam os casos em que isso costuma dar
// errado: horário de verão, virada de dia e virada de semana.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diasDaAgenda, partesLocais, type TurmaDaAgenda } from './agenda.ts';
import { dataEmBrasilia, horaEmBrasilia, horarioNasCidades, inicioEmBrasilia, quandoEmBrasilia } from './conversacao.ts';
import { emailRecordatorio, emailReservaConfirmada, fechaYHora } from './emails.ts';
import { horaEn, reservasNaSemana, rotuloDoFuso, segundaDaSemana, zonaDelDispositivo, zonaValida, ZONAS_COMUNES } from './reservas.ts';

const turma = (inicio: string): TurmaDaAgenda => ({ turmaId: 't', inicio, vagasRestantes: 5, jaReservada: false });

// A aula do teste feito na instalação: segunda-feira, 12 de outubro de 2026, 17:15 em Brasília.
const AULA = inicioEmBrasilia('2026-10-12', '17:15')!;
// Domingo, 11 de outubro de 2026, 15:00 em Brasília (o "agora" de quem abre a agenda).
const AGORA = new Date('2026-10-11T18:00:00Z');

test('o professor escreve em Brasília e o banco guarda o instante; a volta dá a mesma data e hora', () => {
  assert.equal(AULA, '2026-10-12T20:15:00.000Z');
  assert.equal(dataEmBrasilia(AULA), '2026-10-12');
  assert.equal(horaEmBrasilia(AULA), '17:15');
  assert.equal(quandoEmBrasilia(AULA), 'segunda-feira, 12 de outubro de 2026, 17:15');
  // Meia-noite e o último minuto do dia continuam no dia certo de Brasília.
  assert.equal(inicioEmBrasilia('2026-10-12', '00:00'), '2026-10-12T03:00:00.000Z');
  assert.equal(inicioEmBrasilia('2026-10-12', '23:59'), '2026-10-13T02:59:00.000Z');
  assert.equal(dataEmBrasilia('2026-10-13T02:59:00.000Z'), '2026-10-12');
  // Datas e horas que não existem são recusadas.
  for (const [data, hora] of [['2026-02-30', '10:00'], ['2026-13-01', '10:00'], ['2026-10-12', '24:00'], ['2026-10-12', '9:00'], ['12/10/2026', '17:15'], ['', '']]) {
    assert.equal(inicioEmBrasilia(data, hora), null, `${data} ${hora}`);
  }
  // O Brasil não tem horário de verão: em janeiro a diferença é a mesma.
  assert.equal(inicioEmBrasilia('2027-01-15', '17:15'), '2027-01-15T20:15:00.000Z');
});

test('a mesma aula das 17:15 de Brasília, vista por alunos em cada fuso', () => {
  const esperado: Record<string, [string, string, string]> = {
    // fuso: [dia, hora, rótulo do fuso naquele dia]
    'America/Sao_Paulo': ['2026-10-12', '17:15', 'São Paulo (GMT-3)'],
    'America/Argentina/Buenos_Aires': ['2026-10-12', '17:15', 'Buenos Aires (GMT-3)'],
    'America/Montevideo': ['2026-10-12', '17:15', 'Montevideo (GMT-3)'],
    'America/Santiago': ['2026-10-12', '17:15', 'Santiago de Chile (GMT-3)'], // horário de verão do Chile
    'America/La_Paz': ['2026-10-12', '16:15', 'La Paz (GMT-4)'],
    'America/Caracas': ['2026-10-12', '16:15', 'Caracas (GMT-4)'],
    'America/Santo_Domingo': ['2026-10-12', '16:15', 'Santo Domingo (GMT-4)'],
    'America/Puerto_Rico': ['2026-10-12', '16:15', 'Puerto Rico (GMT-4)'],
    'America/New_York': ['2026-10-12', '16:15', 'Nueva York (GMT-4)'], // horário de verão dos EUA
    'America/Bogota': ['2026-10-12', '15:15', 'Bogotá (GMT-5)'],
    'America/Lima': ['2026-10-12', '15:15', 'Lima (GMT-5)'],
    'America/Guayaquil': ['2026-10-12', '15:15', 'Quito y Guayaquil (GMT-5)'],
    'America/Panama': ['2026-10-12', '15:15', 'Panamá (GMT-5)'],
    'America/Chicago': ['2026-10-12', '15:15', 'Chicago (GMT-5)'],
    'America/Mexico_City': ['2026-10-12', '14:15', 'Ciudad de México (GMT-6)'],
    'America/Guatemala': ['2026-10-12', '14:15', 'Guatemala (GMT-6)'],
    'America/Costa_Rica': ['2026-10-12', '14:15', 'Costa Rica (GMT-6)'],
    'America/Los_Angeles': ['2026-10-12', '13:15', 'Los Ángeles (GMT-7)'],
    'Atlantic/Canary': ['2026-10-12', '21:15', 'Islas Canarias (GMT+1)'],
    'Europe/Madrid': ['2026-10-12', '22:15', 'Madrid (GMT+2)'],
  };
  const instante = new Date(AULA);
  for (const [fuso, [dia, hora, rotulo]] of Object.entries(esperado)) {
    assert.ok(zonaValida(fuso), fuso);
    assert.equal(partesLocais(instante, fuso).data, dia, fuso);
    assert.equal(horaEn(instante, fuso), hora, fuso);
    assert.equal(rotuloDoFuso(fuso, instante), rotulo, fuso);
    // A agenda põe a aula no dia e na hora desse fuso.
    const dias = diasDaAgenda([turma(AULA)], fuso, AGORA);
    const doDia = dias.find((d) => d.data === dia)!;
    assert.deepEqual([...doDia.manha, ...doDia.tarde, ...doDia.noite].map((h) => h.hora), [hora], fuso);
    assert.equal(dias.filter((d) => d.manha.length + d.tarde.length + d.noite.length > 0).length, 1, `${fuso}: a aula aparece em um dia só`);
    // "Mis reservas" e os e-mails dizem a hora e de onde ela é.
    assert.ok(fechaYHora(AULA, fuso).endsWith(`, ${hora}, hora de ${rotulo}`), `${fuso}: ${fechaYHora(AULA, fuso)}`);
  }
  // Todos os fusos da lista de mais frequentes foram conferidos, menos o de Assunção (o Paraguai
  // mudou a regra do horário de verão em 2024, e nem todo servidor já conhece a regra nova).
  const fora = ZONAS_COMUNES.filter((fuso) => !(fuso in esperado));
  assert.deepEqual(fora, ['America/Asuncion']);
});

test('a agenda divide o dia em manhã, tarde e noite pela hora do aluno', () => {
  const periodoEm = (fuso: string) => {
    const dia = diasDaAgenda([turma(AULA)], fuso, AGORA).find((d) => d.manha.length + d.tarde.length + d.noite.length > 0)!;
    return dia.manha.length ? 'manha' : dia.tarde.length ? 'tarde' : 'noite';
  };
  assert.equal(periodoEm('America/Sao_Paulo'), 'tarde');
  assert.equal(periodoEm('America/Mexico_City'), 'tarde');
  assert.equal(periodoEm('Europe/Madrid'), 'noite');
});

test('o texto completo: dia da semana, data, hora e o lugar da hora', () => {
  assert.equal(fechaYHora(AULA, 'America/Sao_Paulo'), 'lunes, 12 de octubre de 2026, 17:15, hora de São Paulo (GMT-3)');
  assert.equal(fechaYHora(AULA, 'Europe/Madrid'), 'lunes, 12 de octubre de 2026, 22:15, hora de Madrid (GMT+2)');
  assert.equal(fechaYHora(AULA, 'America/Mexico_City'), 'lunes, 12 de octubre de 2026, 14:15, hora de Ciudad de México (GMT-6)');
  // Fuso fora da lista de mais frequentes: vale o nome da cidade do próprio fuso.
  assert.equal(fechaYHora(AULA, 'Europe/Lisbon'), 'lunes, 12 de octubre de 2026, 21:15, hora de Lisbon (GMT+1)');
});

test('horário de verão: a hora do aluno muda quando o país dele muda o relógio, e o rótulo acompanha o dia da aula', () => {
  // A Europa atrasa o relógio em 25 de outubro de 2026. A aula das 17:15 de Brasília passa das 22:15 para as 21:15 em Madri.
  const antes = inicioEmBrasilia('2026-10-23', '17:15')!;
  const depois = inicioEmBrasilia('2026-10-26', '17:15')!;
  assert.equal(horaEn(new Date(antes), 'Europe/Madrid'), '22:15');
  assert.equal(horaEn(new Date(depois), 'Europe/Madrid'), '21:15');
  assert.equal(fechaYHora(depois, 'Europe/Madrid'), 'lunes, 26 de octubre de 2026, 21:15, hora de Madrid (GMT+1)');
  // O rótulo é o do dia da aula, não o de hoje: quem recebe o e-mail em 20/10 de uma aula de 26/10 lê GMT+1.
  assert.equal(rotuloDoFuso('Europe/Madrid', new Date('2026-10-20T12:00:00Z')), 'Madrid (GMT+2)');
  assert.equal(rotuloDoFuso('Europe/Madrid', new Date(depois)), 'Madrid (GMT+1)');
  // E adianta de novo em 28 de março de 2027.
  assert.equal(horaEn(new Date(inicioEmBrasilia('2027-03-26', '17:15')!), 'Europe/Madrid'), '21:15');
  assert.equal(horaEn(new Date(inicioEmBrasilia('2027-03-29', '17:15')!), 'Europe/Madrid'), '22:15');

  // Os Estados Unidos atrasam em 1º de novembro de 2026: Nova York passa das 16:15 para as 15:15.
  assert.equal(horaEn(new Date(inicioEmBrasilia('2026-10-30', '17:15')!), 'America/New_York'), '16:15');
  assert.equal(horaEn(new Date(inicioEmBrasilia('2026-11-02', '17:15')!), 'America/New_York'), '15:15');

  // Quem não tem horário de verão (México, Colômbia, Argentina) vê sempre a mesma hora.
  for (const data of ['2026-10-12', '2026-12-15', '2027-03-30', '2027-07-01']) {
    const aula = new Date(inicioEmBrasilia(data, '17:15')!);
    assert.equal(horaEn(aula, 'America/Mexico_City'), '14:15', data);
    assert.equal(horaEn(aula, 'America/Bogota'), '15:15', data);
    assert.equal(horaEn(aula, 'America/Argentina/Buenos_Aires'), '17:15', data);
  }
});

test('virada de dia: aula da noite em Brasília é madrugada do dia seguinte na Espanha', () => {
  const aula = inicioEmBrasilia('2026-10-12', '22:30')!; // 03:30 de terça em Madri
  assert.deepEqual(partesLocais(new Date(aula), 'Europe/Madrid'), { data: '2026-10-13', hora: 3, minuto: 30 });
  assert.equal(fechaYHora(aula, 'Europe/Madrid'), 'martes, 13 de octubre de 2026, 03:30, hora de Madrid (GMT+2)');
  assert.equal(fechaYHora(aula, 'America/Sao_Paulo'), 'lunes, 12 de octubre de 2026, 22:30, hora de São Paulo (GMT-3)');
  const emMadri = diasDaAgenda([turma(aula)], 'Europe/Madrid', AGORA);
  assert.equal(emMadri.find((d) => d.data === '2026-10-12')!.noite.length, 0);
  assert.deepEqual(emMadri.find((d) => d.data === '2026-10-13')!.manha.map((h) => h.hora), ['03:30']);
  // O professor vê o aviso de "dia seguinte" na tela da turma, e as horas batem com as do aluno.
  const cidades = Object.fromEntries(horarioNasCidades(aula).map((c) => [c.cidade, c.hora]));
  assert.equal(cidades['Madri'], '03:30 (dia seguinte)');
  assert.equal(cidades['Buenos Aires'], '22:30');
  assert.equal(cidades['Bogotá'], '20:30');
  assert.equal(cidades['Cidade do México'], '19:30');

  // No sentido contrário: aula das 00:30 de terça em Brasília ainda é segunda no México.
  const cedo = inicioEmBrasilia('2026-10-13', '00:30')!;
  assert.equal(fechaYHora(cedo, 'America/Mexico_City'), 'lunes, 12 de octubre de 2026, 21:30, hora de Ciudad de México (GMT-6)');
  assert.equal(Object.fromEntries(horarioNasCidades(cedo).map((c) => [c.cidade, c.hora]))['Cidade do México'], '21:30 (dia anterior)');
});

test('"hoje" e a janela de 7 dias são os do aluno', () => {
  // 22:00 de domingo em Brasília: em Madri já é segunda, 03:00.
  const agora = new Date('2026-10-12T01:00:00Z');
  assert.equal(diasDaAgenda([], 'America/Sao_Paulo', agora)[0]!.data, '2026-10-11');
  assert.equal(diasDaAgenda([], 'America/Mexico_City', agora)[0]!.data, '2026-10-11');
  assert.equal(diasDaAgenda([], 'Europe/Madrid', agora)[0]!.data, '2026-10-12');
  // Uma aula no fim da janela aparece para quem ainda tem aquele dia nos seus 7.
  const noFim = inicioEmBrasilia('2026-10-18', '10:00')!; // domingo seguinte
  assert.equal(diasDaAgenda([turma(noFim)], 'Europe/Madrid', agora).some((d) => d.data === '2026-10-18' && d.tarde.length === 1), true);
  assert.equal(diasDaAgenda([turma(noFim)], 'America/Sao_Paulo', agora).some((d) => d.manha.length + d.tarde.length + d.noite.length > 0), false, 'em São Paulo o dia 18 é o oitavo dia');
});

test('a semana do limite de reservas (segunda a domingo) é a do fuso do aluno', () => {
  // Domingo, 22:00 em Brasília: para quem está em Madri já é segunda, 03:00 — conta na semana seguinte.
  const domingoANoite = inicioEmBrasilia('2026-10-18', '22:00')!;
  assert.equal(segundaDaSemana(new Date(domingoANoite), 'America/Sao_Paulo'), '2026-10-12');
  assert.equal(segundaDaSemana(new Date(domingoANoite), 'America/Mexico_City'), '2026-10-12');
  assert.equal(segundaDaSemana(new Date(domingoANoite), 'Europe/Madrid'), '2026-10-19');
  const reservas = [{ inicio: AULA }, { inicio: domingoANoite }];
  assert.equal(reservasNaSemana(reservas, 'America/Sao_Paulo', new Date(AULA)), 2, 'em São Paulo as duas são da mesma semana');
  assert.equal(reservasNaSemana(reservas, 'Europe/Madrid', new Date(AULA)), 1, 'em Madri a de domingo à noite já é da semana seguinte');
});

test('os e-mails da aula levam a data, a hora e o lugar da hora do aluno', () => {
  const dados = { nombre: 'Lucía', tema: 'En el restaurante', inicio: AULA, meetUrl: 'https://meet.google.com/abc-defg-hij' };
  const confirmada = emailReservaConfirmada({ ...dados, fuso: 'America/Mexico_City', duracionMin: 60, cancelarHastaMin: 120 });
  assert.ok(confirmada.texto.includes('Fecha y hora: lunes, 12 de octubre de 2026, 14:15, hora de Ciudad de México (GMT-6).'), confirmada.texto);
  assert.ok(confirmada.html.includes('14:15, hora de Ciudad de México (GMT-6)'));
  const lembrete = emailRecordatorio({ ...dados, fuso: 'Europe/Madrid', falta: '1 hora' });
  assert.ok(lembrete.texto.includes('Fecha y hora: lunes, 12 de octubre de 2026, 22:15, hora de Madrid (GMT+2).'), lembrete.texto);
});

test('o fuso do aparelho só é aceito quando é o nome de um lugar', () => {
  assert.equal(zonaDelDispositivo('America/Bogota'), 'America/Bogota');
  assert.equal(zonaDelDispositivo('Europe/Madrid'), 'Europe/Madrid');
  for (const ruim of ['UTC', 'Etc/UTC', 'Etc/GMT+3', 'GMT', '', 'Lugar/Inexistente', null, undefined, 42]) {
    assert.equal(zonaDelDispositivo(ruim), null, String(ruim));
  }
});
