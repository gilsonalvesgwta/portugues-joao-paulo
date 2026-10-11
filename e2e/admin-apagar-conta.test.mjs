// Teste de ponta a ponta de apagar a conta de uma aluna: só o administrador, só de aluno, só
// com o e-mail escrito para confirmar. Depois, nada dela fica na plataforma além do aviso de
// compra sem nome e sem e-mail.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { admin, base, caminho, criarPessoa, emailDeTeste, entrar, novaPagina, senha, textoDoAviso } from './apoio.mjs';

const sufixo = randomBytes(3).toString('hex');
const administrador = { email: emailDeTeste('admin-apagar'), nome: `Admin Apagar ${sufixo}`, papel: 'admin' };
const professora = { email: emailDeTeste('professora-apagar'), nome: `Paula Professora ${sufixo}`, papel: 'professor' };
const aluna = { email: emailDeTeste('aluna-que-sai'), nome: `Sara Sale ${sufixo}` };
const vizinha = { email: emailDeTeste('aluna-que-fica'), nome: `Queta Queda ${sufixo}` };
const CHAVE = `teste-apagar-${sufixo}`;

let navegador;
let pagina; // o administrador
let dela; // a aluna, logada antes de a conta ser apagada
let adminId;
let professoraId;
let alunaId;
let vizinhaId;
let turmaId;

async function criar(tabela, linha) {
  const { data, error } = await admin.from(tabela).insert(linha).select('id').single();
  assert.equal(error, null, `${tabela}: ${error?.message}`);
  return data.id;
}

const contar = async (tabela, coluna, valor) => {
  const { count, error } = await admin.from(tabela).select('*', { count: 'exact', head: true }).eq(coluna, valor);
  assert.equal(error, null, `${tabela}: ${error?.message}`);
  return count;
};

before(async () => {
  navegador = await chromium.launch();
  adminId = await criarPessoa(administrador);
  professoraId = await criarPessoa(professora);
  alunaId = await criarPessoa(aluna);
  vizinhaId = await criarPessoa(vizinha);
  const cursoId = await criar('cursos', { titulo_pt: `Curso de quem sai ${sufixo}`, titulo_es: `Curso de quien sale ${sufixo}`, situacao: 'publicado' });
  const temaId = await criar('temas_conversacao', { titulo_es: `Despedidas ${sufixo}`, nivel: 'basico' });
  turmaId = await criar('turmas', {
    tema_id: temaId, inicio: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(), duracao_min: 60, vagas: 5, meet_url: `https://meet.google.com/sai-${sufixo}`,
  });
  for (const pessoa of [alunaId, vizinhaId]) {
    await criar('matriculas', { aluno_id: pessoa, curso_id: cursoId, origem: 'manual', inclui_conversacao: true, reservas_por_semana: 2 });
    await criar('reservas', { turma_id: turmaId, aluno_id: pessoa });
  }
  await criar('eventos_pagamento', {
    tipo: 'sale', evento: 'saleUpdated', status_atual: 'paid', chave_idempotencia: CHAVE, aluno_id: alunaId, processado_em: new Date().toISOString(),
    payload: { type: 'sale', event: 'saleUpdated', currentStatus: 'paid', client: { name: aluna.nome, email: aluna.email }, product: { id: 990000, name: `Produto ${sufixo}` } },
  });
  await criar('notificacoes', { tipo: 'enlace_acceso', canal: 'email', destinatario: aluna.email });

  dela = await novaPagina(navegador);
  await entrar(dela, aluna.email, senha);
  await dela.waitForURL('**/inicio');

  pagina = await novaPagina(navegador);
  await entrar(pagina, administrador.email, senha);
  await pagina.waitForURL('**/admin');
});

after(async () => {
  await navegador?.close();
});

test('conta da equipe não é apagada por ali, e ninguém apaga a própria', async () => {
  await pagina.goto(`${base}/admin/alunos/${professoraId}`);
  await pagina.getByRole('heading', { name: 'Apagar a conta' }).waitFor();
  await pagina.getByText('Esta pessoa é da equipe. Para apagar a conta, mude antes o papel dela para aluno.').waitFor();
  assert.equal(await pagina.getByRole('button', { name: 'Apagar a conta de vez' }).count(), 0);

  await pagina.goto(`${base}/admin/alunos/${adminId}`);
  await pagina.getByRole('heading', { name: 'Papel' }).waitFor();
  assert.equal(await pagina.getByRole('heading', { name: 'Apagar a conta' }).count(), 0);
});

