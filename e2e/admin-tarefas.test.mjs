// Teste de ponta a ponta das tarefas: o professor cria, edita, manda para a lixeira e restaura;
// a aluna matriculada lê e não grava.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { admin, base, caminho, clientePublico, criarPessoa, emailDeTeste, entrar, novaPagina, senha, textoDoAviso } from './apoio.mjs';

const sufixo = randomBytes(3).toString('hex');
const professor = { email: emailDeTeste('professor-tarefas'), nome: 'Professor Tarefas', papel: 'professor' };
const aluna = { email: emailDeTeste('aluna-tarefas'), nome: 'Paula Tareas' };
const titulo = `Escribe cinco frases ${sufixo}`;

let navegador;
let pagina; // o professor, logado do começo ao fim
let cursoId;
let aulaId;

const campo = (rotulo) => pagina.getByLabel(rotulo, { exact: true });
const linhas = () => pagina.locator('main tbody tr');

async function criar(tabela, linha) {
  const { data, error } = await admin.from(tabela).insert(linha).select('id').single();
  assert.equal(error, null, `${tabela}: ${error?.message}`);
  return data.id;
}

async function noBanco() {
  const { data, error } = await admin.from('tarefas').select('id, aula_id, titulo_es, instrucao_es, link, arquivado_em').eq('curso_id', cursoId).order('titulo_es');
  assert.equal(error, null, error?.message);
  return data;
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
  cursoId = await criar('cursos', { titulo_pt: `Curso das tarefas ${sufixo}`, titulo_es: `Curso de tareas ${sufixo}`, situacao: 'publicado' });
  const moduloId = await criar('modulos', { curso_id: cursoId, ordem: 1, titulo_pt: `Módulo ${sufixo}`, titulo_es: `Módulo ${sufixo}` });
  aulaId = await criar('aulas', {
    modulo_id: moduloId, numero: 4, titulo_pt: `Aula com tarefa ${sufixo}`, titulo_es: `Clase con tarea ${sufixo}`,
    video_id: 'aB3dE6gH9jK', situacao: 'publicado',
  });
  await criar('matriculas', { aluno_id: alunaId, curso_id: cursoId, origem: 'manual' });

  pagina = await novaPagina(navegador);
  await entrar(pagina, professor.email, senha);
  await pagina.waitForURL('**/admin');
});

after(async () => {
  await navegador?.close();
});

test('campos em branco e link ruim são apontados sem perder o que foi digitado; depois a tarefa é criada', async () => {
  await pagina.goto(`${base}/admin/tarefas?curso=${cursoId}`);
  await pagina.getByText(`O curso Curso das tarefas ${sufixo} ainda não tem tarefas.`).waitFor();
  await pagina.getByRole('link', { name: 'Nova tarefa' }).click();
  await pagina.waitForURL(`**/admin/tarefas/nova?curso=${cursoId}`);

  let respostas = 0;
  const salvarComErro = async () => {
    await pagina.getByRole('button', { name: 'Salvar tarefa' }).click();
    respostas += 1;
    await pagina.locator(`form[data-vez="${respostas}"]`).waitFor();
  };

  await campo('Título (em espanhol)').fill(titulo);
  await campo('Link (opcional)').fill('http://exemplo.com/sem-https');
  await salvarComErro();
  await pagina.getByText('Escreva o que o aluno deve fazer.').waitFor();
  await pagina.getByText('Cole um link que comece com https://, sem espaços, ou deixe em branco.').waitFor();
  assert.equal(await campo('Título (em espanhol)').inputValue(), titulo);
  assert.deepEqual(await noBanco(), [], 'nada foi gravado');

  await campo('O que o aluno deve fazer (em espanhol)').fill('Usa el verbo ser.\n\n\n\nEnvíalas por el formulario.');
  await campo('Link (opcional)').fill('forms.gle/abc123');
  await campo('Aula ligada (opcional)').selectOption(aulaId);
  await pagina.getByRole('button', { name: 'Salvar tarefa' }).click();
  await pagina.waitForURL(`**/admin/tarefas?curso=${cursoId}&aviso=tarefa_salva`);
  assert.equal(await textoDoAviso(pagina, 'status'), 'Tarefa salva.');

  const [tarefa] = await noBanco();
  assert.deepEqual({ ...tarefa, id: undefined }, {
    id: undefined, aula_id: aulaId, titulo_es: titulo, instrucao_es: 'Usa el verbo ser.\n\nEnvíalas por el formulario.',
    link: 'https://forms.gle/abc123', arquivado_em: null,
  });
  assert.equal(await linhas().count(), 1);
  assert.match(await linhas().first().innerText(), /Aula 4/);
  assert.match(await linhas().first().innerText(), /Com link/);
  await pagina.screenshot({ path: 'capturas/admin-tarefas-computador.png', fullPage: true });
});

