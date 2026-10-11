// Teste de ponta a ponta do Papo, o tutor com inteligência artificial. O serviço da Anthropic é
// imitado por um servidor do próprio teste (variável PAPO_DE_TESTE_PORTA): assim dá para conferir
// o que o aplicativo envia (chave, instruções, histórico) e como ele trata resposta e falha.
// Sem essa variável, o aplicativo está sem a chave e o teste confere o Papo desligado.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { admin, base, criarPessoa, emailDeTeste, entrar, novaPagina, novoContexto, senha, textoDoAviso } from './apoio.mjs';

const porta = Number(process.env.PAPO_DE_TESTE_PORTA ?? '');
const ligado = Number.isInteger(porta) && porta > 0;
const soLigado = ligado ? false : 'o aplicativo está sem a chave do Papo';
const soDesligado = ligado ? 'o aplicativo está com a chave do Papo' : false;

const sufixo = randomBytes(3).toString('hex');
const aluna = { email: emailDeTeste('aluna-papo'), nome: `Pilar Papo ${sufixo}` };
const semCurso = { email: emailDeTeste('aluna-sem-curso'), nome: `Nora Nada ${sufixo}` };
const administrador = { email: emailDeTeste('admin-papo'), nome: `Admin Papo ${sufixo}`, papel: 'admin' };
const professor = { email: emailDeTeste('professor-papo'), nome: `Professor Papo ${sufixo}`, papel: 'professor' };

let navegador;
let pagina; // a aluna
let alunaId;
let imitacao;
const pedidos = []; // o que o aplicativo mandou para o "modelo"

const bolhas = (onde = pagina) => onde.locator('ol[aria-label="Conversación con Papo"] li[data-autor]');
const textos = async (onde = pagina) => (await bolhas(onde).evaluateAll((lista) => lista.map((li) => [li.dataset.autor, li.querySelector('span:last-child').textContent])));
const hojeEmMadri = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());

async function criar(tabela, linha) {
  const { data, error } = await admin.from(tabela).insert(linha).select('id').single();
  assert.equal(error, null, `${tabela}: ${error?.message}`);
  return data.id;
}

async function usadasHoje() {
  const { data } = await admin.from('uso_diario').select('mensagens').eq('aluno_id', alunaId).eq('dia', hojeEmMadri()).maybeSingle();
  return data?.mensagens ?? 0;
}

async function guardadas() {
  const { data, error } = await admin
    .from('mensagens_papo')
    .select('autor, texto, tokens_entrada, tokens_saida, conversas_papo!inner(aluno_id)')
    .eq('conversas_papo.aluno_id', alunaId)
    .order('id');
  assert.equal(error, null, error?.message);
  return data.map((m) => [m.autor, m.texto, m.tokens_entrada, m.tokens_saida]);
}

// Envia pelo formulário e espera a resposta do servidor (o formulário conta as respostas em data-vez).
async function mandar(texto) {
  const antes = Number(await pagina.locator('form[data-vez]').getAttribute('data-vez'));
  await pagina.getByLabel('Tu mensaje').fill(texto);
  await pagina.getByRole('button', { name: 'Enviar' }).click();
  return antes + 1;
}

