// O jogo de combinar pares do quiz, de ponta a ponta: o professor grava a palavra pelo microfone
// (um microfone de teste do navegador), envia um arquivo de áudio para outra e deixa uma sem
// gravação; joga na prévia, publica, e a aluna combina os pares. O gabarito (a palavra gravada)
// nunca vai para a página da aluna, e o áudio só sai para quem está logado.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { escreverWav } from '../src/lib/wav.ts';
import { admin, base, clientePublico, criarPessoa, emailDeTeste, entrar, novoContexto, senha } from './apoio.mjs';

const sufixo = randomBytes(3).toString('hex');
const professor = { email: emailDeTeste('professor-pares'), nome: 'Professor Pares', papel: 'professor' };
const aluna = { email: emailDeTeste('aluna-pares'), nome: 'Lucía Pares' };
const PARES = [
  { palavra: 'tudo bem', traducao: 'todo bien' },
  { palavra: 'obrigado', traducao: 'gracias' },
  { palavra: 'tchau', traducao: 'adiós' },
];

let navegador;
let pagina; // o professor
let aulaId;

const previa = () => pagina.getByRole('complementary', { name: 'Prévia do aluno' });
const pergunta = () => pagina.getByRole('region', { name: 'Pergunta 1: Combinar pares' });

async function criar(tabela, linha) {
  const { data, error } = await admin.from(tabela).insert(linha).select('id').single();
  assert.equal(error, null, `${tabela}: ${error?.message}`);
  return data.id;
}

async function perguntaNoBanco() {
  const { data: quiz } = await admin.from('quizzes').select('id, situacao').eq('aula_id', aulaId).maybeSingle();
  const { data: perguntas } = await admin.from('perguntas').select('id, tipo, conteudo').eq('quiz_id', quiz.id);
  return { quiz, pergunta: perguntas[0] };
}

