// Teste de ponta a ponta dos materiais de apoio por link: o professor cadastra, edita, reordena
// e apaga pelo navegador; o banco é conferido por fora; a aluna matriculada lê e não grava.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { admin, base, caminho, clientePublico, criarPessoa, emailDeTeste, entrar, novaPagina, senha, textoDoAviso } from './apoio.mjs';

const sufixo = randomBytes(3).toString('hex');
const professor = { email: emailDeTeste('professor-materiais'), nome: 'Professor Materiais', papel: 'professor' };
const aluna = { email: emailDeTeste('aluna-materiais'), nome: 'Elena Materiales' };
const lista = { pt: `Lista de verbos ${sufixo}`, es: `Lista de verbos ${sufixo}` };
const ficha = { pt: `Ficha de exercícios ${sufixo}`, es: `Ficha de ejercicios ${sufixo}` };

let navegador;
let pagina; // o professor, logado do começo ao fim
let aulaId;
let aoPerguntar = 'aceitar';

const campo = (rotulo) => pagina.getByLabel(rotulo, { exact: true });
const itens = () => pagina.locator('#materiais + ol > li');

async function criar(tabela, linha) {
  const { data, error } = await admin.from(tabela).insert(linha).select('id').single();
  assert.equal(error, null, `${tabela}: ${error?.message}`);
  return data.id;
}

