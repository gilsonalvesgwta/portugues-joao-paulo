// Teste de ponta a ponta da área do aluno: a tela de início com o dia de hoje, a aula (vídeo,
// anotações, materiais, tarefas), o quiz corrigido pelo servidor e o avanço dos dias em um curso
// em sequência. O YouTube não é chamado: no lugar da ferramenta dele entra uma imitação que
// responde como a de verdade, para conferir o registro de onde a aluna parou.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { admin, base, caminho, clientePublico, criarPessoa, emailDeTeste, entrar, novaPagina, novoContexto, senha, textoDoAviso } from './apoio.mjs';

const sufixo = randomBytes(3).toString('hex');
const aluna = { email: emailDeTeste('aluna-curso'), nome: `Elena Estudia ${sufixo}` };
const semCurso = { email: emailDeTeste('sem-curso'), nome: `Nadia Nada ${sufixo}` };
const professor = { email: emailDeTeste('professor-curso'), nome: `Professor Curso ${sufixo}`, papel: 'professor' };
const curso = `Portugués desde cero ${sufixo}`;
const VIDEO = 'aB3dE6gH9jK';
const A1 = `Saludos ${sufixo}`;
const A2 = `El verbo ser ${sufixo}`;
const A3 = `Clase en borrador ${sufixo}`;
const T1 = `Preséntate ${sufixo}`;
const T2 = `Repasa la semana ${sufixo}`;

// Imitação da ferramenta do YouTube: guarda o que a página pediu e deixa o teste dizer em que
// ponto o vídeo está e quando ele pausa.
const FERRAMENTA_DE_MENTIRA = `
  window.YT = {
    Player: function (id, opcoes) {
      window.__reprodutor = { id: id, tempo: 0, duracao: 600, mudar: function (estado) { opcoes.events.onStateChange({ data: estado }); } };
      this.getCurrentTime = function () { return window.__reprodutor.tempo; };
      this.getDuration = function () { return window.__reprodutor.duracao; };
    },
  };
  if (window.onYouTubeIframeAPIReady) window.onYouTubeIframeAPIReady();
`;

let navegador;
let pagina; // a aluna, logada do começo ao fim
let alunaId;
let cursoId;
let ids;

async function criar(tabela, linha) {
  const { data, error } = await admin.from(tabela).insert(linha).select('id').single();
  assert.equal(error, null, `${tabela}: ${error?.message}`);
  return data.id;
}

async function progressoDaAula(aulaId, de = alunaId) {
  const { data } = await admin.from('progresso_aulas').select('posicao_seg, concluida_em').eq('aluno_id', de).eq('aula_id', aulaId).maybeSingle();
  return data;
}

async function tentativas(de = alunaId) {
  const { data, error } = await admin.from('tentativas_quiz').select('acertos, total, respostas, concluida_em').eq('aluno_id', de).eq('quiz_id', ids.quiz1);
  assert.equal(error, null, error?.message);
  return data;
}

async function ate(condicao, descricao) {
  for (let tentativa = 0; tentativa < 50; tentativa += 1) {
    if (await condicao()) return;
    await new Promise((feito) => setTimeout(feito, 200));
  }
  assert.fail(`não aconteceu a tempo: ${descricao}`);
}

const itemDeHoje = (texto) => pagina.locator('#hoy li').filter({ hasText: texto });
const linhaDaAula = (titulo) => pagina.locator('main li').filter({ hasText: titulo }).last();

