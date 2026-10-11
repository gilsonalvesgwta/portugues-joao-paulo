// Teste de ponta a ponta da conversação na administração: o professor cria temas e turmas, vê
// os inscritos, marca presença e cancela uma turma (os inscritos são avisados por e-mail); o
// link da sala só chega a quem reservou.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import {
  admin, base, caminho, clientePublico, criarPessoa, emailDeTeste, emailsPara, entrar, novaPagina, novoContexto, senha, textoDoAviso,
} from './apoio.mjs';

const sufixo = randomBytes(3).toString('hex');
const professor = { email: emailDeTeste('professor-conversa'), nome: `Professor Conversa ${sufixo}`, papel: 'professor' };
const administrador = { email: emailDeTeste('admin-conversa'), nome: `Admin Conversa ${sufixo}`, papel: 'admin' };
const aluna = { email: emailDeTeste('aluna-conversa'), nome: `Carla Conversa ${sufixo}` };
const TEMA = `En el restaurante ${sufixo}`;
const TEMA2 = `De compras ${sufixo}`;
const SALA = `https://meet.google.com/abc-${sufixo}`;
const HORA_MS = 60 * 60 * 1000;
// Amanhã, no relógio de Brasília, às 20:00 (23:00 no relógio universal).
const amanha = new Date(Date.now() - 3 * HORA_MS + 24 * HORA_MS).toISOString().slice(0, 10);
const inicioEsperado = `${amanha}T23:00:00.000Z`;

let navegador;
let pagina; // o professor, logado do começo ao fim
let alunaId;
let temaId;
let turmaId;
let aoPerguntar = 'aceitar';

const campo = (rotulo) => pagina.getByLabel(rotulo, { exact: true });
const linhaDaTurma = (tema) => pagina.locator('main tbody tr').filter({ hasText: tema });

async function criar(tabela, linha) {
  const { data, error } = await admin.from(tabela).insert(linha).select('id').single();
  assert.equal(error, null, `${tabela}: ${error?.message}`);
  return data.id;
}

async function turmaNoBanco(id = turmaId) {
  const { data, error } = await admin.from('turmas').select('tema_id, inicio, duracao_min, vagas, meet_url, situacao').eq('id', id).single();
  assert.equal(error, null, error?.message);
  return { ...data, inicio: new Date(data.inicio).toISOString() };
}

async function comoAluna() {
  const sessao = clientePublico();
  const { error } = await sessao.auth.signInWithPassword({ email: aluna.email, password: senha });
  assert.equal(error, null, error?.message);
  return sessao;
}

before(async () => {
  await mkdir('capturas', { recursive: true });
  navegador = await chromium.launch();
  await criarPessoa(professor);
  await criarPessoa(administrador);
  alunaId = await criarPessoa(aluna);
  const cursoId = await criar('cursos', { titulo_pt: `Curso da conversa ${sufixo}`, titulo_es: `Curso de conversación ${sufixo}`, situacao: 'publicado' });
  await criar('matriculas', { aluno_id: alunaId, curso_id: cursoId, origem: 'manual', inclui_conversacao: true, reservas_por_semana: 5 });

  pagina = await novaPagina(navegador);
  pagina.on('dialog', (janela) => (aoPerguntar === 'aceitar' ? janela.accept() : janela.dismiss()));
  await entrar(pagina, professor.email, senha);
  await pagina.waitForURL('**/admin');
});

after(async () => {
  await navegador?.close();
});

