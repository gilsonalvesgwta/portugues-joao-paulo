// A tela "Cópias de segurança" da administração. Na stack da VPS (COPIAS_NA_STACK=1) o serviço de
// cópias está no ar: o teste confere a cópia automática, faz uma cópia na hora, baixa, envia e
// apaga. Fora da stack, a tela diz que o serviço não está ligado. A restauração não é feita
// aqui, porque troca os dados de todos os testes que rodam ao mesmo tempo: ela tem a sua etapa
// própria (e2e/so-na-stack/levar-para-outra-vps.mjs).
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { gunzipSync, gzipSync } from 'node:zlib';
import { chromium } from 'playwright';
import { base, caminho, criarPessoa, emailDeTeste, entrar, novaPagina, senha, textoDoAviso } from './apoio.mjs';

const naStack = process.env.COPIAS_NA_STACK === '1';
const administrador = { email: emailDeTeste('admin-copias'), nome: 'Admin Copias', papel: 'admin' };
const professor = { email: emailDeTeste('prof-copias'), nome: 'Prof Copias', papel: 'professor' };
let navegador;
let pagina;
let pasta;

before(async () => {
  navegador = await chromium.launch();
  await criarPessoa(administrador);
  await criarPessoa(professor);
  pasta = await mkdtemp(join(tmpdir(), 'copias-'));
  pagina = await novaPagina(navegador);
  await entrar(pagina, administrador.email, senha);
  await pagina.waitForURL('**/admin');
});

after(async () => {
  await navegador?.close();
});

const linhas = () => pagina.getByRole('list', { name: 'Cópias guardadas' }).getByRole('listitem');

async function enviar(arquivo) {
  await pagina.locator('#arquivo_da_copia').setInputFiles(arquivo);
  await pagina.getByRole('button', { name: 'Enviar cópia' }).click();
}

test('professor não vê nem abre as cópias; nem baixa, nem envia', async () => {
  const dele = await novaPagina(navegador);
  await entrar(dele, professor.email, senha);
  await dele.waitForURL('**/admin');
  assert.equal(await dele.getByRole('link', { name: 'Cópias de segurança' }).count(), 0, 'o menu do professor não mostra as cópias');
  assert.equal(await dele.getByRole('heading', { name: 'Cópias de segurança' }).count(), 0, 'o painel do professor não mostra o quadro das cópias');
  await dele.goto(`${base}/admin/copias`);
  await dele.waitForURL('**/admin?aviso=so_administrador');
  assert.equal((await dele.request.get(`${base}/api/admin/copias/portuguesjp-2026-01-01-030000-automatica.sql.gz`)).status(), 404);
  const envio = await dele.request.post(`${base}/api/admin/copias/enviar`, { headers: { 'x-copia-de-seguranca': '1' }, data: Buffer.from('x') });
  assert.equal(envio.status(), 403);
  await dele.context().close();
});

test('sem o cabeçalho da tela, nem o administrador consegue enviar (pedido forjado por outro site)', async () => {
  const envio = await pagina.request.post(`${base}/api/admin/copias/enviar`, { data: gzipSync('-- PostgreSQL database dump\n') });
  assert.equal(envio.status(), 403);
});

test('fora da stack, a tela avisa que o serviço de cópias não está ligado', { skip: naStack }, async () => {
  await pagina.getByRole('link', { name: 'Cópias de segurança' }).first().click();
  await pagina.waitForURL('**/admin/copias');
  await pagina.getByRole('heading', { name: 'O serviço de cópias ainda não está nesta instalação' }).waitFor();
  await pagina.screenshot({ path: 'capturas/admin-copias-desligado.png', fullPage: true });
});

test('na stack: a cópia automática do dia existe, e uma cópia feita na hora aparece na lista', { skip: !naStack }, async () => {
  await pagina.goto(`${base}/admin`);
  await pagina.getByRole('heading', { name: 'Cópias de segurança' }).waitFor();
  await pagina.getByRole('link', { name: 'Cópias de segurança' }).first().click();
  await pagina.waitForURL('**/admin/copias');
  // A automática sai logo que a stack de teste sobe (na VPS, às 3 da manhã).
  await pagina.getByText('Automática', { exact: true }).first().waitFor({ timeout: 90_000 });
  await pagina.getByText('Em dia', { exact: true }).waitFor();

  const antes = await linhas().count();
  await pagina.getByRole('button', { name: 'Fazer uma cópia agora' }).click();
  await pagina.waitForURL('**/admin/copias?aviso=copia_pedida');
  assert.equal(await textoDoAviso(pagina, 'status'), 'Cópia pedida. Ela fica pronta em alguns segundos e aparece na lista.');
  await pagina.getByText('Feita na hora', { exact: true }).first().waitFor({ timeout: 60_000 });
  assert.equal(await linhas().count(), antes + 1);
  await pagina.getByText(/^Cópia feita na hora/).first().waitFor();
  await pagina.screenshot({ path: 'capturas/admin-copias-computador.png', fullPage: true });
});

