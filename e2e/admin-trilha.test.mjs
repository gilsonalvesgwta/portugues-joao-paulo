// Teste de ponta a ponta da trilha por dia: o professor monta os dias pelo navegador, o banco é
// conferido por fora, o que a aluna já marcou sobrevive à reorganização, e ela não grava a trilha.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { admin, base, caminho, clientePublico, criarPessoa, emailDeTeste, entrar, novaPagina, novoContexto, senha, textoDoAviso } from './apoio.mjs';

const sufixo = randomBytes(3).toString('hex');
const professor = { email: emailDeTeste('professor-trilha'), nome: 'Professor Trilha', papel: 'professor' };
const aluna = { email: emailDeTeste('aluna-trilha'), nome: 'Rocío Camino' };

const A1 = `Aula 1 — Saudações ${sufixo}`;
const A2 = `Aula 2 — Verbo ser ${sufixo}`;
const A3 = `Aula 3 — Números ${sufixo}`;
const Q1 = 'Quiz da aula 1';
const T1 = `Tarefa: Preséntate ${sufixo}`;
const T2 = `Tarefa: Repasa la semana ${sufixo}`;

let navegador;
let pagina; // o professor, logado do começo ao fim
let alunaId;
let cursoId;
let ids; // { aula1, aula2, aula3, quiz1, tarefa1, tarefa2 }
let aoPerguntar = 'aceitar';

const dia = (n) => pagina.getByRole('region', { name: `Dia ${n}`, exact: true });
const fora = () => pagina.getByRole('complementary', { name: 'Fora da trilha' });
const situacao = (texto) => pagina.locator('main [role="status"]').filter({ hasText: texto }).waitFor();
const itensDoDia = async (n) => (await dia(n).locator('ol > li span.font-semibold.min-w-0').allInnerTexts());

async function criar(tabela, linha) {
  const { data, error } = await admin.from(tabela).insert(linha).select('id').single();
  assert.equal(error, null, `${tabela}: ${error?.message}`);
  return data.id;
}

// A trilha gravada, com o nome de cada item no lugar do identificador.
async function noBanco() {
  const { data, error } = await admin.rpc('ler_trilha', { p_curso: cursoId });
  assert.equal(error, null, error?.message);
  const nome = new Map([[ids.aula1, 'A1'], [ids.aula2, 'A2'], [ids.aula3, 'A3'], [ids.quiz1, 'Q1'], [ids.tarefa1, 'T1'], [ids.tarefa2, 'T2']]);
  return data.map((d) => d.itens.map((i) => `${nome.get(i.alvo)}${i.obrigatorio ? '' : '?'}`));
}

async function idDoItem(tarefaId) {
  const { data, error } = await admin.from('itens_dia').select('id').eq('tarefa_id', tarefaId).maybeSingle();
  assert.equal(error, null, error?.message);
  return data?.id ?? null;
}

async function salvar() {
  await pagina.getByRole('button', { name: 'Salvar trilha' }).click();
  await situacao('Trilha salva.');
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
  alunaId = await criarPessoa(aluna);
  cursoId = await criar('cursos', { titulo_pt: `Curso da trilha ${sufixo}`, titulo_es: `Curso del camino ${sufixo}`, situacao: 'publicado' });
  const moduloId = await criar('modulos', { curso_id: cursoId, ordem: 1, titulo_pt: `Módulo ${sufixo}`, titulo_es: `Módulo ${sufixo}` });
  const aula = (numero, titulo, situacao) =>
    criar('aulas', { modulo_id: moduloId, numero, titulo_pt: titulo, titulo_es: titulo, video_id: 'aB3dE6gH9jK', situacao });
  ids = {
    aula1: await aula(1, `Saudações ${sufixo}`, 'publicado'),
    aula2: await aula(2, `Verbo ser ${sufixo}`, 'publicado'),
    aula3: await aula(3, `Números ${sufixo}`, 'rascunho'),
  };
  ids.quiz1 = await criar('quizzes', { aula_id: ids.aula1, situacao: 'publicado' });
  ids.tarefa1 = await criar('tarefas', { curso_id: cursoId, aula_id: ids.aula1, titulo_es: `Preséntate ${sufixo}`, instrucao_es: 'Escribe tu presentación.' });
  ids.tarefa2 = await criar('tarefas', { curso_id: cursoId, titulo_es: `Repasa la semana ${sufixo}`, instrucao_es: 'Lee tus apuntes.' });
  await criar('matriculas', { aluno_id: alunaId, curso_id: cursoId, origem: 'manual' });

  pagina = await novaPagina(navegador);
  pagina.on('dialog', (janela) => (aoPerguntar === 'aceitar' ? janela.accept() : janela.dismiss()));
  await entrar(pagina, professor.email, senha);
  await pagina.waitForURL('**/admin');
});