test('tema: os erros são apontados; depois o tema é criado e editado', async () => {
  await pagina.getByRole('navigation', { name: 'Administração' }).getByRole('link', { name: 'Conversação' }).click();
  await pagina.waitForURL('**/admin/conversacao');
  await pagina.getByRole('link', { name: 'Temas', exact: true }).click();
  await pagina.waitForURL('**/admin/conversacao/temas');
  await pagina.getByRole('link', { name: 'Novo tema' }).click();
  await pagina.waitForURL('**/admin/conversacao/temas/novo');

  await campo('Material da aula (link, opcional)').fill('http://exemplo.com/sem-https.pdf');
  await pagina.getByRole('button', { name: 'Salvar tema' }).click();
  await pagina.locator('form[data-vez="1"]').waitFor();
  await pagina.getByText('Escreva o título do tema, em espanhol.').waitFor();
  await pagina.getByText('Cole um link que comece com https://, sem espaços, ou deixe em branco.').waitFor();

  await campo('Título do tema (em espanhol)').fill(TEMA);
  await campo('Nível').selectOption('intermediario');
  await campo('Descrição (em espanhol, opcional)').fill('Pedir, pagar y dejar propina.');
  await campo('O que o aluno vai aprender (em espanhol, opcional)').fill('Vocabulario práctico\n\n  Pedir la cuenta  ');
  await campo('Material da aula (link, opcional)').fill('exemplo.test/guia.pdf');
  await pagina.getByRole('button', { name: 'Salvar tema' }).click();
  await pagina.waitForURL('**/admin/conversacao/temas?aviso=tema_salvo');
  assert.equal(await textoDoAviso(pagina, 'status'), 'Tema salvo.');

  const { data: tema } = await admin.from('temas_conversacao').select('id, nivel, descricao_es, aprendizados, material, arquivado_em').eq('titulo_es', TEMA).single();
  temaId = tema.id;
  assert.deepEqual({ ...tema, id: undefined }, {
    id: undefined, nivel: 'intermediario', descricao_es: 'Pedir, pagar y dejar propina.', aprendizados: ['Vocabulario práctico', 'Pedir la cuenta'],
    material: 'https://exemplo.test/guia.pdf', arquivado_em: null,
  });

  await pagina.getByRole('link', { name: `Editar o tema ${TEMA}` }).click();
  await pagina.waitForURL(`**/admin/conversacao/temas/${temaId}`);
  assert.equal(await campo('O que o aluno vai aprender (em espanhol, opcional)').inputValue(), 'Vocabulario práctico\nPedir la cuenta');
  await campo('Nível').selectOption('basico');
  await pagina.getByRole('button', { name: 'Salvar tema' }).click();
  await pagina.waitForURL('**/admin/conversacao/temas?aviso=tema_salvo');
  const item = pagina.locator('main li').filter({ hasText: TEMA });
  assert.match(await item.innerText(), /Básico/);
});

test('turma: sem data e sem link não é criada; depois entra na lista, no horário de Brasília', async () => {
  await pagina.goto(`${base}/admin/conversacao`);
  await pagina.getByRole('link', { name: 'Nova turma' }).click();
  await pagina.waitForURL('**/admin/conversacao/turmas/nova');
  await campo('Tema').selectOption(temaId);
  await pagina.getByRole('button', { name: 'Criar turma' }).click();
  await pagina.locator('form[data-vez="1"]').waitFor();
  await pagina.getByText('Escolha a data e a hora da aula.').waitFor();
  await pagina.getByText('Cole o link da sala (Google Meet). Ele vai no e-mail de quem reservar.').waitFor();
  assert.equal(await campo('Tema').inputValue(), temaId, 'o tema escolhido continua escolhido');

  await campo('Data').fill('2020-01-31');
  await campo('Hora (horário de Brasília)').fill('20:00');
  await campo('Link da sala (Google Meet)').fill(SALA.replace('https://', ''));
  await pagina.getByRole('button', { name: 'Criar turma' }).click();
  await pagina.getByText('Essa data e hora já passaram. Escolha um horário no futuro.').waitFor();

  await campo('Data').fill(amanha);
  await pagina.getByRole('button', { name: 'Criar turma' }).click();
  await pagina.waitForURL('**/admin/conversacao?aviso=turma_criada');
  assert.equal(await textoDoAviso(pagina, 'status'), 'Turma criada. Ela já aparece na agenda dos alunos.');

  const { data } = await admin.from('turmas').select('id').eq('tema_id', temaId).single();
  turmaId = data.id;
  assert.deepEqual(await turmaNoBanco(), { tema_id: temaId, inicio: inicioEsperado, duracao_min: 60, vagas: 10, meet_url: SALA, situacao: 'aberta' });
  const linha = linhaDaTurma(TEMA);
  assert.match(await linha.innerText(), /, 20:00/);
  assert.match(await linha.innerText(), /0 de 10/);
  assert.match(await linha.innerText(), /Aberta para reserva/);
  await pagina.screenshot({ path: 'capturas/admin-conversacao-computador.png', fullPage: true });
});

