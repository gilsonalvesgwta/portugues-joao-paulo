// Teste de ponta a ponta do editor de anotações da aula: o professor monta os blocos pelo
// navegador, a prévia acompanha, o banco é conferido por fora e a aluna não entra nem grava.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { admin, base, caminho, clientePublico, criarPessoa, emailDeTeste, entrar, novaPagina, novoContexto, senha, textoDoAviso } from './apoio.mjs';

const sufixo = randomBytes(3).toString('hex');
const professor = { email: emailDeTeste('professor-notas'), nome: 'Professor Notas', papel: 'professor' };
const aluna = { email: emailDeTeste('aluna-notas'), nome: 'Sofía Apuntes' };

let navegador;
let pagina; // o professor, logado do começo ao fim
let aulaId;
// Resposta às janelas de confirmação do navegador ("sair sem salvar?").
let aoPerguntar = 'aceitar';

const bloco = (n, nome) => pagina.getByRole('region', { name: `Bloco ${n}: ${nome}` });
const adicionar = (nome) => pagina.getByRole('region', { name: 'Adicionar bloco' }).getByRole('button', { name: new RegExp(`^${nome}`) }).click();
const previa = () => pagina.getByRole('complementary', { name: 'Prévia do aluno' });
const salvar = () => pagina.getByRole('button', { name: 'Salvar anotações' }).click();
const situacao = (texto) => pagina.locator('main [role="status"]').filter({ hasText: texto }).waitFor();

async function criar(tabela, linha) {
  const { data, error } = await admin.from(tabela).insert(linha).select('id').single();
  assert.equal(error, null, `${tabela}: ${error?.message}`);
  return data.id;
}

async function gravadas() {
  const { data, error } = await admin.from('aulas').select('anotacoes').eq('id', aulaId).single();
  assert.equal(error, null, error?.message);
  return data.anotacoes;
}

before(async () => {
  await mkdir('capturas', { recursive: true });
  navegador = await chromium.launch();
  await criarPessoa(professor);
  await criarPessoa(aluna);
  const cursoId = await criar('cursos', { titulo_pt: `Curso das notas ${sufixo}`, titulo_es: `Curso de apuntes ${sufixo}` });
  const moduloId = await criar('modulos', { curso_id: cursoId, ordem: 1, titulo_pt: `Módulo ${sufixo}`, titulo_es: `Módulo ${sufixo}` });
  aulaId = await criar('aulas', { modulo_id: moduloId, numero: 7, titulo_pt: `Verbo ser ${sufixo}`, titulo_es: `El verbo ser ${sufixo}` });

  pagina = await novaPagina(navegador);
  pagina.on('dialog', (janela) => (aoPerguntar === 'aceitar' ? janela.accept() : janela.dismiss()));
  await entrar(pagina, professor.email, senha);
  await pagina.waitForURL('**/admin');
});

after(async () => {
  await navegador?.close();
});

test('aula sem anotações: a tela diz isso e a prévia espera', async () => {
  await pagina.goto(`${base}/admin/aulas/${aulaId}`);
  await pagina.getByText('Esta aula ainda não tem anotações.').waitFor();
  await pagina.getByRole('link', { name: 'Criar anotações' }).click();
  await pagina.waitForURL(`**/admin/aulas/${aulaId}/anotacoes`);
  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), 'Anotações da aula 7');
  assert.equal(await textoDoAviso(pagina, 'status'), 'Esta aula ainda não tem anotações.');
  await previa().getByText('A prévia aparece aqui conforme você preenche os blocos.').waitFor();
});

