// Teste de ponta a ponta da confirmação do fuso horário: na primeira visita à área do aluno, a
// pessoa confirma em que fuso está antes de ver qualquer tela. O fuso do aparelho já vem
// escolhido, a tela mostra que horas são nele, e a agenda passa a usar o fuso confirmado.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { admin, base, caminho, criarPessoa, emailDeTeste, entrar, novoContexto, senha } from './apoio.mjs';

const sufixo = randomBytes(3).toString('hex');
const aluna = { email: emailDeTeste('aluna-fuso'), nome: `Zoe Zona ${sufixo}`, fusoConfirmado: false };
const outra = { email: emailDeTeste('aluna-fuso-manual'), nome: `Mara Manual ${sufixo}`, fusoConfirmado: false };
const semFuso = { email: emailDeTeste('aluna-sem-fuso'), nome: `Uma Universal ${sufixo}`, fusoConfirmado: false };
const professora = { email: emailDeTeste('professora-fuso'), nome: `Paula Prévia ${sufixo}`, papel: 'professor', fusoConfirmado: false };

let navegador;
let alunaId;
let outraId;
let semFusoId;
let professoraId;

const horaEm = (fuso) => new Intl.DateTimeFormat('en-GB', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
const perfil = async (id) => (await admin.from('perfis').select('fuso, fuso_confirmado_em').eq('id', id).single()).data;

// Uma página em um aparelho que está no fuso pedido.
async function paginaEm(fuso, largura = 1280, altura = 800) {
  const contexto = await novoContexto(navegador, largura, altura, { timezoneId: fuso });
  return contexto.newPage();
}

before(async () => {
  await mkdir('capturas', { recursive: true });
  navegador = await chromium.launch();
  alunaId = await criarPessoa(aluna);
  outraId = await criarPessoa(outra);
  semFusoId = await criarPessoa(semFuso);
  professoraId = await criarPessoa(professora);
  const { data: curso, error } = await admin.from('cursos').insert({ titulo_pt: `Curso do fuso ${sufixo}`, titulo_es: `Curso de la zona ${sufixo}`, situacao: 'publicado' }).select('id').single();
  assert.equal(error, null, error?.message);
  for (const id of [alunaId, outraId, semFusoId]) {
    const matricula = await admin.from('matriculas').insert({ aluno_id: id, curso_id: curso.id, origem: 'manual' });
    assert.equal(matricula.error, null, matricula.error?.message);
  }
});

after(async () => {
  await navegador?.close();
});

test('a conta nasce com o fuso de Madri, sem confirmação', async () => {
  assert.deepEqual(await perfil(alunaId), { fuso: 'Europe/Madrid', fuso_confirmado_em: null });
});

test('na primeira entrada, toda tela da área do aluno leva para a confirmação do fuso', async () => {
  const pagina = await paginaEm('America/Bogota');
  await entrar(pagina, aluna.email, senha);
  await pagina.waitForURL('**/zona-horaria');
  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), 'Confirma tu zona horaria');
  for (const rota of ['/inicio', '/conversacion', '/papo', '/cuenta']) {
    await pagina.goto(`${base}${rota}`);
    assert.equal(caminho(pagina), '/zona-horaria', rota);
  }
  // Nada foi gravado só por abrir a tela.
  assert.deepEqual(await perfil(alunaId), { fuso: 'Europe/Madrid', fuso_confirmado_em: null });
  await pagina.context().close();
});

test('o fuso do aparelho já vem escolhido, com a hora de lá; ao confirmar, a agenda passa a usar esse fuso', async () => {
  const pagina = await paginaEm('America/Bogota');
  await entrar(pagina, aluna.email, senha);
  await pagina.waitForURL('**/zona-horaria');
  const campo = pagina.getByLabel('Tu zona horaria');
  await pagina.getByText('La elegimos por la hora de tu dispositivo. Cámbiala si no es donde estás.').waitFor();
  assert.equal(await campo.inputValue(), 'America/Bogota');
  // A hora mostrada é a de Bogotá agora (com um minuto de folga para a virada do minuto).
  const antes = horaEm('America/Bogota');
  const relogio = await pagina.locator('main [role="status"]').innerText();
  const depois = horaEm('America/Bogota');
  assert.ok(relogio.includes(`Ahora mismo son las ${antes}`) || relogio.includes(`Ahora mismo son las ${depois}`), relogio);
  assert.ok(relogio.includes('en Bogotá (GMT-5).'), relogio);
  await pagina.screenshot({ path: 'capturas/aluno-zona-horaria-computador.png', fullPage: true });

  await pagina.getByRole('button', { name: 'Confirmar zona horaria' }).click();
  await pagina.waitForURL('**/inicio');
  const guardado = await perfil(alunaId);
  assert.equal(guardado.fuso, 'America/Bogota');
  assert.ok(Date.now() - Date.parse(guardado.fuso_confirmado_em) < 60_000, 'a confirmação fica com a hora em que foi feita');

  // Com o fuso confirmado, as telas abrem e a agenda diz em que hora está.
  await pagina.goto(`${base}/conversacion`);
  await pagina.getByText(/Horarios en tu zona horaria: Bogotá \(GMT-5\)\. Ahora son las \d{2}:\d{2}\./).waitFor();
  const naAgenda = (await pagina.getByText(/Horarios en tu zona horaria/).innerText()).match(/Ahora son las (\d{2}:\d{2})/)[1];
  assert.ok([antes, depois, horaEm('America/Bogota')].includes(naAgenda), `a agenda mostra a hora de Bogotá (${naAgenda})`);
  // Quem já confirmou não volta para a tela de confirmação.
  await pagina.goto(`${base}/zona-horaria`);
  await pagina.waitForURL('**/inicio');
  await pagina.context().close();
});