test('a turma mostra como o aluno vê o horário, e os dados são editados enquanto ninguém reservou', async () => {
  await linhaDaTurma(TEMA).getByRole('link', { name: /Abrir/ }).click();
  await pagina.waitForURL(`**/admin/conversacao/turmas/${turmaId}`);
  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), TEMA);
  const cidades = await pagina.locator('main dl > div').evaluateAll((lista) => Object.fromEntries(lista.map((d) => [d.querySelector('dt').textContent, d.querySelector('dd').textContent])));
  assert.equal(cidades['Buenos Aires'], '20:00');
  assert.equal(cidades['Bogotá'], '18:00');
  assert.match(cidades.Madri, /\(dia seguinte\)$/);
  await pagina.getByText('Ninguém reservou esta turma ainda.').waitFor();

  assert.equal(await campo('Data').inputValue(), amanha);
  assert.equal(await campo('Hora (horário de Brasília)').inputValue(), '20:00');
  await campo('Hora (horário de Brasília)').fill('21:30');
  await campo('Vagas').fill('2');
  await pagina.getByRole('button', { name: 'Salvar turma' }).click();
  await pagina.waitForURL('**/admin/conversacao?aviso=turma_salva');
  const salva = await turmaNoBanco();
  // 21:30 em Brasília já é 00:30 do dia seguinte no relógio universal.
  const diaSeguinte = new Date(Date.parse(`${amanha}T00:00:00Z`) + 24 * HORA_MS).toISOString().slice(0, 10);
  assert.equal(salva.inicio, `${diaSeguinte}T00:30:00.000Z`);
  assert.equal(salva.vagas, 2);
});

test('o link da sala não é lido na tabela: só chega à aluna pela reserva dela', async () => {
  const sessao = await comoAluna();
  assert.notEqual((await sessao.from('turmas').select('meet_url').eq('id', turmaId)).error, null, 'pedir o link direto é recusado');
  assert.notEqual((await sessao.from('turmas').select('*').eq('id', turmaId)).error, null);
  assert.deepEqual((await sessao.from('turmas').select('id, vagas').eq('id', turmaId)).data, [{ id: turmaId, vagas: 2 }], 'os outros dados da turma ela lê');
  assert.deepEqual((await sessao.rpc('minhas_reservas')).data, []);
  for (const funcao of ['lista_de_turmas', 'turma_da_equipe', 'cancelar_turma']) {
    const dados = funcao === 'lista_de_turmas' ? { p_quando: 'proximas', p_limite: 10, p_pulo: 0 } : { p_turma: turmaId };
    assert.notEqual((await sessao.rpc(funcao, dados)).error, null, funcao);
  }

  const reserva = await sessao.rpc('reservar_turma', { p_turma: turmaId });
  assert.equal(reserva.error, null, reserva.error?.message);
  const { data: minhas } = await sessao.rpc('minhas_reservas');
  assert.equal(minhas.length, 1);
  assert.deepEqual({ sala: minhas[0].meet_url, tema: minhas[0].titulo_es, material: minhas[0].material }, { sala: SALA, tema: TEMA, material: 'https://exemplo.test/guia.pdf' });
});

