// Teste de ponta a ponta dos alunos: o administrador cadastra, matricula, bloqueia, muda a
// validade, corrige nome e e-mail, muda o papel e reenvia o link; a aluna cria a senha pelo
// e-mail e vê (ou deixa de ver) o curso conforme a matrícula. O professor não entra nessa parte.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import {
  admin, base, caminho, clientePublico, criarPessoa, emailDeTeste, emailsPara, entrar, linkDoEmail, novaPagina, novoContexto, senha, textoDoAviso,
} from './apoio.mjs';

const sufixo = randomBytes(3).toString('hex');
const administrador = { email: emailDeTeste('admin-alunos'), nome: `Admin Alunos ${sufixo}`, papel: 'admin' };
const professor = { email: emailDeTeste('professor-alunos'), nome: `Professor Alunos ${sufixo}`, papel: 'professor' };
const aluna = { email: emailDeTeste('aluna-nova'), nome: `Lucía Peña ${sufixo}` };
const emailCorrigido = emailDeTeste('aluna-corrigida');
const senhaDaAluna = 'senha-da-aluna-1';
const cursoA = `Curso dos alunos ${sufixo}`;
const cursoB = `Curso extra dos alunos ${sufixo}`;
const anoQueVem = new Date().getUTCFullYear() + 1;

let navegador;
let pagina; // o administrador, logado do começo ao fim
let adminId;
let cursoAId;
let cursoBId;
let alunaId;

const campo = (rotulo) => pagina.getByLabel(rotulo, { exact: true });
const formularioDe = (curso) => pagina.getByRole('form', { name: `Matrícula em ${curso}` });

async function criar(tabela, linha) {
  const { data, error } = await admin.from(tabela).insert(linha).select('id').single();
  assert.equal(error, null, `${tabela}: ${error?.message}`);
  return data.id;
}

async function perfilDe(email) {
  const { data, error } = await admin.from('perfis').select('id, nome, email, papel').eq('email', email).maybeSingle();
  assert.equal(error, null, error?.message);
  return data;
}

async function matriculas() {
  const { data, error } = await admin
    .from('matriculas')
    .select('curso_id, situacao, expira_em, origem, inclui_conversacao, reservas_por_semana')
    .eq('aluno_id', alunaId)
    .order('inicio');
  assert.equal(error, null, error?.message);
  return data.map((m) => ({ ...m, expira_em: m.expira_em === null ? null : new Date(m.expira_em).toISOString() }));
}

// O que a aluna enxerga com a própria sessão: os cursos que as regras do banco deixam passar.
async function cursosDaAluna(email = aluna.email) {
  const cliente = clientePublico();
  const { error } = await cliente.auth.signInWithPassword({ email, password: senhaDaAluna });
  assert.equal(error, null, error?.message);
  const { data } = await cliente.from('cursos').select('titulo_pt').in('id', [cursoAId, cursoBId]);
  return (data ?? []).map((curso) => curso.titulo_pt);
}

async function ate(condicao, descricao) {
  for (let tentativa = 0; tentativa < 50; tentativa += 1) {
    if (await condicao()) return;
    await new Promise((feito) => setTimeout(feito, 200));
  }
  assert.fail(`não aconteceu a tempo: ${descricao}`);
}

before(async () => {
  await mkdir('capturas', { recursive: true });
  navegador = await chromium.launch();
  adminId = await criarPessoa(administrador);
  await criarPessoa(professor);
  cursoAId = await criar('cursos', { titulo_pt: cursoA, titulo_es: `Curso de alumnos ${sufixo}`, situacao: 'publicado' });
  cursoBId = await criar('cursos', { titulo_pt: cursoB, titulo_es: `Curso extra ${sufixo}`, situacao: 'rascunho' });

  pagina = await novaPagina(navegador);
  await entrar(pagina, administrador.email, senha);
  await pagina.waitForURL('**/admin');
});

after(async () => {
  await navegador?.close();
});

