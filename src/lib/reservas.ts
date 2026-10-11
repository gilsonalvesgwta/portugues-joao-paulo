// Reservas das aulas de conversação, do lado do aluno: a semana dele (de segunda a domingo, no
// fuso dele), o que ainda dá para cancelar, os fusos e as mensagens de erro em espanhol.
// Sem dependências, para valer igual na tela, no servidor e nos testes.

import { partesLocais } from './agenda.ts';

// Formato devolvido pela função minhas_reservas do banco.
export type ReservaDoAluno = {
  reserva_id: string;
  turma_id: string;
  tema_id: string;
  titulo_es: string;
  nivel: string;
  inicio: string;
  duracao_min: number;
  meet_url: string | null;
  material: string | null;
  nota: number | null;
  comentario: string | null;
};

function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

// A segunda-feira ('AAAA-MM-DD') da semana em que o instante cai, no fuso pedido.
export function segundaDaSemana(instante: Date, fuso: string): string {
  const data = partesLocais(instante, fuso).data;
  const [ano, mes, dia] = data.split('-').map(Number) as [number, number, number];
  const diaDaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay(); // 0 = domingo
  return somarDias(data, -((diaDaSemana + 6) % 7));
}

// Quantas das reservas caem na mesma semana (segunda a domingo, no fuso do aluno) que a referência.
// É a mesma conta que o banco faz para o limite semanal.
export function reservasNaSemana(reservas: readonly { inicio: string }[], fuso: string, referencia: Date): number {
  const semana = segundaDaSemana(referencia, fuso);
  return reservas.filter((reserva) => segundaDaSemana(new Date(reserva.inicio), fuso) === semana).length;
}

// A mesma conta, para um dia da agenda ('AAAA-MM-DD' já no fuso do aluno).
export function reservasNaSemanaDoDia(reservas: readonly { inicio: string }[], fuso: string, dia: string): number {
  const [ano, mes, numero] = dia.split('-').map(Number) as [number, number, number];
  const diaDaSemana = new Date(Date.UTC(ano, mes - 1, numero)).getUTCDay();
  const semana = somarDias(dia, -((diaDaSemana + 6) % 7));
  return reservas.filter((reserva) => segundaDaSemana(new Date(reserva.inicio), fuso) === semana).length;
}

// As que ainda vão acontecer (ou estão acontecendo), da mais próxima para a mais distante, e as
// que já terminaram, da mais recente para a mais antiga.
export function separarReservas<T extends { inicio: string; duracao_min: number }>(reservas: readonly T[], agora: Date): { proximas: T[]; passadas: T[] } {
  const fim = (reserva: T) => Date.parse(reserva.inicio) + reserva.duracao_min * 60_000;
  const emOrdem = [...reservas].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
  return {
    proximas: emOrdem.filter((reserva) => fim(reserva) > agora.getTime()),
    passadas: emOrdem.filter((reserva) => fim(reserva) <= agora.getTime()).reverse(),
  };
}

// O aluno cancela até "minutosAntes" do início (mesma regra do banco).
export function podeCancelar(inicio: string, agora: Date, minutosAntes: number): boolean {
  return Date.parse(inicio) >= agora.getTime() + minutosAntes * 60_000;
}

// ---------------------------------------------------------------------------
// Datas e fusos, em espanhol
// ---------------------------------------------------------------------------

export const DIAS_CORTOS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'] as const;

