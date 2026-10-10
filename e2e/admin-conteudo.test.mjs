// Teste de ponta a ponta da administração de conteúdo: o professor cria curso, módulos e
// aulas pelo navegador; o banco é conferido por fora; a aluna não entra nem grava.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { admin, base, caminho, clientePublico, criarPessoa, emailDeTeste, entrar, novaPagina, novoContexto, senha, textoDoAviso } from './apoio.mjs';

const sufixo = randomBytes(3).toString('hex');
const curso = { pt: `Curso de teste ${sufixo}`, es: `Curso de prueba ${sufixo}` };
const moduloA = `Módulo A ${sufixo}`;
const moduloB = `Módulo B ${sufixo}`;
const aula1 = { pt: `Lição única ${sufixo}`, es: `Lección única ${sufixo}` };
const aula2 = { pt: `Segunda aula ${sufixo}`, es: `Segunda clase ${sufixo}` };

const professor = { email: emailDeTeste('professor-conteudo'), nome: 'Professor Conteúdo', papel: 'professor' };
const aluna = { email: emailDeTeste('aluna-conteudo'), nome: 'Carmen Contenido' };

let navegador;
let pagina; // o professor, logado do começo ao fim
let alunaId;
let cursoId;
let idA;
let idB;
let idAula1;
let idAula2;

const cartaoDoCurso = () => pagina.locator('main section').filter({ has: pagina.getByRole('heading', { name: curso.pt }) });
const campo = (rotulo) => pagina.getByLabel(rotulo, { exact: true });

async function umaLinha(tabela, colunas, filtro) {
  let consulta = admin.from(tabela).select(colunas);
  for (const [coluna, valor] of Object.entries(filtro)) consulta = consulta.eq(coluna, valor);
  const { data, error } = await consulta.single();
  assert.equal(error, null, `${tabela}: ${error?.message}`);
  return data;
}

async function criarModulo(titulo) {
  await pagina.goto(`${base}/admin/cursos`);
  await cartaoDoCurso().getByRole('link', { name: 'Novo módulo' }).click();
  await pagina.waitForURL('**/admin/modulos/novo?curso=*');
  await campo('Título em português').fill(titulo);
  await campo('Título em espanhol').fill(titulo);
  await pagina.getByRole('button', { name: 'Salvar módulo' }).click();
  await pagina.waitForURL('**/admin/cursos?aviso=modulo_salvo');
  return (await umaLinha('modulos', 'id', { titulo_pt: titulo })).id;
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
  pagina = await novaPagina(navegador);
  await entrar(pagina, professor.email, senha);
  await pagina.waitForURL('**/admin');
});

after(async () => {
  await navegador?.close();
});

test('curso: campo vazio mostra o erro sem perder o que foi digitado; depois salva como rascunho', async () => {
  await pagina.goto(`${base}/admin/cursos/novo`);
  await campo('Título em português').fill(curso.pt);
  await pagina.getByRole('button', { name: 'Salvar curso' }).click();
  await pagina.getByText('Escreva o título em espanhol.').waitFor();
  assert.equal(caminho(pagina), '/admin/cursos/novo');
  assert.equal(await campo('Título em português').inputValue(), curso.pt, 'o título digitado continua no campo');

  await campo('Título em espanhol').fill(curso.es);
  await pagina.getByRole('button', { name: 'Salvar curso' }).click();
  await pagina.waitForURL('**/admin/cursos?aviso=curso_salvo');
  assert.equal(await textoDoAviso(pagina, 'status'), 'Curso salvo.');

  const linha = await umaLinha('cursos', 'id, titulo_es, tipo, modo, situacao', { titulo_pt: curso.pt });
  cursoId = linha.id;
  assert.deepEqual({ ...linha, id: undefined }, { id: undefined, titulo_es: curso.es, tipo: 'principal', modo: 'livre', situacao: 'rascunho' });
});

test('módulos: entram no fim da lista e trocam de lugar', async () => {
  idA = await criarModulo(moduloA);
  idB = await criarModulo(moduloB);
  const linhas = cartaoDoCurso().locator('ol > li');
  assert.equal(await linhas.count(), 2);
  await linhas.first().getByText(moduloA, { exact: true }).first().waitFor();

  await pagina.getByRole('button', { name: `Descer o módulo ${moduloA}` }).click();
  await linhas.first().getByText(moduloB, { exact: true }).first().waitFor();
  assert.equal((await umaLinha('modulos', 'ordem', { id: idB })).ordem, 1);
  assert.equal((await umaLinha('modulos', 'ordem', { id: idA })).ordem, 2);

  await pagina.getByRole('button', { name: `Subir o módulo ${moduloA}` }).click();
  await linhas.first().getByText(moduloA, { exact: true }).first().waitFor();
  assert.equal((await umaLinha('modulos', 'ordem', { id: idA })).ordem, 1);
  await pagina.screenshot({ path: 'capturas/admin-cursos-computador.png', fullPage: true });
});

