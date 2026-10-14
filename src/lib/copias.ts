// Cópias de segurança: o que a administração mostra a partir da pasta das cópias. O serviço de
// cópias (deploy/banco/copias.sh) grava os arquivos e o estado; aqui só se lê e se escreve texto.
// Sem dependências, para valer igual no servidor e nos testes.

export type TipoDaCopia = 'automatica' | 'manual' | 'antes-de-restaurar' | 'enviada' | 'outra';

export const NOME_DA_COPIA = /^portuguesjp-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})(?:-(automatica|manual|antes-de-restaurar|enviada))?\.sql\.gz$/;
// O mesmo que o serviço aceita: nada de barra nem de ponto no começo.
export const NOME_SEGURO = /^portuguesjp-[0-9A-Za-z_-]+\.sql\.gz$/;

export const ROTULO_DO_TIPO: Record<TipoDaCopia, string> = {
  automatica: 'Automática',
  manual: 'Feita na hora',
  'antes-de-restaurar': 'Antes de restaurar',
  enviada: 'Enviada',
  outra: 'Cópia',
};

export function tipoDaCopia(nome: string): TipoDaCopia | null {
  if (!NOME_SEGURO.test(nome)) return null;
  const partes = NOME_DA_COPIA.exec(nome);
  if (!partes) return 'outra';
  return (partes[7] as TipoDaCopia | undefined) ?? 'outra';
}

// Nome de uma cópia enviada pela administração: data e hora de Brasília, como as feitas aqui.
const BRASILIA_MS = -3 * 60 * 60 * 1000;
export function nomeDaEnviada(agora: Date): string {
  const t = new Date(agora.getTime() + BRASILIA_MS).toISOString();
  return `portuguesjp-${t.slice(0, 10)}-${t.slice(11, 13)}${t.slice(14, 16)}${t.slice(17, 19)}-enviada.sql.gz`;
}

export function tamanhoEmPalavras(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} bytes`;
  const unidades = ['KB', 'MB', 'GB'];
  let valor = bytes / 1024;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i += 1;
  }
  const texto = valor < 10 ? valor.toFixed(1).replace('.', ',').replace(/,0$/, '') : String(Math.round(valor));
  return `${texto} ${unidades[i]}`;
}

export type Acontecimento = { quando: Date; acao: 'copiar' | 'restaurar'; ok: boolean; arquivo: string; mensagem: string };

// historico.log: uma linha por acontecimento, com os campos separados por tabulação.
export function lerHistorico(texto: string): Acontecimento[] {
  const lista: Acontecimento[] = [];
  for (const linha of texto.split('\n')) {
    const [segundos, acao, resultado, arquivo = '', mensagem = ''] = linha.split('\t');
    const numero = Number(segundos);
    if (!Number.isInteger(numero) || numero <= 0) continue;
    if (acao !== 'copiar' && acao !== 'restaurar') continue;
    if (resultado !== 'ok' && resultado !== 'erro') continue;
    lista.push({ quando: new Date(numero * 1000), acao, ok: resultado === 'ok', arquivo, mensagem });
  }
  return lista.reverse();
}

export type Trabalho = { desde: Date; acao: 'copiar' | 'restaurar'; arquivo: string };

export function lerTrabalhando(texto: string): Trabalho | null {
  const [segundos, acao, arquivo = ''] = texto.trim().split('\t');
  const numero = Number(segundos);
  if (!Number.isInteger(numero) || numero <= 0) return null;
  if (acao !== 'copiar' && acao !== 'restaurar') return null;
  return { desde: new Date(numero * 1000), acao, arquivo };
}

export type ConfigDasCopias = { hora: number; manterDias: number };
export const CONFIG_PADRAO: ConfigDasCopias = { hora: 3, manterDias: 14 };

export function lerConfig(texto: string): ConfigDasCopias {
  const valor = (chave: string): number | null => {
    const achado = new RegExp(`^${chave}=(\\d+)$`, 'm').exec(texto);
    return achado ? Number(achado[1]) : null;
  };
  const hora = valor('hora');
  const manter = valor('manter');
  return {
    hora: hora !== null && hora <= 23 ? hora : CONFIG_PADRAO.hora,
    manterDias: manter !== null && manter > 0 ? manter : CONFIG_PADRAO.manterDias,
  };
}

// O serviço marca a hora a cada 5 segundos. Mais de 2 minutos sem marcar: está parado.
export function servicoNoAr(vivo: Date | null, agora: Date): boolean {
  if (vivo === null) return false;
  const diferenca = agora.getTime() - vivo.getTime();
  return diferenca < 120_000 && diferenca > -120_000;
}

export type Saude = 'em_dia' | 'atrasada' | 'parado' | 'desligado';

// "Em dia": serviço no ar e uma cópia boa nas últimas 36 horas (a automática de hoje, ou a de ontem
// enquanto a de hoje não chega).
export function saudeDasCopias(opcoes: { ligado: boolean; vivo: Date | null; ultimaCopia: Date | null; agora: Date }): Saude {
  if (!opcoes.ligado) return 'desligado';
  if (!servicoNoAr(opcoes.vivo, opcoes.agora)) return 'parado';
  if (opcoes.ultimaCopia === null) return 'atrasada';
  return opcoes.agora.getTime() - opcoes.ultimaCopia.getTime() <= 36 * 3_600_000 ? 'em_dia' : 'atrasada';
}

// Conferência rápida de um arquivo enviado, pelo começo e pelo fim do texto já descompactado.
// A conferência completa, linha por linha, o serviço de cópias faz antes de restaurar.
export function pareceCopia(comeco: string, fim: string): boolean {
  return comeco.includes('-- PostgreSQL database dump') && fim.includes('-- PostgreSQL database dump complete');
}

// "hoje, 03:00", "ontem, 03:00" ou "12 de outubro, 03:00", no horário de Brasília.
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export function quandoEmPalavras(quando: Date, agora: Date): string {
  const local = new Date(quando.getTime() + BRASILIA_MS);
  const hoje = new Date(agora.getTime() + BRASILIA_MS);
  const hora = local.toISOString().slice(11, 16);
  const dia = (d: Date) => d.toISOString().slice(0, 10);
  if (dia(local) === dia(hoje)) return `hoje, ${hora}`;
  if (dia(local) === dia(new Date(hoje.getTime() - 86_400_000))) return `ontem, ${hora}`;
  const ano = local.getUTCFullYear() === hoje.getUTCFullYear() ? '' : ` de ${local.getUTCFullYear()}`;
  return `${local.getUTCDate()} de ${MESES[local.getUTCMonth()] ?? ''}${ano}, ${hora}`;
}