// 'AAAA-MM-DD' -> "jueves 8 de octubre".
export function fechaLarga(data: string): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  if (!ano || !mes || !dia) return '';
  const partes = new Intl.DateTimeFormat('es', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).formatToParts(
    new Date(Date.UTC(ano, mes - 1, dia)),
  );
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${parte('weekday')} ${parte('day')} de ${parte('month')}`;
}

export function zonaValida(fuso: unknown): fuso is string {
  if (typeof fuso !== 'string' || fuso === '' || fuso.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
}

// "Madrid (GMT+2)", "Ciudad de México (GMT-6)": a cidade do fuso e a diferença para o horário universal agora.
export function rotuloDoFuso(fuso: string, agora: Date): string {
  const cidade = NOMBRE_DE_LA_ZONA[fuso] ?? (fuso.split('/').pop() ?? fuso).replace(/_/g, ' ');
  let diferenca = '';
  try {
    diferenca =
      new Intl.DateTimeFormat('en', { timeZone: fuso, timeZoneName: 'shortOffset' }).formatToParts(agora).find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return cidade;
  }
  return diferenca === '' ? cidade : `${cidade} (${diferenca === 'GMT' ? 'GMT+0' : diferenca})`;
}

// Fusos de onde vem a maior parte dos alunos, na ordem em que aparecem na lista.
export const ZONAS_COMUNES = [
  'Europe/Madrid', 'Atlantic/Canary', 'America/Mexico_City', 'America/Bogota', 'America/Lima', 'America/Guayaquil', 'America/Caracas',
  'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Montevideo', 'America/Asuncion', 'America/La_Paz', 'America/Guatemala',
  'America/Costa_Rica', 'America/Panama', 'America/Santo_Domingo', 'America/Puerto_Rico', 'America/New_York', 'America/Chicago',
  'America/Los_Angeles', 'America/Sao_Paulo',
] as const;

const NOMBRE_DE_LA_ZONA: Record<string, string> = {
  'Europe/Madrid': 'Madrid',
  'Atlantic/Canary': 'Islas Canarias',
  'America/Mexico_City': 'Ciudad de México',
  'America/Bogota': 'Bogotá',
  'America/Lima': 'Lima',
  'America/Guayaquil': 'Quito y Guayaquil',
  'America/Caracas': 'Caracas',
  'America/Santiago': 'Santiago de Chile',
  'America/Argentina/Buenos_Aires': 'Buenos Aires',
  'America/Montevideo': 'Montevideo',
  'America/Asuncion': 'Asunción',
  'America/La_Paz': 'La Paz',
  'America/Guatemala': 'Guatemala',
  'America/Costa_Rica': 'Costa Rica',
  'America/Panama': 'Panamá',
  'America/Santo_Domingo': 'Santo Domingo',
  'America/Puerto_Rico': 'Puerto Rico',
  'America/New_York': 'Nueva York',
  'America/Chicago': 'Chicago',
  'America/Los_Angeles': 'Los Ángeles',
  'America/Sao_Paulo': 'São Paulo',
};

// ---------------------------------------------------------------------------
// Erros e avaliação
// ---------------------------------------------------------------------------

export const ERRORES_DE_RESERVA: Record<string, string> = {
  turma_lotada: 'Esa clase acaba de completarse. Elige otro horario.',
  limite_semanal: 'Ya usaste todas tus reservas de esa semana.',
  reserva_encerrada: 'Las reservas de esa clase ya cerraron.',
  fora_da_janela: 'Esa clase todavía no está abierta para reservar.',
  ja_reservada: 'Ya tienes una reserva en esa clase.',
  turma_fechada: 'Esa clase ya no está disponible.',
  turma_inexistente: 'Esa clase ya no está disponible.',
  sem_direito_a_conversacao: 'Tu acceso no incluye clases de conversación.',
  cancelamento_fora_do_prazo: 'El plazo para cancelar esta clase ya pasó.',
  reserva_inexistente: 'No encontramos esa reserva.',
  aula_ainda_nao_terminou: 'Podrás valorar la clase cuando termine.',
  nota: 'Elige una nota de 1 a 5.',
  fallo: 'No pudimos guardar el cambio. Inténtalo de nuevo.',
};

// A mensagem de erro do banco -> o código conhecido que ela traz; 'fallo' para o resto.
export function codigoDoErro(mensagem: string | null | undefined): string {
  const texto = mensagem ?? '';
  return Object.keys(ERRORES_DE_RESERVA).find((codigo) => codigo !== 'fallo' && codigo !== 'nota' && texto.includes(codigo)) ?? 'fallo';
}

export const COMENTARIO_MAX = 500;

export function lerNota(valor: unknown): number | null {
  return typeof valor === 'string' && /^[1-5]$/.test(valor) ? Number(valor) : null;
}
