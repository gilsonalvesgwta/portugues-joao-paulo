// Regras das aulas de conversação ao vivo: temas, turmas e configurações.
// Sem dependências, para valer igual na tela, no servidor e nos testes.
// A equipe trabalha no horário de Brasília (sem horário de verão desde 2019); o banco guarda
// tudo em UTC e o aluno vê no fuso dele.

import { ehUuid, lerLink, limpar, limparTexto, type Entrada, type Erros, type Resultado } from './conteudo.ts';

export const NIVEIS = ['basico', 'intermediario', 'avancado'] as const;
export type Nivel = (typeof NIVEIS)[number];
export const NOME_DO_NIVEL: Record<Nivel, string> = { basico: 'Básico', intermediario: 'Intermediário', avancado: 'Avançado' };
export const NOMBRE_DEL_NIVEL: Record<Nivel, string> = { basico: 'Básico', intermediario: 'Intermedio', avancado: 'Avanzado' };

export function lerNivel(valor: unknown): Nivel | null {
  return typeof valor === 'string' && (NIVEIS as readonly string[]).includes(valor) ? (valor as Nivel) : null;
}

// ---------------------------------------------------------------------------
// Tema
// ---------------------------------------------------------------------------

export const LIMITES_DO_TEMA = { titulo: 120, descricao: 600, aprendizados: 8, aprendizado: 120 };

export type DadosDoTema = { titulo_es: string; nivel: Nivel; descricao_es: string | null; aprendizados: string[]; material: string | null };

// "aprendizados" chega como texto, um por linha ("Lo que vas a aprender").
export function validarTema(entrada: Entrada): Resultado<DadosDoTema> {
  const erros: Erros = {};
  const titulo_es = limpar(entrada.titulo_es);
  if (titulo_es === '') erros.titulo_es = 'Escreva o título do tema, em espanhol.';
  else if (titulo_es.length > LIMITES_DO_TEMA.titulo) erros.titulo_es = `O título pode ter até ${LIMITES_DO_TEMA.titulo} letras.`;

  const nivel = lerNivel(entrada.nivel);
  if (!nivel) erros.nivel = 'Escolha o nível.';

  const descricao = limparTexto(entrada.descricao_es);
  if (descricao.length > LIMITES_DO_TEMA.descricao) erros.descricao_es = `A descrição pode ter até ${LIMITES_DO_TEMA.descricao} letras.`;

  const aprendizados = (typeof entrada.aprendizados === 'string' ? entrada.aprendizados : '')
    .split('\n')
    .map((linha) => limpar(linha))
    .filter((linha) => linha !== '');
  if (aprendizados.length > LIMITES_DO_TEMA.aprendizados) erros.aprendizados = `Escreva até ${LIMITES_DO_TEMA.aprendizados} linhas.`;
  else if (aprendizados.some((linha) => linha.length > LIMITES_DO_TEMA.aprendizado)) {
    erros.aprendizados = `Cada linha pode ter até ${LIMITES_DO_TEMA.aprendizado} letras.`;
  }

  const material = lerLink(entrada.material);
  if (material === 'invalido') erros.material = 'Cole um link que comece com https://, sem espaços, ou deixe em branco.';

  if (!nivel || material === 'invalido' || Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, valor: { titulo_es, nivel, descricao_es: descricao === '' ? null : descricao, aprendizados, material } };
}

// O que está gravado em temas_conversacao.aprendizados -> lista de textos (o que não for texto some).
export function lerAprendizados(gravado: unknown): string[] {
  return Array.isArray(gravado) ? gravado.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : [];
}

// ---------------------------------------------------------------------------
// Datas no horário de Brasília
// ---------------------------------------------------------------------------

const BRASILIA_MS = -3 * 60 * 60 * 1000;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// Data ('AAAA-MM-DD') e hora ('HH:MM') de Brasília -> instante. null se a data ou a hora não existem.
export function inicioEmBrasilia(data: unknown, hora: unknown): string | null {
  if (typeof data !== 'string' || typeof hora !== 'string' || !DATA.test(data) || !HORA.test(hora)) return null;
  const instante = new Date(`${data}T${hora}:00.000-03:00`);
  if (Number.isNaN(instante.getTime())) return null;
  const iso = instante.toISOString();
  // "2026-02-30" vira 2 de março no relógio: a volta não bate e a data é recusada.
  return dataEmBrasilia(iso) === data ? iso : null;
}

