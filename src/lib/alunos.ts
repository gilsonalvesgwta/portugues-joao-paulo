// Regras do cadastro de pessoas e das matrículas feitas pela administração.
// Sem dependências, para valer igual na tela, no servidor e nos testes.

import { ehUuid, limpar, type Entrada, type Erros, type Resultado } from './conteudo.ts';

export const NOME_MAX = 120;
export const EMAIL_MAX = 254;
export const RESERVAS_MAX = 14;

export function normalizarEmail(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim().toLowerCase() : '';
}

// Conferência simples: um @, sem espaços, com ponto depois do @. Quem confirma que o endereço
// existe é o próprio e-mail de acesso.
export function emailValido(email: string): boolean {
  return email.length <= EMAIL_MAX && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

export const PAPEIS = ['aluno', 'professor', 'admin'] as const;
export type Papel = (typeof PAPEIS)[number];
export const NOME_DO_PAPEL: Record<Papel, string> = { aluno: 'Aluno', professor: 'Professor', admin: 'Administrador' };

export function lerPapel(valor: unknown): Papel | null {
  return typeof valor === 'string' && (PAPEIS as readonly string[]).includes(valor) ? (valor as Papel) : null;
}

function conferirNome(erros: Erros, nome: string): void {
  if (nome === '') erros.nome = 'Escreva o nome da pessoa.';
  else if (nome.length > NOME_MAX) erros.nome = `O nome pode ter até ${NOME_MAX} letras.`;
}

function conferirEmail(erros: Erros, email: string): void {
  if (email === '') erros.email = 'Escreva o e-mail da pessoa.';
  else if (!emailValido(email)) erros.email = 'Esse e-mail não parece certo. Confira se tem @ e o final (por exemplo, .com).';
}

export function validarNome(entrada: Entrada): Resultado<{ nome: string }> {
  const erros: Erros = {};
  const nome = limpar(entrada.nome);
  conferirNome(erros, nome);
  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, valor: { nome } };
}

export function validarEmail(entrada: Entrada): Resultado<{ email: string }> {
  const erros: Erros = {};
  const email = normalizarEmail(entrada.email);
  conferirEmail(erros, email);
  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, valor: { email } };
}

// ---------------------------------------------------------------------------
// Datas: a administração trabalha no horário de Brasília (sem horário de verão desde 2019).
// ---------------------------------------------------------------------------

const BRASILIA_MS = -3 * 60 * 60 * 1000;
const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

// 'AAAA-MM-DD' do campo de data -> instante do fim daquele dia em Brasília. null se a data não existe.
export function fimDoDia(data: unknown): string | null {
  if (typeof data !== 'string' || !DATA.test(data)) return null;
  const instante = new Date(`${data}T23:59:59.999-03:00`);
  if (Number.isNaN(instante.getTime())) return null;
  const iso = instante.toISOString();
  // "2026-02-30" vira 2 de março no relógio: a volta não bate e a data é recusada.
  return diaEmBrasilia(iso) === data ? iso : null;
}

// Instante -> 'AAAA-MM-DD' no horário de Brasília (o valor do campo de data). '' se não for data.
export function diaEmBrasilia(iso: unknown): string {
  if (typeof iso !== 'string') return '';
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return '';
  return new Date(instante.getTime() + BRASILIA_MS).toISOString().slice(0, 10);
}