before(async () => {
  await mkdir('capturas', { recursive: true });
  navegador = await chromium.launch();
  alunaId = await criarPessoa(aluna);
  await criarPessoa(semCurso);
  await criarPessoa(professor);

  cursoId = await criar('cursos', { titulo_pt: `Português do zero ${sufixo}`, titulo_es: curso, situacao: 'publicado', modo: 'sequencial' });
  const moduloId = await criar('modulos', { curso_id: cursoId, ordem: 1, titulo_pt: `Primeiros passos ${sufixo}`, titulo_es: `Primeros pasos ${sufixo}` });
  const aula = (numero, titulo, situacao, extra = {}) =>
    criar('aulas', { modulo_id: moduloId, numero, titulo_pt: `${titulo} (pt)`, titulo_es: titulo, video_id: VIDEO, situacao, ...extra });
  ids = {
    aula1: await aula(1, A1, 'publicado', {
      duracao_seg: 600,
      anotacoes: [
        { id: 'b1', tipo: 'capa', titulo: 'Cómo saludar', resumo: 'Las primeras palabras en portugués.' },
        { id: 'b2', tipo: 'texto', texto: 'Di **olá** al llegar.' },
        { id: 'b3', tipo: 'nota', texto: 'En Brasil casi nadie dice adeus.' },
      ],
    }),
    aula2: await aula(2, A2, 'publicado'),
    aula3: await aula(3, A3, 'rascunho'),
  };
  await criar('materiais', { aula_id: ids.aula1, titulo_pt: 'Lista de saudações', titulo_es: `Lista de saludos ${sufixo}`, descricao_es: 'Para imprimir.', link: 'https://exemplo.test/saludos.pdf', ordem: 1 });
  ids.quiz1 = await criar('quizzes', { aula_id: ids.aula1, situacao: 'publicado', nota_minima: 70 });
  ids.quiz3 = await criar('quizzes', { aula_id: ids.aula3, situacao: 'publicado' });
  for (const [ordem, tipo, conteudo] of [
    [1, 'multipla_escolha', { enunciado: '¿Cómo se dice "gracias"?', opcoes: ['por favor', 'obrigado', 'desculpa'], correta: 1 }],
    [2, 'completar', { frase: 'Eu ___ brasileiro.', opcoes: ['sou', 'estou'], correta: 0 }],
    [3, 'ordenar', { palavras: ['Ela', 'mora', 'no', 'Brasil.'], traducao: 'Ella vive en Brasil.' }],
  ]) {
    await criar('perguntas', { quiz_id: ids.quiz1, ordem, tipo, conteudo });
  }
  ids.tarefa1 = await criar('tarefas', { curso_id: cursoId, aula_id: ids.aula1, titulo_es: T1, instrucao_es: 'Escribe tu presentación.', link: 'https://exemplo.test/formulario' });
  ids.tarefa2 = await criar('tarefas', { curso_id: cursoId, titulo_es: T2, instrucao_es: 'Lee tus apuntes.' });

  // Trilha do professor: dia 1 com aula, quiz e tarefas; dia 2 só com a aula em rascunho (some para
  // a aluna); dia 3 com a aula 2 e o quiz da aula em rascunho (o quiz some).
  const dia = (numero) => criar('dias_trilha', { curso_id: cursoId, numero });
  const item = (diaId, ordem, tipo, alvo, obrigatorio = true) =>
    criar('itens_dia', { dia_id: diaId, ordem, tipo, obrigatorio, [`${tipo}_id`]: alvo });
  const [d1, d2, d3] = [await dia(1), await dia(2), await dia(3)];
  await item(d1, 1, 'aula', ids.aula1);
  await item(d1, 2, 'quiz', ids.quiz1);
  ids.itemT1 = await item(d1, 3, 'tarefa', ids.tarefa1);
  await item(d1, 4, 'tarefa', ids.tarefa2, false);
  await item(d2, 1, 'aula', ids.aula3);
  await item(d3, 1, 'aula', ids.aula2);
  await item(d3, 2, 'quiz', ids.quiz3);
  await criar('matriculas', { aluno_id: alunaId, curso_id: cursoId, origem: 'manual' });

  const contexto = await novoContexto(navegador);
  pagina = await contexto.newPage();
  // A regra da página vale mais que a do contexto (que barra o YouTube): só a ferramenta passa, e de mentira.
  await pagina.route('https://www.youtube.com/iframe_api', (rota) => rota.fulfill({ contentType: 'application/javascript', body: FERRAMENTA_DE_MENTIRA }));
  await entrar(pagina, aluna.email, senha);
  await pagina.waitForURL('**/inicio');
});

after(async () => {
  await navegador?.close();
});

