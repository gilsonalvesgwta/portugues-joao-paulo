// Teste de ponta a ponta da jornada inteira de uma aluna, do jeito que acontece de verdade, em
// sequência e pelas telas: a compra na Greenn cria a conta, o e-mail traz o link, ela cria a
// senha, assiste à aula, faz o quiz, o dia vira, reserva uma aula ao vivo, muda o fuso; o
// administrador a vê nas telas dele; e o reembolso tira o acesso e solta a reserva.
import assert from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { admin, base, caminho, confirmarZona, criarPessoa, emailDeTeste, emailsPara, entrar, linkDoEmail, novaPagina, senha, textoDoAviso } from './apoio.mjs';

const SEGREDO = process.env.GREENN_WEBHOOK_SEGREDO ?? '';
const sufixo = randomBytes(3).toString('hex');
const administrador = { email: emailDeTeste('admin-jornada'), nome: `Admin Jornada ${sufixo}`, papel: 'admin' };
const aluna = { email: emailDeTeste('aluna-jornada'), nome: `Julia Jornada ${sufixo}` };
const SENHA_DELA = 'senha-da-julia-123';
const CURSO = `Portugués para viajar ${sufixo}`;
const A1 = `En el aeropuerto ${sufixo}`;
const A2 = `En el hotel ${sufixo}`;
const TEMA = `Pedir un café ${sufixo}`;
const SALA = `https://meet.google.com/jornada-${sufixo}`;
const GUIA = `Guía del viajero ${sufixo}`;
const produto = randomInt(100_000_000, 999_999_999);
const numeroDaVenda = randomInt(100_000_000, 999_999_999);

let navegador;
let pagina; // a aluna
let doAdmin; // o administrador
let cursoId;
let turmaId;
let alunaId;
let ids;

async function criar(tabela, linha) {
  const { data, error } = await admin.from(tabela).insert(linha).select('id').single();
  assert.equal(error, null, `${tabela}: ${error?.message}`);
  return data.id;
}

function venda(status) {
  return {
    oldStatus: 'waiting_payment', currentStatus: status, type: 'sale', event: 'saleUpdated',
    product: { id: produto, name: `Curso ${sufixo}`, type: 'TRANSACTION', amount: 297 },
    sale: { id: numeroDaVenda, status, method: 'CREDIT_CARD', amount: 297, installments: 1 },
    client: { id: 7, name: aluna.nome, email: aluna.email, cellphone: '+34600000000', cpf_cnpj: '00000000000', city: 'Madrid' },
  };
}