before(async () => {
  await mkdir('capturas', { recursive: true });
  navegador = await chromium.launch();
  alunaId = await criarPessoa(aluna);
  await criarPessoa(semCurso);
  await criarPessoa(administrador);
  await criarPessoa(professor);
  const cursoId = await criar('cursos', { titulo_pt: `Curso do Papo ${sufixo}`, titulo_es: `Curso de Papo ${sufixo}`, situacao: 'publicado' });
  await criar('matriculas', { aluno_id: alunaId, curso_id: cursoId, origem: 'manual' });

  if (ligado) {
    imitacao = createServer((pedido, resposta) => {
      let corpo = '';
      pedido.on('data', (parte) => (corpo += parte));
      pedido.on('end', () => {
        const lido = JSON.parse(corpo);
        pedidos.push({ caminho: pedido.url, metodo: pedido.method, cabecalhos: pedido.headers, corpo: lido });
        const ultima = String(lido.messages.at(-1)?.content ?? '');
        const responder = () => {
          if (ultima.includes('FALHA')) {
            resposta.writeHead(529, { 'content-type': 'application/json' });
            resposta.end(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }));
            return;
          }
          const texto = ultima.includes('HTML')
            ? 'Em HTML seria <b>negrito</b>.\n<script>window.invadido = true</script>'
            : `Muito bem! Você disse: «${ultima}». (¡Bien hecho!)`;
          resposta.writeHead(200, { 'content-type': 'application/json' });
          resposta.end(JSON.stringify({
            id: 'msg_de_teste', type: 'message', role: 'assistant', model: lido.model, stop_reason: 'end_turn',
            content: [{ type: 'text', text: texto }], usage: { input_tokens: 31, output_tokens: 17 },
          }));
        };
        if (ultima.includes('DEVAGAR')) setTimeout(responder, 1500);
        else responder();
      });
    });
    await new Promise((pronto) => imitacao.listen(porta, '127.0.0.1', pronto));
  }

  pagina = await novaPagina(navegador);
  await entrar(pagina, aluna.email, senha);
  await pagina.waitForURL('**/inicio');
});

after(async () => {
  await navegador?.close();
  await new Promise((fechado) => (imitacao ? imitacao.close(fechado) : fechado()));
});

// ---------------------------------------------------------------------------
// Papo desligado (instalação sem a chave)
// ---------------------------------------------------------------------------

test('sem a chave, o Papo não aparece no menu, a tela explica e o painel mostra "Desligado"', { skip: soDesligado }, async () => {
  assert.equal(await pagina.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Papo' }).count(), 0);
  await pagina.goto(`${base}/papo`);
  await pagina.getByRole('heading', { name: 'El tutor todavía no está disponible' }).waitFor();
  assert.equal(await pagina.getByLabel('Tu mensaje').count(), 0);

  const dele = await novaPagina(navegador);
  await entrar(dele, administrador.email, senha);
  await dele.waitForURL('**/admin');
  await dele.getByRole('heading', { name: 'Papo, o tutor com inteligência artificial' }).waitFor();
  await dele.getByText('Desligado', { exact: true }).waitFor();
  await dele.getByText(/variável ANTHROPIC_API_KEY/).waitFor();
  await dele.context().close();
});

// ---------------------------------------------------------------------------
// Papo ligado
// ---------------------------------------------------------------------------

test('a aluna abre o Papo pelo menu e vê quantas mensagens tem hoje', { skip: soLigado }, async () => {
  await pagina.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Papo' }).click();
  await pagina.waitForURL('**/papo');
  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), 'Papo, tu tutor');
  await pagina.getByText(/Escribe tu primer mensaje en portugués/).waitFor();
  await pagina.getByText('Te quedan 40 mensajes hoy.').waitFor();
  assert.equal(await pagina.getByRole('button', { name: 'Empezar una conversación nueva' }).count(), 0);
});