test('início: o curso, o dia 1 de 2 com o que fazer hoje, e a aula de depois fechada', async () => {
  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), 'Hola, Elena');
  await pagina.getByRole('heading', { name: curso }).waitFor();
  assert.match(await pagina.locator('#hoy').innerText(), /Día 1 de 2/);
  assert.deepEqual(await pagina.locator('#hoy li').evaluateAll((itens) => itens.length), 4);
  await itemDeHoje(`Ver la clase 1: ${A1}`).waitFor();
  await itemDeHoje('Hacer el quiz de la clase 1').waitFor();
  await itemDeHoje(`Tarea: ${T1}`).waitFor();
  assert.match(await itemDeHoje(`Tarea: ${T2}`).innerText(), /Opcional/);
  assert.equal(await pagina.locator('#hoy').getByText('Hecho', { exact: true }).count(), 0);
  await pagina.getByText('0 de 2 clases vistas').waitFor();

  assert.equal(await pagina.getByRole('link', { name: A1, exact: true }).count(), 1);
  assert.equal(await pagina.getByRole('link', { name: A2, exact: true }).count(), 0, 'a aula 2 ainda não abre');
  assert.match(await linhaDaAula(A2).innerText(), /Se abre más adelante/);
  assert.equal((await pagina.content()).includes(A3), false, 'a aula em rascunho não aparece em lugar nenhum');
  assert.equal(await pagina.getByRole('link', { name: 'Empezar' }).getAttribute('href'), `/clase/${ids.aula1}`);
  await pagina.screenshot({ path: 'capturas/aluno-inicio-computador.png', fullPage: true });
});

test('aula fechada, aula em rascunho e quiz de aula em rascunho não abrem nem pelo endereço', async () => {
  await pagina.goto(`${base}/clase/${ids.aula2}`);
  await pagina.waitForURL(`**/inicio?curso=${cursoId}&aviso=bloqueada`);
  assert.equal(await textoDoAviso(pagina), 'Esa clase se abre cuando completes los días anteriores.');
  for (const rota of [`/clase/${ids.aula3}`, `/quiz/${ids.quiz3}`, '/clase/nao-e-um-id', `/quiz/${ids.aula1}`]) {
    await pagina.goto(`${base}${rota}`);
    await pagina.waitForURL('**/inicio?aviso=no_encontrada');
  }
  assert.equal(await textoDoAviso(pagina), 'No encontramos esa clase en tus cursos.');
});

test('a tela da aula traz o vídeo, as anotações, o material, a tarefa e o quiz', async () => {
  await pagina.goto(`${base}/inicio`);
  await pagina.getByRole('link', { name: 'Empezar' }).click();
  await pagina.waitForURL(`**/clase/${ids.aula1}`);
  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), A1);
  const quadro = pagina.locator('iframe');
  const endereco = new URL(await quadro.getAttribute('src'));
  assert.equal(`${endereco.origin}${endereco.pathname}`, `https://www.youtube-nocookie.com/embed/${VIDEO}`);
  assert.equal(endereco.searchParams.get('enablejsapi'), '1');
  assert.equal(endereco.searchParams.get('start'), null, 'primeira vez: o vídeo começa do início');
  assert.equal(await quadro.getAttribute('title'), `Video de la clase: ${A1}`);

  await pagina.getByRole('heading', { name: 'Cómo saludar' }).waitFor();
  await pagina.getByText('En Brasil casi nadie dice adeus.').waitFor();
  assert.equal(await pagina.locator('strong').filter({ hasText: 'olá' }).count(), 1);

  const material = pagina.getByRole('link', { name: `Lista de saludos ${sufixo}` });
  assert.equal(await material.getAttribute('href'), 'https://exemplo.test/saludos.pdf');
  assert.equal(await material.getAttribute('target'), '_blank');
  assert.equal(await material.getAttribute('rel'), 'noopener noreferrer');
  await pagina.getByText(T1, { exact: true }).waitFor();
  assert.equal(await pagina.getByText(T2).count(), 0, 'a tarefa do curso todo não é desta aula');
  assert.equal(await pagina.getByRole('link', { name: 'Hacer el quiz' }).getAttribute('href'), `/quiz/${ids.quiz1}`);
  assert.equal(await pagina.getByRole('link', { name: /Clase siguiente/ }).count(), 0, 'a aula seguinte ainda está fechada');
  await pagina.screenshot({ path: 'capturas/aluno-clase-computador.png', fullPage: true });
});