test('sem o e-mail certo escrito, a conta não é apagada', async () => {
  await pagina.goto(`${base}/admin/alunos/${alunaId}`);
  const formulario = pagina.locator('form').filter({ has: pagina.getByRole('button', { name: 'Apagar a conta de vez' }) });
  for (const [vez, escrito] of [[1, ''], [2, vizinha.email]]) {
    await pagina.getByLabel('Para confirmar, escreva o e-mail desta pessoa').fill(escrito);
    await pagina.getByRole('button', { name: 'Apagar a conta de vez' }).click();
    await formulario.and(pagina.locator(`[data-vez="${vez}"]`)).waitFor();
    await pagina.getByText('Escreva o e-mail desta pessoa, igual ao que aparece no cadastro.').waitFor();
  }
  assert.equal(await contar('perfis', 'id', alunaId), 1);
  assert.equal(await contar('reservas', 'aluno_id', alunaId), 1);
});

test('com o e-mail escrito, somem o login, o cadastro, a matrícula e a reserva; o aviso de compra fica sem nome', async () => {
  await pagina.getByLabel('Para confirmar, escreva o e-mail desta pessoa').fill(`  ${aluna.email.toUpperCase()} `);
  await pagina.getByRole('button', { name: 'Apagar a conta de vez' }).click();
  await pagina.waitForURL('**/admin/alunos?aviso=conta_apagada');
  assert.equal(await textoDoAviso(pagina, 'status'), 'Conta apagada. A pessoa não entra mais, e os dados dela saíram da plataforma.');

  for (const [tabela, coluna] of [['perfis', 'id'], ['matriculas', 'aluno_id'], ['reservas', 'aluno_id'], ['notificacoes', 'aluno_id']]) {
    assert.equal(await contar(tabela, coluna, alunaId), 0, tabela);
  }
  assert.equal(await contar('notificacoes', 'destinatario', aluna.email), 0, 'registros de e-mail daquele endereço');
  const conta = await admin.auth.admin.getUserById(alunaId);
  assert.equal(conta.data?.user ?? null, null, 'o login não existe mais');

  const { data: aviso } = await admin.from('eventos_pagamento').select('payload, aluno_id').eq('chave_idempotencia', CHAVE).single();
  assert.equal(aviso.aluno_id, null);
  assert.equal('client' in aviso.payload, false, 'o aviso de compra fica sem o comprador');
  assert.equal(aviso.payload.product.id, 990000, 'e continua com o produto');
  assert.equal(JSON.stringify(aviso.payload).includes(aluna.email), false);

  const { data: historico } = await admin.from('registro_alteracoes').select('pessoa_id, antes, depois').eq('tabela', 'contas_apagadas').eq('registro', alunaId);
  assert.deepEqual(historico, [{ pessoa_id: adminId, antes: null, depois: null }], 'fica só o registro de quem apagou, sem dados da pessoa');

  // A colega continua como estava, e a vaga da turma voltou.
  assert.equal(await contar('reservas', 'aluno_id', vizinhaId), 1);
  assert.equal(await contar('reservas', 'turma_id', turmaId), 1);
});

test('quem teve a conta apagada não entra mais, nem com a sessão que já estava aberta', async () => {
  await dela.goto(`${base}/inicio`);
  assert.equal(caminho(dela), '/entrar', 'a sessão aberta deixa de valer');
  await entrar(dela, aluna.email, senha);
  await dela.waitForURL('**/entrar?error=credenciales');

  await pagina.goto(`${base}/admin/alunos/${alunaId}`);
  await pagina.waitForURL('**/admin/alunos?aviso=nao_encontrado');
});

test('a professora não abre a ficha nem apaga contas', async () => {
  const outra = await novaPagina(navegador);
  await entrar(outra, professora.email, senha);
  await outra.waitForURL('**/admin');
  await outra.goto(`${base}/admin/alunos/${vizinhaId}`);
  await outra.waitForURL('**/admin?aviso=so_administrador');
  assert.equal(await contar('perfis', 'id', vizinhaId), 1);
  await outra.context().close();
});
