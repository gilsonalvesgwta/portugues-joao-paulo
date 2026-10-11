// Teste de ponta a ponta dos materiais do curso inteiro: o professor cadastra, ordena, edita e
// apaga na tela do curso; a aluna matriculada vê na tela inicial; quem não tem o curso não lê.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { admin, base, clientePublico, criarPessoa, emailDeTeste, entrar, novaPagina, senha, textoDoAviso } from './apoio.mjs';

const sufixo = randomBytes(3).toString('hex');
const professor = { email: emailDeTeste('professor-guia'), nome: 'Professor Guia', papel: 'professor' };
const aluna = { email: emailDeTeste('aluna-guia'), nome: `Gema Guía ${sufixo}` };
const deFora = { email: emailDeTeste('aluna-de-fora'), nome: `Flor Fuera ${sufixo}` };
const guia = { pt: `Guia de estudo ${sufixo}`, es: `Guía de estudio ${sufixo}`, link: `https://drive.google.com/file/d/guia-${sufixo}/view` };
const verbos = { pt: `Tabela de verbos ${sufixo}`, es: `Tabla de verbos ${sufixo}`, link: `https://drive.google.com/file/d/verbos-${sufixo}/view` };
const DA_AULA = `Material só da aula ${sufixo}`;

let navegador;
let pagina; // o professor
let cursoId;
let aulaId;

const campo = (rotulo) => pagina.getByLabel(rotulo, { exact: true });
const itens = () => pagina.locator('#materiais + ol > li');

async function criar(tabela, linha) {
  const { data, error } = await admin.from(tabela).insert(linha).select('id').single();
  assert.equal(error, null, `${tabela}: ${error?.message}`);
  return data.id;
}

async function doCurso() {
  const { data, error } = await admin.from('materiais').select('titulo_pt, titulo_es, link, ordem, aula_id').eq('curso_id', cursoId).order('ordem');
  assert.equal(error, null, error?.message);
  return data;
}

async function sessaoDe(pessoa) {
  const cliente = clientePublico();
  const { error } = await cliente.auth.signInWithPassword({ email: pessoa.email, password: senha });
  assert.equal(error, null, error?.message);
  return cliente;
}

async function adicionar(material) {
  await pagina.goto(`${base}/admin/cursos/${cursoId}`);
  await pagina.getByRole('link', { name: 'Adicionar material' }).click();
  await pagina.waitForURL(`**/admin/cursos/${cursoId}/materiais/novo`);
  await campo('Título em português').fill(material.pt);
  await campo('Título em espanhol').fill(material.es);
  await campo('Link do material').fill(material.link);
  await pagina.getByRole('button', { name: 'Salvar material' }).click();
  await pagina.waitForURL(`**/admin/cursos/${cursoId}?aviso=material_salvo#materiais`);
}

before(async () => {
  navegador = await chromium.launch();
  await criarPessoa(professor);
  const alunaId = await criarPessoa(aluna);
  await criarPessoa(deFora);
  cursoId = await criar('cursos', { titulo_pt: `Curso com guia ${sufixo}`, titulo_es: `Curso con guía ${sufixo}`, situacao: 'publicado' });
  const moduloId = await criar('modulos', { curso_id: cursoId, ordem: 1, titulo_pt: `Módulo ${sufixo}`, titulo_es: `Módulo ${sufixo}` });
  aulaId = await criar('aulas', {
    modulo_id: moduloId, numero: 1, titulo_pt: `Aula ${sufixo}`, titulo_es: `Clase ${sufixo}`, video_id: 'aB3dE6gH9jK', situacao: 'publicado',
  });
  await criar('materiais', { aula_id: aulaId, titulo_pt: DA_AULA, titulo_es: DA_AULA, link: 'https://exemplo.test/da-aula.pdf', ordem: 1 });
  await criar('matriculas', { aluno_id: alunaId, curso_id: cursoId, origem: 'manual' });

  pagina = await novaPagina(navegador);
  pagina.on('dialog', (janela) => janela.accept());
  await entrar(pagina, professor.email, senha);
  await pagina.waitForURL('**/admin');
});

after(async () => {
  await navegador?.close();
});