after(async () => {
  await navegador?.close();
});

test('curso sem trilha: tudo aparece como fora da trilha; montar sozinho cria um dia por aula', async () => {
  await pagina.goto(`${base}/admin/trilha?curso=${cursoId}`);
  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), 'Trilha por dia');
  assert.equal(await textoDoAviso(pagina, 'status'), 'Este curso ainda não tem dias na trilha.');
  assert.deepEqual(await fora().locator('li').allInnerTexts(), [A1, Q1, T1, A2, A3, T2]);

  await fora().getByRole('button', { name: 'Montar sozinho o que falta' }).click();
  assert.deepEqual(await itensDoDia(1), [A1, Q1, T1]);
  assert.deepEqual(await itensDoDia(2), [A2]);
  assert.deepEqual(await itensDoDia(3), [A3]);
  await dia(3).getByText('em rascunho: o aluno ainda não vê').waitFor();
  assert.deepEqual(await fora().locator('li').allInnerTexts(), [T2], 'a tarefa sem aula fica para o professor encaixar');
  assert.deepEqual(await noBanco(), [], 'nada é gravado antes de salvar');

  await salvar();
  assert.deepEqual(await noBanco(), [['A1', 'Q1', 'T1'], ['A2'], ['A3']]);
});

test('encaixa a tarefa solta, marca como opcional, reordena itens e dias', async () => {
  await dia(2).getByLabel('Adicionar ao dia 2').selectOption({ label: T2 });
  await dia(2).getByRole('button', { name: 'Adicionar', exact: true }).click();
  assert.deepEqual(await itensDoDia(2), [A2, T2]);
  await fora().getByText('Tudo o que existe no curso já está em algum dia.').waitFor();

  await dia(2).getByLabel(`Obrigatório: ${T2}`).uncheck();
  await dia(2).getByRole('button', { name: `Subir: ${T2}` }).click();
  assert.deepEqual(await itensDoDia(2), [T2, A2]);

  await pagina.getByRole('button', { name: 'Subir o dia 3' }).click();
  assert.deepEqual(await itensDoDia(2), [A3]);
  assert.deepEqual(await itensDoDia(3), [T2, A2]);
  await pagina.screenshot({ path: 'capturas/admin-trilha-computador.png', fullPage: true });

  await salvar();
  assert.deepEqual(await noBanco(), [['A1', 'Q1', 'T1'], ['A3'], ['T2?', 'A2']]);
});

test('reabre como foi salva; o que a aluna já marcou sobrevive quando o item muda de dia', async () => {
  const cliente = await comoAluna();
  const item = await idDoItem(ids.tarefa1);
  const marcar = await cliente.from('itens_concluidos').insert({ aluno_id: alunaId, item_dia_id: item });
  assert.equal(marcar.error, null, marcar.error?.message);

  await pagina.reload();
  assert.equal(await textoDoAviso(pagina, 'status'), 'Tudo salvo.');
  assert.deepEqual(await itensDoDia(3), [T2, A2]);
  assert.equal(await dia(3).getByLabel(`Obrigatório: ${T2}`).isChecked(), false);

  // A tarefa da aula 1 é o último item do dia 1: descer leva para o começo do dia 2.
  await dia(1).getByRole('button', { name: `Descer: ${T1}` }).click();
  assert.deepEqual(await itensDoDia(2), [T1, A3]);
  await salvar();
  assert.deepEqual(await noBanco(), [['A1', 'Q1'], ['T1', 'A3'], ['T2?', 'A2']]);
  assert.equal(await idDoItem(ids.tarefa1), item, 'o item é o mesmo, só mudou de dia');
  const { data: marcadas } = await admin.from('itens_concluidos').select('item_dia_id').eq('aluno_id', alunaId);
  assert.deepEqual(marcadas, [{ item_dia_id: item }], 'a marcação da aluna continua lá');

  // Tirar e recolocar na mesma edição também mantém o item e a marcação.
  await dia(2).getByRole('button', { name: `Tirar da trilha: ${T1}` }).click();
  await dia(1).getByLabel('Adicionar ao dia 1').selectOption({ label: T1 });
  await dia(1).getByRole('button', { name: 'Adicionar', exact: true }).click();
  await salvar();
  assert.equal(await idDoItem(ids.tarefa1), item);
  assert.equal((await admin.from('itens_concluidos').select('item_dia_id').eq('aluno_id', alunaId)).data.length, 1);
});

