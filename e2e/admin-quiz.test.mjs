// Teste de ponta a ponta do editor de quiz: o professor monta as perguntas pelo navegador, a
// prévia não entrega a resposta, o banco é conferido por fora e a aluna nunca lê o gabarito.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { admin, base, caminho, clientePublico, criarPessoa, emailDeTeste, entrar, novaPagina, novoContexto, senha, textoDoAviso } from './apoio.mjs';

const sufixo = randomBytes(3).toString('hex');
const professor = { email: emailDeTeste('professor-quiz'), nome: 'Professor Quiz', papel: 'professor' };
const aluna = { email: emailDeTeste('aluna-quiz'), nome: 'Valeria Quiz' };

let navegador;
let pagina; // o professor, logado do começo ao fim
let aulaId;
let aoPerguntar = 'aceitar';

const pergunta = (n, nome) => pagina.getByRole('region', { name: `Pergunta ${n}: ${nome}` });
const adicionar = (nome) => pagina.getByRole('region', { name: 'Adicionar pergunta' }).getByRole('button', { name: new RegExp(`^${nome}`) }).click();
const previa = () => pagina.getByRole('complementary', { name: 'Prévia do aluno' });
const situacao = (texto) => pagina.locator('main [role="status"]').filter({ hasText: texto }).waitFor();
const salvar = (botao) => pagina.getByRole('button', { name: botao, exact: true }).click();

async function criar(tabela, linha) {
  const { data, error } = await admin.from(tabela).insert(linha).select('id').single();
  assert.equal(error, null, `${tabela}: ${error?.message}`);
  return data.id;
}

async function noBanco() {
  const { data: quiz, error } = await admin.from('quizzes').select('id, dificuldade, nota_minima, situacao').eq('aula_id', aulaId).maybeSingle();
  assert.equal(error, null, error?.message);
  if (!quiz) return null;
  const { data: perguntas, error: erro } = await admin.from('perguntas').select('tipo, ordem, conteudo').eq('quiz_id', quiz.id).order('ordem');
  assert.equal(erro, null, erro?.message);
  return { dificuldade: quiz.dificuldade, nota_minima: quiz.nota_minima, situacao: quiz.situacao, perguntas };
}

async function comoAluna() {
  const cliente = clientePublico();
  const { error } = await cliente.auth.signInWithPassword({ email: aluna.email, password: senha });
  assert.equal(error, null, error?.message);
  return cliente;
}

before(async () => {
  await mkdir('capturas', { recursive: true });
  navegador = await chromium.launch();
  await criarPessoa(professor);
  const alunaId = await criarPessoa(aluna);
  const cursoId = await criar('cursos', { titulo_pt: `Curso do quiz ${sufixo}`, titulo_es: `Curso del quiz ${sufixo}`, situacao: 'publicado' });
  const moduloId = await criar('modulos', { curso_id: cursoId, ordem: 1, titulo_pt: `Módulo ${sufixo}`, titulo_es: `Módulo ${sufixo}` });
  aulaId = await criar('aulas', {
    modulo_id: moduloId, numero: 5, titulo_pt: `Aula com quiz ${sufixo}`, titulo_es: `Clase con quiz ${sufixo}`,
    video_id: 'aB3dE6gH9jK', situacao: 'publicado',
  });
  await criar('matriculas', { aluno_id: alunaId, curso_id: cursoId, origem: 'manual' });

  pagina = await novaPagina(navegador);
  pagina.on('dialog', (janela) => (aoPerguntar === 'aceitar' ? janela.accept() : janela.dismiss()));
  await entrar(pagina, professor.email, senha);
  await pagina.waitForURL('**/admin');
});

after(async () => {
  await navegador?.close();
});

test('aula sem quiz: a tela diz isso, e publicar sem perguntas é recusado', async () => {
  await pagina.goto(`${base}/admin/aulas/${aulaId}`);
  await pagina.getByText('Esta aula ainda não tem quiz.').waitFor();
  await pagina.getByRole('link', { name: 'Criar quiz' }).click();
  await pagina.waitForURL(`**/admin/aulas/${aulaId}/quiz`);
  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), 'Quiz da aula 5');
  assert.equal(await textoDoAviso(pagina, 'status'), 'Esta aula ainda não tem quiz.');

  await salvar('Salvar e publicar');
  await pagina.locator('main [role="alert"]').filter({ hasText: 'Para publicar, o quiz precisa de pelo menos uma pergunta.' }).waitFor();
  assert.equal(await noBanco(), null, 'nada foi gravado');
});