async function avisar(corpo) {
  const resposta = await fetch(`${base}/api/greenn/${SEGREDO}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  return { status: resposta.status, ...(await resposta.json()) };
}

before(async () => {
  navegador = await chromium.launch();
  await criarPessoa(administrador);

  cursoId = await criar('cursos', { titulo_pt: `Português para viajar ${sufixo}`, titulo_es: CURSO, situacao: 'publicado', modo: 'sequencial' });
  const moduloId = await criar('modulos', { curso_id: cursoId, ordem: 1, titulo_pt: `Chegada ${sufixo}`, titulo_es: `Llegada ${sufixo}` });
  const aula = (numero, titulo) =>
    criar('aulas', { modulo_id: moduloId, numero, titulo_pt: `${titulo} (pt)`, titulo_es: titulo, video_id: 'aB3dE6gH9jK', situacao: 'publicado', duracao_seg: 480 });
  ids = { aula1: await aula(1, A1), aula2: await aula(2, A2) };
  ids.quiz = await criar('quizzes', { aula_id: ids.aula1, situacao: 'publicado', nota_minima: 70 });
  await criar('perguntas', { quiz_id: ids.quiz, ordem: 1, tipo: 'multipla_escolha', conteudo: { enunciado: '¿Cómo se dice "equipaje"?', opcoes: ['bagagem', 'passagem'], correta: 0 } });
  await criar('perguntas', { quiz_id: ids.quiz, ordem: 2, tipo: 'completar', conteudo: { frase: 'Onde ___ o portão?', opcoes: ['fica', 'tem'], correta: 0 } });
  const dia1 = await criar('dias_trilha', { curso_id: cursoId, numero: 1 });
  const dia2 = await criar('dias_trilha', { curso_id: cursoId, numero: 2 });
  await criar('itens_dia', { dia_id: dia1, ordem: 1, tipo: 'aula', aula_id: ids.aula1 });
  await criar('itens_dia', { dia_id: dia1, ordem: 2, tipo: 'quiz', quiz_id: ids.quiz });
  await criar('itens_dia', { dia_id: dia2, ordem: 1, tipo: 'aula', aula_id: ids.aula2 });
  await criar('materiais', { curso_id: cursoId, titulo_pt: 'Guia do viajante', titulo_es: GUIA, link: 'https://exemplo.test/guia.pdf', ordem: 1 });
  await criar('ofertas', { greenn_product_id: produto, curso_id: cursoId, nome: `Oferta ${sufixo}`, dias_de_acesso: 365, inclui_conversacao: true, reservas_por_semana: 2 });

  const temaId = await criar('temas_conversacao', { titulo_es: TEMA, nivel: 'basico', descricao_es: 'Pedir y pagar en una cafetería.' });
  turmaId = await criar('turmas', { tema_id: temaId, inicio: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(), duracao_min: 60, vagas: 6, meet_url: SALA });

  pagina = await novaPagina(navegador);
  doAdmin = await novaPagina(navegador);
  await entrar(doAdmin, administrador.email, senha);
  await doAdmin.waitForURL('**/admin');
});

after(async () => {
  await navegador?.close();
});

test('1. a compra na Greenn cria a conta, a matrícula de um ano e manda o e-mail com o link', async () => {
  assert.deepEqual(await avisar(venda('paid')), { status: 200, ok: true, resultado: 'acesso_liberado' });

  const { data: perfil } = await admin.from('perfis').select('id, nome, papel').eq('email', aluna.email).single();
  assert.deepEqual([perfil.nome, perfil.papel], [aluna.nome, 'aluno']);
  alunaId = perfil.id;
  const { data: matricula } = await admin.from('matriculas').select('situacao, origem, expira_em, inclui_conversacao, reservas_por_semana').eq('aluno_id', alunaId).single();
  assert.deepEqual([matricula.situacao, matricula.origem, matricula.inclui_conversacao, matricula.reservas_por_semana], ['ativa', 'greenn', true, 2]);
  const dias = (new Date(matricula.expira_em).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  assert.ok(dias > 364 && dias <= 365, `o acesso vale um ano (${dias.toFixed(1)} dias)`);

  const emails = await emailsPara(aluna.email);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].asunto, 'Tu acceso al curso de portugués');
  assert.ok(emails[0].texto.includes('Tu compra está confirmada'));
});

test('2. ela abre o link do e-mail, cria a senha e cai no curso, no dia 1', async () => {
  await pagina.goto(linkDoEmail((await emailsPara(aluna.email))[0]));
  await pagina.getByRole('button', { name: 'Continuar' }).click();
  await pagina.waitForURL('**/nueva-contrasena');
  await pagina.getByLabel('Contraseña nueva', { exact: true }).fill(SENHA_DELA);
  await pagina.getByLabel('Repite la contraseña', { exact: true }).fill(SENHA_DELA);
  await pagina.getByRole('button', { name: 'Guardar y entrar' }).click();
  // A primeira tela é a confirmação do fuso horário: ela confirma o de Madri e só então vê o curso.
  await confirmarZona(pagina, 'Europe/Madrid');

  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), 'Hola, Julia');
  await pagina.getByRole('heading', { name: CURSO }).waitFor();
  assert.match(await pagina.locator('#hoy').innerText(), /Día 1 de 2/);
  await pagina.getByText('0 de 2 clases vistas').waitFor();
  assert.equal(await pagina.locator('#materiales').getByRole('link', { name: new RegExp(GUIA) }).getAttribute('href'), 'https://exemplo.test/guia.pdf');
  // A aula do dia 2 ainda está fechada.
  assert.equal(await pagina.getByRole('link', { name: A2 }).count(), 0);
});

test('3. assiste à aula 1, faz o quiz e é aprovada: o dia vira e a aula 2 abre', async () => {
  await pagina.locator('#hoy').getByRole('link', { name: new RegExp(`Ver la clase 1: ${A1}`) }).click();
  await pagina.waitForURL(`**/clase/${ids.aula1}`);
  await pagina.getByRole('button', { name: 'Marcar la clase como vista' }).click();
  await pagina.getByText('Clase vista', { exact: true }).waitFor();

  await pagina.getByRole('link', { name: 'Hacer el quiz' }).click();
  await pagina.waitForURL(`**/quiz/${ids.quiz}`);
  await pagina.getByRole('radio', { name: 'bagagem' }).check();
  await pagina.getByRole('radio', { name: 'fica', exact: true }).check();
  await pagina.getByRole('button', { name: 'Corregir mis respuestas' }).click();
  await pagina.locator('form[data-vez="1"]').waitFor();
  await pagina.getByText('2 de 2 · 100 %').waitFor();
  await pagina.getByText('¡Aprobado!').waitFor();
  const { data: tentativas } = await admin.from('tentativas_quiz').select('acertos, total').eq('aluno_id', alunaId);
  assert.deepEqual(tentativas, [{ acertos: 2, total: 2 }]);

  await pagina.goto(`${base}/inicio`);
  assert.match(await pagina.locator('#hoy').innerText(), /Día 2 de 2/);
  await pagina.getByText('1 de 2 clases vistas').waitFor();
  await pagina.locator('#hoy').getByRole('link', { name: new RegExp(`Ver la clase 2: ${A2}`) }).click();
  await pagina.waitForURL(`**/clase/${ids.aula2}`);
  await pagina.getByRole('heading', { level: 1, name: A2 }).waitFor();
});

test('4. reserva a aula ao vivo e recebe o link da sala na tela e no e-mail', async () => {
  await pagina.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Conversación' }).click();
  await pagina.waitForURL('**/conversacion');
  // A turma é daqui a 26 horas: abre o dia dela (no fuso do cadastro, Madri).
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(Date.now() + 26 * 60 * 60 * 1000));
  await pagina.goto(`${base}/conversacion?dia=${dia}`);
  const horario = pagina.locator('#agenda li').filter({ hasText: TEMA });
  await horario.getByText('6 plazas').waitFor();
  await horario.getByRole('button', { name: /Reservar/ }).click();
  await pagina.waitForURL('**/conversacion?*aviso=reservada');
  assert.equal(await textoDoAviso(pagina, 'status'), 'Reserva confirmada. Te enviamos el enlace de la clase por correo.');
  assert.equal(await pagina.locator('#mis-reservas li').filter({ hasText: TEMA }).getByRole('link', { name: 'Entrar a la clase' }).getAttribute('href'), SALA);

  const emails = await emailsPara(aluna.email);
  assert.equal(emails.length, 2);
  assert.equal(emails[1].asunto, `Reserva confirmada: ${TEMA}`);
  assert.ok(emails[1].texto.includes(SALA));
});

test('5. muda o fuso em «Mi cuenta» e a agenda passa a mostrar a hora de lá', async () => {
  await pagina.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Mi cuenta' }).click();
  await pagina.waitForURL('**/cuenta');
  await pagina.getByLabel('Zona horaria').selectOption('America/Mexico_City');
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await pagina.waitForURL('**/cuenta?aviso=guardado');
  await pagina.goto(`${base}/conversacion`);
  await pagina.getByText(/Horarios en tu zona horaria: Ciudad de México \(GMT-6\)/).waitFor();
});

test('6. o administrador vê a aluna, a compra e a reserva nas telas dele', async () => {
  await doAdmin.goto(`${base}/admin/alunos?q=${encodeURIComponent(aluna.email)}`);
  const linha = doAdmin.locator('main tr, main li').filter({ hasText: aluna.email });
  await linha.first().waitFor();
  assert.match(await linha.first().innerText(), new RegExp(aluna.nome));

  await doAdmin.goto(`${base}/admin/alunos/${alunaId}`);
  await doAdmin.getByRole('heading', { level: 1, name: aluna.nome }).waitFor();
  const matricula = doAdmin.getByRole('form', { name: `Matrícula em Português para viajar ${sufixo}` });
  await matricula.waitFor();
  assert.match(await doAdmin.locator('main').innerText(), /Greenn/);

  await doAdmin.goto(`${base}/admin/pagamentos?ver=todos`);
  const aviso = doAdmin.locator('main tbody tr').filter({ hasText: aluna.email });
  assert.match(await aviso.first().innerText(), /Processado/);

  await doAdmin.goto(`${base}/admin/conversacao/turmas/${turmaId}`);
  await doAdmin.getByRole('heading', { name: 'Inscritos: 1 de 6' }).waitFor();
  await doAdmin.getByText(aluna.nome).first().waitFor();
});

test('7. o reembolso tira o acesso na hora e solta a reserva da aula que ainda não aconteceu', async () => {
  assert.deepEqual(await avisar(venda('refunded')), { status: 200, ok: true, resultado: 'acesso_encerrado' });
  const { data: reservas } = await admin.from('reservas').select('situacao').eq('aluno_id', alunaId);
  assert.deepEqual(reservas, [{ situacao: 'cancelada' }]);

  await pagina.goto(`${base}/inicio`);
  await pagina.getByRole('heading', { name: 'Todavía no tienes un curso activo' }).waitFor();
  await pagina.goto(`${base}/conversacion`);
  await pagina.getByRole('heading', { name: 'Tu acceso no incluye clases de conversación' }).waitFor();
  await pagina.goto(`${base}/clase/${ids.aula1}`);
  await pagina.waitForURL('**/inicio?aviso=no_encontrada');

  await doAdmin.goto(`${base}/admin/conversacao/turmas/${turmaId}`);
  await doAdmin.getByRole('heading', { name: 'Inscritos: 0 de 6' }).waitFor();
});

test('8. ela sai, e a senha continua sendo a porta de entrada', async () => {
  await pagina.getByRole('button', { name: 'Salir' }).click();
  await pagina.waitForURL('**/entrar');
  await pagina.goto(`${base}/inicio`);
  assert.equal(caminho(pagina), '/entrar');
  await entrar(pagina, aluna.email, SENHA_DELA);
  await pagina.waitForURL('**/inicio');
  await pagina.getByRole('heading', { name: 'Todavía no tienes un curso activo' }).waitFor();
});
