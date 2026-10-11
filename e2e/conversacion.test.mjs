// Teste de ponta a ponta da conversação do aluno: a agenda no fuso dele, reservar (com o e-mail
// e o link da sala), o limite da semana, cancelar, avaliar, e a tela "Mi cuenta" (fuso e senha).
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { admin, base, clientePublico, criarPessoa, emailDeTeste, emailsPara, entrar, novaPagina, novoContexto, senha, textoDoAviso } from './apoio.mjs';

const sufixo = randomBytes(3).toString('hex');
const aluna = { email: emailDeTeste('aluna-agenda'), nome: `Rosa Reserva ${sufixo}` };
const colega = { email: emailDeTeste('colega-agenda'), nome: `Clara Colega ${sufixo}` };
const semConversa = { email: emailDeTeste('sem-conversa'), nome: `Sonia Sin ${sufixo}` };
const professor = { email: emailDeTeste('professor-agenda'), nome: `Professor Agenda ${sufixo}`, papel: 'professor' };
const TEMA = `En el mercado ${sufixo}`;
const TEMA_DE_HOJE = `Clase de hoy ${sufixo}`;
const SALA = `https://meet.google.com/xyz-${sufixo}`;
const MATERIAL = `https://exemplo.test/mercado-${sufixo}.pdf`;
const MIN = 60 * 1000;

// Três turmas amanhã (no relógio universal: 16:00, 18:00 e 20:00; em Madri caem no mesmo dia).
const hoje = new Date();
const amanhaAs = (hora) => new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + 1, hora, 0, 0));
const DIA = amanhaAs(18).toISOString().slice(0, 10);
const horaEm = (instante, fuso) => new Intl.DateTimeFormat('en-GB', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instante);
const fechaLarga = (data) => {
  const partes = new Intl.DateTimeFormat('es', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).formatToParts(new Date(`${data}T12:00:00Z`));
  const parte = (tipo) => partes.find((p) => p.type === tipo).value;
  return `${parte('weekday')} ${parte('day')} de ${parte('month')}`;
};

let navegador;
let pagina; // a aluna, logada do começo ao fim
let alunaId;
let colegaId;
let turmas; // { cedo, unica, tarde, hoje, passada }
const hora = {}; // a hora de cada turma em Madri

async function criar(tabela, linha) {
  const { data, error } = await admin.from(tabela).insert(linha).select('id').single();
  assert.equal(error, null, `${tabela}: ${error?.message}`);
  return data.id;
}

async function reservasDe(pessoaId) {
  const { data, error } = await admin.from('reservas').select('turma_id, situacao').eq('aluno_id', pessoaId);
  assert.equal(error, null, error?.message);
  return Object.fromEntries(data.map((r) => [Object.keys(turmas).find((nome) => turmas[nome] === r.turma_id), r.situacao]));
}

async function sessaoDe(pessoa, clave = senha) {
  const sessao = clientePublico();
  const { error } = await sessao.auth.signInWithPassword({ email: pessoa.email, password: clave });
  assert.equal(error, null, error?.message);
  return sessao;
}

const horario = (qual, onde = pagina) => onde.locator('#agenda li').filter({ hasText: TEMA }).filter({ hasText: hora[qual] });
const abrirODia = (onde = pagina) => onde.goto(`${base}/conversacion?dia=${DIA}`);