function noRelogioDeBrasilia(iso: unknown): string {
  if (typeof iso !== 'string') return '';
  const instante = new Date(iso);
  return Number.isNaN(instante.getTime()) ? '' : new Date(instante.getTime() + BRASILIA_MS).toISOString();
}

// Instante -> 'AAAA-MM-DD' e 'HH:MM' em Brasília (os valores dos campos de data e de hora).
export function dataEmBrasilia(iso: unknown): string {
  return noRelogioDeBrasilia(iso).slice(0, 10);
}
export function horaEmBrasilia(iso: unknown): string {
  return noRelogioDeBrasilia(iso).slice(11, 16);
}

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// "quinta-feira, 8 de outubro de 2026, 20:00", em Brasília.
export function quandoEmBrasilia(iso: unknown): string {
  const relogio = noRelogioDeBrasilia(iso);
  if (relogio === '') return '';
  const dia = new Date(relogio);
  return `${DIAS[dia.getUTCDay()]}, ${dia.getUTCDate()} de ${MESES[dia.getUTCMonth()]} de ${dia.getUTCFullYear()}, ${relogio.slice(11, 16)}`;
}

// Como o aluno vê o horário: a hora (e o dia, quando muda) em algumas cidades de quem estuda.
export const CIDADES = [
  { nome: 'Madri', fuso: 'Europe/Madrid' },
  { nome: 'Buenos Aires', fuso: 'America/Argentina/Buenos_Aires' },
  { nome: 'Bogotá', fuso: 'America/Bogota' },
  { nome: 'Cidade do México', fuso: 'America/Mexico_City' },
] as const;

export function horarioNasCidades(iso: string): { cidade: string; hora: string }[] {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return [];
  const diaAqui = dataEmBrasilia(iso);
  return CIDADES.map(({ nome, fuso }) => {
    const partes: Record<string, string> = {};
    const formato = new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    for (const parte of formato.formatToParts(instante)) partes[parte.type] = parte.value;
    const diaLa = `${partes.year}-${partes.month}-${partes.day}`;
    const hora = `${partes.hour}:${partes.minute}`;
    return { cidade: nome, hora: diaLa === diaAqui ? hora : `${hora} (${diaLa > diaAqui ? 'dia seguinte' : 'dia anterior'})` };
  });
}

// ---------------------------------------------------------------------------
// Turma
// ---------------------------------------------------------------------------

export const LIMITES_DA_TURMA = { duracaoMin: 15, duracaoMax: 240, vagasMax: 100 };

export type DadosDaTurma = { tema_id: string; inicio: string; duracao_min: number; vagas: number; meet_url: string };

function inteiroEntre(valor: unknown, minimo: number, maximo: number): number | null {
  const escrito = limpar(valor);
  if (!/^\d{1,5}$/.test(escrito)) return null;
  const numero = Number(escrito);
  return numero >= minimo && numero <= maximo ? numero : null;
}