test('o professor não vê Alunos no menu e é barrado na tela; a lista de pessoas não responde para ele', async () => {
  const dele = await novaPagina(navegador);
  await entrar(dele, professor.email, senha);
  await dele.waitForURL('**/admin');
  assert.equal(await dele.getByRole('navigation', { name: 'Administração' }).getByRole('link', { name: 'Alunos' }).count(), 0);
  await dele.goto(`${base}/admin/alunos`);
  await dele.waitForURL('**/admin?aviso=so_administrador');
  assert.equal(await textoDoAviso(dele), 'Essa parte é só para o administrador.');
  await dele.goto(`${base}/admin/alunos/novo`);
  await dele.waitForURL('**/admin?aviso=so_administrador');

  const cliente = clientePublico();
  await cliente.auth.signInWithPassword({ email: professor.email, password: senha });
  assert.notEqual((await cliente.rpc('lista_de_pessoas', { p_busca: '', p_filtro: 'alunos', p_limite: 10, p_pulo: 0 })).error, null);
  assert.deepEqual((await cliente.from('matriculas').select('id')).data ?? [], [], 'professor não lê matrículas');
  await dele.context().close();
});

test('novo aluno: os erros são apontados sem perder o que foi digitado; depois a pessoa é cadastrada, matriculada e recebe o e-mail', async () => {
  await pagina.getByRole('navigation', { name: 'Administração' }).getByRole('link', { name: 'Alunos' }).click();
  await pagina.waitForURL('**/admin/alunos');
  await pagina.getByRole('link', { name: 'Novo aluno' }).click();
  await pagina.waitForURL('**/admin/alunos/novo');

  await campo('E-mail').fill('lucia-sem-arroba');
  await campo('Matricular no curso').selectOption(cursoAId);
  await campo('Acesso até (opcional)').fill('2020-01-31');
  await campo('Reservas de conversação por semana').fill('muitas');
  await pagina.getByRole('button', { name: 'Cadastrar' }).click();
  await pagina.locator('form[data-vez="1"]').waitFor();
  await pagina.getByText('Escreva o nome da pessoa.').waitFor();
  await pagina.getByText('Esse e-mail não parece certo. Confira se tem @ e o final (por exemplo, .com).').waitFor();
  await pagina.getByText('Essa data já passou. Escolha uma data futura ou deixe em branco.').waitFor();
  await pagina.getByText('Escreva um número de 0 a 14.').waitFor();
  assert.equal(await campo('E-mail').inputValue(), 'lucia-sem-arroba');
  assert.equal(await campo('Acesso até (opcional)').inputValue(), '2020-01-31');
  assert.equal(await perfilDe(aluna.email), null, 'nada foi criado');

  await campo('Nome').fill(`  ${aluna.nome}  `);
  await campo('E-mail').fill(aluna.email.toUpperCase());
  await campo('Acesso até (opcional)').fill(`${anoQueVem}-12-31`);
  await campo('Reservas de conversação por semana').fill('1');
  await pagina.getByRole('button', { name: 'Cadastrar' }).click();
  await pagina.waitForURL('**/admin/alunos/*?aviso=criada_link_enviado');
  assert.equal(await textoDoAviso(pagina, 'status'), 'Pessoa cadastrada. O e-mail com o link para criar a senha foi enviado.');

  const perfil = await perfilDe(aluna.email);
  assert.deepEqual({ nome: perfil.nome, papel: perfil.papel }, { nome: aluna.nome, papel: 'aluno' });
  alunaId = perfil.id;
  assert.equal(caminho(pagina), `/admin/alunos/${alunaId}`);
  assert.deepEqual(await matriculas(), [{
    curso_id: cursoAId, situacao: 'ativa', expira_em: `${anoQueVem + 1}-01-01T02:59:59.999Z`, origem: 'manual',
    inclui_conversacao: true, reservas_por_semana: 1,
  }]);

  const emails = await emailsPara(aluna.email);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].asunto, 'Tu acceso al curso de portugués');
  assert.ok(emails[0].texto.startsWith(`Hola, ${aluna.nome}:`));
  assert.ok(emails[0].texto.includes('Tu cuenta en la plataforma ya está lista.'));

  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), aluna.nome);
  await pagina.getByText('Esta pessoa ainda não entrou na plataforma: falta criar a senha pelo link do e-mail.').waitFor();
  await pagina.getByText(`acesso até 31 de dezembro de ${anoQueVem}`).waitFor();
  assert.equal(await pagina.getByRole('heading', { name: 'Últimos e-mails de acesso' }).locator('xpath=following-sibling::ul/li').count(), 1);
  await pagina.screenshot({ path: 'capturas/admin-aluno-computador.png', fullPage: true });
});

