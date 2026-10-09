// Agenda de conversação vista pelo aluno: as turmas dos próximos dias, agrupadas por dia
// e por período (manhã, tarde, noite), sempre no fuso do aluno.
// O banco guarda tudo em UTC; a função agenda_turmas já devolve só o que está na janela.

export type TurmaDaAgenda = {
  turmaId: string;
  inicio: string; // instante em ISO 8601 (UTC)
  vagasRestantes: number;
  jaReservada: boolean;
};

export type Horario = TurmaDaAgenda & {
  hora: string; // "20:00" no fuso do aluno
  lotada: boolean;
};

export type DiaDaAgenda = {
  data: string; // "2026-10-08" no fuso do aluno
  diaDoMes: number;
  diaDaSemana: number; // 0 = domingo ... 6 = sábado
  ehHoje: boolean;
  turmasComVaga: number;
  manha: Horario[];
  tarde: Horario[];
  noite: Horario[];
};

type PartesLocais = { data: string; hora: number; minuto: number };

const formatadores = new Map<string, Intl.DateTimeFormat>();

function formatador(fuso: string): Intl.DateTimeFormat {
  let f = formatadores.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatadores.set(fuso, f);
  }
  return f;
}

// Data e hora de um instante no fuso pedido. Fuso inválido lança RangeError (o banco já recusa).
export function partesLocais(instante: Date, fuso: string): PartesLocais {
  const partes: Record<string, string> = {};
  for (const p of formatador(fuso).formatToParts(instante)) partes[p.type] = p.value;
  return {
    data: `${partes.year}-${partes.month}-${partes.day}`,
    hora: Number(partes.hour),
    minuto: Number(partes.minute),
  };
}

function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

function dois(n: number): string {
  return String(n).padStart(2, '0');
}

// Manhã até 11:59, tarde até 17:59, noite a partir das 18:00.
export function periodoDaHora(hora: number): 'manha' | 'tarde' | 'noite' {
  if (hora < 12) return 'manha';
  if (hora < 18) return 'tarde';
  return 'noite';
}

// Monta um dia por data da janela, inclusive os dias sem turma (a tela mostra "Sin clases").
export function diasDaAgenda(
  turmas: readonly TurmaDaAgenda[],
  fuso: string,
  agora: Date,
  janelaDias = 7,
): DiaDaAgenda[] {
  const hoje = partesLocais(agora, fuso).data;
  const dias = new Map<string, DiaDaAgenda>();

  for (let i = 0; i < janelaDias; i += 1) {
    const data = somarDias(hoje, i);
    const [ano, mes, dia] = data.split('-').map(Number) as [number, number, number];
    dias.set(data, {
      data,
      diaDoMes: dia,
      diaDaSemana: new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay(),
      ehHoje: i === 0,
      turmasComVaga: 0,
      manha: [],
      tarde: [],
      noite: [],
    });
  }

  const emOrdem = [...turmas].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
  for (const turma of emOrdem) {
    const inicio = new Date(turma.inicio);
    if (Number.isNaN(inicio.getTime()) || inicio <= agora) continue;
    const local = partesLocais(inicio, fuso);
    const dia = dias.get(local.data);
    if (!dia) continue; // fora da janela neste fuso
    const lotada = turma.vagasRestantes <= 0;
    dia[periodoDaHora(local.hora)].push({ ...turma, hora: `${dois(local.hora)}:${dois(local.minuto)}`, lotada });
    if (!lotada) dia.turmasComVaga += 1;
  }

  return [...dias.values()];
}