test('o reprodutor guarda onde a aluna parou, retoma dali e marca a aula como vista perto do fim', async () => {
  await pagina.waitForFunction(() => window.__reprodutor !== undefined);
  assert.equal(await pagina.evaluate(() => window.__reprodutor.id), `video-${ids.aula1}`);
  await pagina.evaluate(() => {
    window.__reprodutor.tempo = 125.4;
    window.__reprodutor.mudar(2); // pausa
  });
  await ate(async () => (await progressoDaAula(ids.aula1))?.posicao_seg === 125, 'guardar a posição');
  assert.equal((await progressoDaAula(ids.aula1)).concluida_em, null);

  await pagina.reload();
  assert.equal(new URL(await pagina.locator('iframe').getAttribute('src')).searchParams.get('start'), '125');
  await pagina.getByRole('button', { name: 'Marcar como vista' }).waitFor();

  await pagina.waitForFunction(() => window.__reprodutor !== undefined);
  await pagina.evaluate(() => {
    window.__reprodutor.tempo = 545;
    window.__reprodutor.mudar(2);
  });
  await pagina.getByText('✓ Clase vista').waitFor();
  const depois = await progressoDaAula(ids.aula1);
  assert.equal(depois.posicao_seg, 545);
  assert.notEqual(depois.concluida_em, null);
});

test('o botão desmarca e marca a aula como vista', async () => {
  await pagina.getByRole('button', { name: 'Marcar como no vista' }).click();
  await pagina.getByRole('button', { name: 'Marcar como vista' }).waitFor();
  assert.equal((await progressoDaAula(ids.aula1)).concluida_em, null);
  assert.equal(await pagina.getByText('✓ Clase vista').count(), 0);

  await pagina.getByRole('button', { name: 'Marcar como vista' }).click();
  await pagina.getByText('✓ Clase vista').waitFor();
  assert.notEqual((await progressoDaAula(ids.aula1)).concluida_em, null);
});

test('quiz: as respostas certas não vão para o navegador; faltando resposta, avisa; depois corrige e mostra as certas', async () => {
  await pagina.getByRole('link', { name: 'Hacer el quiz' }).click();
  await pagina.waitForURL(`**/quiz/${ids.quiz1}`);
  const codigo = await pagina.content();
  assert.equal(codigo.includes('correta'), false, 'o gabarito não está no código da página');
  assert.equal(codigo.includes('Ela mora no Brasil.'), false, 'a frase em ordem não está no código da página');

  await pagina.getByRole('button', { name: 'Corregir mis respuestas' }).click();
  assert.equal(await textoDoAviso(pagina), 'Te faltan preguntas por responder: 1, 2, 3');
  assert.deepEqual(await tentativas(), []);

  await pagina.getByRole('radio', { name: 'por favor' }).check();
  await pagina.getByRole('radio', { name: 'sou', exact: true }).check();
  for (const palavra of ['mora', 'Ela', 'no']) await pagina.getByRole('button', { name: palavra, exact: true }).click();
  await pagina.getByRole('button', { name: 'Corregir mis respuestas' }).click();
  assert.equal(await textoDoAviso(pagina), 'Te faltan preguntas por responder: 3', 'a frase incompleta não conta como respondida');
  // Tira uma palavra da frase e põe de novo, com a que faltava.
  await pagina.getByRole('button', { name: 'Quitar: no' }).click();
  for (const palavra of ['no', 'Brasil.']) await pagina.getByRole('button', { name: palavra, exact: true }).click();
  await pagina.screenshot({ path: 'capturas/aluno-quiz-computador.png', fullPage: true });
  await pagina.getByRole('button', { name: 'Corregir mis respuestas' }).click();
  await pagina.locator('form[data-vez="1"]').waitFor();

  await pagina.getByText('1 de 3 · 33 %').waitFor();
  await pagina.getByText('Todavía no alcanzas la nota mínima.').waitFor();
  const perguntas = pagina.locator('form section[aria-labelledby^="pergunta-"]');
  assert.deepEqual(await perguntas.evaluateAll((lista) => lista.map((p) => (p.textContent.includes('Incorrecta') ? 'errada' : p.textContent.includes('Correcta') ? 'certa' : '?'))), ['errada', 'certa', 'errada']);
  assert.match(await perguntas.nth(0).innerText(), /Respuesta correcta: obrigado/);
  assert.match(await perguntas.nth(2).innerText(), /Respuesta correcta: Ela mora no Brasil\./);
  assert.equal(await perguntas.nth(1).getByText('Respuesta correcta').count(), 0);
  assert.equal(await pagina.getByRole('radio', { name: 'por favor' }).isChecked(), true, 'o que a aluna marcou continua na tela');
  assert.equal(await pagina.getByRole('button', { name: 'Corregir mis respuestas' }).count(), 0);

  const [tentativa] = await tentativas();
  assert.deepEqual({ acertos: tentativa.acertos, total: tentativa.total }, { acertos: 1, total: 3 });
  assert.notEqual(tentativa.concluida_em, null);
  assert.deepEqual(tentativa.respostas.map((r) => [r.resposta, r.correta]), [['por favor', false], ['sou', true], [['mora', 'Ela', 'no', 'Brasil.'], false]]);
});