test('a aluna cria a senha pelo link do e-mail, entra e vê o curso; a ficha passa a mostrar a última entrada', async () => {
  const dela = await novaPagina(navegador);
  await dela.goto(linkDoEmail((await emailsPara(aluna.email))[0]));
  await dela.getByRole('button', { name: 'Continuar' }).click();
  await dela.waitForURL('**/nueva-contrasena');
  await dela.getByLabel('Contraseña nueva', { exact: true }).fill(senhaDaAluna);
  await dela.getByLabel('Repite la contraseña', { exact: true }).fill(senhaDaAluna);
  await dela.getByRole('button', { name: 'Guardar y entrar' }).click();
  await dela.waitForURL('**/inicio');
  await dela.goto(`${base}/admin/alunos`);
  assert.equal(caminho(dela), '/inicio', 'aluna não abre a tela de alunos');
  await dela.context().close();

  assert.deepEqual(await cursosDaAluna(), [cursoA]);
  await pagina.reload();
  await pagina.getByText('Entrou pela última vez em').waitFor();
});

test('e-mail já cadastrado é recusado, com o caminho para o cadastro que existe', async () => {
  await pagina.goto(`${base}/admin/alunos/novo`);
  await campo('Nome').fill('Outra Pessoa');
  await campo('E-mail').fill(aluna.email);
  await campo('Matricular no curso').selectOption('');
  await pagina.getByRole('button', { name: 'Cadastrar' }).click();
  await pagina.getByText('Já existe uma pessoa com esse e-mail.').waitFor();
  await pagina.getByRole('link', { name: 'Abrir o cadastro dessa pessoa' }).click();
  await pagina.waitForURL(`**/admin/alunos/${alunaId}`);
  assert.equal((await emailsPara(aluna.email)).length, 1, 'nenhum e-mail novo saiu');
});

test('cadastrar sem matrícula e sem e-mail: a pessoa existe, não vê nada e nenhum e-mail sai', async () => {
  const email = emailDeTeste('so-cadastro');
  await pagina.goto(`${base}/admin/alunos/novo`);
  await campo('Nome').fill(`Só Cadastro ${sufixo}`);
  await campo('E-mail').fill(email);
  await campo('Matricular no curso').selectOption('');
  assert.equal(await campo('Acesso até (opcional)').count(), 0, 'sem curso, os campos da matrícula somem');
  await campo('Enviar agora o e-mail com o link para criar a senha').uncheck();
  await pagina.getByRole('button', { name: 'Cadastrar' }).click();
  await pagina.waitForURL('**/admin/alunos/*?aviso=pessoa_criada');
  await pagina.getByText('Esta pessoa ainda não tem matrícula: não vê nenhum curso.').waitFor();
  const perfil = await perfilDe(email);
  assert.equal((await admin.from('matriculas').select('id').eq('aluno_id', perfil.id)).data.length, 0);
  assert.equal((await emailsPara(email)).length, 0);
});

test('bloquear tira o acesso da aluna na hora; liberar devolve', async () => {
  await pagina.goto(`${base}/admin/alunos/${alunaId}`);
  await pagina.getByRole('button', { name: `Bloquear o acesso a ${cursoA}` }).click();
  await pagina.waitForURL(`**/admin/alunos/${alunaId}?aviso=acesso_bloqueado#matriculas`);
  assert.equal((await matriculas())[0].situacao, 'suspensa');
  await pagina.getByText('Acesso bloqueado', { exact: true }).waitFor();
  assert.deepEqual(await cursosDaAluna(), []);

  await pagina.getByRole('button', { name: `Liberar o acesso a ${cursoA}` }).click();
  await pagina.waitForURL(`**/admin/alunos/${alunaId}?aviso=acesso_liberado#matriculas`);
  assert.equal((await matriculas())[0].situacao, 'ativa');
  assert.deepEqual(await cursosDaAluna(), [cursoA]);
});

test('validade: com a data vencida a aluna deixa de ver o curso; sem prazo, volta a ver', async () => {
  const formulario = formularioDe(cursoA);
  await formulario.getByLabel('Reservas de conversação por semana').fill('99');
  await formulario.getByRole('button', { name: 'Salvar matrícula' }).click();
  await formulario.getByText('Escreva um número de 0 a 14.').waitFor();
  assert.equal((await matriculas())[0].reservas_por_semana, 1, 'nada mudou');

  await formulario.getByLabel('Acesso até (opcional)').fill('2020-01-31');
  await formulario.getByLabel('Inclui as aulas de conversação ao vivo').uncheck();
  await formulario.getByRole('button', { name: 'Salvar matrícula' }).click();
  await pagina.getByText('Acesso vencido', { exact: true }).waitFor();
  assert.equal(await textoDoAviso(pagina, 'status'), 'Matrícula salva.');
  assert.deepEqual(await matriculas(), [{
    curso_id: cursoAId, situacao: 'ativa', expira_em: '2020-02-01T02:59:59.999Z', origem: 'manual', inclui_conversacao: false, reservas_por_semana: 0,
  }]);
  assert.deepEqual(await cursosDaAluna(), []);

  await formularioDe(cursoA).getByLabel('Acesso até (opcional)').fill('');
  await formularioDe(cursoA).getByRole('button', { name: 'Salvar matrícula' }).click();
  await pagina.getByText('Com acesso', { exact: true }).waitFor();
  await pagina.getByText('sem prazo').waitFor();
  assert.equal((await matriculas())[0].expira_em, null);
  assert.deepEqual(await cursosDaAluna(), [cursoA]);
});