test('monta as três perguntas, a prévia não entrega a resposta, e o rascunho confere com o banco', async () => {
  await adicionar('Múltipla escolha');
  assert.equal(await pagina.locator('main [role="alert"]').count(), 0, 'o aviso da tentativa anterior some quando o professor mexe no quiz');
  const multipla = pergunta(1, 'Múltipla escolha');
  await multipla.getByLabel('Pergunta', { exact: true }).fill('¿Cómo se dice "gracias"?');
  await multipla.getByLabel('Opção 1', { exact: true }).fill('por favor');
  await multipla.getByLabel('Opção 2', { exact: true }).fill('obrigado');
  await multipla.getByRole('button', { name: 'Adicionar opção' }).click();
  await multipla.getByLabel('Opção 3', { exact: true }).fill('desculpa');
  await multipla.getByLabel('A opção 2 é a correta').check();

  await adicionar('Completar a frase');
  const completar = pergunta(2, 'Completar a frase');
  await completar.getByLabel('Frase com a lacuna').fill('Eu');
  await completar.getByRole('button', { name: 'Inserir a lacuna no fim' }).click();
  assert.equal(await completar.getByLabel('Frase com a lacuna').inputValue(), 'Eu ___');
  await completar.getByLabel('Frase com a lacuna').fill('Eu ___ brasileiro.');
  await completar.getByLabel('Opção 1', { exact: true }).fill('sou');
  await completar.getByLabel('Opção 2', { exact: true }).fill('estou');
  await completar.getByLabel('A opção 1 é a correta').check();

  await adicionar('Ordenar a frase');
  const ordenar = pergunta(3, 'Ordenar a frase');
  await ordenar.getByLabel('Frase em português, na ordem certa').fill('Ela mora no Brasil.');
  await ordenar.getByLabel('Tradução em espanhol').fill('Ella vive en Brasil.');

  await pagina.getByLabel('Dificuldade').selectOption('medio');
  await pagina.getByLabel('Nota mínima para passar (%)').fill('80');

  await previa().getByText('CLASE 5 — QUIZ').waitFor();
  await previa().getByText('Eu ______ brasileiro.').waitFor();
  await previa().getByText('Ella vive en Brasil.').waitFor();
  assert.equal(await previa().getByText('Ela mora no Brasil.').count(), 0, 'a frase na ordem certa não aparece para o aluno');
  assert.equal(await previa().locator('input').count(), 0, 'a prévia não mostra qual opção está marcada');
  assert.deepEqual(await previa().locator('section').nth(2).locator('span').allInnerTexts(), ['Brasil.', 'Ela', 'mora', 'no'], 'palavras fora de ordem');
  await pagina.screenshot({ path: 'capturas/admin-quiz-computador.png', fullPage: true });

  await salvar('Salvar como rascunho');
  await situacao('Quiz salvo como rascunho.');
  assert.deepEqual(await noBanco(), {
    dificuldade: 'medio',
    nota_minima: 80,
    situacao: 'rascunho',
    perguntas: [
      { tipo: 'multipla_escolha', ordem: 1, conteudo: { enunciado: '¿Cómo se dice "gracias"?', opcoes: ['por favor', 'obrigado', 'desculpa'], correta: 1 } },
      { tipo: 'completar', ordem: 2, conteudo: { frase: 'Eu ___ brasileiro.', opcoes: ['sou', 'estou'], correta: 0 } },
      { tipo: 'ordenar', ordem: 3, conteudo: { palavras: ['Ela', 'mora', 'no', 'Brasil.'], traducao: 'Ella vive en Brasil.' } },
    ],
  });
});

test('pergunta incompleta não salva nada e é apontada; removida, o quiz é publicado', async () => {
  const antes = await noBanco();
  await adicionar('Múltipla escolha');
  const nova = pergunta(4, 'Múltipla escolha');
  await nova.getByLabel('Pergunta', { exact: true }).fill('Pergunta sem resposta marcada');
  await nova.getByLabel('Opção 1', { exact: true }).fill('a');
  await nova.getByLabel('Opção 2', { exact: true }).fill('b');
  await salvar('Salvar e publicar');
  assert.equal(await textoDoAviso(pagina), 'Nada foi salvo. Corrija as perguntas marcadas e salve de novo.');
  await nova.getByText('Marque qual opção é a correta.').waitFor();
  assert.deepEqual(await noBanco(), antes, 'o banco fica como estava');
  assert.equal(await pergunta(1, 'Múltipla escolha').getByLabel('Opção 2', { exact: true }).inputValue(), 'obrigado', 'nada do que foi digitado se perde');

  await pagina.getByRole('button', { name: 'Remover a pergunta 4' }).click();
  await salvar('Salvar e publicar');
  await situacao('Quiz salvo e publicado.');
  assert.equal((await noBanco()).situacao, 'publicado');
  assert.equal((await noBanco()).perguntas.length, 3);
});