before(async () => {
  await mkdir('capturas', { recursive: true });
  navegador = await chromium.launch();
  alunaId = await criarPessoa(aluna);
  colegaId = await criarPessoa(colega);
  const semConversaId = await criarPessoa(semConversa);
  await criarPessoa(professor);
  const cursoId = await criar('cursos', { titulo_pt: `Curso da agenda ${sufixo}`, titulo_es: `Curso de agenda ${sufixo}`, situacao: 'publicado' });
  await criar('matriculas', { aluno_id: alunaId, curso_id: cursoId, origem: 'manual', inclui_conversacao: true, reservas_por_semana: 2 });
  await criar('matriculas', { aluno_id: colegaId, curso_id: cursoId, origem: 'manual', inclui_conversacao: true, reservas_por_semana: 3 });
  await criar('matriculas', { aluno_id: semConversaId, curso_id: cursoId, origem: 'manual', inclui_conversacao: false, reservas_por_semana: 0 });

  const temaId = await criar('temas_conversacao', {
    titulo_es: TEMA, nivel: 'basico', descricao_es: 'Comprar frutas y preguntar precios.', aprendizados: ['Números y precios', 'Frutas y verduras'], material: MATERIAL,
  });
  const temaDeHoje = await criar('temas_conversacao', { titulo_es: TEMA_DE_HOJE, nivel: 'intermediario' });
  const turma = (tema, inicio, vagas) => criar('turmas', { tema_id: tema, inicio: inicio.toISOString(), duracao_min: 60, vagas, meet_url: SALA });
  turmas = {
    cedo: await turma(temaId, amanhaAs(16), 10),
    unica: await turma(temaId, amanhaAs(18), 1),
    tarde: await turma(temaId, amanhaAs(20), 10),
    hoje: await turma(temaDeHoje, new Date(Date.now() + 60 * MIN), 10),
    passada: await turma(temaDeHoje, new Date(Date.now() - 120 * MIN), 10),
  };
  for (const [nome, horas] of [['cedo', 16], ['unica', 18], ['tarde', 20]]) hora[nome] = horaEm(amanhaAs(horas), 'Europe/Madrid');
  // A colega já teve uma aula (para avaliar) e tem outra daqui a uma hora (fora do prazo de cancelar).
  await criar('reservas', { turma_id: turmas.passada, aluno_id: colegaId });

  pagina = await novaPagina(navegador);
  await entrar(pagina, aluna.email, senha);
  await pagina.waitForURL('**/inicio');
});

after(async () => {
  await navegador?.close();
});

test('quem não tem conversação na matrícula vê a explicação e não reserva nem pelo banco', async () => {
  const dela = await novaPagina(navegador);
  await entrar(dela, semConversa.email, senha);
  await dela.waitForURL('**/inicio');
  await dela.goto(`${base}/conversacion`);
  await dela.getByRole('heading', { name: 'Tu acceso no incluye clases de conversación' }).waitFor();
  assert.equal(await dela.getByRole('button', { name: /Reservar/ }).count(), 0);
  await dela.context().close();

  const sessao = await sessaoDe(semConversa);
  assert.match((await sessao.rpc('reservar_turma', { p_turma: turmas.cedo })).error?.message ?? '', /sem_direito_a_conversacao/);
  assert.deepEqual((await sessao.rpc('agenda_turmas', { p_nivel: null })).data ?? [], [], 'a agenda vem vazia');
});

