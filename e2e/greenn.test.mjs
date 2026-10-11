// Teste de ponta a ponta da matrícula automática: avisos simulados da Greenn (compra, repetição,
// reembolso, recompra, assinatura) chegam ao endereço da plataforma, e o administrador cuida das
// ofertas e dos avisos pendentes pela tela de pagamentos.
// O formato dos avisos segue a documentação pública da Greenn; ainda falta conferir com uma
// compra de verdade.
import assert from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import {
  admin, base, caminho, clientePublico, criarPessoa, emailDeTeste, emailsPara, entrar, linkDoEmail, novaPagina, novoContexto, senha, textoDoAviso,
} from './apoio.mjs';

const SEGREDO = process.env.GREENN_WEBHOOK_SEGREDO ?? '';
const DIA = 24 * 60 * 60 * 1000;

const sufixo = randomBytes(3).toString('hex');
const administrador = { email: emailDeTeste('admin-greenn'), nome: `Admin Greenn ${sufixo}`, papel: 'admin' };
const professor = { email: emailDeTeste('professor-greenn'), nome: `Professor Greenn ${sufixo}`, papel: 'professor' };
const compradora = { email: emailDeTeste('compradora-greenn'), nome: `Carmen Compra ${sufixo}` };
const assinante = { email: emailDeTeste('assinante-greenn'), nome: `Sergio Suscrito ${sufixo}` };
const senhaDaCompradora = 'senha-da-compradora-1';
const curso = `Curso da Greenn ${sufixo}`;
// Números próprios desta execução: o banco reconhece um aviso repetido pelo número da venda.
const produto = randomInt(100_000_000, 999_999_999);
const produtoAssinatura = produto + 1;
const venda1 = randomInt(100_000_000, 999_999_000);

let navegador;
let pagina; // o administrador, logado do começo ao fim
let cursoId;
let aoPerguntar = 'aceitar';

const campo = (rotulo) => pagina.getByLabel(rotulo, { exact: true });

async function criar(tabela, linha) {
  const { data, error } = await admin.from(tabela).insert(linha).select('id').single();
  assert.equal(error, null, `${tabela}: ${error?.message}`);
  return data.id;
}

function cliente(pessoa) {
  return {
    id: 5, name: pessoa.nome, email: pessoa.email.toUpperCase(), cellphone: '+34600000000', cpf_cnpj: '12345678901',
    street: 'Calle Mayor', number: '10', complement: '2B', neighborhood: 'Centro', zipcode: '28001', city: 'Madrid', uf: 'MD',
  };
}

function venda(numero, status, pessoa, doProduto = produto) {
  return {
    oldStatus: 'waiting_payment', currentStatus: status, type: 'sale', event: 'saleUpdated',
    product: { id: doProduto, name: `Produto ${sufixo}`, type: 'TRANSACTION', amount: 99 },
    sale: { id: numero, status, method: 'CREDIT_CARD', amount: 99, installments: 1 },
    seller: { id: 1, name: 'Vendedor', email: 'vendedor@exemplo.test', cellphone: '+5511999990000' },
    client: cliente(pessoa),
    saleMetas: [],
  };
}

function assinatura(contrato, cobranca, status, fimDoPeriodo, pessoa) {
  return {
    oldStatus: 'paid', currentStatus: status, type: 'contract', event: 'contractUpdated',
    product: { id: produtoAssinatura, name: `Assinatura ${sufixo}`, type: 'SUBSCRIPTION', amount: 19 },
    currentSale: { id: cobranca, status: 'paid', method: 'CREDIT_CARD' },
    contract: { id: contrato, status, start_date: new Date().toISOString(), ...(fimDoPeriodo ? { current_period_end: fimDoPeriodo.toISOString() } : {}) },
    client: cliente(pessoa),
  };
}