test('com gente inscrita: o professor vê quem reservou, e a data e o tema não mudam mais', async () => {
  await pagina.goto(`${base}/admin/conversacao/turmas/${turmaId}`);
  await pagina.getByRole('heading', { name: 'Inscritos: 1 de 2' }).waitFor();
  const inscrita = pagina.locator('main li').filter({ hasText: aluna.email });
  assert.match(await inscrita.innerText(), new RegExp(aluna.nome));
  assert.equal(await inscrita.getByRole('link').count(), 0, 'o professor não tem a ficha do aluno');
  await pagina.getByText('Já há gente inscrita: o tema, a data e a hora não mudam mais.').waitFor();
  assert.equal(await campo('Data').count(), 0);
  assert.equal(await campo('Tema').count(), 0);
  await pagina.getByText('A presença pode ser marcada a partir do início da aula.').waitFor();
  assert.equal(await pagina.getByRole('button', { name: /como presente/ }).count(), 0);

  const antes = await turmaNoBanco();
  await campo('Vagas').fill('abc');
  await pagina.getByRole('button', { name: 'Salvar turma' }).click();
  await pagina.getByText('Escreva o número de vagas, de 1 a 100.').waitFor();
  await campo('Vagas').fill('12');
  await campo('Link da sala (Google Meet)').fill(`${SALA}-nova`);
  await pagina.getByRole('button', { name: 'Salvar turma' }).click();
  await pagina.waitForURL('**/admin/conversacao?aviso=turma_salva');
  assert.deepEqual(await turmaNoBanco(), { ...antes, vagas: 12, meet_url: `${SALA}-nova` });
  assert.match(await linhaDaTurma(TEMA).innerText(), /1 de 12/);
  await pagina.goto(`${base}/admin/conversacao/turmas/${turmaId}`);
  await pagina.screenshot({ path: 'capturas/admin-turma-computador.png', fullPage: true });
});

test('tema com turma marcada não é arquivado', async () => {
  await pagina.goto(`${base}/admin/conversacao/temas/${temaId}`);
  await pagina.getByRole('button', { name: 'Arquivar o tema' }).click();
  await pagina.waitForURL(`**/admin/conversacao/temas/${temaId}?aviso=tema_com_turmas`);
  assert.equal(await textoDoAviso(pagina), 'Este tema tem turmas marcadas. Cancele as turmas ou espere que aconteçam antes de arquivar.');
});

test('cancelar a turma: a pergunta protege; confirmando, a inscrita é avisada por e-mail e a reserva volta', async () => {
  await pagina.goto(`${base}/admin/conversacao/turmas/${turmaId}`);
  aoPerguntar = 'recusar';
  await pagina.getByRole('button', { name: 'Cancelar a turma' }).click();
  assert.equal((await turmaNoBanco()).situacao, 'aberta', 'recusando a pergunta, nada muda');
  aoPerguntar = 'aceitar';
  await pagina.getByRole('button', { name: 'Cancelar a turma' }).click();
  await pagina.waitForURL(`**/admin/conversacao/turmas/${turmaId}?aviso=turma_cancelada`);
  assert.equal(await textoDoAviso(pagina, 'status'), 'Turma cancelada. Quem estava inscrito foi avisado por e-mail e recebeu a reserva de volta.');
  assert.equal((await turmaNoBanco()).situacao, 'cancelada');
  const { data: reservas } = await admin.from('reservas').select('situacao').eq('turma_id', turmaId);
  assert.deepEqual(reservas, [{ situacao: 'cancelada' }]);

  const emails = await emailsPara(aluna.email);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].asunto, `Clase cancelada: ${TEMA}`);
  assert.ok(emails[0].texto.includes('fue cancelada por el profesor'));
  assert.ok(emails[0].texto.includes(`${base}/conversacion`));
  const { data: aviso } = await admin.from('notificacoes').select('tipo, enviada_em, erro').eq('aluno_id', alunaId).eq('tipo', 'clase_cancelada');
  assert.equal(aviso.length, 1);
  assert.notEqual(aviso[0].enviada_em, null);

  // A tela passa a mostrar a turma como cancelada, sem formulário e sem o botão de cancelar.
  await pagina.getByText('Cancelada', { exact: true }).waitFor();
  assert.equal(await pagina.getByRole('button', { name: 'Salvar turma' }).count(), 0);
  assert.equal(await pagina.getByRole('button', { name: 'Cancelar a turma' }).count(), 0);
  const sessao = await comoAluna();
  assert.deepEqual((await sessao.rpc('minhas_reservas')).data, [], 'a aluna deixa de ter a reserva e o link');

  await pagina.goto(`${base}/admin/conversacao?ver=passadas`);
  assert.match(await linhaDaTurma(TEMA).innerText(), /Cancelada/);
  await pagina.goto(`${base}/admin/conversacao`);
  assert.equal(await linhaDaTurma(TEMA).count(), 0, 'saiu das próximas');
});