test('a agenda mostra os horários no fuso da aluna, com o tema, as vagas e o que ela vai aprender', async () => {
  await pagina.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Conversación' }).click();
  await pagina.waitForURL('**/conversacion');
  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), 'Conversación en grupo');
  await pagina.getByText('Todavía no tienes clases reservadas.').waitFor();
  await pagina.getByText(/Horarios en tu zona horaria: Madrid \(GMT\+[12]\)/).waitFor();
  await pagina.getByText('Puedes cancelar hasta 2 horas antes del inicio; la reserva vuelve a tu semana.').waitFor();

  await pagina.locator(`nav[aria-label="Elige el día"] a[href*="dia=${DIA}"]`).click();
  await pagina.waitForURL(`**/conversacion?dia=${DIA}`);
  await pagina.getByRole('heading', { name: `Horarios del ${fechaLarga(DIA)}` }).waitFor();
  assert.match(await horario('unica').innerText(), /1 plaza(?!s)/);
  assert.match(await horario('tarde').innerText(), /10 plazas/);
  assert.match(await horario('tarde').innerText(), /Básico, 60 min/);
  assert.match(await horario('tarde').innerText(), /Comprar frutas y preguntar precios\./);
  await horario('tarde').getByText('Lo que vas a aprender').click();
  await horario('tarde').getByText('Números y precios').waitFor();
  await pagina.getByText('En la semana del día elegido: te quedan 2 de 2 reservas.').waitFor();
  assert.equal((await pagina.content()).includes(SALA), false, 'o link da sala não está na página antes de reservar');
  await pagina.screenshot({ path: 'capturas/aluno-conversacion-computador.png', fullPage: true });

  await pagina.getByRole('navigation', { name: 'Nivel' }).getByRole('link', { name: 'Avanzado' }).click();
  await pagina.waitForURL(`**/conversacion?dia=${DIA}&nivel=avancado`);
  await pagina.locator('nav[aria-label="Nivel"] a[aria-current="page"]').filter({ hasText: 'Avanzado' }).waitFor();
  assert.equal(await horario('unica').count(), 0, 'o tema básico some no filtro de avançado');
  await pagina.getByRole('navigation', { name: 'Nivel' }).getByRole('link', { name: 'Todos' }).click();
  await horario('unica').waitFor();
});

test('reservar: confirmação na tela, e-mail com o link da sala, e a vaga some para a colega', async () => {
  await horario('unica').getByRole('button', { name: /Reservar/ }).click();
  await pagina.waitForURL(`**/conversacion?dia=${DIA}&aviso=reservada`);
  assert.equal(await textoDoAviso(pagina, 'status'), 'Reserva confirmada. Te enviamos el enlace de la clase por correo.');
  assert.deepEqual(await reservasDe(alunaId), { unica: 'confirmada' });

  const minha = pagina.locator('#mis-reservas li').filter({ hasText: TEMA });
  assert.equal(await minha.getByRole('link', { name: 'Entrar a la clase' }).getAttribute('href'), SALA);
  assert.equal(await minha.getByRole('link', { name: 'Entrar a la clase' }).getAttribute('rel'), 'noopener noreferrer');
  assert.equal(await minha.getByRole('link', { name: 'Material de la clase' }).getAttribute('href'), MATERIAL);
  assert.match(await minha.innerText(), new RegExp(`${hora.unica}`));
  assert.match(await horario('unica').innerText(), /Reservada/);
  assert.equal(await horario('unica').getByRole('button').count(), 0);
  await pagina.getByText('En la semana del día elegido: te quedan 1 de 2 reservas.').waitFor();

  const emails = await emailsPara(aluna.email);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].asunto, `Reserva confirmada: ${TEMA}`);
  assert.ok(emails[0].texto.startsWith(`Hola, ${aluna.nome}:`));
  for (const trecho of [SALA, MATERIAL, `${hora.unica}`, 'hasta 2 horas antes', '60 minutos']) assert.ok(emails[0].texto.includes(trecho), trecho);
  const { data: registro } = await admin.from('notificacoes').select('tipo, enviada_em').eq('aluno_id', alunaId).eq('tipo', 'reserva_confirmada');
  assert.equal(registro.length, 1);
  assert.notEqual(registro[0].enviada_em, null);

  // A turma tinha uma vaga só: para a colega ela aparece completa, e o banco recusa a reserva.
  const sessao = await sessaoDe(colega);
  const { data: agenda } = await sessao.rpc('agenda_turmas', { p_nivel: null });
  assert.equal(agenda.find((t) => t.turma_id === turmas.unica).vagas_restantes, 0);
  assert.match((await sessao.rpc('reservar_turma', { p_turma: turmas.unica })).error?.message ?? '', /turma_lotada/);
  const dela = await novaPagina(navegador);
  await entrar(dela, colega.email, senha);
  await dela.waitForURL('**/inicio');
  await abrirODia(dela);
  assert.match(await horario('unica', dela).innerText(), /Completo/);
  assert.equal(await horario('unica', dela).getByRole('button').count(), 0);
  await dela.context().close();
});