test('a mensagem vai ao modelo com a chave, as instruções e o nome; a resposta aparece e fica guardada', { skip: soLigado }, async () => {
  const vez = await mandar('  Oi, Papo!   Eu quero   praticar. DEVAGAR ');
  // Enquanto o tutor responde: a mensagem enviada já aparece, e a tela avisa.
  await pagina.getByText('Papo está escribiendo…').waitFor();
  assert.deepEqual(await textos(), [['aluno', 'Oi, Papo! Eu quero praticar. DEVAGAR']]);
  await pagina.locator(`form[data-vez="${vez}"]`).waitFor();
  await bolhas().nth(1).waitFor();
  assert.deepEqual(await textos(), [
    ['aluno', 'Oi, Papo! Eu quero praticar. DEVAGAR'],
    ['papo', 'Muito bem! Você disse: «Oi, Papo! Eu quero praticar. DEVAGAR». (¡Bien hecho!)'],
  ]);
  assert.equal(await pagina.getByLabel('Tu mensaje').inputValue(), '', 'o campo volta vazio');
  await pagina.getByText('Te quedan 39 mensajes hoy.').waitFor();

  assert.equal(pedidos.length, 1);
  const { caminho, metodo, cabecalhos, corpo } = pedidos[0];
  assert.equal(`${metodo} ${caminho}`, 'POST /v1/messages');
  assert.equal(cabecalhos['x-api-key'], process.env.ANTHROPIC_API_KEY, 'a chave vai no cabeçalho');
  assert.equal(cabecalhos['anthropic-version'], '2023-06-01');
  assert.equal(corpo.model, 'claude-haiku-4-5-20251001');
  assert.ok(corpo.max_tokens > 0 && corpo.max_tokens <= 1000);
  assert.ok(corpo.system.includes('tutor de português do Brasil') && corpo.system.includes(`se chama ${aluna.nome}.`));
  assert.deepEqual(corpo.messages, [{ role: 'user', content: 'Oi, Papo! Eu quero praticar. DEVAGAR' }]);
  assert.equal(JSON.stringify(corpo).includes(aluna.email), false, 'o e-mail da aluna não vai para o modelo');

  assert.deepEqual(await guardadas(), [
    ['aluno', 'Oi, Papo! Eu quero praticar. DEVAGAR', null, null],
    ['papo', 'Muito bem! Você disse: «Oi, Papo! Eu quero praticar. DEVAGAR». (¡Bien hecho!)', 31, 17],
  ]);
  assert.equal(await usadasHoje(), 1);
  assert.equal((await pagina.content()).includes(process.env.ANTHROPIC_API_KEY), false, 'a chave nunca chega ao navegador');
});