test('aula: não publica sem vídeo, salva como rascunho e depois publica com vídeo', async () => {
  await pagina.goto(`${base}/admin/aulas/nova?modulo=${idA}`);
  assert.equal(await campo('Número').inputValue(), '1', 'sugere o próximo número livre do curso');
  assert.equal(await campo('Módulo').inputValue(), idA);
  await campo('Título em português').fill(aula1.pt);
  await campo('Título em espanhol').fill(aula1.es);

  await pagina.getByRole('button', { name: 'Salvar e publicar' }).click();
  await pagina.getByText('Para publicar, a aula precisa de um vídeo. Sem vídeo, salve como rascunho.').waitFor();
  assert.equal(await campo('Título em português').inputValue(), aula1.pt);
  assert.equal(await campo('Módulo').inputValue(), idA);

  await pagina.getByRole('button', { name: 'Salvar como rascunho' }).click();
  await pagina.waitForURL(/\/admin\/aulas\/[0-9a-f-]{36}\?aviso=aula_salva$/);
  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), 'Editar aula 1');
  idAula1 = caminho(pagina).split('/').pop();
  assert.equal((await umaLinha('aulas', 'situacao', { id: idAula1 })).situacao, 'rascunho');

  await campo('Link do vídeo no YouTube').fill('https://vimeo.com/123456');
  await pagina.getByRole('button', { name: 'Salvar e publicar' }).click();
  await pagina.getByText('Cole o link de um vídeo do YouTube. Exemplo: https://youtu.be/aB3dE6gH9jK').waitFor();
  assert.equal((await umaLinha('aulas', 'situacao', { id: idAula1 })).situacao, 'rascunho', 'link de outro site não publica');

  await campo('Link do vídeo no YouTube').fill('https://www.youtube.com/watch?v=aB3dE6gH9jK&t=42s');
  await campo('Duração').fill('12:30');
  await pagina.getByRole('button', { name: 'Salvar e publicar' }).click();
  await pagina.waitForURL('**/admin/aulas/*?aviso=aula_publicada');
  assert.equal(await textoDoAviso(pagina, 'status'), 'Aula salva e publicada.');
  assert.deepEqual(await umaLinha('aulas', 'modulo_id, numero, titulo_pt, titulo_es, video_id, duracao_seg, situacao', { id: idAula1 }), {
    modulo_id: idA, numero: 1, titulo_pt: aula1.pt, titulo_es: aula1.es, video_id: 'aB3dE6gH9jK', duracao_seg: 750, situacao: 'publicado',
  });
  assert.equal(await campo('Duração').inputValue(), '12:30');
  assert.equal(
    await pagina.getByTitle('Prévia do vídeo da aula').getAttribute('src'),
    'https://www.youtube-nocookie.com/embed/aB3dE6gH9jK',
    'a prévia aponta para o vídeo salvo',
  );
  await pagina.reload();
  assert.equal(await campo('Link do vídeo no YouTube').inputValue(), 'https://youtu.be/aB3dE6gH9jK', 'o campo mostra o link limpo');
  await pagina.screenshot({ path: 'capturas/admin-aula-computador.png', fullPage: true });
});

test('aula: número repetido no curso é recusado, mesmo em outro módulo', async () => {
  await pagina.goto(`${base}/admin/aulas/nova?modulo=${idB}`);
  assert.equal(await campo('Número').inputValue(), '2');
  await campo('Número').fill('1');
  await campo('Título em português').fill(aula2.pt);
  await campo('Título em espanhol').fill(aula2.es);
  await pagina.getByRole('button', { name: 'Salvar como rascunho' }).click();
  await pagina.getByText('Já existe a aula nº 1 neste curso.').waitFor();

  await campo('Número').fill('2');
  await pagina.getByRole('button', { name: 'Salvar como rascunho' }).click();
  await pagina.waitForURL(/\/admin\/aulas\/[0-9a-f-]{36}\?aviso=aula_salva$/);
  idAula2 = caminho(pagina).split('/').pop();
  assert.equal((await umaLinha('aulas', 'modulo_id', { id: idAula2 })).modulo_id, idB);
});

