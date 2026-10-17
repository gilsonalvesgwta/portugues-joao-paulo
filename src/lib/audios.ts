// Áudios do quiz (a voz do professor nas palavras do jogo de pares): reconhecer o formato pelo
// conteúdo do arquivo, e não pelo nome ou pelo que o navegador diz, e entregar o som em pedaços
// (o Safari só toca áudio de quem atende "Range"). Sem dependências: vale no servidor e nos testes.

export type TipoDeAudio = 'audio/wav' | 'audio/mpeg' | 'audio/mp4' | 'audio/ogg' | 'audio/webm';

export const AUDIO_MAX_BYTES = 2 * 1024 * 1024;
export const AUDIO_MIN_BYTES = 44;

function comeca(bytes: Uint8Array, assinatura: number[], deslocamento = 0): boolean {
  return assinatura.every((valor, i) => bytes[deslocamento + i] === valor);
}

const ascii = (texto: string) => [...texto].map((letra) => letra.charCodeAt(0));

export function tipoDoAudio(bytes: Uint8Array): TipoDeAudio | null {
  if (bytes.length < AUDIO_MIN_BYTES) return null;
  if (comeca(bytes, ascii('RIFF')) && comeca(bytes, ascii('WAVE'), 8)) return 'audio/wav';
  if (comeca(bytes, ascii('ID3'))) return 'audio/mpeg';
  // Quadro de MP3 sem etiqueta: 11 bits ligados no começo.
  if (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0) return 'audio/mpeg';
  if (comeca(bytes, ascii('ftyp'), 4)) return 'audio/mp4';
  if (comeca(bytes, ascii('OggS'))) return 'audio/ogg';
  if (comeca(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return 'audio/webm';
  return null;
}

// Cabeçalho "Range: bytes=a-b" -> o pedaço pedido. null: sem pedido de pedaço (vai o arquivo
// inteiro). 'fora': pedido que não cabe no arquivo (resposta 416).
export function pedacoPedido(cabecalho: string | null, total: number): { inicio: number; fim: number } | null | 'fora' {
  if (cabecalho === null) return null;
  const achado = /^bytes=(\d*)-(\d*)$/.exec(cabecalho.trim());
  if (!achado || (achado[1] === '' && achado[2] === '')) return null;
  let inicio: number;
  let fim: number;
  if (achado[1] === '') {
    // "bytes=-500": os últimos 500.
    const ultimos = Number(achado[2]);
    if (ultimos === 0) return 'fora';
    inicio = Math.max(total - ultimos, 0);
    fim = total - 1;
  } else {
    inicio = Number(achado[1]);
    fim = achado[2] === '' ? total - 1 : Math.min(Number(achado[2]), total - 1);
  }
  if (inicio >= total || inicio > fim) return 'fora';
  return { inicio, fim };
}

// O banco devolve o conteúdo binário escrito em hexadecimal ("\x5249...").
export function bytesDoBanco(valor: unknown): Uint8Array<ArrayBuffer> | null {
  if (typeof valor !== 'string' || !valor.startsWith('\\x') || valor.length % 2 !== 0) return null;
  const hex = valor.slice(2);
  if (!/^[0-9a-f]*$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function paraOBanco(bytes: Uint8Array): string {
  let hex = '\\x';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}
