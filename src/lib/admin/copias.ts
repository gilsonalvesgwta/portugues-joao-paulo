import { randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import {
  lerConfig, lerHistorico, lerTrabalhando, nomeDaEnviada, NOME_SEGURO, pareceCopia, tipoDaCopia,
  type Acontecimento, type ConfigDasCopias, type TipoDaCopia, type Trabalho,
} from '@/lib/copias';

// Cópias de segurança, do lado do aplicativo. Quem faz as cópias e as restaurações é o serviço de
// cópias da stack (deploy/banco/copias.sh); o aplicativo lista, entrega para baixar, recebe as
// enviadas e deixa pedidos na pasta que os dois compartilham (PASTA_DAS_COPIAS).

export type Copia = { nome: string; tipo: TipoDaCopia; bytes: number; quando: Date };

export type SituacaoDasCopias = {
  ligado: boolean;
  copias: Copia[];
  vivo: Date | null;
  trabalhando: Trabalho | null;
  pendentes: number;
  historico: Acontecimento[];
  config: ConfigDasCopias;
};

const TAMANHO_MAX = 2 * 1024 * 1024 * 1024;

export function pastaDasCopias(): string | null {
  const pasta = (process.env.PASTA_DAS_COPIAS ?? '').trim();
  return pasta === '' ? null : pasta;
}

async function lerTexto(arquivo: string): Promise<string> {
  try {
    return await readFile(arquivo, 'utf8');
  } catch {
    return '';
  }
}

async function nomesEm(pasta: string): Promise<string[]> {
  try {
    return await readdir(pasta);
  } catch {
    return [];
  }
}

export async function carregarCopias(): Promise<SituacaoDasCopias> {
  const pasta = pastaDasCopias();
  const vazio: SituacaoDasCopias = { ligado: false, copias: [], vivo: null, trabalhando: null, pendentes: 0, historico: [], config: lerConfig('') };
  if (pasta === null) return vazio;

  const arquivos = path.join(pasta, 'arquivos');
  const copias: Copia[] = [];
  for (const nome of await nomesEm(arquivos)) {
    const tipo = tipoDaCopia(nome);
    if (tipo === null) continue;
    try {
      const info = await stat(path.join(arquivos, nome));
      if (info.isFile()) copias.push({ nome, tipo, bytes: info.size, quando: info.mtime });
    } catch {
      // Apagada entre a lista e a leitura: fica de fora.
    }
  }
  copias.sort((a, b) => b.quando.getTime() - a.quando.getTime() || b.nome.localeCompare(a.nome));

  const vivoTexto = (await lerTexto(path.join(pasta, 'estado', 'vivo'))).trim();
  const vivoNumero = Number(vivoTexto);
  const pendentes = (await nomesEm(path.join(pasta, 'pedidos'))).filter((nome) => nome.endsWith('.pedido')).length;

  return {
    ligado: true,
    copias,
    vivo: vivoTexto !== '' && Number.isInteger(vivoNumero) && vivoNumero > 0 ? new Date(vivoNumero * 1000) : null,
    trabalhando: lerTrabalhando(await lerTexto(path.join(pasta, 'estado', 'trabalhando'))),
    pendentes,
    historico: lerHistorico(await lerTexto(path.join(pasta, 'estado', 'historico.log'))),
    config: lerConfig(await lerTexto(path.join(pasta, 'estado', 'config'))),
  };
}

// Caminho de uma cópia pelo nome, só se o nome for de cópia e o arquivo existir.
export async function caminhoDaCopia(nome: string): Promise<{ caminho: string; bytes: number } | null> {
  const pasta = pastaDasCopias();
  if (pasta === null || tipoDaCopia(nome) === null) return null;
  const caminho = path.join(pasta, 'arquivos', nome);
  try {
    const info = await stat(caminho);
    return info.isFile() ? { caminho, bytes: info.size } : null;
  } catch {
    return null;
  }
}

export function lerCopia(caminho: string): ReadableStream<Uint8Array> {
  return Readable.toWeb(createReadStream(caminho)) as unknown as ReadableStream<Uint8Array>;
}

// Um pedido para o serviço de cópias. O arquivo é escrito com outro nome e só então renomeado,
// para o serviço nunca ler um pedido pela metade.
export async function pedirAoServico(acao: 'copiar' | 'restaurar', arquivo = ''): Promise<boolean> {
  const pasta = pastaDasCopias();
  if (pasta === null) return false;
  if (acao === 'restaurar' && tipoDaCopia(arquivo) === null) return false;
  const pedidos = path.join(pasta, 'pedidos');
  const nome = `${Date.now()}-${randomBytes(4).toString('hex')}`;
  const provisorio = path.join(pedidos, `.${nome}.escrevendo`);
  try {
    await writeFile(provisorio, `acao=${acao}\n${acao === 'restaurar' ? `arquivo=${arquivo}\n` : ''}`, { mode: 0o600 });
    await rename(provisorio, path.join(pedidos, `${nome}.pedido`));
    return true;
  } catch {
    await rm(provisorio, { force: true });
    return false;
  }
}

export async function apagarCopia(nome: string): Promise<boolean> {
  const achada = await caminhoDaCopia(nome);
  if (achada === null) return false;
  try {
    await rm(achada.caminho);
    return true;
  } catch {
    return false;
  }
}

export type ResultadoDoEnvio = { ok: true; nome: string } | { ok: false; motivo: 'desligado' | 'grande_demais' | 'nao_e_copia' | 'falhou' };

// Recebe um arquivo enviado pela administração e guarda na lista de cópias, depois de conferir
// que ele é mesmo uma cópia (compactada, com começo e fim de uma cópia do banco).
export async function receberCopia(corpo: ReadableStream<Uint8Array>): Promise<ResultadoDoEnvio> {
  const pasta = pastaDasCopias();
  if (pasta === null) return { ok: false, motivo: 'desligado' };
  const arquivos = path.join(pasta, 'arquivos');
  const provisorio = path.join(arquivos, `.enviando-${Date.now()}-${randomBytes(4).toString('hex')}`);

  let recebidos = 0;
  const contador = new Transform({
    transform(pedaco: Buffer, _codificacao, pronto) {
      recebidos += pedaco.length;
      if (recebidos > TAMANHO_MAX) pronto(new Error('grande_demais'));
      else pronto(null, pedaco);
    },
  });
  try {
    await pipeline(Readable.fromWeb(corpo as unknown as Parameters<typeof Readable.fromWeb>[0]), contador, createWriteStream(provisorio, { mode: 0o600 }));
  } catch (erro) {
    await rm(provisorio, { force: true });
    return { ok: false, motivo: erro instanceof Error && erro.message === 'grande_demais' ? 'grande_demais' : 'falhou' };
  }

  if (!(await conferirCompactado(provisorio))) {
    await rm(provisorio, { force: true });
    return { ok: false, motivo: 'nao_e_copia' };
  }
  const nome = nomeDaEnviada(new Date());
  if (!NOME_SEGURO.test(nome)) {
    await rm(provisorio, { force: true });
    return { ok: false, motivo: 'falhou' };
  }
  try {
    await rename(provisorio, path.join(arquivos, nome));
  } catch {
    await rm(provisorio, { force: true });
    return { ok: false, motivo: 'falhou' };
  }
  return { ok: true, nome };
}

// Descompacta o arquivo inteiro (o que confere que ele não está danificado) guardando só o começo
// e o fim do texto.
async function conferirCompactado(caminho: string): Promise<boolean> {
  let comeco = '';
  let fim = '';
  const leitor = new Writable({
    write(pedaco: Buffer, _codificacao, pronto) {
      const texto = pedaco.toString('latin1');
      if (comeco.length < 4096) comeco += texto.slice(0, 4096 - comeco.length);
      fim = (fim + texto).slice(-4096);
      pronto();
    },
  });
  try {
    await pipeline(createReadStream(caminho), createGunzip(), leitor);
  } catch {
    return false;
  }
  return pareceCopia(comeco, fim);
}