test('a tela da aula mostra a tarefa ligada e cria outra já ligada a ela', async () => {
  await pagina.goto(`${base}/admin/aulas/${aulaId}`);
  await pagina.getByRole('link', { name: `Editar a tarefa ${titulo}` }).waitFor();
  await pagina.getByRole('link', { name: 'Nova tarefa' }).click();
  await pagina.waitForURL(`**/admin/tarefas/nova?curso=${cursoId}&aula=${aulaId}`);
  assert.equal(await campo('Aula ligada (opcional)').inputValue(), aulaId, 'a aula já vem escolhida');
});

test('editar: tirar a aula e o link; a tarefa passa a valer para o curso todo', async () => {
  await pagina.goto(`${base}/admin/tarefas?curso=${cursoId}`);
  await pagina.getByRole('link', { name: `Editar a tarefa ${titulo}` }).click();
  await pagina.waitForURL('**/admin/tarefas/*');
  assert.equal(await campo('Link (opcional)').inputValue(), 'https://forms.gle/abc123');
  await campo('Aula ligada (opcional)').selectOption('');
  await campo('Link (opcional)').fill('');
  await pagina.getByRole('button', { name: 'Salvar tarefa' }).click();
  await pagina.waitForURL(`**/admin/tarefas?curso=${cursoId}&aviso=tarefa_salva`);
  const [tarefa] = await noBanco();
  assert.equal(tarefa.aula_id, null);
  assert.equal(tarefa.link, null);
  assert.match(await linhas().first().innerText(), /Curso todo/);
  assert.match(await linhas().first().innerText(), /Sem link/);
});

test('aluna matriculada lê a tarefa e não grava', async () => {
  const cliente = await comoAluna();
  const ler = async () => ((await cliente.from('tarefas').select('titulo_es').eq('curso_id', cursoId)).data ?? []).map((t) => t.titulo_es);
  assert.deepEqual(await ler(), [titulo]);

  const criarUma = await cliente.from('tarefas').insert({ curso_id: cursoId, titulo_es: 'Intrusa', instrucao_es: 'x' }).select('id');
  assert.notEqual(criarUma.error, null, 'aluna não cria tarefa');
  const alterar = await cliente.from('tarefas').update({ titulo_es: 'Trocada' }).eq('curso_id', cursoId).select('id');
  assert.deepEqual(alterar.data ?? [], [], 'aluna não altera tarefa');
  assert.equal((await noBanco())[0].titulo_es, titulo);

  const dela = await novaPagina(navegador);
  await entrar(dela, aluna.email, senha);
  await dela.waitForURL('**/inicio');
  await dela.goto(`${base}/admin/tarefas`);
  assert.equal(caminho(dela), '/inicio');
});

test('o banco recusa link de tarefa que não seja https', async () => {
  for (const link of ['javascript:alert(1)', 'http://exemplo.com/a']) {
    const { error } = await admin.from('tarefas').insert({ curso_id: cursoId, titulo_es: 'X', instrucao_es: 'x', link });
    assert.notEqual(error, null, link);
  }
  assert.equal((await noBanco()).length, 1);
});

test('lixeira: a tarefa some da lista e da aluna, e volta ao restaurar', async () => {
  await pagina.goto(`${base}/admin/tarefas?curso=${cursoId}`);
  await pagina.getByRole('link', { name: `Editar a tarefa ${titulo}` }).click();
  await pagina.waitForURL('**/admin/tarefas/*');
  await pagina.getByRole('button', { name: 'Mover a tarefa para a lixeira' }).click();
  await pagina.waitForURL('**/admin/tarefas?aviso=na_lixeira');
  assert.notEqual((await noBanco())[0].arquivado_em, null);

  const cliente = await comoAluna();
  assert.deepEqual((await cliente.from('tarefas').select('id').eq('curso_id', cursoId)).data ?? [], [], 'a aluna deixa de ver');
  await pagina.goto(`${base}/admin/tarefas?curso=${cursoId}`);
  assert.equal(await linhas().count(), 0);

  await pagina.goto(`${base}/admin/lixeira`);
  await pagina.getByRole('button', { name: `Restaurar tarefa ${titulo}` }).click();
  await pagina.waitForURL('**/admin/lixeira?aviso=tarefa_restaurada');
  assert.equal((await noBanco())[0].arquivado_em, null);
  assert.equal(((await cliente.from('tarefas').select('id').eq('curso_id', cursoId)).data ?? []).length, 1, 'a aluna volta a ver');
});