test('lista de aulas: filtra por módulo, situação e busca sem acento', async () => {
  const linhas = pagina.locator('main tbody tr');

  await pagina.goto(`${base}/admin/aulas?modulo=${idA}`);
  assert.equal(await linhas.count(), 1);
  assert.match(await linhas.first().innerText(), new RegExp(aula1.pt));
  assert.match(await linhas.first().innerText(), /12:30/);
  assert.match(await linhas.first().innerText(), /Publicada/);

  await pagina.goto(`${base}/admin/aulas?modulo=${idB}&situacao=rascunho`);
  assert.equal(await linhas.count(), 1);
  assert.match(await linhas.first().innerText(), /Sem vídeo/);

  await pagina.goto(`${base}/admin/aulas?modulo=${idB}&situacao=publicado`);
  assert.equal(await linhas.count(), 0);
  await pagina.getByText('Nenhuma aula com esses filtros.').waitFor();

  await pagina.goto(`${base}/admin/aulas`);
  await campo('Buscar').fill(`licao unica ${sufixo}`);
  await pagina.getByRole('button', { name: 'Filtrar' }).click();
  await pagina.waitForURL('**/admin/aulas?*busca=*');
  assert.equal(await linhas.count(), 1);

  await pagina.goto(`${base}/admin/aulas?busca=${sufixo}`);
  assert.equal(await linhas.count(), 2);
  await pagina.screenshot({ path: 'capturas/admin-aulas-computador.png', fullPage: true });
});

test('no celular, as telas da administração cabem na largura', async () => {
  const contexto = await novoContexto(navegador, 390, 844);
  const celular = await contexto.newPage();
  await entrar(celular, professor.email, senha);
  await celular.waitForURL('**/admin');
  for (const [rota, nome] of [['/admin/cursos', 'cursos'], [`/admin/aulas?busca=${sufixo}`, 'aulas'], [`/admin/aulas/${idAula1}`, 'aula']]) {
    await celular.goto(`${base}${rota}`, { waitUntil: 'networkidle' });
    const sobra = await celular.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(sobra <= 0, `${rota} passa ${sobra}px da largura da tela`);
    await celular.screenshot({ path: `capturas/admin-${nome}-celular.png`, fullPage: true });
  }
  await contexto.close();
});

test('aluna não abre as telas da administração e não grava conteúdo pelo banco', async () => {
  const dela = await novaPagina(navegador);
  await entrar(dela, aluna.email, senha);
  await dela.waitForURL('**/inicio');
  for (const rota of ['/admin/cursos', '/admin/aulas', '/admin/aulas/nova', `/admin/aulas/${idAula1}`, '/admin/lixeira']) {
    await dela.goto(`${base}${rota}`);
    assert.equal(caminho(dela), '/inicio', rota);
  }

  const cliente = await comoAluna();
  const criar = await cliente.from('cursos').insert({ titulo_pt: 'Invasão', titulo_es: 'Invasión' }).select('id');
  assert.notEqual(criar.error, null, 'aluna não cria curso');
  const alterar = await cliente.from('aulas').update({ titulo_pt: 'Alterada' }).eq('id', idAula1).select('id');
  assert.deepEqual(alterar.data ?? [], [], 'aluna não altera aula');
  const apagar = await cliente.from('aulas').delete().eq('id', idAula1).select('id');
  assert.deepEqual(apagar.data ?? [], [], 'aluna não apaga aula');
  assert.equal((await umaLinha('aulas', 'titulo_pt', { id: idAula1 })).titulo_pt, aula1.pt);

  // Sem matrícula, não lê nem a aula publicada.
  const ler = await cliente.from('aulas').select('id').in('id', [idAula1, idAula2]);
  assert.deepEqual(ler.data ?? [], []);
});

test('aluna matriculada só vê a aula publicada, e só depois de o curso ser publicado', async () => {
  const { error } = await admin.from('matriculas').insert({ aluno_id: alunaId, curso_id: cursoId, origem: 'manual' });
  assert.equal(error, null, error?.message);
  const cliente = await comoAluna();
  const aulasDela = async () => ((await cliente.from('aulas').select('id').in('id', [idAula1, idAula2])).data ?? []).map((a) => a.id);

  assert.deepEqual(await aulasDela(), [], 'curso ainda em rascunho');

  await pagina.goto(`${base}/admin/cursos`);
  await cartaoDoCurso().getByRole('link', { name: 'Editar curso' }).click();
  await pagina.waitForURL(`**/admin/cursos/${cursoId}`);
  await campo('Situação').selectOption('publicado');
  await pagina.getByRole('button', { name: 'Salvar curso' }).click();
  await pagina.waitForURL('**/admin/cursos?aviso=curso_salvo');

  assert.deepEqual(await aulasDela(), [idAula1], 'só a publicada; o rascunho fica de fora');
});