test('monta os blocos, a prévia acompanha e o que é salvo confere com o banco', async () => {
  await adicionar('Capa');
  await bloco(1, 'Capa').getByLabel('Título (em espanhol)').fill('  El verbo   ser ');
  await bloco(1, 'Capa').getByLabel('Resumo (opcional)').fill('Cómo decir quién eres.');
  await previa().getByText('CLASE 7 — APUNTES').waitFor();
  await previa().getByRole('heading', { name: 'El verbo ser' }).waitFor();

  await adicionar('Seção numerada');
  await bloco(2, 'Seção numerada').getByLabel('Título da seção (em espanhol)').fill('En la práctica');
  await previa().getByText('01 — EN LA PRÁCTICA').waitFor();
  // Enter em campo de uma linha não salva: salvar é só pelo botão.
  await bloco(2, 'Seção numerada').getByLabel('Título da seção (em espanhol)').press('Enter');
  await situacao('Há alterações que ainda não foram salvas.');
  await pagina.waitForTimeout(300);
  assert.deepEqual(await gravadas(), []);

  await adicionar('Pares de exemplo');
  await bloco(3, 'Pares de exemplo').getByLabel('Frase em português, linha 1').fill('Ele é professor.');
  await bloco(3, 'Pares de exemplo').getByLabel('Tradução em espanhol, linha 1').fill('Él es profesor.');
  await previa().getByText('Él es profesor.').waitFor();

  await adicionar('Nota do professor');
  await bloco(4, 'Nota do professor').getByLabel('Texto da nota').fill('Se dice **sou**, no "soy".\n\n<script>window.invadido = 1</script><b>x</b>');
  await previa().locator('strong', { hasText: 'sou' }).waitFor();
  assert.equal(await pagina.evaluate(() => window.invadido), undefined, 'texto do professor nunca roda como programa');
  assert.equal(await previa().locator('script, b').count(), 0, 'nem vira HTML');
  await previa().getByText('<script>window.invadido = 1</script><b>x</b>').waitFor();

  await adicionar('Vocabulário');
  await bloco(5, 'Vocabulário').getByLabel('Palavra em português, linha 1').fill('cidade');
  await bloco(5, 'Vocabulário').getByLabel('Tradução em espanhol, linha 1').fill('ciudad');
  await bloco(5, 'Vocabulário').getByLabel('Palavra em português, linha 2').fill('escritório');
  await bloco(5, 'Vocabulário').getByLabel('Tradução em espanhol, linha 2').fill('oficina');

  await adicionar('Tabela-resumo');
  const tabela = bloco(6, 'Tabela-resumo');
  await tabela.getByLabel('Título da coluna 1').fill('Persona');
  await tabela.getByLabel('Título da coluna 2').fill('Ser');
  await tabela.getByLabel('Linha 1, coluna 1').fill('eu');
  await tabela.getByLabel('Linha 1, coluna 2').fill('sou');
  await tabela.getByRole('button', { name: 'Adicionar linha' }).click();
  await tabela.getByLabel('Linha 2, coluna 1').fill('você');
  await tabela.getByLabel('Linha 2, coluna 2').fill('é');
  await previa().getByRole('columnheader', { name: 'Persona' }).waitFor();

  assert.equal(await pagina.getByRole('region', { name: 'Adicionar bloco' }).getByRole('button', { name: /^Capa/ }).isDisabled(), true, 'só uma capa');
  await pagina.screenshot({ path: 'capturas/admin-anotacoes-computador.png', fullPage: true });

  await salvar();
  await situacao('Anotações salvas.');
  const salvo = await gravadas();
  assert.deepEqual(salvo.map((b) => b.tipo), ['capa', 'secao', 'pares', 'nota', 'vocabulario', 'tabela']);
  assert.equal(salvo[0].titulo, 'El verbo ser', 'espaços sobrando são tirados');
  assert.deepEqual(salvo[2].itens, [{ pt: 'Ele é professor.', es: 'Él es profesor.' }], 'a linha em branco não é gravada');
  assert.equal(salvo[3].texto, 'Se dice **sou**, no "soy".\n\n<script>window.invadido = 1</script><b>x</b>');
  assert.deepEqual(salvo[4].itens, [{ pt: 'cidade', es: 'ciudad' }, { pt: 'escritório', es: 'oficina' }]);
  assert.deepEqual({ colunas: salvo[5].colunas, linhas: salvo[5].linhas }, { colunas: ['Persona', 'Ser'], linhas: [['eu', 'sou'], ['você', 'é']] });
  assert.equal(await bloco(1, 'Capa').getByLabel('Título (em espanhol)').inputValue(), 'El verbo ser', 'a tela passa a mostrar o que ficou gravado');
});

test('reabre com o que foi salvo; reordena e remove blocos', async () => {
  await pagina.reload();
  assert.equal(await textoDoAviso(pagina, 'status'), 'Tudo salvo.');
  assert.equal(await bloco(3, 'Pares de exemplo').getByLabel('Frase em português, linha 1').inputValue(), 'Ele é professor.');
  await previa().getByText('<script>window.invadido = 1</script><b>x</b>').waitFor();
  assert.equal(await pagina.evaluate(() => window.invadido), undefined);

  assert.equal(await pagina.getByRole('button', { name: 'Descer o bloco 1' }).isDisabled(), true, 'a capa fica no topo');
  assert.equal(await pagina.getByRole('button', { name: 'Subir o bloco 2' }).isDisabled(), true, 'nada sobe acima da capa');

  await pagina.getByRole('button', { name: 'Descer o bloco 3' }).click();
  await bloco(3, 'Nota do professor').waitFor();
  await bloco(4, 'Pares de exemplo').waitFor();
  await pagina.getByRole('button', { name: 'Remover o bloco 6' }).click();
  assert.equal(await pagina.getByRole('region', { name: /^Bloco 6/ }).count(), 0);
  assert.equal(await previa().getByRole('table').count(), 0, 'a tabela some da prévia');

  await salvar();
  await situacao('Anotações salvas.');
  assert.deepEqual((await gravadas()).map((b) => b.tipo), ['capa', 'secao', 'nota', 'pares', 'vocabulario']);
});