test('matricular em outro curso; o curso já matriculado sai da lista de escolha', async () => {
  const nova = pagina.locator('form').filter({ has: pagina.getByRole('button', { name: 'Matricular', exact: true }) });
  const opcoes = async () => nova.getByLabel('Curso', { exact: true }).locator('option').evaluateAll((lista) => lista.map((o) => o.value));
  assert.equal((await opcoes()).includes(cursoAId), false);
  await nova.getByLabel('Curso', { exact: true }).selectOption(cursoBId);
  await nova.getByRole('button', { name: 'Matricular', exact: true }).click();
  await pagina.waitForURL(`**/admin/alunos/${alunaId}?aviso=matricula_criada#matriculas`);
  assert.equal(await textoDoAviso(pagina, 'status'), 'Matrícula feita.');
  const todas = await matriculas();
  assert.deepEqual(todas.map((m) => m.curso_id).sort(), [cursoAId, cursoBId].sort());
  assert.deepEqual(todas.find((m) => m.curso_id === cursoBId), {
    curso_id: cursoBId, situacao: 'ativa', expira_em: null, origem: 'manual', inclui_conversacao: true, reservas_por_semana: 2,
  });
  await formularioDe(`${cursoB} (rascunho)`).waitFor();
  assert.equal((await opcoes().catch(() => [])).includes(cursoBId), false);
  assert.deepEqual(await cursosDaAluna(), [cursoA], 'curso em rascunho não aparece para a aluna, mesmo com matrícula');

  // O banco não aceita duas matrículas da mesma pessoa no mesmo curso.
  const repetida = await admin.from('matriculas').insert({ aluno_id: alunaId, curso_id: cursoBId, origem: 'manual' });
  assert.notEqual(repetida.error, null);
});

test('as mudanças ficam no histórico, com quem fez', async () => {
  const { data: dela, error } = await admin
    .from('registro_alteracoes')
    .select('pessoa_id, antes, depois')
    .eq('tabela', 'matriculas')
    .eq('depois->>aluno_id', alunaId)
    .order('id');
  assert.equal(error, null, error?.message);
  // Matrícula, bloqueio, liberação, validade vencida, sem prazo e a segunda matrícula.
  assert.equal(dela.length, 6);
  assert.ok(dela.every((linha) => linha.pessoa_id === adminId));
  assert.equal(dela[0].antes, null);
  assert.deepEqual(dela.slice(1, 3).map((linha) => linha.depois.situacao), ['suspensa', 'ativa']);
});

