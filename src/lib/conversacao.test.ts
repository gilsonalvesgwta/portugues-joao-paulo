import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dataEmBrasilia, estadoDaTurma, horaEmBrasilia, horarioNasCidades, inicioEmBrasilia, lerAprendizados, lerConfiguracoes, lerNivel,
  quandoEmBrasilia, validarConfiguracoes, validarTema, validarTurma,
} from './conversacao.ts';

const agora = new Date('2026-10-08T15:00:00Z'); // meio-dia em Brasília
const tema = '11111111-2222-3333-4444-555555555555';
const turma = { tema_id: tema, data: '2026-10-09', hora: '15:00', duracao_min: '60', vagas: '10', meet_url: 'meet.google.com/abc-defg-hij' };

test('tema: título, nível, o que o aluno vai aprender (um por linha) e material por link', () => {
  assert.deepEqual(
    validarTema({ titulo_es: '  En el   restaurante ', nivel: 'basico', descricao_es: 'Pedir comida.', aprendizados: ' Vocabulario práctico \n\n  Pedir la cuenta\n', material: 'exemplo.com/guia.pdf' }),
    { ok: true, valor: { titulo_es: 'En el restaurante', nivel: 'basico', descricao_es: 'Pedir comida.', aprendizados: ['Vocabulario práctico', 'Pedir la cuenta'], material: 'https://exemplo.com/guia.pdf' } },
  );
  assert.deepEqual(validarTema({ titulo_es: 'Tema', nivel: 'avancado' }), {
    ok: true, valor: { titulo_es: 'Tema', nivel: 'avancado', descricao_es: null, aprendizados: [], material: null },
  });
  const ruim = validarTema({ titulo_es: '', nivel: 'expert', aprendizados: Array.from({ length: 9 }, (_, i) => `linha ${i}`).join('\n'), material: 'http://sem-https.com' });
  assert.deepEqual(!ruim.ok && Object.keys(ruim.erros).sort(), ['aprendizados', 'material', 'nivel', 'titulo_es']);
  assert.equal(validarTema({ titulo_es: 'Tema', nivel: 'basico', aprendizados: 'x'.repeat(121) }).ok, false);
  assert.equal(lerNivel('intermediario'), 'intermediario');
  assert.equal(lerNivel('medio'), null);
  assert.deepEqual(lerAprendizados(['a', 5, '', 'b']), ['a', 'b']);
  assert.deepEqual(lerAprendizados('texto'), []);
});

test('datas: a equipe escreve em Brasília e o banco guarda o instante', () => {
  assert.equal(inicioEmBrasilia('2026-10-08', '20:00'), '2026-10-08T23:00:00.000Z');
  assert.equal(inicioEmBrasilia('2026-10-08', '22:30'), '2026-10-09T01:30:00.000Z');
  assert.equal(dataEmBrasilia('2026-10-09T01:30:00.000Z'), '2026-10-08');
  assert.equal(horaEmBrasilia('2026-10-09T01:30:00.000Z'), '22:30');
  assert.equal(quandoEmBrasilia('2026-10-08T23:00:00.000Z'), 'quinta-feira, 8 de outubro de 2026, 20:00');
  for (const [data, hora] of [['2026-02-30', '10:00'], ['2026-10-08', '24:00'], ['2026-10-08', '9:00'], ['08/10/2026', '10:00'], ['', ''], [null, null]]) {
    assert.equal(inicioEmBrasilia(data, hora), null, `${data} ${hora}`);
  }
  assert.equal(quandoEmBrasilia('nada'), '');
  assert.equal(horaEmBrasilia(null), '');
});

test('como o aluno vê o horário: a hora em cada cidade, avisando quando o dia muda', () => {
  assert.deepEqual(horarioNasCidades('2026-10-08T23:00:00.000Z'), [
    { cidade: 'Madri', hora: '01:00 (dia seguinte)' },
    { cidade: 'Buenos Aires', hora: '20:00' },
    { cidade: 'Bogotá', hora: '18:00' },
    { cidade: 'Cidade do México', hora: '17:00' },
  ]);
  assert.deepEqual(horarioNasCidades('2026-10-08T15:00:00.000Z').map((c) => c.hora), ['17:00', '12:00', '10:00', '09:00']);
  assert.deepEqual(horarioNasCidades('nada'), []);
});