test('limite da semana: usadas as duas reservas, a terceira não é oferecida nem aceita pelo banco', async () => {
  await horario('tarde').getByRole('button', { name: /Reservar/ }).click();
  await pagina.waitForURL(`**/conversacion?dia=${DIA}&aviso=reservada`);
  await pagina.getByText('En la semana del día elegido: te quedan 0 de 2 reservas.').waitFor();
  assert.deepEqual(await reservasDe(alunaId), { unica: 'confirmada', tarde: 'confirmada' });
  assert.equal(await pagina.locator('#mis-reservas li').count(), 2);
  assert.match(await horario('cedo').innerText(), /Ya usaste tus reservas de esa semana/);
  assert.equal(await horario('cedo').getByRole('button').count(), 0);
  const sessao = await sessaoDe(aluna);
  assert.match((await sessao.rpc('reservar_turma', { p_turma: turmas.cedo })).error?.message ?? '', /limite_semanal/);
  assert.equal((await emailsPara(aluna.email)).length, 2);
});

test('cancelar dentro do prazo: a reserva volta para a semana, a vaga volta para a turma e sai o e-mail', async () => {
  await pagina.locator('#mis-reservas li').filter({ hasText: hora.unica }).getByRole('button', { name: /Cancelar reserva/ }).click();
  await pagina.waitForURL(`**/conversacion?dia=${DIA}&aviso=cancelada`);
  assert.equal(await textoDoAviso(pagina, 'status'), 'Reserva cancelada. Puedes elegir otra clase.');
  assert.deepEqual(await reservasDe(alunaId), { unica: 'cancelada', tarde: 'confirmada' });
  assert.equal(await pagina.locator('#mis-reservas li').count(), 1);
  await pagina.getByText('En la semana del día elegido: te quedan 1 de 2 reservas.').waitFor();
  assert.match(await horario('unica').innerText(), /1 plaza(?!s)/);
  assert.equal(await horario('cedo').getByRole('button', { name: /Reservar/ }).count(), 1, 'a outra turma voltou a ser oferecida');

  const emails = await emailsPara(aluna.email);
  assert.equal(emails.length, 3);
  assert.equal(emails[2].asunto, `Reserva cancelada: ${TEMA}`);
  assert.equal(emails[2].texto.includes(SALA), false, 'o e-mail de cancelamento não leva o link da sala');
  const sessao = await sessaoDe(aluna);
  const { data: minhas } = await sessao.rpc('minhas_reservas');
  assert.deepEqual(minhas.map((r) => r.turma_id), [turmas.tarde], 'o link da turma cancelada não chega mais');
});

test('faltando menos que o prazo, a reserva não pode ser cancelada, nem pelo banco', async () => {
  const sessao = await sessaoDe(colega);
  const reserva = await sessao.rpc('reservar_turma', { p_turma: turmas.hoje });
  assert.equal(reserva.error, null, reserva.error?.message);
  assert.match((await sessao.rpc('cancelar_reserva', { p_reserva: reserva.data.id })).error?.message ?? '', /cancelamento_fora_do_prazo/);

  const dela = await novaPagina(navegador);
  await entrar(dela, colega.email, senha);
  await dela.waitForURL('**/inicio');
  await dela.goto(`${base}/conversacion`);
  const minha = dela.locator('#mis-reservas li').filter({ hasText: TEMA_DE_HOJE });
  await minha.getByText('El plazo para cancelar ya pasó.').waitFor();
  assert.equal(await minha.getByRole('button').count(), 0);
  assert.equal(await minha.getByRole('link', { name: 'Entrar a la clase' }).getAttribute('href'), SALA);
  await dela.context().close();
});