async function noBanco() {
  const { data, error } = await admin.from('materiais').select('titulo_pt, titulo_es, descricao_es, link, ordem').eq('aula_id', aulaId).order('ordem');
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
  const cursoId = await criar('cursos', { titulo_pt: `Curso dos materiais ${sufixo}`, titulo_es: `Curso de materiales ${sufixo}`, situacao: 'publicado' });
  const moduloId = await criar('modulos', { curso_id: cursoId, ordem: 1, titulo_pt: `Módulo ${sufixo}`, titulo_es: `Módulo ${sufixo}` });
  aulaId = await criar('aulas', {
    modulo_id: moduloId, numero: 3, titulo_pt: `Aula com materiais ${sufixo}`, titulo_es: `Clase con materiales ${sufixo}`,
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

test('link ruim é recusado com o que foi digitado mantido; link sem https:// é completado', async () => {
  await pagina.goto(`${base}/admin/aulas/${aulaId}`);
  await pagina.getByText('Esta aula ainda não tem materiais.').waitFor();
  await pagina.getByRole('link', { name: 'Adicionar material' }).click();
  await pagina.waitForURL(`**/admin/aulas/${aulaId}/materiais/novo`);

  await campo('Título em português').fill(lista.pt);
  await pagina.getByRole('button', { name: 'Salvar material' }).click();
  await pagina.getByText('Escreva o título em espanhol.').waitFor();
  await pagina.getByText('Cole o link do material.').waitFor();
  assert.equal(await campo('Título em português').inputValue(), lista.pt);

  await campo('Título em espanhol').fill(lista.es);
  for (const ruim of ['http://exemplo.com/lista.pdf', 'javascript:alert(1)', 'meu arquivo.pdf']) {
    await campo('Link do material').fill(ruim);
    await pagina.getByRole('button', { name: 'Salvar material' }).click();
    await pagina.getByText('Cole um link que comece com https://, sem espaços.').waitFor();
    assert.equal(await campo('Link do material').inputValue(), ruim, 'o link digitado continua no campo');
  }
  assert.deepEqual(await noBanco(), [], 'nada foi gravado');

  await campo('Link do material').fill('drive.google.com/file/d/abc123/view');
  await campo('Descrição em espanhol (opcional)').fill('Para imprimir.');
  await pagina.getByRole('button', { name: 'Salvar material' }).click();
  await pagina.waitForURL(`**/admin/aulas/${aulaId}?aviso=material_salvo#materiais`);
  assert.equal(await textoDoAviso(pagina, 'status'), 'Material salvo.');
  assert.deepEqual(await noBanco(), [
    { titulo_pt: lista.pt, titulo_es: lista.es, descricao_es: 'Para imprimir.', link: 'https://drive.google.com/file/d/abc123/view', ordem: 1 },
  ]);
});

test('o link abre em outra aba, sem levar dados da plataforma', async () => {
  const link = itens().first().getByRole('link', { name: 'https://drive.google.com/file/d/abc123/view' });
  assert.equal(await link.getAttribute('target'), '_blank');
  assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
});

test('segundo material entra no fim; subir, descer e editar funcionam', async () => {
  await pagina.getByRole('link', { name: 'Adicionar material' }).click();
  await campo('Título em português').fill(ficha.pt);
  await campo('Título em espanhol').fill(ficha.es);
  await campo('Link do material').fill('https://www.dropbox.com/s/xyz/ficha.pdf?dl=0');
  await pagina.getByRole('button', { name: 'Salvar material' }).click();
  await pagina.waitForURL('**?aviso=material_salvo#materiais');
  assert.deepEqual((await noBanco()).map((m) => m.titulo_pt), [lista.pt, ficha.pt]);

  await pagina.getByRole('button', { name: `Subir o material ${ficha.pt}` }).click();
  await itens().first().getByText(ficha.pt, { exact: true }).waitFor();
  assert.deepEqual((await noBanco()).map((m) => [m.titulo_pt, m.ordem]), [[ficha.pt, 1], [lista.pt, 2]]);
  await pagina.screenshot({ path: 'capturas/admin-materiais-computador.png', fullPage: true });

  await pagina.getByRole('link', { name: `Editar o material ${lista.pt}` }).click();
  await pagina.waitForURL('**/admin/materiais/*');
  assert.equal(await campo('Link do material').inputValue(), 'https://drive.google.com/file/d/abc123/view');
  await campo('Descrição em espanhol (opcional)').fill('');
  await campo('Título em espanhol').fill(`Verbos regulares ${sufixo}`);
  await pagina.getByRole('button', { name: 'Salvar material' }).click();
  await pagina.waitForURL(`**/admin/aulas/${aulaId}?aviso=material_salvo#materiais`);
  const depois = await noBanco();
  assert.deepEqual(depois[1], {
    titulo_pt: lista.pt, titulo_es: `Verbos regulares ${sufixo}`, descricao_es: null, link: 'https://drive.google.com/file/d/abc123/view', ordem: 2,
  });
});

test('aluna matriculada lê os materiais da aula publicada e não grava; em rascunho, deixa de ler', async () => {
  const cliente = await comoAluna();
  const ler = async () => ((await cliente.from('materiais').select('titulo_pt').eq('aula_id', aulaId).order('ordem')).data ?? []).map((m) => m.titulo_pt);
  assert.deepEqual(await ler(), [ficha.pt, lista.pt]);

  const criarUm = await cliente.from('materiais').insert({ aula_id: aulaId, titulo_pt: 'Intruso', titulo_es: 'Intruso', link: 'https://exemplo.com/x' }).select('id');
  assert.notEqual(criarUm.error, null, 'aluna não cria material');
  const alterar = await cliente.from('materiais').update({ link: 'https://exemplo.com/trocado' }).eq('aula_id', aulaId).select('id');
  assert.deepEqual(alterar.data ?? [], [], 'aluna não altera material');
  const apagar = await cliente.from('materiais').delete().eq('aula_id', aulaId).select('id');
  assert.deepEqual(apagar.data ?? [], [], 'aluna não apaga material');
  assert.equal((await noBanco()).length, 2);

  const { error } = await admin.from('aulas').update({ situacao: 'rascunho' }).eq('id', aulaId);
  assert.equal(error, null, error?.message);
  assert.deepEqual(await ler(), [], 'material de aula em rascunho não aparece para a aluna');

  const dela = await novaPagina(navegador);
  await entrar(dela, aluna.email, senha);
  await dela.waitForURL('**/inicio');
  await dela.goto(`${base}/admin/aulas/${aulaId}/materiais/novo`);
  assert.equal(caminho(dela), '/inicio');
});

test('o banco recusa link que não seja https, mesmo vindo por fora da tela', async () => {
  for (const link of ['javascript:alert(1)', 'http://exemplo.com/a.pdf', 'https://exemplo.com/com espaço.pdf']) {
    const { error } = await admin.from('materiais').insert({ aula_id: aulaId, titulo_pt: 'X', titulo_es: 'X', link });
    assert.notEqual(error, null, link);
  }
  assert.equal((await noBanco()).length, 2);
});

test('apagar pede confirmação: recusando, fica; aceitando, some', async () => {
  await pagina.goto(`${base}/admin/aulas/${aulaId}`);
  aoPerguntar = 'recusar';
  await pagina.getByRole('button', { name: `Apagar o material ${ficha.pt}` }).click();
  await pagina.waitForTimeout(400);
  assert.equal((await noBanco()).length, 2, 'recusou: nada foi apagado');

  aoPerguntar = 'aceitar';
  await pagina.getByRole('button', { name: `Apagar o material ${ficha.pt}` }).click();
  await pagina.waitForURL('**?aviso=material_apagado#materiais');
  assert.equal(await textoDoAviso(pagina, 'status'), 'Material apagado.');
  assert.deepEqual((await noBanco()).map((m) => m.titulo_pt), [lista.pt]);
  assert.equal(await itens().count(), 1);
});