test('tentar de novo e acertar tudo: aprovada; o início marca a aula e o quiz como feitos', async () => {
  await pagina.getByRole('link', { name: 'Intentar de nuevo' }).click();
  await pagina.getByRole('button', { name: 'Corregir mis respuestas' }).waitFor();
  assert.equal(await pagina.getByRole('radio', { name: 'por favor' }).isChecked(), false, 'a nova tentativa começa em branco');
  await pagina.getByRole('radio', { name: 'obrigado' }).check();
  await pagina.getByRole('radio', { name: 'sou', exact: true }).check();
  for (const palavra of ['Ela', 'mora', 'no', 'Brasil.']) await pagina.getByRole('button', { name: palavra, exact: true }).click();
  await pagina.getByRole('button', { name: 'Corregir mis respuestas' }).click();
  await pagina.getByText('3 de 3 · 100 %').waitFor();
  await pagina.getByText('¡Aprobado!').waitFor();
  assert.equal((await tentativas()).length, 2);

  await pagina.getByRole('link', { name: /Volver a la clase/ }).click();
  await pagina.waitForURL(`**/clase/${ids.aula1}`);
  await pagina.getByText('Tu mejor resultado: 100 %').waitFor();
  await pagina.getByRole('link', { name: 'Repetir el quiz' }).waitFor();
  await pagina.getByRole('link', { name: /Volver al inicio/ }).click();
  await pagina.waitForURL(`**/inicio?curso=${cursoId}`);
  assert.equal(await itemDeHoje(`Ver la clase 1: ${A1}`).getByText('Hecho', { exact: true }).count(), 1);
  assert.equal(await itemDeHoje('Hacer el quiz de la clase 1').getByText('Hecho', { exact: true }).count(), 1);
  assert.equal(await itemDeHoje(`Tarea: ${T1}`).getByText('Pendiente', { exact: true }).count(), 1);
  assert.match(await pagina.locator('#hoy').innerText(), /Día 1 de 2/, 'falta a tarefa obrigatória');
  await pagina.getByText('1 de 2 clases vistas').waitFor();
  assert.equal(await pagina.getByRole('link', { name: 'Continuar' }).count(), 0, 'só falta a tarefa, que está nesta tela');
});