test('reabre com o que foi salvo; remover uma opção leva a marcação junto; reordena', async () => {
  await pagina.reload();
  assert.equal(await textoDoAviso(pagina, 'status'), 'Tudo salvo. O quiz está publicado.');
  const multipla = pergunta(1, 'Múltipla escolha');
  assert.equal(await multipla.getByLabel('A opção 2 é a correta').isChecked(), true);
  assert.equal(await pagina.getByLabel('Nota mínima para passar (%)').inputValue(), '80');
  assert.equal(await pergunta(3, 'Ordenar a frase').getByLabel('Frase em português, na ordem certa').inputValue(), 'Ela mora no Brasil.');

  // Remove a opção 1 ("por favor"): a correta ("obrigado") passa a ser a opção 1.
  await multipla.getByRole('button', { name: 'Remover a opção 1' }).click();
  assert.equal(await multipla.getByLabel('Opção 1', { exact: true }).inputValue(), 'obrigado');
  assert.equal(await multipla.getByLabel('A opção 1 é a correta').isChecked(), true);

  await pagina.getByRole('button', { name: 'Subir a pergunta 3' }).click();
  await pergunta(2, 'Ordenar a frase').waitFor();
  await pagina.getByRole('button', { name: 'Remover a pergunta 3' }).click();
  await salvar('Salvar e publicar');
  await situacao('Quiz salvo e publicado.');
  const salvo = await noBanco();
  assert.deepEqual(salvo.perguntas.map((p) => [p.tipo, p.ordem]), [['multipla_escolha', 1], ['ordenar', 2]]);
  assert.deepEqual(salvo.perguntas[0].conteudo, { enunciado: '¿Cómo se dice "gracias"?', opcoes: ['obrigado', 'desculpa'], correta: 0 });
});

test('a tela da aula e a lista mostram o quiz; com alteração sem salvar, sair pede confirmação', async () => {
  await pergunta(2, 'Ordenar a frase').getByLabel('Tradução em espanhol').fill('Texto que não será salvo.');
  await situacao('Há alterações que ainda não foram salvas.');
  aoPerguntar = 'recusar';
  await pagina.getByRole('link', { name: 'Editar aula 5' }).click();
  await pagina.waitForTimeout(400);
  assert.equal(caminho(pagina), `/admin/aulas/${aulaId}/quiz`, 'recusou: continua no editor');

  aoPerguntar = 'aceitar';
  await pagina.getByRole('link', { name: 'Editar aula 5' }).click();
  await pagina.waitForURL(`**/admin/aulas/${aulaId}`);
  await pagina.getByText('2 perguntas · Publicado').waitFor();
  assert.equal((await noBanco()).perguntas[1].conteudo.traducao, 'Ella vive en Brasil.', 'o que não foi salvo não foi gravado');

  await pagina.goto(`${base}/admin/aulas?busca=${sufixo}`);
  assert.match(await pagina.locator('main tbody tr').first().innerText(), /2 perguntas/);
});

test('no celular, o editor de quiz cabe na largura', async () => {
  const contexto = await novoContexto(navegador, 390, 844);
  const celular = await contexto.newPage();
  await entrar(celular, professor.email, senha);
  await celular.waitForURL('**/admin');
  await celular.goto(`${base}/admin/aulas/${aulaId}/quiz`, { waitUntil: 'networkidle' });
  const sobra = await celular.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(sobra <= 0, `o editor passa ${sobra}px da largura da tela`);
  await celular.screenshot({ path: 'capturas/admin-quiz-celular.png', fullPage: true });
  await contexto.close();
});

test('aluna matriculada vê que o quiz existe, mas nunca lê as perguntas nem grava', async () => {
  const cliente = await comoAluna();
  const quiz = await cliente.from('quizzes').select('id, situacao').eq('aula_id', aulaId);
  assert.equal(quiz.error, null, quiz.error?.message);
  assert.equal(quiz.data.length, 1, 'o quiz publicado de aula publicada aparece para a aluna');

  const perguntas = await cliente.from('perguntas').select('*').eq('quiz_id', quiz.data[0].id);
  assert.deepEqual(perguntas.data ?? [], [], 'as perguntas guardam o gabarito: a aluna não as lê');

  const gravar = await cliente.rpc('salvar_quiz', { p_aula: aulaId, p_dificuldade: 'facil', p_nota_minima: 0, p_situacao: 'publicado', p_perguntas: [] });
  assert.notEqual(gravar.error, null, 'aluna não grava quiz');
  const inserir = await cliente.from('perguntas').insert({ quiz_id: quiz.data[0].id, tipo: 'ordenar', conteudo: {} }).select('id');
  assert.notEqual(inserir.error, null, 'aluna não cria pergunta');
  const resumo = await cliente.rpc('resumo_dos_quizzes');
  assert.deepEqual(resumo.data ?? [], [], 'aluna não recebe o resumo dos quizzes');
  assert.equal((await noBanco()).perguntas.length, 2);

  const dela = await novaPagina(navegador);
  await entrar(dela, aluna.email, senha);
  await dela.waitForURL('**/inicio');
  await dela.goto(`${base}/admin/aulas/${aulaId}/quiz`);
  assert.equal(caminho(dela), '/inicio');
});