test('a pessoa pode escolher outro fuso da lista: o relógio da tela acompanha e é esse que fica guardado', async () => {
  const pagina = await paginaEm('Europe/Madrid');
  await entrar(pagina, outra.email, senha);
  await pagina.waitForURL('**/zona-horaria');
  const campo = pagina.getByLabel('Tu zona horaria');
  await pagina.getByText('La elegimos por la hora de tu dispositivo.').waitFor();
  assert.equal(await campo.inputValue(), 'Europe/Madrid');
  await campo.selectOption('America/Mexico_City');
  await pagina.getByText('Elige en la lista el lugar donde estás.').waitFor();
  const relogio = await pagina.locator('main [role="status"]').innerText();
  assert.ok(relogio.includes('en Ciudad de México (GMT-6).'), relogio);
  await pagina.getByRole('button', { name: 'Confirmar zona horaria' }).click();
  await pagina.waitForURL('**/inicio');
  assert.equal((await perfil(outraId)).fuso, 'America/Mexico_City');
  await pagina.context().close();
});

test('aparelho sem fuso de lugar (UTC): fica o fuso do cadastro, e a pessoa escolhe na lista', async () => {
  const pagina = await paginaEm('UTC', 390, 844);
  await entrar(pagina, semFuso.email, senha);
  await pagina.waitForURL('**/zona-horaria');
  await pagina.getByText('Elige en la lista el lugar donde estás.').waitFor();
  assert.equal(await pagina.getByLabel('Tu zona horaria').inputValue(), 'Europe/Madrid');
  const sobra = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(sobra <= 0, `/zona-horaria passa ${sobra}px da largura no celular`);
  await pagina.screenshot({ path: 'capturas/aluno-zona-horaria-celular.png', fullPage: true });
  await pagina.getByLabel('Tu zona horaria').selectOption('America/Argentina/Buenos_Aires');
  await pagina.getByRole('button', { name: 'Confirmar zona horaria' }).click();
  await pagina.waitForURL('**/inicio');
  assert.equal((await perfil(semFusoId)).fuso, 'America/Argentina/Buenos_Aires');
  await pagina.context().close();
});

test('a equipe trabalha na administração sem confirmar nada; a prévia da área do aluno pede o fuso uma vez', async () => {
  const pagina = await paginaEm('America/Sao_Paulo');
  await entrar(pagina, professora.email, senha);
  await pagina.waitForURL('**/admin');
  await pagina.goto(`${base}/admin/conversacao`);
  assert.equal(caminho(pagina), '/admin/conversacao');
  await pagina.goto(`${base}/conversacion`);
  await pagina.waitForURL('**/zona-horaria');
  await pagina.getByText('La elegimos por la hora de tu dispositivo.').waitFor();
  assert.equal(await pagina.getByLabel('Tu zona horaria').inputValue(), 'America/Sao_Paulo');
  await pagina.getByRole('button', { name: 'Confirmar zona horaria' }).click();
  await pagina.waitForURL('**/inicio');
  await pagina.goto(`${base}/conversacion`);
  await pagina.getByText(/Horarios en tu zona horaria: São Paulo \(GMT-3\)/).waitFor();
  assert.equal((await perfil(professoraId)).fuso, 'America/Sao_Paulo');
  await pagina.context().close();
});

test('quem não está logado não abre a tela, e o banco recusa fuso que não existe', async () => {
  const pagina = await paginaEm('Europe/Madrid');
  await pagina.goto(`${base}/zona-horaria`);
  await pagina.waitForURL('**/entrar');
  await pagina.context().close();
  const { error } = await admin.from('perfis').update({ fuso: 'Lugar/Inexistente', fuso_confirmado_em: new Date().toISOString() }).eq('id', alunaId);
  assert.notEqual(error, null);
  assert.equal((await perfil(alunaId)).fuso, 'America/Bogota');
});