test('tarefa feita: o dia vira, a aula 2 abre; a tarefa opcional não segurou; desmarcar volta atrás', async () => {
  await pagina.getByRole('button', { name: `Marcar como hecha: ${T1}` }).click();
  await pagina.locator('#hoy').getByText('Día 2 de 2').waitFor();
  await itemDeHoje(`Ver la clase 2: ${A2}`).waitFor();
  assert.equal(await pagina.locator('#hoy li').count(), 1, 'o quiz da aula em rascunho não entra no dia');
  assert.equal(await pagina.getByRole('link', { name: A2, exact: true }).count(), 1, 'a aula 2 abriu');
  assert.equal(await pagina.getByRole('link', { name: 'Continuar' }).getAttribute('href'), `/clase/${ids.aula2}`);
  const { data: marcados } = await admin.from('itens_concluidos').select('item_dia_id').eq('aluno_id', alunaId);
  assert.deepEqual(marcados, [{ item_dia_id: ids.itemT1 }]);

  // Na tela da aula 1, a tarefa aparece feita e pode ser desmarcada: o dia volta a ser o 1.
  await pagina.goto(`${base}/clase/${ids.aula1}`);
  await pagina.getByRole('link', { name: /Clase siguiente/ }).waitFor();
  await pagina.getByRole('button', { name: `Desmarcar: ${T1}` }).click();
  await pagina.getByRole('button', { name: `Marcar como hecha: ${T1}` }).waitFor();
  assert.equal(await pagina.getByRole('link', { name: /Clase siguiente/ }).count(), 0, 'a aula 2 fechou de novo');
  await pagina.getByRole('button', { name: `Marcar como hecha: ${T1}` }).click();
  await pagina.getByRole('link', { name: /Clase siguiente/ }).click();
  await pagina.waitForURL(`**/clase/${ids.aula2}`);
  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), A2);
  assert.equal(await pagina.getByRole('link', { name: 'Hacer el quiz' }).count(), 0, 'aula sem quiz não mostra o cartão');
});

test('última aula vista: curso completo, 100 %, e tudo continua aberto para repassar', async () => {
  await pagina.getByRole('button', { name: 'Marcar como vista' }).click();
  await pagina.getByText('✓ Clase vista').waitFor();
  await pagina.getByRole('link', { name: /Volver al inicio/ }).click();
  await pagina.getByText('¡Completaste todos los días del curso!').waitFor();
  await pagina.getByText('2 de 2 clases vistas').waitFor();
  assert.equal(await pagina.getByRole('progressbar').getAttribute('aria-valuenow'), '100');
  assert.equal(await pagina.getByText('Se abre más adelante').count(), 0);
  assert.equal(await pagina.getByRole('link', { name: 'Continuar' }).count(), 0);
  await pagina.screenshot({ path: 'capturas/aluno-inicio-completo-computador.png', fullPage: true });
});

test('com a própria sessão, a aluna não escreve a nota, não lê o gabarito e não mexe no progresso de outra pessoa', async () => {
  const sessao = clientePublico();
  await sessao.auth.signInWithPassword({ email: aluna.email, password: senha });
  assert.notEqual((await sessao.from('tentativas_quiz').insert({ aluno_id: alunaId, quiz_id: ids.quiz1, acertos: 3, total: 3, concluida_em: new Date().toISOString() })).error, null);
  assert.deepEqual((await sessao.from('tentativas_quiz').update({ acertos: 3 }).eq('aluno_id', alunaId).select('id')).data ?? [], []);
  assert.deepEqual((await sessao.from('perguntas').select('id')).data ?? [], [], 'não lê as perguntas');
  const outra = (await admin.from('perfis').select('id').eq('email', semCurso.email).single()).data.id;
  assert.notEqual((await sessao.from('progresso_aulas').insert({ aluno_id: outra, aula_id: ids.aula1, concluida_em: new Date().toISOString() })).error, null);
  assert.notEqual((await sessao.from('progresso_aulas').insert({ aluno_id: alunaId, aula_id: ids.aula3, concluida_em: new Date().toISOString() })).error, null, 'não marca aula em rascunho');
  const feito = (await sessao.rpc('meu_progresso', { p_curso: cursoId })).data;
  assert.deepEqual(feito.quizzes, [{ quiz_id: ids.quiz1, tentativas: 2, melhor: 100 }]);
  assert.equal(JSON.stringify((await sessao.rpc('curso_do_aluno', { p_curso: cursoId })).data).includes(A3), false);
});