test('sem turma marcada, o tema é arquivado, some da escolha de turma nova e volta ao restaurar', async () => {
  await pagina.goto(`${base}/admin/conversacao/temas/${temaId}`);
  await pagina.getByRole('button', { name: 'Arquivar o tema' }).click();
  await pagina.waitForURL('**/admin/conversacao/temas?aviso=tema_arquivado');
  assert.match(await pagina.locator('main li').filter({ hasText: TEMA }).innerText(), /Arquivado/);

  await criar('temas_conversacao', { titulo_es: TEMA2, nivel: 'avancado' });
  await pagina.goto(`${base}/admin/conversacao/turmas/nova`);
  const opcoes = await campo('Tema').locator('option').allInnerTexts();
  assert.equal(opcoes.some((texto) => texto.includes(TEMA)), false);
  assert.equal(opcoes.some((texto) => texto === `${TEMA2} · Avançado`), true);

  await pagina.goto(`${base}/admin/conversacao/temas/${temaId}`);
  await pagina.getByRole('button', { name: 'Restaurar o tema' }).click();
  await pagina.waitForURL('**/admin/conversacao/temas?aviso=tema_restaurado');
  const { data } = await admin.from('temas_conversacao').select('arquivado_em').eq('id', temaId).single();
  assert.equal(data.arquivado_em, null);
});

test('turma que já aconteceu: o professor marca presença e vê a avaliação; não dá mais para cancelar', async () => {
  const passada = await criar('turmas', { tema_id: temaId, inicio: new Date(Date.now() - 2 * HORA_MS).toISOString(), duracao_min: 60, vagas: 10, meet_url: SALA });
  const reservaId = await criar('reservas', { turma_id: passada, aluno_id: alunaId });
  await criar('avaliacoes', { reserva_id: reservaId, nota: 4, comentario: 'Muy dinámica' });

  await pagina.goto(`${base}/admin/conversacao?ver=passadas`);
  await linhaDaTurma(TEMA).filter({ hasText: 'Realizada' }).getByRole('link', { name: /Abrir/ }).click();
  await pagina.waitForURL(`**/admin/conversacao/turmas/${passada}`);
  await pagina.getByText('Avaliação: 4 de 5').waitFor();
  await pagina.getByText('“Muy dinámica”').waitFor();
  await pagina.getByText('Média das avaliações: 4,0 de 5 (1 avaliação).').waitFor();
  assert.equal(await pagina.getByRole('button', { name: 'Cancelar a turma' }).count(), 0);

  const presenca = async () => (await admin.from('reservas').select('presente').eq('id', reservaId).single()).data.presente;
  await pagina.getByRole('button', { name: `Marcar ${aluna.nome} como presente` }).click();
  await pagina.waitForURL(`**/admin/conversacao/turmas/${passada}?aviso=presenca_salva`);
  assert.equal(await textoDoAviso(pagina, 'status'), 'Presença salva.');
  assert.equal(await presenca(), true);
  assert.equal(await pagina.getByRole('button', { name: `Marcar ${aluna.nome} como presente` }).count(), 0);
  await pagina.getByRole('button', { name: `Marcar ${aluna.nome} como faltou` }).click();
  await pagina.getByRole('button', { name: `Marcar ${aluna.nome} como presente` }).waitFor();
  assert.equal(await presenca(), false);

  // Nem chamando o banco direto: turma que já aconteceu não é cancelada.
  const sessao = clientePublico();
  await sessao.auth.signInWithPassword({ email: professor.email, password: senha });
  assert.match((await sessao.rpc('cancelar_turma', { p_turma: passada })).error?.message ?? '', /turma_ja_aconteceu/);
});