before(async () => {
  await mkdir('capturas', { recursive: true });
  // Microfone de teste: o navegador "ouve" um arquivo com um tom (no lugar da voz) e aceita o
  // pedido de permissão sozinho.
  const pasta = await mkdtemp(join(tmpdir(), 'microfone-'));
  const voz = join(pasta, 'voz.wav');
  const amostras = new Float32Array(44_100 * 3);
  for (let i = 22_050; i < 44_100 * 2; i += 1) amostras[i] = 0.5 * Math.sin((2 * Math.PI * 220 * i) / 44_100);
  await writeFile(voz, escreverWav(amostras, 44_100));
  navegador = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${voz}`, '--autoplay-policy=no-user-gesture-required'],
  });
  await criarPessoa(professor);
  const alunaId = await criarPessoa(aluna);
  const cursoId = await criar('cursos', { titulo_pt: `Curso dos pares ${sufixo}`, titulo_es: `Curso de pares ${sufixo}`, situacao: 'publicado' });
  const moduloId = await criar('modulos', { curso_id: cursoId, ordem: 1, titulo_pt: `Módulo ${sufixo}`, titulo_es: `Módulo ${sufixo}` });
  aulaId = await criar('aulas', {
    modulo_id: moduloId, numero: 1, titulo_pt: `Saudações ${sufixo}`, titulo_es: `Saludos ${sufixo}`, video_id: 'aB3dE6gH9jK', situacao: 'publicado',
  });
  await criar('matriculas', { aluno_id: alunaId, curso_id: cursoId, origem: 'manual' });

  const contexto = await novoContexto(navegador);
  await contexto.grantPermissions(['microphone'], { origin: base });
  pagina = await contexto.newPage();
  pagina.on('dialog', (janela) => janela.accept());
  await entrar(pagina, professor.email, senha);
  await pagina.waitForURL('**/admin');
});

after(async () => {
  await navegador?.close();
});

test('o professor monta os pares: grava uma palavra, envia o áudio de outra e deixa uma para a voz do navegador', async () => {
  await pagina.goto(`${base}/admin/aulas/${aulaId}/quiz`);
  await pagina.getByRole('region', { name: 'Adicionar pergunta' }).getByRole('button', { name: /^Combinar pares/ }).click();
  const p = pergunta();
  await p.getByLabel('O aluno ouve a palavra').waitFor();
  assert.equal(await p.getByLabel('O aluno ouve a palavra').isChecked(), true, 'começa com áudio');
  // Começa com 4 pares; o quarto sai.
  await p.getByRole('button', { name: 'Remover o par 4' }).click();
  for (const [i, par] of PARES.entries()) {
    await p.getByLabel(`Palavra ${i + 1}, em português`).fill(par.palavra);
    await p.getByLabel(`Tradução ${i + 1}, em espanhol`).fill(par.traducao);
  }

  // Palavra 1: gravada pelo microfone.
  await p.getByRole('button', { name: 'Gravar a palavra 1' }).click();
  await p.getByText(/^Gravando…/).waitFor();
  await pagina.waitForTimeout(2500);
  await p.getByRole('button', { name: 'Parar a gravação da palavra 1' }).click();
  await p.getByRole('listitem').nth(0).getByText('Com a sua gravação').waitFor({ timeout: 15_000 });

  // Palavra 2: um arquivo de áudio pronto. Um arquivo que não é áudio é recusado antes.
  const pasta = await mkdtemp(join(tmpdir(), 'pares-'));
  const falso = join(pasta, 'nao-e-audio.mp3');
  await writeFile(falso, '<html>não sou áudio</html>'.repeat(10));
  await p.locator('[data-arquivo-da-palavra="2"]').setInputFiles(falso);
  await p.getByRole('listitem').nth(1).getByText('Esse arquivo não é de áudio.', { exact: false }).waitFor();
  const tom = new Float32Array(11_025).map((_, i) => 0.4 * Math.sin((2 * Math.PI * 330 * i) / 22_050));
  const arquivo = join(pasta, 'obrigado.wav');
  await writeFile(arquivo, escreverWav(tom, 22_050));
  await p.locator('[data-arquivo-da-palavra="2"]').setInputFiles(arquivo);
  await p.getByRole('listitem').nth(1).getByText('Com a sua gravação').waitFor();
  await p.getByRole('listitem').nth(2).getByText('Sem gravação: o navegador lê a palavra').waitFor();

  // Na prévia dá para jogar: um par errado pisca, um certo mostra a palavra.
  const jogo = previa();
  await jogo.getByText('Combina el audio con la traducción').waitFor();
  await jogo.getByRole('button', { name: 'gracias' }).click();
  await jogo.getByRole('button', { name: 'Escuchar el audio 1' }).click();
  await jogo.getByText('No es esa. Inténtalo de nuevo.').waitFor();
  await jogo.getByRole('button', { name: 'todo bien' }).click();
  await jogo.getByRole('button', { name: 'Escuchar el audio 1' }).click();
  await jogo.getByRole('button', { name: 'tudo bem, combinado' }).waitFor();
  await pagina.screenshot({ path: 'capturas/admin-quiz-pares-computador.png', fullPage: true });

  await pagina.getByRole('button', { name: 'Salvar e publicar', exact: true }).click();
  await pagina.locator('main [role="status"]').filter({ hasText: 'Quiz salvo e publicado.' }).waitFor();

  const { quiz, pergunta: gravada } = await perguntaNoBanco();
  assert.equal(quiz.situacao, 'publicado');
  assert.equal(gravada.tipo, 'parear_audio');
  assert.equal(gravada.conteudo.modo, 'audio');
  assert.deepEqual(gravada.conteudo.pares.map((par) => [par.palavra, par.traducao, typeof par.audio]), [
    ['tudo bem', 'todo bien', 'string'],
    ['obrigado', 'gracias', 'string'],
    ['tchau', 'adiós', 'undefined'],
  ]);
  const { data: audios } = await admin.from('audios').select('id, tipo').eq('aula_id', aulaId);
  assert.deepEqual(audios.map((a) => a.tipo).sort(), ['audio/wav', 'audio/wav'], 'a gravação do microfone também sai em WAV');

  // Abrindo de novo, o editor mostra o que ficou gravado.
  await pagina.reload();
  await pergunta().getByLabel('Palavra 3, em português').waitFor();
  assert.equal(await pergunta().getByLabel('Palavra 2, em português').inputValue(), 'obrigado');
  assert.equal(await pergunta().getByText('Com a sua gravação').count(), 2);
});

test('no celular, o editor dos pares cabe na largura', async () => {
  const contexto = await novoContexto(navegador, 390, 844);
  const celular = await contexto.newPage();
  await entrar(celular, professor.email, senha);
  await celular.waitForURL('**/admin');
  await celular.goto(`${base}/admin/aulas/${aulaId}/quiz`, { waitUntil: 'networkidle' });
  const sobra = await celular.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(sobra <= 0, `o editor passa ${sobra}px da largura da tela`);
  await celular.screenshot({ path: 'capturas/admin-quiz-pares-celular.png', fullPage: true });
  await contexto.close();
});

// A aluna joga. O cartão de cima não diz a palavra: o teste lê qual par ele é (a posição na lista
// do professor, que não revela a tradução) e procura o par no banco.
async function abrirComoAluna(largura = 1280, altura = 900) {
  const contexto = await novoContexto(navegador, largura, altura);
  const dela = await contexto.newPage();
  await entrar(dela, aluna.email, senha);
  await dela.waitForURL('**/inicio');
  const { quiz } = await perguntaNoBanco();
  await dela.goto(`${base}/quiz/${quiz.id}`);
  await dela.getByText('Combina el audio con la traducción').waitFor();
  return { contexto, dela, quizId: quiz.id };
}

async function descobrirCartoes(dela) {
  const { pergunta: gravada } = await perguntaNoBanco();
  const mapa = [];
  for (let n = 1; n <= PARES.length; n += 1) {
    const indice = Number(await dela.getByRole('button', { name: `Escuchar el audio ${n}` }).getAttribute('data-indice'));
    mapa.push(gravada.conteudo.pares[indice]);
  }
  return mapa;
}

test('a página da aluna não traz a palavra gravada, e o áudio só sai para quem está logado', async () => {
  const { contexto, dela } = await abrirComoAluna();
  const html = await dela.content();
  assert.equal(html.includes('tudo bem'), false, 'a palavra gravada não vai na página');
  assert.equal(html.includes('obrigado'), false, 'a palavra do arquivo enviado não vai na página');
  assert.equal(html.includes('tchau'), true, 'a palavra sem gravação vai, para o navegador ler em voz alta');

  const { data: audios } = await admin.from('audios').select('id').eq('aula_id', aulaId);
  const endereco = `${base}/api/audio/${audios[0].id}`;
  const inteiro = await dela.request.get(endereco);
  assert.equal(inteiro.status(), 200);
  assert.equal(inteiro.headers()['content-type'], 'audio/wav');
  const pedaco = await dela.request.get(endereco, { headers: { range: 'bytes=0-11' } });
  assert.equal(pedaco.status(), 206, 'atende pedido de pedaço (o Safari precisa)');
  assert.equal((await pedaco.body()).toString('latin1', 0, 4), 'RIFF');

  const visitante = await navegador.newContext();
  const semLogin = await visitante.request.get(endereco, { maxRedirects: 0 });
  assert.notEqual(semLogin.status(), 200, 'sem login, o áudio não sai');
  await visitante.close();

  // Pelo banco, a aluna não lê os áudios nem grava um.
  const cliente = clientePublico();
  await cliente.auth.signInWithPassword({ email: aluna.email, password: senha });
  assert.deepEqual((await cliente.from('audios').select('id')).data ?? [], []);
  const gravar = await cliente.from('audios').insert({ aula_id: aulaId, tipo: 'audio/wav', dados: '\\x' + '52494646'.repeat(20) });
  assert.notEqual(gravar.error, null, 'aluna não grava áudio');
  const envio = await dela.request.post(`${base}/api/admin/audios?aula=${aulaId}`, { headers: { 'x-audio-do-quiz': '1' }, data: Buffer.alloc(100) });
  assert.equal(envio.status(), 403);
  await contexto.close();
});

test('a aluna combina todos os pares sem errar: pergunta certa; com um erro no caminho, errada', async () => {
  const { contexto, dela } = await abrirComoAluna();
  const mapa = await descobrirCartoes(dela);
  assert.deepEqual(mapa.map((par) => par.palavra).sort(), PARES.map((par) => par.palavra).sort());

  for (const [i, par] of mapa.entries()) {
    await dela.getByRole('button', { name: `Escuchar el audio ${i + 1}` }).click();
    await dela.getByRole('button', { name: par.traducao, exact: true }).click();
    await dela.getByRole('button', { name: `${par.palavra}, combinado` }).waitFor();
  }
  await dela.getByText('¡Todos los pares combinados!').waitFor();
  await dela.screenshot({ path: 'capturas/aluno-quiz-pares-computador.png', fullPage: true });
  await dela.getByRole('button', { name: 'Corregir mis respuestas' }).click();
  await dela.getByText('1 de 1 · 100 %').waitFor();
  await dela.getByText('Correcta', { exact: true }).waitFor();

  // De novo, agora começando pela tradução e com um erro: a pergunta conta como errada.
  await dela.getByRole('link', { name: 'Intentar de nuevo' }).click();
  await dela.getByText('Combina el audio con la traducción').waitFor();
  const outra = await descobrirCartoes(dela);
  const [primeiro, segundo] = outra;
  await dela.getByRole('button', { name: segundo.traducao, exact: true }).click();
  await dela.getByRole('button', { name: 'Escuchar el audio 1' }).click();
  await dela.getByText('No es esa. Inténtalo de nuevo.').waitFor();
  assert.ok(primeiro);
  // Sem combinar tudo, o quiz não deixa corrigir.
  await dela.getByRole('button', { name: 'Corregir mis respuestas' }).click();
  await dela.getByText('Te faltan preguntas por responder: 1').waitFor();
  for (const [i, par] of outra.entries()) {
    await dela.getByRole('button', { name: par.traducao, exact: true }).click();
    await dela.getByRole('button', { name: `Escuchar el audio ${i + 1}` }).click();
    await dela.getByRole('button', { name: `${par.palavra}, combinado` }).waitFor();
  }
  await dela.getByText('Todos combinados, con algún error en el camino.').waitFor();
  await dela.getByRole('button', { name: 'Corregir mis respuestas' }).click();
  await dela.getByText('0 de 1 · 0 %').waitFor();
  await dela.getByText('tudo bem = todo bien, obrigado = gracias, tchau = adiós').waitFor();

  const { data: tentativas } = await admin.from('tentativas_quiz').select('acertos, total, respostas').eq('quiz_id', (await perguntaNoBanco()).quiz.id);
  assert.deepEqual(tentativas.map((t) => [t.acertos, t.total]).sort(), [[0, 1], [1, 1]]);
  assert.ok(tentativas.every((t) => Array.isArray(t.respostas[0].resposta)), 'a lista de tentativas fica gravada');
  await contexto.close();
});

test('no celular, o jogo da aluna fica em duas colunas e cabe na largura', async () => {
  const { contexto, dela } = await abrirComoAluna(390, 844);
  const sobra = await dela.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(sobra <= 0, `o jogo passa ${sobra}px da largura da tela`);
  const cima = await dela.getByRole('button', { name: 'Escuchar el audio 1' }).boundingBox();
  const baixo = await dela.getByRole('button', { name: 'todo bien', exact: true }).boundingBox();
  assert.ok(cima && baixo && baixo.x !== cima.x, 'áudios e traduções lado a lado');
  await dela.screenshot({ path: 'capturas/aluno-quiz-pares-celular.png', fullPage: true });
  await contexto.close();
});

test('modo escrito: a palavra em português aparece no cartão, sem som', async () => {
  const p = pergunta();
  await pagina.goto(`${base}/admin/aulas/${aulaId}/quiz`);
  await p.getByLabel('O aluno lê a palavra').check();
  assert.equal(await p.getByRole('button', { name: 'Gravar a palavra 1' }).count(), 0, 'sem som, sem botão de gravar');
  await previa().getByText('Combina cada palabra con su traducción').waitFor();
  await previa().getByRole('button', { name: 'tudo bem', exact: true }).waitFor();
  await pagina.getByRole('button', { name: 'Salvar e publicar', exact: true }).click();
  await pagina.locator('main [role="status"]').filter({ hasText: 'Quiz salvo e publicado.' }).waitFor();
  const { pergunta: gravada } = await perguntaNoBanco();
  assert.equal(gravada.conteudo.modo, 'escrita');
  assert.equal(gravada.conteudo.pares.filter((par) => par.audio).length, 2, 'as gravações continuam guardadas, para voltar ao áudio');

  const contexto = await novoContexto(navegador);
  const dela = await contexto.newPage();
  await entrar(dela, aluna.email, senha);
  await dela.waitForURL('**/inicio');
  await dela.goto(`${base}/quiz/${(await perguntaNoBanco()).quiz.id}`);
  await dela.getByText('Combina cada palabra con su traducción').waitFor();
  await dela.getByRole('button', { name: 'obrigado', exact: true }).click();
  await dela.getByRole('button', { name: 'gracias', exact: true }).click();
  await dela.getByRole('button', { name: 'obrigado, combinado' }).waitFor();
  await contexto.close();
});
