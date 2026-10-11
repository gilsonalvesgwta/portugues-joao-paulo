import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acessoDaMatricula, dataEHora, dataPorExtenso, diaEmBrasilia, emailValido, fimDoDia, lerFiltro, lerPagina, lerPapel,
  normalizarEmail, novaSituacao, totalDePaginas, validarEmail, validarMatricula, validarNome, validarNovaPessoa,
} from './alunos.ts';

const agora = new Date('2026-10-10T15:00:00Z'); // meio-dia em Brasília
const curso = '11111111-2222-3333-4444-555555555555';

test('e-mail: arruma maiúsculas e espaços, e recusa o que não é endereço', () => {
  assert.equal(normalizarEmail('  Lucia.Pena@Exemplo.COM '), 'lucia.pena@exemplo.com');
  assert.equal(normalizarEmail(undefined), '');
  for (const bom of ['a@b.co', 'lucia.pena+curso@mail.exemplo.com']) assert.equal(emailValido(bom), true, bom);
  for (const ruim of ['', 'lucia', 'lucia@', '@exemplo.com', 'lucia@exemplo', 'lu cia@exemplo.com', 'a@b..com', 'a@@b.com', `${'a'.repeat(250)}@b.com`]) {
    assert.equal(emailValido(ruim), false, ruim);
  }
  assert.deepEqual(validarEmail({ email: ' Ana@Exemplo.com ' }), { ok: true, valor: { email: 'ana@exemplo.com' } });
  assert.equal(validarEmail({ email: '' }).ok, false);
});

test('nome: obrigatório, sem espaços sobrando e com limite', () => {
  assert.deepEqual(validarNome({ nome: '  Lucía   Peña ' }), { ok: true, valor: { nome: 'Lucía Peña' } });
  const vazio = validarNome({ nome: '   ' });
  assert.equal(vazio.ok, false);
  assert.equal(!vazio.ok && vazio.erros.nome, 'Escreva o nome da pessoa.');
  assert.equal(validarNome({ nome: 'a'.repeat(121) }).ok, false);
});

test('datas: o dia escolhido vale até o fim dele em Brasília', () => {
  assert.equal(fimDoDia('2026-12-31'), '2027-01-01T02:59:59.999Z');
  assert.equal(diaEmBrasilia('2027-01-01T02:59:59.999Z'), '2026-12-31');
  assert.equal(diaEmBrasilia('2027-01-01T03:00:00.000Z'), '2027-01-01');
  assert.equal(dataPorExtenso('2027-01-01T02:59:59.999Z'), '31 de dezembro de 2026');
  assert.equal(dataPorExtenso('2026-03-05T12:00:00Z'), '5 de março de 2026');
  for (const ruim of ['2026-02-30', '2026-13-01', '31/12/2026', '', null, 20261231]) assert.equal(fimDoDia(ruim), null, String(ruim));
  assert.equal(diaEmBrasilia('nada'), '');
  assert.equal(dataPorExtenso(null), '');
  assert.equal(dataEHora('2026-10-10T17:32:59Z'), '10 de outubro de 2026, 14:32');
  assert.equal(dataEHora('2026-10-10T02:05:00Z'), '9 de outubro de 2026, 23:05');
  assert.equal(dataEHora('x'), '');
});

test('acesso: ativa com validade vencida não dá acesso', () => {
  assert.equal(acessoDaMatricula({ situacao: 'ativa', expira_em: null }, agora), 'ativa');
  assert.equal(acessoDaMatricula({ situacao: 'ativa', expira_em: '2026-10-10T15:00:01Z' }, agora), 'ativa');
  assert.equal(acessoDaMatricula({ situacao: 'ativa', expira_em: '2026-10-10T15:00:00Z' }, agora), 'vencida');
  assert.equal(acessoDaMatricula({ situacao: 'suspensa', expira_em: null }, agora), 'suspensa');
  assert.equal(acessoDaMatricula({ situacao: 'encerrada', expira_em: '2030-01-01T00:00:00Z' }, agora), 'encerrada');
});