test('sem matrícula não há curso; com o acesso bloqueado o curso some na hora', async () => {
  const dela = await novaPagina(navegador);
  await entrar(dela, semCurso.email, senha);
  await dela.waitForURL('**/inicio');
  await dela.getByRole('heading', { name: 'Todavía no tienes un curso activo' }).waitFor();
  await dela.goto(`${base}/clase/${ids.aula1}`);
  await dela.waitForURL('**/inicio?aviso=no_encontrada');
  await dela.goto(`${base}/quiz/${ids.quiz1}`);
  await dela.waitForURL('**/inicio?aviso=no_encontrada');
  await dela.context().close();

  await admin.from('matriculas').update({ situacao: 'suspensa' }).eq('aluno_id', alunaId).eq('curso_id', cursoId);
  await pagina.goto(`${base}/inicio`);
  await pagina.getByRole('heading', { name: 'Todavía no tienes un curso activo' }).waitFor();
  await pagina.goto(`${base}/clase/${ids.aula1}`);
  await pagina.waitForURL('**/inicio?aviso=no_encontrada');
  await admin.from('matriculas').update({ situacao: 'ativa' }).eq('aluno_id', alunaId).eq('curso_id', cursoId);
  await pagina.goto(`${base}/inicio`);
  await pagina.getByRole('heading', { name: curso }).waitFor();
});

test('a equipe vê o curso como o aluno, com tudo aberto, e nada do que faz fica gravado', async () => {
  const dele = await novaPagina(navegador);
  await entrar(dele, professor.email, senha);
  await dele.waitForURL('**/admin');
  await dele.getByRole('link', { name: 'Abrir a área do aluno' }).click();
  await dele.waitForURL('**/inicio');
  await dele.goto(`${base}/inicio?curso=${cursoId}`);
  await dele.getByText('Vista previa del equipo: ves el curso como lo ve un alumno. Tu progreso no se guarda.').waitFor();
  assert.equal(await dele.getByText('Se abre más adelante').count(), 0);
  assert.equal(await dele.getByRole('button', { name: /Marcar como hecha/ }).count(), 0);
  assert.equal((await dele.content()).includes(A3), false, 'nem a equipe vê rascunho na visão do aluno');

  await dele.goto(`${base}/clase/${ids.aula2}`);
  assert.equal(await dele.getByRole('heading', { level: 1 }).innerText(), A2);
  assert.equal(await dele.getByRole('button', { name: 'Marcar como vista' }).count(), 0);

  await dele.goto(`${base}/quiz/${ids.quiz1}`);
  await dele.getByText('Vista previa del equipo: este intento no se guarda.').waitFor();
  await dele.getByRole('radio', { name: 'obrigado' }).check();
  await dele.getByRole('radio', { name: 'estou' }).check();
  for (const palavra of ['Ela', 'mora', 'no', 'Brasil.']) await dele.getByRole('button', { name: palavra, exact: true }).click();
  await dele.getByRole('button', { name: 'Corregir mis respuestas' }).click();
  await dele.getByText('2 de 3 · 67 %').waitFor();
  const professorId = (await admin.from('perfis').select('id').eq('email', professor.email).single()).data.id;
  assert.deepEqual(await tentativas(professorId), []);
  assert.equal(await progressoDaAula(ids.aula2, professorId), null);
  await dele.context().close();
});

test('no celular, o início, a aula e o quiz cabem na largura', async () => {
  const contexto = await novoContexto(navegador, 390, 844);
  const celular = await contexto.newPage();
  await entrar(celular, aluna.email, senha);
  await celular.waitForURL('**/inicio');
  for (const [nome, rota] of [['inicio', `/inicio?curso=${cursoId}`], ['clase', `/clase/${ids.aula1}`], ['quiz', `/quiz/${ids.quiz1}`]]) {
    await celular.goto(`${base}${rota}`, { waitUntil: 'networkidle' });
    const sobra = await celular.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(sobra <= 0, `${rota} passa ${sobra}px da largura no celular`);
    await celular.screenshot({ path: `capturas/aluno-${nome}-celular.png`, fullPage: true });
  }
  await contexto.close();
});