test('bloco incompleto não salva nada e é apontado na tela', async () => {
  const antes = await gravadas();
  await adicionar('Seção numerada');
  await bloco(4, 'Pares de exemplo').getByLabel('Tradução em espanhol, linha 1').fill('');
  await salvar();
  assert.equal(await textoDoAviso(pagina), 'Nada foi salvo. Corrija os blocos marcados e salve de novo.');
  await bloco(6, 'Seção numerada').getByText('Preencha: título da seção.').waitFor();
  await bloco(4, 'Pares de exemplo').getByText('Preencha: tradução em espanhol.').waitFor();
  assert.deepEqual(await gravadas(), antes, 'o banco fica como estava');
  assert.equal(await bloco(4, 'Pares de exemplo').getByLabel('Frase em português, linha 1').inputValue(), 'Ele é professor.', 'nada do que foi digitado se perde');

  await pagina.getByRole('button', { name: 'Remover o bloco 6' }).click();
  await bloco(4, 'Pares de exemplo').getByLabel('Tradução em espanhol, linha 1').fill('Él es profesor.');
  await salvar();
  await situacao('Anotações salvas.');
  assert.equal((await gravadas()).length, 5);
});

test('com alteração sem salvar, sair pede confirmação', async () => {
  await bloco(3, 'Nota do professor').getByLabel('Texto da nota').fill('Texto que não será salvo.');
  await situacao('Há alterações que ainda não foram salvas.');

  aoPerguntar = 'recusar';
  await pagina.getByRole('link', { name: 'Editar aula 7' }).click();
  await pagina.waitForTimeout(400);
  assert.equal(caminho(pagina), `/admin/aulas/${aulaId}/anotacoes`, 'recusou: continua no editor');
  assert.equal(await bloco(3, 'Nota do professor').getByLabel('Texto da nota').inputValue(), 'Texto que não será salvo.');

  aoPerguntar = 'aceitar';
  await pagina.getByRole('link', { name: 'Editar aula 7' }).click();
  await pagina.waitForURL(`**/admin/aulas/${aulaId}`);
  await pagina.getByText('5 blocos de anotações.').waitFor();
  assert.equal((await gravadas())[2].texto.startsWith('Se dice'), true, 'o que não foi salvo não foi gravado');

  await pagina.goto(`${base}/admin/aulas?busca=${sufixo}`);
  assert.match(await pagina.locator('main tbody tr').first().innerText(), /5 blocos/);
});

test('no celular, o editor cabe na largura', async () => {
  const contexto = await novoContexto(navegador, 390, 844);
  const celular = await contexto.newPage();
  await entrar(celular, professor.email, senha);
  await celular.waitForURL('**/admin');
  await celular.goto(`${base}/admin/aulas/${aulaId}/anotacoes`, { waitUntil: 'networkidle' });
  const sobra = await celular.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(sobra <= 0, `o editor passa ${sobra}px da largura da tela`);
  await celular.screenshot({ path: 'capturas/admin-anotacoes-celular.png', fullPage: true });
  await contexto.close();
});

test('aluna não abre o editor e não grava anotações pelo banco', async () => {
  const dela = await novaPagina(navegador);
  await entrar(dela, aluna.email, senha);
  await dela.waitForURL('**/inicio');
  await dela.goto(`${base}/admin/aulas/${aulaId}/anotacoes`);
  assert.equal(caminho(dela), '/inicio');

  const antes = await gravadas();
  const cliente = clientePublico();
  const { error } = await cliente.auth.signInWithPassword({ email: aluna.email, password: senha });
  assert.equal(error, null, error?.message);
  const tentativa = await cliente.from('aulas').update({ anotacoes: [] }).eq('id', aulaId).select('id');
  assert.deepEqual(tentativa.data ?? [], [], 'aluna não altera as anotações');
  assert.deepEqual(await gravadas(), antes);
});