test('o professor cadastra materiais do curso inteiro na tela do curso', async () => {
  await pagina.goto(`${base}/admin/cursos/${cursoId}`);
  await pagina.getByRole('heading', { name: 'Materiais do curso' }).waitFor();
  await pagina.getByText('Este curso ainda não tem materiais gerais.').waitFor();

  await adicionar(guia);
  assert.equal(await textoDoAviso(pagina, 'status'), 'Material salvo.');
  await adicionar(verbos);
  assert.deepEqual(await doCurso(), [
    { titulo_pt: guia.pt, titulo_es: guia.es, link: guia.link, ordem: 1, aula_id: null },
    { titulo_pt: verbos.pt, titulo_es: verbos.es, link: verbos.link, ordem: 2, aula_id: null },
  ]);
  assert.equal(await itens().count(), 2, 'o material da aula não aparece na lista do curso');
  assert.equal((await pagina.content()).includes(DA_AULA), false);
});

test('subir muda a ordem só dos materiais do curso; editar volta para a tela do curso', async () => {
  await pagina.getByRole('button', { name: `Subir o material ${verbos.pt}` }).click();
  await pagina.locator('#materiais + ol > li').first().filter({ hasText: verbos.pt }).waitFor();
  assert.deepEqual((await doCurso()).map((m) => [m.titulo_pt, m.ordem]), [[verbos.pt, 1], [guia.pt, 2]]);
  const { data: daAula } = await admin.from('materiais').select('ordem, curso_id').eq('aula_id', aulaId).single();
  assert.deepEqual(daAula, { ordem: 1, curso_id: null }, 'o material da aula não foi tocado');

  await pagina.getByRole('link', { name: `Editar o material ${guia.pt}` }).click();
  await pagina.waitForURL('**/admin/materiais/*');
  await pagina.getByRole('link', { name: /Voltar para o curso/ }).waitFor();
  await campo('Descrição em espanhol (opcional)').fill('Cómo organizar tu semana.');
  await pagina.getByRole('button', { name: 'Salvar material' }).click();
  await pagina.waitForURL(`**/admin/cursos/${cursoId}?aviso=material_salvo#materiais`);
  const { data } = await admin.from('materiais').select('descricao_es, curso_id, aula_id').eq('titulo_pt', guia.pt).single();
  assert.deepEqual(data, { descricao_es: 'Cómo organizar tu semana.', curso_id: cursoId, aula_id: null });
});

test('a aluna matriculada vê os materiais do curso na tela inicial, na ordem do professor', async () => {
  const dela = await novaPagina(navegador);
  await entrar(dela, aluna.email, senha);
  await dela.waitForURL('**/inicio');
  const cartao = dela.locator('#materiales');
  await cartao.getByRole('heading', { name: 'Materiales del curso' }).waitFor();
  const links = cartao.getByRole('link');
  assert.deepEqual(await links.evaluateAll((lista) => lista.map((a) => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')])), [
    [verbos.link, '_blank', 'noopener noreferrer'],
    [guia.link, '_blank', 'noopener noreferrer'],
  ]);
  await cartao.getByText('Cómo organizar tu semana.').waitFor();
  assert.equal((await cartao.innerText()).includes(DA_AULA), false, 'o material da aula fica na aula');
  await dela.context().close();

  // Pelo banco: a aluna lê e não grava; quem não tem o curso não lê nada.
  const sessao = await sessaoDe(aluna);
  assert.equal(((await sessao.from('materiais').select('id').eq('curso_id', cursoId)).data ?? []).length, 2);
  const intruso = await sessao.from('materiais').insert({ curso_id: cursoId, titulo_pt: 'Intruso', titulo_es: 'Intruso', link: 'https://exemplo.test/x' }).select('id');
  assert.notEqual(intruso.error, null, 'aluna não cria material');
  const outra = await sessaoDe(deFora);
  assert.deepEqual((await outra.from('materiais').select('id').eq('curso_id', cursoId)).data ?? [], [], 'sem matrícula, não lê os materiais do curso');
});

test('apagar tira o material da tela do curso e da tela da aluna', async () => {
  await pagina.goto(`${base}/admin/cursos/${cursoId}`);
  await pagina.getByRole('button', { name: `Apagar o material ${verbos.pt}` }).click();
  await pagina.waitForURL(`**/admin/cursos/${cursoId}?aviso=material_apagado#materiais`);
  await pagina.getByRole('button', { name: `Apagar o material ${guia.pt}` }).click();
  await pagina.getByText('Este curso ainda não tem materiais gerais.').waitFor();
  assert.deepEqual(await doCurso(), []);
  assert.equal((await admin.from('materiais').select('id').eq('aula_id', aulaId)).data.length, 1, 'o material da aula continua');

  const dela = await novaPagina(navegador);
  await entrar(dela, aluna.email, senha);
  await dela.waitForURL('**/inicio');
  await dela.getByRole('heading', { name: 'Todas las clases' }).waitFor();
  assert.equal(await dela.locator('#materiales').count(), 0);
  await dela.context().close();
});