test('regras de reserva: o professor só lê; o administrador muda, com os erros apontados', async () => {
  await pagina.goto(`${base}/admin/conversacao`);
  await pagina.getByText('Só o administrador muda estas regras.').waitFor();
  assert.equal(await pagina.getByRole('button', { name: 'Salvar regras' }).count(), 0);

  const dele = await novaPagina(navegador);
  await entrar(dele, administrador.email, senha);
  await dele.waitForURL('**/admin');
  await dele.goto(`${base}/admin/conversacao`);
  const regra = (rotulo) => dele.getByLabel(rotulo, { exact: true });
  const antes = (await admin.from('configuracoes').select('atualizado_em').eq('chave', 'agenda_janela_dias').single()).data.atualizado_em;
  const janela = await regra('Dias de agenda que o aluno vê').inputValue();
  await regra('Dias de agenda que o aluno vê').fill('0');
  await dele.getByRole('button', { name: 'Salvar regras' }).click();
  await dele.getByText('Escreva um número de 1 a 30.').waitFor();
  // Grava os mesmos valores: outros testes rodam ao mesmo tempo e contam com as regras como estão.
  await regra('Dias de agenda que o aluno vê').fill(janela);
  await dele.getByRole('button', { name: 'Salvar regras' }).click();
  await dele.waitForURL('**/admin/conversacao?aviso=configuracoes_salvas');
  const depois = (await admin.from('configuracoes').select('valor, atualizado_em').eq('chave', 'agenda_janela_dias').single()).data;
  assert.equal(String(depois.valor), janela);
  assert.notEqual(depois.atualizado_em, antes);
  await dele.context().close();

  const sessao = clientePublico();
  await sessao.auth.signInWithPassword({ email: professor.email, password: senha });
  const tentativa = await sessao.from('configuracoes').update({ valor: 99 }).eq('chave', 'agenda_janela_dias').select('chave');
  assert.deepEqual(tentativa.data ?? [], [], 'o professor não muda as regras nem pelo banco');
});

test('a aluna não abre as telas de conversação da equipe', async () => {
  const dela = await novaPagina(navegador);
  await entrar(dela, aluna.email, senha);
  await dela.waitForURL('**/inicio');
  for (const rota of ['/admin/conversacao', '/admin/conversacao/temas', `/admin/conversacao/turmas/${turmaId}`]) {
    await dela.goto(`${base}${rota}`);
    assert.equal(caminho(dela), '/inicio', rota);
  }
  await dela.context().close();
});

test('no celular, as telas de conversação cabem na largura', async () => {
  const contexto = await novoContexto(navegador, 390, 844);
  const celular = await contexto.newPage();
  await entrar(celular, professor.email, senha);
  await celular.waitForURL('**/admin');
  for (const [nome, rota] of [['conversacao', '/admin/conversacao?ver=passadas'], ['turma', `/admin/conversacao/turmas/${turmaId}`], ['tema', `/admin/conversacao/temas/${temaId}`], ['turma-nova', '/admin/conversacao/turmas/nova']]) {
    await celular.goto(`${base}${rota}`, { waitUntil: 'networkidle' });
    const sobra = await celular.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(sobra <= 0, `${rota} passa ${sobra}px da largura no celular`);
    await celular.screenshot({ path: `capturas/admin-${nome}-celular.png`, fullPage: true });
  }
  await contexto.close();
});