test('turma nova: tema, data futura em Brasília, duração, vagas e o link da sala obrigatório', () => {
  assert.deepEqual(validarTurma(turma, agora, 0), {
    ok: true, valor: { tema_id: tema, inicio: '2026-10-09T18:00:00.000Z', duracao_min: 60, vagas: 10, meet_url: 'https://meet.google.com/abc-defg-hij' },
  });
  const passada = validarTurma({ ...turma, data: '2026-10-08', hora: '11:59' }, agora, 0);
  assert.equal(!passada.ok && passada.erros.data, 'Essa data e hora já passaram. Escolha um horário no futuro.');
  const semLink = validarTurma({ ...turma, meet_url: '' }, agora, 0);
  assert.equal(!semLink.ok && semLink.erros.meet_url, 'Cole o link da sala (Google Meet). Ele vai no e-mail de quem reservar.');
  const tudoRuim = validarTurma({ tema_id: 'x', data: '', hora: '', duracao_min: '5', vagas: '0', meet_url: 'http://x.com' }, agora, 0);
  assert.deepEqual(!tudoRuim.ok && Object.keys(tudoRuim.erros).sort(), ['data', 'duracao_min', 'meet_url', 'tema_id', 'vagas']);
  for (const duracao of ['14', '241', '1,5', 'uma hora']) assert.equal(validarTurma({ ...turma, duracao_min: duracao }, agora, 0).ok, false, duracao);
  assert.equal(validarTurma({ ...turma, vagas: '101' }, agora, 0).ok, false);
});

test('turma com gente inscrita: a data não é conferida (não muda) e as vagas não ficam abaixo dos inscritos', () => {
  const comInscritos = validarTurma({ ...turma, data: '', hora: '', vagas: '6' }, agora, 6);
  assert.deepEqual(comInscritos, { ok: true, valor: { tema_id: tema, inicio: '', duracao_min: 60, vagas: 6, meet_url: 'https://meet.google.com/abc-defg-hij' } });
  const poucas = validarTurma({ ...turma, vagas: '5' }, agora, 6);
  assert.equal(!poucas.ok && poucas.erros.vagas, 'Já há 6 pessoas inscritas: as vagas não podem ficar abaixo disso.');
  const uma = validarTurma({ ...turma, vagas: '0' }, agora, 1);
  assert.equal(uma.ok, false);
});

test('estado da turma pelo relógio', () => {
  const base = { situacao: 'aberta', inicio: '2026-10-08T16:00:00Z', duracao_min: 60 };
  assert.equal(estadoDaTurma(base, agora), 'aberta');
  assert.equal(estadoDaTurma(base, new Date('2026-10-08T16:00:00Z')), 'acontecendo');
  assert.equal(estadoDaTurma(base, new Date('2026-10-08T16:59:59Z')), 'acontecendo');
  assert.equal(estadoDaTurma(base, new Date('2026-10-08T17:00:00Z')), 'realizada');
  assert.equal(estadoDaTurma({ ...base, situacao: 'cancelada' }, agora), 'cancelada');
});

test('configurações: janela da agenda, fim das reservas e prazo de cancelamento', () => {
  assert.deepEqual(validarConfiguracoes({ agenda_janela_dias: '7', reserva_fecha_min_antes: '15', cancelamento_min_antes: '120' }), {
    ok: true, valor: { agenda_janela_dias: 7, reserva_fecha_min_antes: 15, cancelamento_min_antes: 120 },
  });
  const ruim = validarConfiguracoes({ agenda_janela_dias: '0', reserva_fecha_min_antes: '-1', cancelamento_min_antes: 'dois dias' });
  assert.deepEqual(!ruim.ok && Object.keys(ruim.erros).sort(), ['agenda_janela_dias', 'cancelamento_min_antes', 'reserva_fecha_min_antes']);
  assert.equal(validarConfiguracoes({ agenda_janela_dias: '31', reserva_fecha_min_antes: '0', cancelamento_min_antes: '0' }).ok, false);
  assert.deepEqual(lerConfiguracoes([{ chave: 'agenda_janela_dias', valor: 14 }, { chave: 'cancelamento_min_antes', valor: '60' }, { chave: 'outra', valor: 1 }, { chave: 'reserva_fecha_min_antes', valor: 'x' }]), {
    agenda_janela_dias: 14, reserva_fecha_min_antes: 15, cancelamento_min_antes: 60,
  });
});