// "10 de outubro de 2026", no horário de Brasília.
export function dataPorExtenso(iso: unknown): string {
  const dia = diaEmBrasilia(iso);
  const partes = DATA.exec(dia);
  if (!partes) return '';
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${Number(partes[3])} de ${meses[Number(partes[2]) - 1]} de ${partes[1]}`;
}

// "10 de outubro de 2026, 14:32", no horário de Brasília.
export function dataEHora(iso: unknown): string {
  const data = dataPorExtenso(iso);
  if (data === '' || typeof iso !== 'string') return '';
  const hora = new Date(new Date(iso).getTime() + BRASILIA_MS).toISOString().slice(11, 16);
  return `${data}, ${hora}`;
}

// ---------------------------------------------------------------------------
// Matrícula
// ---------------------------------------------------------------------------

export type SituacaoDaMatricula = 'ativa' | 'suspensa' | 'encerrada';
// O que a tela mostra: uma matrícula ativa com a validade vencida não dá acesso.
export type Acesso = 'ativa' | 'vencida' | 'suspensa' | 'encerrada';

export function acessoDaMatricula(matricula: { situacao: string; expira_em: string | null }, agora: Date): Acesso {
  if (matricula.situacao === 'suspensa') return 'suspensa';
  if (matricula.situacao === 'encerrada') return 'encerrada';
  if (matricula.expira_em !== null && new Date(matricula.expira_em).getTime() <= agora.getTime()) return 'vencida';
  return 'ativa';
}

export const NOME_DO_ACESSO: Record<Acesso, string> = {
  ativa: 'Com acesso',
  vencida: 'Acesso vencido',
  suspensa: 'Acesso bloqueado',
  encerrada: 'Encerrada',
};

export type DadosDaMatricula = {
  expira_em: string | null;
  inclui_conversacao: boolean;
  reservas_por_semana: number;
};

// Campos do formulário: acesso_ate ('' = sem prazo, ou AAAA-MM-DD), inclui_conversacao (marcado ou não)
// e reservas_por_semana. "recusarPassado": ao matricular, uma validade que já passou é engano.
export function validarMatricula(entrada: Entrada, agora: Date, recusarPassado: boolean): Resultado<DadosDaMatricula> {
  const erros: Erros = {};

  let expira_em: string | null = null;
  const data = limpar(entrada.acesso_ate);
  if (data !== '') {
    expira_em = fimDoDia(data);
    if (expira_em === null) erros.acesso_ate = 'Essa data não existe. Escolha outra ou deixe em branco.';
    else if (recusarPassado && new Date(expira_em).getTime() <= agora.getTime()) {
      erros.acesso_ate = 'Essa data já passou. Escolha uma data futura ou deixe em branco.';
    }
  }

  const inclui_conversacao = entrada.inclui_conversacao === 'on' || entrada.inclui_conversacao === 'true';
  const escrito = limpar(entrada.reservas_por_semana);
  let reservas_por_semana = 0;
  if (inclui_conversacao) {
    if (!/^\d{1,2}$/.test(escrito) || Number(escrito) > RESERVAS_MAX) {
      erros.reservas_por_semana = `Escreva um número de 0 a ${RESERVAS_MAX}.`;
    } else {
      reservas_por_semana = Number(escrito);
    }
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, valor: { expira_em, inclui_conversacao, reservas_por_semana } };
}

export type NovaPessoa = { nome: string; email: string; curso_id: string | null; matricula: DadosDaMatricula | null; enviar_email: boolean };

// Formulário de novo aluno: nome, e-mail e, se um curso foi escolhido, os dados da matrícula.
export function validarNovaPessoa(entrada: Entrada, agora: Date): Resultado<NovaPessoa> {
  const erros: Erros = {};
  const nome = limpar(entrada.nome);
  const email = normalizarEmail(entrada.email);
  conferirNome(erros, nome);
  conferirEmail(erros, email);

  const escolhido = limpar(entrada.curso_id);
  let curso_id: string | null = null;
  let matricula: DadosDaMatricula | null = null;
  if (escolhido !== '') {
    if (!ehUuid(escolhido)) erros.curso_id = 'Escolha um curso da lista.';
    else curso_id = escolhido;
    const conferida = validarMatricula(entrada, agora, true);
    if (conferida.ok) matricula = conferida.valor;
    else Object.assign(erros, conferida.erros);
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, valor: { nome, email, curso_id, matricula, enviar_email: entrada.enviar_email === 'on' } };
}

// Bloquear e liberar o acesso sem mexer na validade.
export type MudancaDeAcesso = 'bloquear' | 'liberar';

export function novaSituacao(atual: string, mudanca: unknown): SituacaoDaMatricula | null {
  if (mudanca === 'bloquear') return atual === 'ativa' ? 'suspensa' : null;
  if (mudanca === 'liberar') return atual === 'suspensa' || atual === 'encerrada' ? 'ativa' : null;
  return null;
}

// Página da lista: número pedido no endereço -> página válida (1 em diante).
export const PESSOAS_POR_PAGINA = 50;
export const FILTROS = ['alunos', 'com_acesso', 'sem_acesso', 'equipe'] as const;
export type Filtro = (typeof FILTROS)[number];

export function lerFiltro(valor: unknown): Filtro {
  return typeof valor === 'string' && (FILTROS as readonly string[]).includes(valor) ? (valor as Filtro) : 'alunos';
}

export function lerPagina(valor: unknown): number {
  return typeof valor === 'string' && /^\d{1,6}$/.test(valor) ? Math.max(Number(valor), 1) : 1;
}

export function totalDePaginas(total: number): number {
  return Math.max(1, Math.ceil(total / PESSOAS_POR_PAGINA));
}