test('corrigir o nome e o e-mail: a aluna passa a entrar com o e-mail novo e a mesma senha', async () => {
  await pagina.goto(`${base}/admin/alunos/${alunaId}`);
  await campo('Nome').fill('');
  await pagina.getByRole('button', { name: 'Salvar nome' }).click();
  await pagina.getByText('Escreva o nome da pessoa.').waitFor();
  await campo('Nome').fill(`Lucía Peña García ${sufixo}`);
  await pagina.getByRole('button', { name: 'Salvar nome' }).click();
  await pagina.waitForURL(`**/admin/alunos/${alunaId}?aviso=nome_salvo`);
  assert.equal(await pagina.getByRole('heading', { level: 1 }).innerText(), `Lucía Peña García ${sufixo}`);
  assert.equal(await pagina.getByText('Escreva o nome da pessoa.').count(), 0, 'o erro antigo não fica na tela');

  await campo('E-mail').fill(administrador.email);
  await pagina.getByRole('button', { name: 'Trocar e-mail' }).click();
  await pagina.getByText('Já existe outra pessoa com esse e-mail.').waitFor();
  await campo('E-mail').fill('sem-arroba');
  await pagina.getByRole('button', { name: 'Trocar e-mail' }).click();
  await pagina.getByText('Esse e-mail não parece certo.').waitFor();
  await campo('E-mail').fill(emailCorrigido);
  await pagina.getByRole('button', { name: 'Trocar e-mail' }).click();
  await pagina.waitForURL(`**/admin/alunos/${alunaId}?aviso=email_corrigido`);
  assert.equal(await textoDoAviso(pagina, 'status'), 'E-mail trocado. A pessoa passa a entrar com o e-mail novo; a senha continua a mesma.');

  assert.equal((await perfilDe(emailCorrigido)).id, alunaId);
  assert.equal(await perfilDe(aluna.email), null);
  assert.deepEqual(await cursosDaAluna(emailCorrigido), [cursoA]);
  const antigo = await clientePublico().auth.signInWithPassword({ email: aluna.email, password: senhaDaAluna });
  assert.notEqual(antigo.error, null, 'o e-mail antigo não entra mais');

  const { data: historico } = await admin.from('registro_alteracoes').select('pessoa_id, antes, depois').eq('tabela', 'perfis').eq('registro', alunaId);
  assert.deepEqual(historico, [{ pessoa_id: adminId, antes: { email: aluna.email }, depois: { email: emailCorrigido } }]);
});

test('papel: a pessoa vira professora e volta a ser aluna; ninguém muda o próprio papel', async () => {
  await campo('O que esta pessoa pode fazer').selectOption('professor');
  await pagina.getByRole('button', { name: 'Salvar papel' }).click();
  await pagina.waitForURL(`**/admin/alunos/${alunaId}?aviso=papel_salvo`);
  assert.equal((await perfilDe(emailCorrigido)).papel, 'professor');
  const comoProfessora = clientePublico();
  await comoProfessora.auth.signInWithPassword({ email: emailCorrigido, password: senhaDaAluna });
  assert.equal(((await comoProfessora.from('cursos').select('id').eq('id', cursoBId)).data ?? []).length, 1, 'como professora, lê o rascunho');

  await campo('O que esta pessoa pode fazer').selectOption('aluno');
  await pagina.getByRole('button', { name: 'Salvar papel' }).click();
  await ate(async () => (await perfilDe(emailCorrigido)).papel === 'aluno', 'voltar a ser aluna');

  await pagina.goto(`${base}/admin/alunos/${adminId}`);
  await pagina.getByText('Ninguém muda o próprio papel').waitFor();
  assert.equal(await pagina.getByRole('button', { name: 'Salvar papel' }).count(), 0);
  // Nem chamando o banco direto com a própria sessão.
  const eu = clientePublico();
  await eu.auth.signInWithPassword({ email: administrador.email, password: senha });
  const tentativa = await eu.rpc('definir_papel', { p_pessoa: adminId, p_papel: 'aluno' });
  assert.match(tentativa.error?.message ?? '', /proprio_papel/);
  assert.equal((await perfilDe(administrador.email)).papel, 'admin');
});

test('reenviar o link de acesso: o e-mail sai; no quarto pedido em 10 minutos, o limite barra', async () => {
  await pagina.goto(`${base}/admin/alunos/${alunaId}`);
  for (let vez = 1; vez <= 3; vez += 1) {
    await pagina.getByRole('button', { name: 'Enviar link de acesso por e-mail' }).click();
    await ate(async () => (await emailsPara(emailCorrigido)).length === vez, `e-mail ${vez}`);
    await pagina.waitForURL(`**/admin/alunos/${alunaId}?aviso=link_enviado`);
    await pagina.waitForLoadState('networkidle');
  }
  assert.equal(await textoDoAviso(pagina, 'status'), 'E-mail enviado com o link para criar ou trocar a senha.');
  await pagina.getByRole('button', { name: 'Enviar link de acesso por e-mail' }).click();
  await pagina.waitForURL(`**/admin/alunos/${alunaId}?aviso=link_limite`);
  assert.equal(await textoDoAviso(pagina), 'Esse endereço já recebeu 3 e-mails de acesso nos últimos 10 minutos. Espere um pouco antes de mandar outro.');
  assert.equal((await emailsPara(emailCorrigido)).length, 3);
});