test('avaliar a aula que já aconteceu: sem nota não vai; com nota e comentário, fica registrada', async () => {
  const dela = await novaPagina(navegador);
  await entrar(dela, colega.email, senha);
  await dela.waitForURL('**/inicio');
  await dela.goto(`${base}/conversacion`);
  const anterior = dela.locator('#anteriores li').filter({ hasText: TEMA_DE_HOJE });
  await anterior.getByRole('button', { name: 'Enviar valoración' }).click();
  await dela.waitForURL('**/conversacion?*aviso=nota');
  assert.equal(await textoDoAviso(dela), 'Elige una nota de 1 a 5.');

  const formulario = dela.locator('#anteriores li').filter({ hasText: TEMA_DE_HOJE });
  await formulario.locator('label').filter({ hasText: /^5$/ }).click();
  await formulario.getByLabel('Comentario (opcional)').fill('Aprendí mucho.');
  await formulario.getByRole('button', { name: 'Enviar valoración' }).click();
  await dela.waitForURL('**/conversacion?*aviso=valorada');
  assert.equal(await textoDoAviso(dela, 'status'), '¡Gracias por tu valoración!');
  await dela.locator('#anteriores').getByText('Tu valoración: 5 de 5').waitFor();
  assert.equal(await dela.locator('#anteriores').getByRole('button', { name: 'Enviar valoración' }).count(), 0);
  const { data } = await admin.from('avaliacoes').select('nota, comentario, reservas!inner(aluno_id, turma_id)').eq('reservas.aluno_id', colegaId);
  assert.deepEqual(data.map((a) => [a.nota, a.comentario, a.reservas.turma_id]), [[5, 'Aprendí mucho.', turmas.passada]]);
  await dela.context().close();

  // A aula de daqui a uma hora ainda não pode ser avaliada.
  const sessao = await sessaoDe(colega);
  const { data: minhas } = await sessao.rpc('minhas_reservas');
  const futura = minhas.find((r) => r.turma_id === turmas.hoje);
  assert.match((await sessao.rpc('avaliar_aula', { p_reserva: futura.reserva_id, p_nota: 5 })).error?.message ?? '', /aula_ainda_nao_terminou/);
});

test('a equipe vê a agenda como o aluno, sem reservar', async () => {
  const dele = await novaPagina(navegador);
  await entrar(dele, professor.email, senha);
  await dele.waitForURL('**/admin');
  await abrirODia(dele);
  await dele.getByText('Vista previa del equipo: ves la agenda como un alumno, pero no puedes reservar.').waitFor();
  await horario('cedo', dele).waitFor();
  assert.equal(await dele.getByRole('button', { name: /Reservar/ }).count(), 0);
  assert.equal(await dele.getByRole('heading', { name: 'Mis reservas' }).count(), 0);
  assert.equal((await dele.content()).includes(SALA), false);
  await dele.context().close();
});

test('aparelho em outro fuso: a tela oferece trocar, e os horários passam a ser os de lá', async () => {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'America/Bogota' });
  const dela = await contexto.newPage();
  await entrar(dela, aluna.email, senha);
  await dela.waitForURL('**/inicio');
  await abrirODia(dela);
  await dela.getByText('Tu dispositivo está en otra zona horaria: America/Bogota').waitFor();
  await dela.getByRole('button', { name: 'Usar esta zona' }).click();
  await dela.waitForURL(`**/conversacion?dia=${DIA}&aviso=zona`);
  assert.equal(await textoDoAviso(dela, 'status'), 'Zona horaria actualizada.');
  assert.equal((await admin.from('perfis').select('fuso').eq('id', alunaId).single()).data.fuso, 'America/Bogota');
  await dela.getByText('Horarios en tu zona horaria: Bogotá (GMT-5)').waitFor();
  assert.equal(await dela.getByText('Tu dispositivo está en otra zona horaria').count(), 0);
  const emBogota = horaEm(amanhaAs(20), 'America/Bogota');
  assert.match(await dela.locator('#mis-reservas li').filter({ hasText: TEMA }).innerText(), new RegExp(emBogota));
  await contexto.close();
});