async function avisar(corpo, { segredo = SEGREDO, cru = false } = {}) {
  const resposta = await fetch(`${base}/api/greenn/${segredo}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: cru ? corpo : JSON.stringify(corpo),
  });
  const texto = await resposta.text();
  let lido = null;
  try {
    lido = JSON.parse(texto);
  } catch {
    // resposta sem corpo
  }
  return { status: resposta.status, resultado: lido?.resultado ?? null, motivo: lido?.motivo ?? null };
}

async function avisosDe(email) {
  const { data, error } = await admin
    .from('eventos_pagamento')
    .select('id, tipo, status_atual, processado_em, erro, aluno_id, payload')
    .eq('payload->client->>email', email.toUpperCase())
    .order('id');
  assert.equal(error, null, error?.message);
  return data;
}

async function perfilDe(email) {
  const { data } = await admin.from('perfis').select('id, nome, papel').eq('email', email).maybeSingle();
  return data;
}

async function matriculaDe(email) {
  const perfil = await perfilDe(email);
  const { data, error } = await admin
    .from('matriculas')
    .select('situacao, expira_em, origem, inclui_conversacao, reservas_por_semana, greenn_sale_id, greenn_contract_id')
    .eq('aluno_id', perfil.id)
    .eq('curso_id', cursoId)
    .maybeSingle();
  assert.equal(error, null, error?.message);
  return data;
}

// A validade fica a "dias" dias de agora, com folga de alguns minutos para o tempo do teste.
function daquiA(expiraEm, dias) {
  return Math.abs(new Date(expiraEm).getTime() - (Date.now() + dias * DIA)) < 10 * 60 * 1000;
}

async function cursosVistosPor(email, clave) {
  const sessao = clientePublico();
  const { error } = await sessao.auth.signInWithPassword({ email, password: clave });
  assert.equal(error, null, error?.message);
  const { data } = await sessao.from('cursos').select('titulo_pt').eq('id', cursoId);
  return (data ?? []).map((item) => item.titulo_pt);
}

before(async () => {
  assert.ok(SEGREDO.length >= 24, 'falta GREENN_WEBHOOK_SEGREDO (o mesmo do aplicativo) para rodar este teste');
  await mkdir('capturas', { recursive: true });
  navegador = await chromium.launch();
  await criarPessoa(administrador);
  await criarPessoa(professor);
  cursoId = await criar('cursos', { titulo_pt: curso, titulo_es: `Curso de Greenn ${sufixo}`, situacao: 'publicado' });

  pagina = await novaPagina(navegador);
  pagina.on('dialog', (janela) => (aoPerguntar === 'aceitar' ? janela.accept() : janela.dismiss()));
  await entrar(pagina, administrador.email, senha);
  await pagina.waitForURL('**/admin');
});

after(async () => {
  await navegador?.close();
});

test('sem o segredo certo, o endereço responde como página que não existe e nada é guardado', async () => {
  const aviso = venda(venda1, 'paid', compradora);
  assert.equal((await avisar(aviso, { segredo: 'segredo-errado-com-mais-de-24-letras' })).status, 404);
  assert.equal((await avisar(aviso, { segredo: SEGREDO.slice(0, -1) })).status, 404);
  assert.equal((await avisar(aviso, { segredo: `${SEGREDO}x` })).status, 404);
  assert.equal((await fetch(`${base}/api/greenn/${SEGREDO}`)).status, 405, 'só aceita envio (POST)');
  assert.deepEqual(await avisosDe(compradora.email), []);
  assert.equal(await perfilDe(compradora.email), null);
});

test('o que não é aviso é recusado; carrinho abandonado não é guardado', async () => {
  assert.deepEqual(await avisar('isto não é um aviso', { cru: true }), { status: 400, resultado: null, motivo: 'formato' });
  assert.equal((await avisar([venda(venda1, 'paid', compradora)])).status, 400);
  assert.equal((await avisar('x'.repeat(200_001), { cru: true })).status, 413);

  const curioso = { email: emailDeTeste('curioso-greenn'), nome: 'Curioso' };
  const carrinho = { type: 'lead', event: 'checkoutAbandoned', lead: { ...cliente(curioso), step: 1 }, product: { id: produto } };
  assert.deepEqual(await avisar(carrinho), { status: 200, resultado: 'ignorado', motivo: null });
  const { data } = await admin.from('eventos_pagamento').select('id').eq('payload->lead->>email', curioso.email.toUpperCase());
  assert.deepEqual(data, []);
});

test('compra de produto sem oferta: o aviso fica pendente e nenhuma conta é criada; o que é sensível não é guardado', async () => {
  assert.deepEqual(await avisar(venda(venda1, 'paid', compradora)), { status: 200, resultado: 'oferta_desconhecida', motivo: null });
  assert.equal(await perfilDe(compradora.email), null);
  const [guardado] = await avisosDe(compradora.email);
  assert.deepEqual(
    { tipo: guardado.tipo, status: guardado.status_atual, processado: guardado.processado_em, erro: guardado.erro },
    { tipo: 'sale', status: 'paid', processado: null, erro: 'oferta_desconhecida' },
  );
  assert.deepEqual(guardado.payload.client, { id: 5, name: compradora.nome, email: compradora.email.toUpperCase() });
  assert.deepEqual(guardado.payload.seller, { id: 1, name: 'Vendedor', email: 'vendedor@exemplo.test' });
  assert.equal(JSON.stringify(guardado.payload).includes('12345678901'), false, 'o documento não fica guardado');
  assert.equal((await emailsPara(compradora.email)).length, 0);
});

test('o administrador cadastra a oferta, manda processar de novo e a compradora ganha conta, matrícula e e-mail', async () => {
  await pagina.getByRole('navigation', { name: 'Administração' }).getByRole('link', { name: 'Pagamentos' }).click();
  await pagina.waitForURL('**/admin/pagamentos');
  await pagina.getByText('Pronta para receber').waitFor();
  assert.equal((await pagina.content()).includes(SEGREDO), false, 'o segredo não aparece na tela');
  const linha = pagina.locator('main tbody tr').filter({ hasText: compradora.email.toUpperCase() });
  assert.match(await linha.innerText(), /Venda paga/);
  assert.match(await linha.innerText(), /Produto sem oferta cadastrada/);

  await pagina.getByRole('link', { name: 'Nova oferta' }).click();
  await pagina.waitForURL('**/admin/pagamentos/ofertas/nova');
  await campo('Código do produto na Greenn').fill('abc');
  await campo('Dias de acesso (opcional)').fill('0');
  await pagina.getByRole('button', { name: 'Salvar oferta' }).click();
  await pagina.locator('form[data-vez="1"]').waitFor();
  await pagina.getByText('Escreva um nome para reconhecer a oferta.').waitFor();
  await pagina.getByText('Escreva o código do produto na Greenn: só números.').waitFor();
  await pagina.getByText('Escreva um número de 1 a 3660, ou deixe em branco para acesso sem prazo.').waitFor();

  await campo('Nome da oferta').fill(`Acesso de 30 dias ${sufixo}`);
  await campo('Código do produto na Greenn').fill(String(produto));
  await campo('Curso que a compra libera').selectOption(cursoId);
  await campo('Dias de acesso (opcional)').fill('30');
  await campo('Reservas de conversação por semana').fill('3');
  await pagina.getByRole('button', { name: 'Salvar oferta' }).click();
  await pagina.waitForURL('**/admin/pagamentos?aviso=oferta_salva');
  assert.equal(await textoDoAviso(pagina, 'status'), 'Oferta salva.');
  const cartao = pagina.locator('main li').filter({ hasText: `Acesso de 30 dias ${sufixo}` });
  assert.match(await cartao.innerText(), new RegExp(`Produto ${produto} · ${curso} · 30 dias de acesso · conversação: 3 por semana`));

  await pagina.getByRole('button', { name: `Processar de novo o aviso de ${compradora.email.toUpperCase()}` }).click();
  await pagina.waitForURL('**/admin/pagamentos?aviso=aviso_liberou#avisos');
  assert.equal(await textoDoAviso(pagina, 'status'), 'Aviso processado: o acesso foi liberado.');

  const perfil = await perfilDe(compradora.email);
  assert.deepEqual({ nome: perfil.nome, papel: perfil.papel }, { nome: compradora.nome, papel: 'aluno' });
  const matricula = await matriculaDe(compradora.email);
  assert.deepEqual({ ...matricula, expira_em: undefined }, {
    situacao: 'ativa', expira_em: undefined, origem: 'greenn', inclui_conversacao: true, reservas_por_semana: 3,
    greenn_sale_id: venda1, greenn_contract_id: null,
  });
  assert.ok(daquiA(matricula.expira_em, 30), `validade de 30 dias: ${matricula.expira_em}`);
  const [guardado] = await avisosDe(compradora.email);
  assert.equal(guardado.erro, null);
  assert.equal(guardado.aluno_id, perfil.id);
  assert.notEqual(guardado.processado_em, null);

  const emails = await emailsPara(compradora.email);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].asunto, 'Tu acceso al curso de portugués');
  assert.ok(emails[0].texto.startsWith(`Hola, ${compradora.nome}:`));
  assert.ok(emails[0].texto.includes('Tu compra está confirmada y tu acceso ya está activo.'));

  // Na lista de todos, o aviso aparece processado e leva à ficha da pessoa.
  await pagina.getByRole('navigation', { name: 'Quais avisos mostrar' }).getByRole('link', { name: 'Todos' }).click();
  await pagina.waitForURL('**/admin/pagamentos?ver=todos#avisos');
  const processada = pagina.locator('main tbody tr').filter({ hasText: compradora.email.toUpperCase() });
  assert.match(await processada.innerText(), /Processado/);
  await pagina.screenshot({ path: 'capturas/admin-pagamentos-computador.png', fullPage: true });
  await processada.getByRole('link', { name: compradora.nome }).click();
  await pagina.waitForURL(`**/admin/alunos/${perfil.id}`);
  await pagina.getByText('Veio da compra na Greenn').waitFor();
});

test('a compradora cria a senha pelo link e vê o curso; o mesmo aviso repetido não muda nada nem manda outro e-mail', async () => {
  const dela = await novaPagina(navegador);
  await dela.goto(linkDoEmail((await emailsPara(compradora.email))[0]));
  await dela.getByRole('button', { name: 'Continuar' }).click();
  await dela.waitForURL('**/nueva-contrasena');
  await dela.getByLabel('Contraseña nueva', { exact: true }).fill(senhaDaCompradora);
  await dela.getByLabel('Repite la contraseña', { exact: true }).fill(senhaDaCompradora);
  await dela.getByRole('button', { name: 'Guardar y entrar' }).click();
  await dela.waitForURL('**/inicio');
  await dela.context().close();
  assert.deepEqual(await cursosVistosPor(compradora.email, senhaDaCompradora), [curso]);

  const antes = await matriculaDe(compradora.email);
  assert.deepEqual(await avisar(venda(venda1, 'paid', compradora)), { status: 200, resultado: 'ja_processado', motivo: null });
  assert.deepEqual(await matriculaDe(compradora.email), antes);
  assert.equal((await avisosDe(compradora.email)).length, 1);
  assert.equal((await emailsPara(compradora.email)).length, 1);
});

test('pagamento aguardando ou recusado fica guardado e não mexe na matrícula', async () => {
  const antes = await matriculaDe(compradora.email);
  assert.equal((await avisar(venda(venda1 + 1, 'waiting_payment', compradora))).resultado, 'ignorado');
  assert.equal((await avisar(venda(venda1 + 1, 'refused', compradora))).resultado, 'ignorado');
  assert.deepEqual(await matriculaDe(compradora.email), antes);
  const guardados = await avisosDe(compradora.email);
  assert.deepEqual(guardados.map((aviso) => aviso.status_atual), ['paid', 'waiting_payment', 'refused']);
  assert.ok(guardados.every((aviso) => aviso.processado_em !== null));
});

test('reembolso encerra o acesso na hora, sem e-mail', async () => {
  assert.equal((await avisar(venda(venda1, 'refunded', compradora))).resultado, 'acesso_encerrado');
  assert.equal((await matriculaDe(compradora.email)).situacao, 'encerrada');
  assert.deepEqual(await cursosVistosPor(compradora.email, senhaDaCompradora), []);
  assert.equal((await emailsPara(compradora.email)).length, 1);
});

test('nova compra de quem já tem senha: o acesso volta e o e-mail traz só o botão de entrar', async () => {
  assert.equal((await avisar(venda(venda1 + 2, 'paid', compradora))).resultado, 'acesso_liberado');
  const matricula = await matriculaDe(compradora.email);
  assert.equal(matricula.situacao, 'ativa');
  assert.equal(matricula.greenn_sale_id, venda1 + 2);
  assert.ok(daquiA(matricula.expira_em, 30), `validade de 30 dias a contar de hoje: ${matricula.expira_em}`);
  assert.deepEqual(await cursosVistosPor(compradora.email, senhaDaCompradora), [curso]);

  const emails = await emailsPara(compradora.email);
  assert.equal(emails.length, 2);
  assert.equal(emails[1].asunto, 'Tu acceso al curso está activo');
  assert.ok(emails[1].texto.includes(`Entrar a mis clases: ${base}/entrar`));
  assert.equal(emails[1].texto.includes('token_hash'), false, 'quem já tem senha não recebe link de senha');
});

test('quem compra de novo com o acesso em dia soma os dias e não recebe outro e-mail', async () => {
  assert.equal((await avisar(venda(venda1 + 3, 'paid', compradora))).resultado, 'acesso_liberado');
  const matricula = await matriculaDe(compradora.email);
  assert.ok(daquiA(matricula.expira_em, 60), `30 dias que restavam + 30 comprados: ${matricula.expira_em}`);
  assert.equal((await emailsPara(compradora.email)).length, 2);

  // As mudanças vindas do pagamento entram no histórico sem pessoa.
  const perfil = await perfilDe(compradora.email);
  const { data: historico } = await admin
    .from('registro_alteracoes')
    .select('pessoa_id, depois')
    .eq('tabela', 'matriculas')
    .eq('depois->>aluno_id', perfil.id)
    .order('id');
  assert.deepEqual(historico.map((linha) => linha.depois.situacao), ['ativa', 'encerrada', 'ativa', 'ativa']);
  assert.ok(historico.every((linha) => linha.pessoa_id === null));
});

test('assinatura: cada cobrança estende o acesso; cancelada, vale até o fim do período pago; sem pagamento, acaba', async () => {
  await criar('ofertas', { greenn_product_id: produtoAssinatura, curso_id: cursoId, nome: `Assinatura ${sufixo}`, dias_de_acesso: null, inclui_conversacao: false, reservas_por_semana: 0 });
  const contrato = randomInt(100_000_000, 999_999_999);
  const em = (dias) => new Date(Date.now() + dias * DIA);

  assert.equal((await avisar(assinatura(contrato, 1, 'paid', em(30), assinante))).resultado, 'acesso_liberado');
  let matricula = await matriculaDe(assinante.email);
  assert.deepEqual({ ...matricula, expira_em: undefined }, {
    situacao: 'ativa', expira_em: undefined, origem: 'greenn', inclui_conversacao: false, reservas_por_semana: 0,
    greenn_sale_id: null, greenn_contract_id: contrato,
  });
  assert.ok(daquiA(matricula.expira_em, 30));
  assert.equal((await emailsPara(assinante.email)).length, 1, 'o e-mail de acesso sai na primeira cobrança');

  assert.equal((await avisar(assinatura(contrato, 1, 'paid', em(30), assinante))).resultado, 'ja_processado');
  assert.equal((await avisar(assinatura(contrato, 2, 'paid', em(60), assinante))).resultado, 'acesso_liberado', 'a cobrança do mês seguinte é um aviso novo');
  matricula = await matriculaDe(assinante.email);
  assert.ok(daquiA(matricula.expira_em, 60), `a renovação estende o acesso: ${matricula.expira_em}`);
  assert.equal((await emailsPara(assinante.email)).length, 1, 'a renovação não manda e-mail');

  assert.equal((await avisar(assinatura(contrato, 2, 'canceled', em(60), assinante))).resultado, 'acesso_ate_fim_do_periodo');
  matricula = await matriculaDe(assinante.email);
  assert.equal(matricula.situacao, 'ativa');
  assert.ok(daquiA(matricula.expira_em, 60), 'cancelar não tira o que já foi pago');

  assert.equal((await avisar(assinatura(contrato, 3, 'unpaid', null, assinante))).resultado, 'acesso_ate_fim_do_periodo');
  matricula = await matriculaDe(assinante.email);
  assert.ok(new Date(matricula.expira_em).getTime() <= Date.now(), 'sem pagamento e sem período pago, o acesso acaba');
});

test('reembolso de quem não tem conta fica guardado e não cria conta', async () => {
  const sumido = { email: emailDeTeste('sumido-greenn'), nome: 'Sin Cuenta' };
  assert.equal((await avisar(venda(venda1 + 10, 'refunded', sumido))).resultado, 'aluno_desconhecido');
  assert.equal(await perfilDe(sumido.email), null);
  const [guardado] = await avisosDe(sumido.email);
  assert.equal(guardado.erro, 'aluno_desconhecido');
  assert.notEqual(guardado.processado_em, null);
});

test('oferta desativada: a compra fica pendente; o código de produto não se repete; dispensar tira o aviso da lista', async () => {
  await pagina.goto(`${base}/admin/pagamentos`);
  await pagina.getByRole('link', { name: `Editar a oferta Acesso de 30 dias ${sufixo}` }).click();
  await pagina.waitForURL('**/admin/pagamentos/ofertas/*');
  assert.equal(await campo('Código do produto na Greenn').inputValue(), String(produto));
  assert.equal(await campo('Dias de acesso (opcional)').inputValue(), '30');

  await campo('Código do produto na Greenn').fill(String(produtoAssinatura));
  await pagina.getByRole('button', { name: 'Salvar oferta' }).click();
  await pagina.getByText('Já existe uma oferta com esse código de produto.').waitFor();
  await campo('Código do produto na Greenn').fill(String(produto));
  await campo('Oferta ativa').uncheck();
  await pagina.getByRole('button', { name: 'Salvar oferta' }).click();
  await pagina.waitForURL('**/admin/pagamentos?aviso=oferta_salva');
  await pagina.locator('main li').filter({ hasText: `Acesso de 30 dias ${sufixo}` }).getByText('Desativada').waitFor();

  const atrasado = { email: emailDeTeste('atrasado-greenn'), nome: `Tarde Llega ${sufixo}` };
  assert.equal((await avisar(venda(venda1 + 20, 'paid', atrasado))).resultado, 'oferta_desconhecida');
  assert.equal(await perfilDe(atrasado.email), null);

  await pagina.reload();
  const botao = pagina.getByRole('button', { name: `Dispensar o aviso de ${atrasado.email.toUpperCase()}` });
  aoPerguntar = 'recusar';
  await botao.click();
  assert.equal((await avisosDe(atrasado.email))[0].processado_em, null, 'recusando a pergunta, nada muda');
  aoPerguntar = 'aceitar';
  await botao.click();
  await pagina.waitForURL('**/admin/pagamentos?aviso=aviso_dispensado#avisos');
  const [guardado] = await avisosDe(atrasado.email);
  assert.equal(guardado.erro, 'dispensado');
  assert.notEqual(guardado.processado_em, null);
  assert.equal(await pagina.locator('main tbody tr').filter({ hasText: atrasado.email.toUpperCase() }).count(), 0, 'saiu dos pendentes');
  assert.equal(await perfilDe(atrasado.email), null);
});

test('o professor não vê Pagamentos; ofertas e avisos não respondem para ele nem para a aluna', async () => {
  const dele = await novaPagina(navegador);
  await entrar(dele, professor.email, senha);
  await dele.waitForURL('**/admin');
  assert.equal(await dele.getByRole('navigation', { name: 'Administração' }).getByRole('link', { name: 'Pagamentos' }).count(), 0);
  for (const rota of ['/admin/pagamentos', '/admin/pagamentos/ofertas/nova']) {
    await dele.goto(`${base}${rota}`);
    await dele.waitForURL('**/admin?aviso=so_administrador');
  }
  await dele.context().close();

  for (const [email, clave] of [[professor.email, senha], [compradora.email, senhaDaCompradora]]) {
    const sessao = clientePublico();
    await sessao.auth.signInWithPassword({ email, password: clave });
    assert.deepEqual((await sessao.from('ofertas').select('id')).data ?? [], [], `${email} não lê ofertas`);
    assert.deepEqual((await sessao.from('eventos_pagamento').select('id')).data ?? [], [], `${email} não lê avisos`);
    assert.notEqual((await sessao.rpc('registrar_evento_pagamento', { p_payload: { type: 'sale' } })).error, null);
    assert.notEqual((await sessao.from('ofertas').insert({ greenn_product_id: produto + 5, curso_id: cursoId, nome: 'Intrusa' })).error, null);
  }

  const dela = await novaPagina(navegador);
  await entrar(dela, compradora.email, senhaDaCompradora);
  await dela.waitForURL('**/inicio');
  await dela.goto(`${base}/admin/pagamentos`);
  assert.equal(caminho(dela), '/inicio');
  await dela.context().close();
});

test('no celular, a tela de pagamentos e a de oferta cabem na largura', async () => {
  const contexto = await novoContexto(navegador, 390, 844);
  const celular = await contexto.newPage();
  await entrar(celular, administrador.email, senha);
  await celular.waitForURL('**/admin');
  for (const [nome, rota] of [['pagamentos', '/admin/pagamentos?ver=todos'], ['oferta', '/admin/pagamentos/ofertas/nova']]) {
    await celular.goto(`${base}${rota}`, { waitUntil: 'networkidle' });
    const sobra = await celular.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(sobra <= 0, `${rota} passa ${sobra}px da largura no celular`);
    await celular.screenshot({ path: `capturas/admin-${nome}-celular.png`, fullPage: true });
  }
  await contexto.close();
});