test('lista: busca por nome ou e-mail e filtros por acesso e equipe', async () => {
  await pagina.goto(`${base}/admin/alunos`);
  await campo('Procurar por nome ou e-mail').fill(sufixo);
  await pagina.getByRole('button', { name: 'Procurar' }).click();
  await pagina.waitForURL(`**/admin/alunos?q=${sufixo}`);
  const linhas = () => pagina.locator('main tbody tr');
  assert.equal(await linhas().count(), 2, 'a aluna e a pessoa só cadastrada');
  const dela = linhas().filter({ hasText: emailCorrigido });
  assert.match(await dela.innerText(), new RegExp(`Lucía Peña García ${sufixo}`));
  assert.match(await dela.innerText(), new RegExp(cursoA));
  assert.match(await linhas().filter({ hasText: `Só Cadastro ${sufixo}` }).innerText(), /Sem matrícula/);
  await pagina.screenshot({ path: 'capturas/admin-alunos-computador.png', fullPage: true });

  const filtros = pagina.getByRole('navigation', { name: 'Filtro da lista' });
  await filtros.getByRole('link', { name: 'Com acesso' }).click();
  await pagina.waitForURL(`**/admin/alunos?filtro=com_acesso&q=${sufixo}`);
  assert.equal(await linhas().count(), 1);
  await filtros.getByRole('link', { name: 'Sem acesso' }).click();
  await pagina.waitForURL(`**/admin/alunos?filtro=sem_acesso&q=${sufixo}`);
  assert.match(await linhas().innerText(), new RegExp(`Só Cadastro ${sufixo}`));
  await filtros.getByRole('link', { name: 'Equipe' }).click();
  await pagina.waitForURL(`**/admin/alunos?filtro=equipe&q=${sufixo}`);
  assert.deepEqual((await linhas().allInnerTexts()).map((texto) => (texto.includes('Administrador') ? 'admin' : texto.includes('Professor') ? 'professor' : '?')).sort(), ['admin', 'professor']);

  await campo('Procurar por nome ou e-mail').fill(`ninguem-${sufixo}%`);
  await pagina.getByRole('button', { name: 'Procurar' }).click();
  await pagina.getByText(`Ninguém encontrado com “ninguem-${sufixo}%” nesta lista.`).waitFor();

  await pagina.goto(`${base}/admin/alunos?pagina=99999&q=${sufixo}`);
  await pagina.waitForURL(`**/admin/alunos?q=${sufixo}`);
  assert.equal(await linhas().count(), 2, 'página que não existe volta para a última');
});

test('a aluna, com a própria sessão, não lista pessoas, não se matricula e não muda papel', async () => {
  const cliente = clientePublico();
  await cliente.auth.signInWithPassword({ email: emailCorrigido, password: senhaDaAluna });
  assert.notEqual((await cliente.rpc('lista_de_pessoas', { p_busca: '', p_filtro: 'alunos', p_limite: 10, p_pulo: 0 })).error, null);
  assert.notEqual((await cliente.rpc('definir_papel', { p_pessoa: alunaId, p_papel: 'admin' })).error, null);
  const outro = await criar('cursos', { titulo_pt: `Curso fechado ${sufixo}`, titulo_es: `Curso cerrado ${sufixo}`, situacao: 'publicado' });
  assert.notEqual((await cliente.from('matriculas').insert({ aluno_id: alunaId, curso_id: outro, origem: 'manual' })).error, null);
  const mudar = await cliente.from('matriculas').update({ expira_em: null, situacao: 'ativa' }).eq('aluno_id', alunaId).select('id');
  assert.deepEqual(mudar.data ?? [], [], 'não altera a própria matrícula');
  assert.deepEqual((await cliente.from('registro_alteracoes').select('id')).data ?? [], [], 'não lê o histórico');
  assert.equal((await perfilDe(emailCorrigido)).papel, 'aluno');
});

test('no celular, a lista e a ficha cabem na largura', async () => {
  const contexto = await novoContexto(navegador, 390, 844);
  const celular = await contexto.newPage();
  await entrar(celular, administrador.email, senha);
  await celular.waitForURL('**/admin');
  for (const [nome, rota] of [['alunos', `/admin/alunos?q=${sufixo}`], ['aluno', `/admin/alunos/${alunaId}`], ['aluno-novo', '/admin/alunos/novo']]) {
    await celular.goto(`${base}${rota}`, { waitUntil: 'networkidle' });
    const sobra = await celular.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(sobra <= 0, `${rota} passa ${sobra}px da largura no celular`);
    await celular.screenshot({ path: `capturas/admin-${nome}-celular.png`, fullPage: true });
  }
  await contexto.close();
});