test('Mi cuenta: nome e fuso são guardados; a senha só troca com as duas iguais e 8 letras ou mais', async () => {
  await pagina.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Mi cuenta' }).click();
  await pagina.waitForURL('**/cuenta');
  assert.equal(await pagina.getByLabel('Zona horaria').inputValue(), 'America/Bogota');
  await pagina.getByText(aluna.email).waitFor();

  await pagina.getByLabel('Tu nombre').fill('');
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await pagina.waitForURL('**/cuenta?error=nombre');
  assert.equal(await textoDoAviso(pagina), 'Escribe tu nombre.');
  await pagina.getByLabel('Tu nombre').fill(`  Rosa   Reserva Ruiz ${sufixo} `);
  await pagina.getByLabel('Zona horaria').selectOption('Europe/Madrid');
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await pagina.waitForURL('**/cuenta?aviso=guardado');
  assert.deepEqual((await admin.from('perfis').select('nome, fuso, papel').eq('id', alunaId).single()).data, {
    nome: `Rosa Reserva Ruiz ${sufixo}`, fuso: 'Europe/Madrid', papel: 'aluno',
  });

  const trocar = async (nueva, repetida) => {
    await pagina.getByLabel('Contraseña nueva').fill(nueva);
    await pagina.getByLabel('Repite la contraseña').fill(repetida);
    await pagina.getByRole('button', { name: 'Cambiar contraseña' }).click();
  };
  // O navegador já barra senha curta; tirando essa barreira, quem recusa é o servidor.
  await pagina.evaluate(() => document.querySelectorAll('input[minlength]').forEach((campo) => campo.removeAttribute('minlength')));
  await trocar('curta', 'curta');
  await pagina.waitForURL('**/cuenta?error=corta#clave');
  assert.equal(await textoDoAviso(pagina), 'La contraseña debe tener al menos 8 caracteres.');
  await trocar('senha-nova-da-rosa', 'senha-diferente');
  await pagina.waitForURL('**/cuenta?error=distintas#clave');
  await trocar('senha-nova-da-rosa', 'senha-nova-da-rosa');
  await pagina.waitForURL('**/cuenta?aviso=clave');
  assert.equal(await textoDoAviso(pagina, 'status'), 'Contraseña cambiada.');
  await sessaoDe(aluna, 'senha-nova-da-rosa');
  const antiga = await clientePublico().auth.signInWithPassword({ email: aluna.email, password: senha });
  assert.notEqual(antiga.error, null, 'a senha antiga deixa de valer');

  // Pelo banco, a aluna não muda o próprio papel nem o e-mail, e fuso que não existe é recusado.
  const sessao = await sessaoDe(aluna, 'senha-nova-da-rosa');
  assert.notEqual((await sessao.from('perfis').update({ papel: 'admin' }).eq('id', alunaId)).error, null);
  assert.notEqual((await sessao.from('perfis').update({ fuso: 'Lugar/Inexistente' }).eq('id', alunaId)).error, null);
  await pagina.screenshot({ path: 'capturas/aluno-cuenta-computador.png', fullPage: true });
});

test('no celular, a conversação e a conta cabem na largura', async () => {
  const contexto = await novoContexto(navegador, 390, 844);
  const celular = await contexto.newPage();
  await entrar(celular, aluna.email, 'senha-nova-da-rosa');
  await celular.waitForURL('**/inicio');
  for (const [nome, rota] of [['conversacion', `/conversacion?dia=${DIA}`], ['cuenta', '/cuenta'], ['inicio-con-menu', '/inicio']]) {
    await celular.goto(`${base}${rota}`, { waitUntil: 'networkidle' });
    const sobra = await celular.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(sobra <= 0, `${rota} passa ${sobra}px da largura no celular`);
    await celular.screenshot({ path: `capturas/aluno-${nome}-celular.png`, fullPage: true });
  }
  await contexto.close();
});