test('remover um dia devolve os itens para fora da trilha; dia vazio não é gravado', async () => {
  await pagina.getByRole('button', { name: 'Remover o dia 2' }).click();
  assert.deepEqual(await fora().locator('li').allInnerTexts(), [A3]);
  await pagina.getByRole('button', { name: 'Adicionar dia' }).click();
  await dia(3).getByText('Dia vazio. Dias sem nenhum item não são gravados.').waitFor();
  await salvar();
  assert.deepEqual(await noBanco(), [['A1', 'Q1', 'T1'], ['T2?', 'A2']]);
  assert.equal(await pagina.getByRole('region', { name: /^Dia \d+$/ }).count(), 2, 'a tela mostra o que ficou gravado');
});

test('com alteração sem salvar, sair pede confirmação', async () => {
  await dia(1).getByLabel(`Obrigatório: ${Q1}`).uncheck();
  await situacao('Há alterações que ainda não foram salvas.');
  aoPerguntar = 'recusar';
  await pagina.getByRole('link', { name: 'Tarefas', exact: true }).click();
  await pagina.waitForTimeout(400);
  assert.equal(caminho(pagina), '/admin/trilha', 'recusou: continua no editor');
  aoPerguntar = 'aceitar';
  await pagina.reload();
  assert.equal(await dia(1).getByLabel(`Obrigatório: ${Q1}`).isChecked(), true, 'o que não foi salvo não foi gravado');
});

test('aula e tarefa que estão na trilha não vão para a lixeira', async () => {
  await pagina.goto(`${base}/admin/aulas/${ids.aula1}`);
  await pagina.getByRole('button', { name: 'Mover a aula para a lixeira' }).click();
  await pagina.waitForURL(`**/admin/aulas/${ids.aula1}?aviso=aula_na_trilha`);
  assert.equal(await textoDoAviso(pagina), 'Esta aula (ou o quiz dela) está na trilha por dia. Tire da trilha antes de mover para a lixeira.');

  await pagina.goto(`${base}/admin/tarefas/${ids.tarefa2}`);
  await pagina.getByRole('button', { name: 'Mover a tarefa para a lixeira' }).click();
  await pagina.waitForURL(`**/admin/tarefas/${ids.tarefa2}?aviso=tarefa_na_trilha`);
  assert.equal(await textoDoAviso(pagina), 'Esta tarefa está na trilha por dia. Tire da trilha antes de mover para a lixeira.');

  const { data: aula } = await admin.from('aulas').select('arquivado_em').eq('id', ids.aula1).single();
  const { data: tarefa } = await admin.from('tarefas').select('arquivado_em').eq('id', ids.tarefa2).single();
  assert.deepEqual([aula.arquivado_em, tarefa.arquivado_em], [null, null]);

  // A aula 3 saiu da trilha no teste anterior: essa pode ir para a lixeira.
  await pagina.goto(`${base}/admin/aulas/${ids.aula3}`);
  await pagina.getByRole('button', { name: 'Mover a aula para a lixeira' }).click();
  await pagina.waitForURL('**/admin/aulas?aviso=na_lixeira');
});

test('no celular, o editor da trilha cabe na largura', async () => {
  const contexto = await novoContexto(navegador, 390, 844);
  const celular = await contexto.newPage();
  await entrar(celular, professor.email, senha);
  await celular.waitForURL('**/admin');
  await celular.goto(`${base}/admin/trilha?curso=${cursoId}`, { waitUntil: 'networkidle' });
  const sobra = await celular.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(sobra <= 0, `o editor passa ${sobra}px da largura da tela`);
  await celular.screenshot({ path: 'capturas/admin-trilha-celular.png', fullPage: true });
  await contexto.close();
});

test('aluna matriculada lê a trilha do curso e não grava', async () => {
  const cliente = await comoAluna();
  const lida = await cliente.rpc('ler_trilha', { p_curso: cursoId });
  assert.equal(lida.error, null, lida.error?.message);
  assert.deepEqual(lida.data.map((d) => d.itens.length), [3, 2], 'ela recebe os dias e os itens');

  const gravar = await cliente.rpc('salvar_trilha', { p_curso: cursoId, p_dias: [] });
  assert.notEqual(gravar.error, null, 'aluna não grava a trilha');
  const apagar = await cliente.from('itens_dia').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id');
  assert.deepEqual(apagar.data ?? [], [], 'aluna não apaga itens da trilha');
  assert.deepEqual(await noBanco(), [['A1', 'Q1', 'T1'], ['T2?', 'A2']]);

  const dela = await novaPagina(navegador);
  await entrar(dela, aluna.email, senha);
  await dela.waitForURL('**/inicio');
  await dela.goto(`${base}/admin/trilha`);
  assert.equal(caminho(dela), '/inicio');
});