test('matrícula: sem prazo, com prazo, conversação e reservas', () => {
  assert.deepEqual(validarMatricula({ acesso_ate: '', inclui_conversacao: 'on', reservas_por_semana: '2' }, agora, true), {
    ok: true, valor: { expira_em: null, inclui_conversacao: true, reservas_por_semana: 2 },
  });
  assert.deepEqual(validarMatricula({ acesso_ate: '2026-10-10', reservas_por_semana: '5' }, agora, true), {
    ok: true, valor: { expira_em: '2026-10-11T02:59:59.999Z', inclui_conversacao: false, reservas_por_semana: 0 },
  }, 'hoje ainda vale até o fim do dia; sem conversação, as reservas ficam em zero');

  const passada = validarMatricula({ acesso_ate: '2026-10-09' }, agora, true);
  assert.equal(!passada.ok && passada.erros.acesso_ate, 'Essa data já passou. Escolha uma data futura ou deixe em branco.');
  assert.equal(validarMatricula({ acesso_ate: '2026-10-09' }, agora, false).ok, true, 'na edição, a data passada é aceita');
  const inexistente = validarMatricula({ acesso_ate: '2026-02-30' }, agora, false);
  assert.equal(!inexistente.ok && inexistente.erros.acesso_ate, 'Essa data não existe. Escolha outra ou deixe em branco.');

  for (const ruim of ['', '-1', '15', '2,5', 'duas', '100']) {
    const r = validarMatricula({ inclui_conversacao: 'on', reservas_por_semana: ruim }, agora, true);
    assert.equal(!r.ok && r.erros.reservas_por_semana, 'Escreva um número de 0 a 14.', ruim);
  }
});

test('novo aluno: só cadastro, ou cadastro com matrícula', () => {
  assert.deepEqual(validarNovaPessoa({ nome: ' Lucía Peña ', email: 'LUCIA@exemplo.com', curso_id: '' }, agora), {
    ok: true, valor: { nome: 'Lucía Peña', email: 'lucia@exemplo.com', curso_id: null, matricula: null, enviar_email: false },
  });
  assert.deepEqual(
    validarNovaPessoa({ nome: 'Ana', email: 'ana@exemplo.com', curso_id: curso, acesso_ate: '2027-01-31', inclui_conversacao: 'on', reservas_por_semana: '1', enviar_email: 'on' }, agora),
    {
      ok: true,
      valor: {
        nome: 'Ana', email: 'ana@exemplo.com', curso_id: curso, enviar_email: true,
        matricula: { expira_em: '2027-02-01T02:59:59.999Z', inclui_conversacao: true, reservas_por_semana: 1 },
      },
    },
  );
  const ruim = validarNovaPessoa({ nome: '', email: 'ana', curso_id: 'curso', acesso_ate: '2020-01-01' }, agora);
  assert.equal(ruim.ok, false);
  assert.deepEqual(!ruim.ok && Object.keys(ruim.erros).sort(), ['acesso_ate', 'curso_id', 'email', 'nome']);
  // Sem curso escolhido, os campos da matrícula não são conferidos.
  assert.equal(validarNovaPessoa({ nome: 'Ana', email: 'ana@exemplo.com', curso_id: '', acesso_ate: '2020-01-01' }, agora).ok, true);
});

test('bloquear e liberar o acesso', () => {
  assert.equal(novaSituacao('ativa', 'bloquear'), 'suspensa');
  assert.equal(novaSituacao('suspensa', 'liberar'), 'ativa');
  assert.equal(novaSituacao('encerrada', 'liberar'), 'ativa');
  assert.equal(novaSituacao('suspensa', 'bloquear'), null);
  assert.equal(novaSituacao('ativa', 'liberar'), null);
  assert.equal(novaSituacao('ativa', 'apagar'), null);
});

test('papel, filtro e página vindos do endereço', () => {
  assert.equal(lerPapel('professor'), 'professor');
  assert.equal(lerPapel('dono'), null);
  assert.equal(lerFiltro('equipe'), 'equipe');
  assert.equal(lerFiltro('qualquer'), 'alunos');
  assert.equal(lerFiltro(['equipe']), 'alunos');
  assert.equal(lerPagina('3'), 3);
  for (const ruim of [undefined, '0', '-2', 'abc', '1.5', ['2']]) assert.equal(lerPagina(ruim), 1, String(ruim));
  assert.equal(totalDePaginas(0), 1);
  assert.equal(totalDePaginas(50), 1);
  assert.equal(totalDePaginas(51), 2);
});