test('a conversa continua: o modelo recebe o histórico, e o que ele responde nunca vira HTML', { skip: soLigado }, async () => {
  const vez = await mandar('Como se escreve em HTML?');
  await pagina.locator(`form[data-vez="${vez}"]`).waitFor();
  await bolhas().nth(3).waitFor();
  assert.deepEqual(pedidos[1].corpo.messages.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.equal(pedidos[1].corpo.messages[2].content, 'Como se escreve em HTML?');
  assert.equal((await textos())[3][1], 'Em HTML seria <b>negrito</b>.\n<script>window.invadido = true</script>');
  assert.equal(await bolhas().nth(3).locator('b, script').count(), 0, 'o texto do tutor é mostrado como texto');
  assert.equal(await pagina.evaluate(() => window.invadido === true), false);
  await pagina.screenshot({ path: 'capturas/aluno-papo-computador.png', fullPage: true });
});

test('se o modelo falha, a aluna é avisada, o texto dela fica no campo e a mensagem não é contada', { skip: soLigado }, async () => {
  const vez = await mandar('Esta vai dar FALHA no modelo');
  await pagina.locator(`form[data-vez="${vez}"]`).waitFor();
  assert.equal(await textoDoAviso(pagina), 'Papo no pudo responder ahora. Tu mensaje no se contó: inténtalo de nuevo en un momento.');
  assert.equal(await pagina.getByLabel('Tu mensaje').inputValue(), 'Esta vai dar FALHA no modelo');
  assert.equal(await bolhas().count(), 4, 'nada novo na conversa');
  assert.equal((await guardadas()).length, 4);
  assert.equal(await usadasHoje(), 2, 'a mensagem contada foi devolvida');
  await pagina.getByText('Te quedan 38 mensajes hoy.').waitFor();
});

test('conversa nova: a tela recomeça e o modelo não recebe mais o que veio antes', { skip: soLigado }, async () => {
  await pagina.getByRole('button', { name: 'Empezar una conversación nueva' }).click();
  await pagina.waitForURL('**/papo?aviso=nueva');
  assert.equal(await textoDoAviso(pagina, 'status'), 'Conversación nueva. Papo ya no tiene en cuenta lo anterior.');
  assert.equal(await bolhas().count(), 0);

  const antes = pedidos.length;
  const vez = await mandar('Agora outro assunto');
  await pagina.locator(`form[data-vez="${vez}"]`).waitFor();
  await bolhas().nth(1).waitFor();
  assert.deepEqual(pedidos[antes].corpo.messages, [{ role: 'user', content: 'Agora outro assunto' }]);
  assert.equal((await guardadas()).length, 6, 'a conversa anterior continua guardada');
});

test('no limite do dia, a última mensagem entra e depois o campo some', { skip: soLigado }, async () => {
  const { error } = await admin.from('uso_diario').update({ mensagens: 39 }).eq('aluno_id', alunaId).eq('dia', hojeEmMadri());
  assert.equal(error, null, error?.message);
  await pagina.goto(`${base}/papo`);
  await pagina.getByText('Te queda 1 mensaje hoy.').waitFor();
  await mandar('A última de hoje');
  await pagina.getByText('Ya usaste todos tus mensajes de hoy. Mañana tendrás más.').waitFor();
  assert.equal(await pagina.getByLabel('Tu mensaje').count(), 0);
  assert.equal(await usadasHoje(), 40);
  const total = pedidos.length;
  await pagina.reload();
  await pagina.getByText('Ya usaste todos tus mensajes de hoy. Mañana tendrás más.').waitFor();
  assert.equal(pedidos.length, total);
});

test('quem não tem curso ativo vê a explicação e não conversa', { skip: soLigado }, async () => {
  const dela = await novaPagina(navegador);
  await entrar(dela, semCurso.email, senha);
  await dela.waitForURL('**/inicio');
  await dela.goto(`${base}/papo`);
  await dela.getByRole('heading', { name: 'Tu acceso no incluye el tutor' }).waitFor();
  assert.equal(await dela.getByLabel('Tu mensaje').count(), 0);
  await dela.context().close();
});

test('painel: o administrador vê o Papo ligado e muda o limite do dia; o professor só lê', { skip: soLigado }, async () => {
  const dele = await novaPagina(navegador);
  await entrar(dele, administrador.email, senha);
  await dele.waitForURL('**/admin');
  await dele.getByRole('heading', { name: 'Papo, o tutor com inteligência artificial' }).waitFor();
  await dele.getByText('Ligado', { exact: true }).waitFor();
  await dele.getByText(/Nos últimos 7 dias: \d+ mensagens?, de \d+ pessoas?\./).waitFor();
  const limite = dele.getByLabel('Mensagens por pessoa, por dia');
  assert.equal(await limite.inputValue(), '40');

  await limite.fill('abc');
  await dele.getByRole('button', { name: 'Salvar limite' }).click();
  await dele.waitForURL('**/admin?aviso=papo_invalido#papo');
  assert.equal(await textoDoAviso(dele), 'O limite do Papo é um número de 0 a 500.');

  await dele.getByLabel('Mensagens por pessoa, por dia').fill('45');
  await dele.getByRole('button', { name: 'Salvar limite' }).click();
  await dele.waitForURL('**/admin?aviso=papo_salvo');
  const { data } = await admin.from('configuracoes').select('valor').eq('chave', 'papo_mensagens_por_dia').single();
  assert.equal(Number(data.valor), 45);
  await dele.context().close();

  // Com o limite maior, a aluna volta a ter mensagens hoje.
  await pagina.goto(`${base}/papo`);
  await pagina.getByText('Te quedan 5 mensajes hoy.').waitFor();

  const doProfessor = await novaPagina(navegador);
  await entrar(doProfessor, professor.email, senha);
  await doProfessor.waitForURL('**/admin');
  await doProfessor.getByText('Limite: 45 mensagens por pessoa, por dia.').waitFor();
  assert.equal(await doProfessor.getByRole('button', { name: 'Salvar limite' }).count(), 0);
  await doProfessor.context().close();

  // O limite volta ao padrão, para não mexer com outras execuções.
  const volta = await admin.from('configuracoes').update({ valor: 40 }).eq('chave', 'papo_mensagens_por_dia');
  assert.equal(volta.error, null, volta.error?.message);
});

test('no celular, a conversa com o Papo cabe na largura', { skip: soLigado }, async () => {
  const contexto = await novoContexto(navegador, 390, 844);
  const celular = await contexto.newPage();
  await entrar(celular, aluna.email, senha);
  await celular.waitForURL('**/inicio');
  await celular.goto(`${base}/papo`, { waitUntil: 'networkidle' });
  await bolhas(celular).first().waitFor();
  const sobra = await celular.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(sobra <= 0, `/papo passa ${sobra}px da largura no celular`);
  await celular.screenshot({ path: 'capturas/aluno-papo-celular.png', fullPage: true });
  await contexto.close();
});