test('lixeira: módulo com aula não vai; a aula vai, some para a aluna e volta como rascunho', async () => {
  await pagina.goto(`${base}/admin/modulos/${idA}`);
  await pagina.getByText('Este módulo tem 1 aula.').waitFor();
  assert.equal(await pagina.getByRole('button', { name: 'Mover o módulo para a lixeira' }).count(), 0);

  await pagina.goto(`${base}/admin/aulas/${idAula1}`);
  await pagina.getByRole('button', { name: 'Mover a aula para a lixeira' }).click();
  await pagina.waitForURL('**/admin/aulas?aviso=na_lixeira');
  const naLixeira = await umaLinha('aulas', 'arquivado_em, situacao', { id: idAula1 });
  assert.notEqual(naLixeira.arquivado_em, null);
  assert.equal(naLixeira.situacao, 'rascunho');

  const cliente = await comoAluna();
  assert.deepEqual((await cliente.from('aulas').select('id').eq('id', idAula1)).data ?? [], [], 'a aluna deixa de ver');

  await pagina.goto(`${base}/admin/aulas/${idAula1}`);
  await pagina.waitForURL('**/admin/aulas?aviso=nao_encontrado');

  // Com a aula 1 na lixeira, o número 1 fica livre e outra aula pode usá-lo.
  await pagina.goto(`${base}/admin/aulas/${idAula2}`);
  await campo('Número').fill('1');
  await pagina.getByRole('button', { name: 'Salvar como rascunho' }).click();
  await pagina.waitForURL('**/admin/aulas/*?aviso=aula_salva');

  await pagina.goto(`${base}/admin/lixeira`);
  await pagina.getByRole('button', { name: `Restaurar aula 1. ${aula1.pt}` }).click();
  await pagina.waitForURL('**/admin/lixeira?aviso=numero_ocupado');
  assert.notEqual((await umaLinha('aulas', 'arquivado_em', { id: idAula1 })).arquivado_em, null, 'não restaura com número repetido');

  await pagina.goto(`${base}/admin/aulas/${idAula2}`);
  await campo('Número').fill('2');
  await pagina.getByRole('button', { name: 'Salvar como rascunho' }).click();
  await pagina.waitForURL('**/admin/aulas/*?aviso=aula_salva');

  await pagina.goto(`${base}/admin/lixeira`);
  await pagina.screenshot({ path: 'capturas/admin-lixeira-computador.png', fullPage: true });
  await pagina.getByRole('button', { name: `Restaurar aula 1. ${aula1.pt}` }).click();
  await pagina.waitForURL('**/admin/lixeira?aviso=restaurado');
  assert.deepEqual(await umaLinha('aulas', 'arquivado_em, situacao', { id: idAula1 }), { arquivado_em: null, situacao: 'rascunho' });
  assert.deepEqual((await cliente.from('aulas').select('id').eq('id', idAula1)).data ?? [], [], 'restaurar não publica sozinho');
});

test('lixeira: curso só vai depois dos módulos, e módulo não volta antes do curso', async () => {
  await pagina.goto(`${base}/admin/cursos`);
  assert.equal(await cartaoDoCurso().getByRole('button', { name: 'Mover o curso para a lixeira' }).count(), 0);

  // Esvazia: as duas aulas e os dois módulos vão para a lixeira.
  for (const id of [idAula1, idAula2]) {
    await pagina.goto(`${base}/admin/aulas/${id}`);
    await pagina.getByRole('button', { name: 'Mover a aula para a lixeira' }).click();
    await pagina.waitForURL('**/admin/aulas?aviso=na_lixeira');
  }
  for (const id of [idA, idB]) {
    await pagina.goto(`${base}/admin/modulos/${id}`);
    await pagina.getByRole('button', { name: 'Mover o módulo para a lixeira' }).click();
    await pagina.waitForURL('**/admin/cursos?aviso=na_lixeira');
  }
  await cartaoDoCurso().getByRole('button', { name: 'Mover o curso para a lixeira' }).click();
  await cartaoDoCurso().waitFor({ state: 'detached' });
  assert.notEqual((await umaLinha('cursos', 'arquivado_em', { id: cursoId })).arquivado_em, null);

  await pagina.goto(`${base}/admin/lixeira`);
  await pagina.getByRole('button', { name: `Restaurar módulo ${moduloA}` }).click();
  await pagina.waitForURL('**/admin/lixeira?aviso=restaurar_curso_antes');
  await pagina.getByRole('button', { name: `Restaurar aula 1. ${aula1.pt}` }).click();
  await pagina.waitForURL('**/admin/lixeira?aviso=restaurar_modulo_antes');

  await pagina.getByRole('button', { name: `Restaurar curso ${curso.pt}` }).click();
  await pagina.waitForURL('**/admin/lixeira?aviso=restaurado');
  assert.deepEqual(await umaLinha('cursos', 'arquivado_em, situacao', { id: cursoId }), { arquivado_em: null, situacao: 'rascunho' });
});