// "reservas": quantas pessoas já reservaram (0 para turma nova). Com gente inscrita, a data e a
// hora não mudam mais (quem chama mantém as que estavam) e as vagas não ficam abaixo dos inscritos.
export function validarTurma(entrada: Entrada, agora: Date, reservas: number): Resultado<DadosDaTurma> {
  const erros: Erros = {};

  const tema_id = limpar(entrada.tema_id);
  if (!ehUuid(tema_id)) erros.tema_id = 'Escolha o tema da aula.';

  let inicio = '';
  if (reservas === 0) {
    const lido = inicioEmBrasilia(limpar(entrada.data), limpar(entrada.hora));
    if (lido === null) erros.data = 'Escolha a data e a hora da aula.';
    else if (new Date(lido).getTime() <= agora.getTime()) erros.data = 'Essa data e hora já passaram. Escolha um horário no futuro.';
    else inicio = lido;
  }

  const duracao_min = inteiroEntre(entrada.duracao_min, LIMITES_DA_TURMA.duracaoMin, LIMITES_DA_TURMA.duracaoMax);
  if (duracao_min === null) erros.duracao_min = `Escreva a duração em minutos, de ${LIMITES_DA_TURMA.duracaoMin} a ${LIMITES_DA_TURMA.duracaoMax}.`;

  const vagas = inteiroEntre(entrada.vagas, 1, LIMITES_DA_TURMA.vagasMax);
  if (vagas === null) erros.vagas = `Escreva o número de vagas, de 1 a ${LIMITES_DA_TURMA.vagasMax}.`;
  else if (vagas < reservas) erros.vagas = `Já há ${reservas} ${reservas === 1 ? 'pessoa inscrita' : 'pessoas inscritas'}: as vagas não podem ficar abaixo disso.`;

  const meet_url = lerLink(entrada.meet_url);
  if (meet_url === null) erros.meet_url = 'Cole o link da sala (Google Meet). Ele vai no e-mail de quem reservar.';
  else if (meet_url === 'invalido') erros.meet_url = 'Cole um link que comece com https://, sem espaços.';

  if (duracao_min === null || vagas === null || meet_url === null || meet_url === 'invalido' || Object.keys(erros).length > 0) {
    return { ok: false, erros };
  }
  return { ok: true, valor: { tema_id, inicio, duracao_min, vagas, meet_url } };
}

export type EstadoDaTurma = 'cancelada' | 'realizada' | 'acontecendo' | 'aberta';

export function estadoDaTurma(turma: { situacao: string; inicio: string; duracao_min: number }, agora: Date): EstadoDaTurma {
  if (turma.situacao === 'cancelada') return 'cancelada';
  const inicio = new Date(turma.inicio).getTime();
  if (agora.getTime() >= inicio + turma.duracao_min * 60_000) return 'realizada';
  return agora.getTime() >= inicio ? 'acontecendo' : 'aberta';
}

export const NOME_DO_ESTADO: Record<EstadoDaTurma, string> = {
  cancelada: 'Cancelada',
  realizada: 'Realizada',
  acontecendo: 'Acontecendo agora',
  aberta: 'Aberta para reserva',
};

// ---------------------------------------------------------------------------
// Configurações da conversação
// ---------------------------------------------------------------------------

export type Configuracoes = { agenda_janela_dias: number; reserva_fecha_min_antes: number; cancelamento_min_antes: number };
export const CONFIGURACOES_PADRAO: Configuracoes = { agenda_janela_dias: 7, reserva_fecha_min_antes: 15, cancelamento_min_antes: 120 };

export function validarConfiguracoes(entrada: Entrada): Resultado<Configuracoes> {
  const erros: Erros = {};
  const agenda_janela_dias = inteiroEntre(entrada.agenda_janela_dias, 1, 30);
  const reserva_fecha_min_antes = inteiroEntre(entrada.reserva_fecha_min_antes, 0, 1440);
  const cancelamento_min_antes = inteiroEntre(entrada.cancelamento_min_antes, 0, 10080);
  if (agenda_janela_dias === null) erros.agenda_janela_dias = 'Escreva um número de 1 a 30.';
  if (reserva_fecha_min_antes === null) erros.reserva_fecha_min_antes = 'Escreva um número de 0 a 1440 (um dia).';
  if (cancelamento_min_antes === null) erros.cancelamento_min_antes = 'Escreva um número de 0 a 10080 (uma semana).';
  if (agenda_janela_dias === null || reserva_fecha_min_antes === null || cancelamento_min_antes === null) return { ok: false, erros };
  return { ok: true, valor: { agenda_janela_dias, reserva_fecha_min_antes, cancelamento_min_antes } };
}

// O que está gravado na tabela de configurações -> os três números, com o padrão no que faltar.
export function lerConfiguracoes(linhas: readonly { chave: string; valor: unknown }[]): Configuracoes {
  const lidas: Configuracoes = { ...CONFIGURACOES_PADRAO };
  for (const linha of linhas) {
    const numero = typeof linha.valor === 'number' ? linha.valor : Number(linha.valor);
    if (linha.chave in lidas && Number.isInteger(numero) && numero >= 0) lidas[linha.chave as keyof Configuracoes] = numero;
  }
  return lidas;
}
