// Teste de ponta a ponta dos lembretes das aulas ao vivo: o servidor, sozinho, manda um e-mail
// 1 hora antes e outro 24 horas antes, uma vez só, e não manda para quem reservou em cima da hora.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { before, test } from 'node:test';
import { admin, criarPessoa, emailDeTeste, emailsPara } from './apoio.mjs';

const sufixo = randomBytes(3).toString('hex');
const aluna = { email: emailDeTeste('aluna-lembrete'), nome: `Lola Lembrete ${sufixo}` };
const atrasada = { email: emailDeTeste('aluna-em-cima-da-hora'), nome: `Tania Tarde ${sufixo}` };
const TEMA_DE_HOJE = `De compras ${sufixo}`;
const TEMA_DE_AMANHA = `En el aeropuerto ${sufixo}`;
const SALA_DE_HOJE = `https://meet.google.com/hoje-${sufixo}`;
const SALA_DE_AMANHA = `https://meet.google.com/amanha-${sufixo}`;
const MIN = 60 * 1000;
const HORA = 60 * MIN;

// O servidor de teste confere os lembretes a cada poucos segundos (no ar, a cada 5 minutos).
const intervalo = Number(process.env.LEMBRETES_INTERVALO_SEG ?? '');
const rapido = Number.isInteger(intervalo) && intervalo > 0 && intervalo <= 10;
const pular = rapido ? false : 'o servidor precisa estar com LEMBRETES_INTERVALO_SEG de até 10 segundos';

const emBreve = new Date(Date.now() + 50 * MIN);
const amanha = new Date(Date.now() + 20 * HORA);
let alunaId;
let reservas; // { hoje, amanha }

async function criar(tabela, linha) {
  const { data, error } = await admin.from(tabela).insert(linha).select('id').single();
  assert.equal(error, null, `${tabela}: ${error?.message}`);
  return data.id;
}

const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function esperarEmails(destinatario, quantos, limiteMs) {
  const fim = Date.now() + limiteMs;
  let emails = [];
  while (Date.now() < fim) {
    emails = await emailsPara(destinatario);
    if (emails.length >= quantos) return emails;
    await espera(500);
  }
  return emails;
}

const horaEmMadri = (instante) =>
  new Intl.DateTimeFormat('es', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instante);

before(async () => {
  if (!rapido) return;
  alunaId = await criarPessoa(aluna);
  const atrasadaId = await criarPessoa(atrasada);
  const cursoId = await criar('cursos', { titulo_pt: `Curso dos lembretes ${sufixo}`, titulo_es: `Curso de recordatorios ${sufixo}`, situacao: 'publicado' });
  for (const pessoa of [alunaId, atrasadaId]) {
    await criar('matriculas', { aluno_id: pessoa, curso_id: cursoId, origem: 'manual', inclui_conversacao: true, reservas_por_semana: 3 });
  }
  const temaDeHoje = await criar('temas_conversacao', { titulo_es: TEMA_DE_HOJE, nivel: 'basico' });
  const temaDeAmanha = await criar('temas_conversacao', { titulo_es: TEMA_DE_AMANHA, nivel: 'basico' });
  const turmaDeHoje = await criar('turmas', { tema_id: temaDeHoje, inicio: emBreve.toISOString(), duracao_min: 60, vagas: 10, meet_url: SALA_DE_HOJE });
  const turmaDeAmanha = await criar('turmas', { tema_id: temaDeAmanha, inicio: amanha.toISOString(), duracao_min: 60, vagas: 10, meet_url: SALA_DE_AMANHA });
  // A aluna reservou as duas aulas há dias; a outra reservou a de hoje agora há pouco.
  const haDias = new Date(Date.now() - 3 * 24 * HORA).toISOString();
  reservas = {
    hoje: await criar('reservas', { turma_id: turmaDeHoje, aluno_id: alunaId, criada_em: haDias }),
    amanha: await criar('reservas', { turma_id: turmaDeAmanha, aluno_id: alunaId, criada_em: haDias }),
  };
  await criar('reservas', { turma_id: turmaDeHoje, aluno_id: atrasadaId, criada_em: new Date(Date.now() - 10 * MIN).toISOString() });
});

test('o servidor manda sozinho o lembrete de 1 hora e o de 24 horas, com o link da sala e a hora da aluna', { skip: pular }, async () => {
  const emails = await esperarEmails(aluna.email, 2, 45_000);
  assert.equal(emails.length, 2, 'chegaram os dois lembretes');
  const deHoje = emails.find((email) => email.asunto === `Tu clase empieza en 1 hora: ${TEMA_DE_HOJE}`);
  const deAmanha = emails.find((email) => email.asunto === `Tu clase empieza en 24 horas: ${TEMA_DE_AMANHA}`);
  assert.ok(deHoje, `lembrete de 1 hora: ${emails.map((email) => email.asunto).join(' | ')}`);
  assert.ok(deAmanha, `lembrete de 24 horas: ${emails.map((email) => email.asunto).join(' | ')}`);
  assert.ok(deHoje.texto.startsWith(`Hola, ${aluna.nome}:`));
  assert.ok(deHoje.texto.includes(SALA_DE_HOJE) && deHoje.html.includes(`href="${SALA_DE_HOJE}"`));
  assert.ok(deHoje.texto.includes(horaEmMadri(emBreve)), 'a hora vem no fuso da aluna');
  assert.equal(deHoje.texto.includes(SALA_DE_AMANHA), false);
  assert.ok(deAmanha.texto.includes(SALA_DE_AMANHA));
  assert.ok(deAmanha.texto.includes(horaEmMadri(amanha)));

  const { data: registros, error } = await admin.from('notificacoes').select('tipo, enviada_em, erro, dados').eq('aluno_id', alunaId).order('tipo');
  assert.equal(error, null, error?.message);
  assert.deepEqual(registros.map((r) => [r.tipo, r.dados.reserva_id, r.enviada_em !== null, r.erro]), [
    ['recordatorio_1h', reservas.hoje, true, null],
    ['recordatorio_24h', reservas.amanha, true, null],
  ]);
});

test('o lembrete sai uma vez só, e quem reservou em cima da hora não recebe', { skip: pular }, async () => {
  // Tempo para o servidor conferir os lembretes mais algumas vezes.
  await espera((intervalo * 3 + 1) * 1000);
  assert.equal((await emailsPara(aluna.email)).length, 2, 'nenhum lembrete repetido');
  assert.deepEqual(await emailsPara(atrasada.email), [], 'reserva feita há 10 minutos: a confirmação já serviu de lembrete');
});