test('na stack: baixar, enviar de volta e apagar', { skip: !naStack }, async () => {
  await pagina.goto(`${base}/admin/copias`);
  const [baixado] = await Promise.all([
    pagina.waitForEvent('download'),
    pagina.getByRole('link', { name: /^Baixar a cópia de/ }).first().click(),
  ]);
  assert.match(baixado.suggestedFilename(), /^portuguesjp-\d{4}-\d{2}-\d{2}-\d{6}-(manual|automatica)\.sql\.gz$/);
  const arquivo = join(pasta, baixado.suggestedFilename());
  await baixado.saveAs(arquivo);
  const texto = gunzipSync(await readFile(arquivo)).toString('utf8');
  assert.ok(texto.startsWith('-- Cópia de segurança da plataforma Português com João Paulo'), 'a cópia diz o que é');
  assert.match(texto, /^-- ultima-migracao: \d{4}_[a-z_]+\.sql$/m, 'a cópia diz de que versão ela é');
  assert.ok(texto.includes(`COPY auth.users `), 'a cópia tem as contas');
  assert.ok(texto.includes(administrador.email), 'a cópia tem os dados de quem já estava na plataforma');
  assert.ok(texto.trimEnd().endsWith('--'), 'a cópia está completa');

  // Um arquivo que não é cópia é recusado, e nada entra na lista.
  const antes = await linhas().count();
  const lixo = join(pasta, 'lixo.sql.gz');
  await writeFile(lixo, 'isto não é uma cópia');
  await enviar(lixo);
  await pagina.getByText('Esse arquivo não é uma cópia de segurança da plataforma', { exact: false }).waitFor();
  const outro = join(pasta, 'outro.sql.gz');
  await writeFile(outro, gzipSync('<html>uma página qualquer</html>'));
  await enviar(outro);
  await pagina.getByText('Esse arquivo não é uma cópia de segurança da plataforma', { exact: false }).waitFor();
  assert.equal(await linhas().count(), antes);

  // A cópia baixada volta e entra na lista como "Enviada", pronta para restaurar.
  await enviar(arquivo);
  await pagina.waitForURL('**/admin/copias?aviso=copia_enviada');
  assert.equal(await textoDoAviso(pagina, 'status'), 'Cópia enviada. Ela está na lista; para usar, clique em “Restaurar” ao lado dela.');
  const enviada = linhas().filter({ hasText: 'Enviada' });
  assert.equal(await enviada.count(), 1);
  assert.equal(await linhas().count(), antes + 1);

  // A tela de restaurar explica o que acontece e não aceita sem escrever RESTAURAR.
  await enviada.getByRole('link', { name: /^Restaurar a cópia de/ }).click();
  await pagina.waitForURL('**/admin/copias/restaurar?arquivo=*');
  await pagina.getByText('Todos os dados atuais da plataforma são trocados pelos desta cópia:').waitFor();
  await pagina.getByLabel('Para confirmar, escreva RESTAURAR').fill('restaurar');
  await pagina.getByRole('button', { name: 'Restaurar esta cópia' }).click();
  await pagina.waitForURL('**/admin/copias/restaurar?arquivo=*&aviso=copia_confirmar');
  assert.equal(await textoDoAviso(pagina), 'Para restaurar, escreva RESTAURAR no campo, em letras maiúsculas.');
  await pagina.getByRole('link', { name: 'Cancelar' }).click();
  await pagina.waitForURL('**/admin/copias');

  pagina.once('dialog', (dialogo) => dialogo.accept());
  await linhas().filter({ hasText: 'Enviada' }).getByRole('button', { name: /^Apagar a cópia de/ }).click();
  await pagina.waitForURL('**/admin/copias?aviso=copia_apagada');
  assert.equal(await linhas().filter({ hasText: 'Enviada' }).count(), 0);
  assert.equal(caminho(pagina), '/admin/copias');
});

test('na stack, no celular: a lista e os botões cabem na largura', { skip: !naStack }, async () => {
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  const celular = await contexto.newPage();
  await entrar(celular, administrador.email, senha);
  await celular.waitForURL('**/admin');
  await celular.goto(`${base}/admin/copias`, { waitUntil: 'networkidle' });
  const sobra = await celular.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(sobra <= 0, `a tela passa ${sobra}px da largura`);
  await celular.screenshot({ path: 'capturas/admin-copias-celular.png', fullPage: true });
  await contexto.close();
});
