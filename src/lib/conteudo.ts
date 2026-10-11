// Regras do conteúdo editado na administração: cursos, módulos e aulas.
// Sem dependências, para valer igual na tela, no servidor e nos testes.

export type Erros = Record<string, string>;
export type Resultado<T> = { ok: true; valor: T } | { ok: false; erros: Erros };
export type Entrada = Record<string, unknown>;

export const TITULO_MAX = 160;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODIGO_DO_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;

export function ehUuid(valor: unknown): valor is string {
  return typeof valor === 'string' && UUID.test(valor);
}

// Tira espaços das pontas e junta espaços repetidos.
export function limpar(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '';
}

function conferirTitulo(erros: Erros, campo: string, valor: string, idioma: string): void {
  if (valor === '') erros[campo] = `Escreva o título em ${idioma}.`;
  else if (valor.length > TITULO_MAX) erros[campo] = `O título pode ter até ${TITULO_MAX} letras.`;
}

function umDe<T extends string>(valor: unknown, opcoes: readonly T[]): T | null {
  return typeof valor === 'string' && (opcoes as readonly string[]).includes(valor) ? (valor as T) : null;
}

export const TIPOS_DE_CURSO = ['principal', 'complementar'] as const;
export const MODOS_DE_CURSO = ['livre', 'sequencial'] as const;
export const SITUACOES = ['rascunho', 'publicado'] as const;
export type Situacao = (typeof SITUACOES)[number];

export type DadosDoCurso = {
  titulo_pt: string;
  titulo_es: string;
  tipo: (typeof TIPOS_DE_CURSO)[number];
  modo: (typeof MODOS_DE_CURSO)[number];
  situacao: Situacao;
};

export function validarCurso(entrada: Entrada): Resultado<DadosDoCurso> {
  const erros: Erros = {};
  const titulo_pt = limpar(entrada.titulo_pt);
  const titulo_es = limpar(entrada.titulo_es);
  conferirTitulo(erros, 'titulo_pt', titulo_pt, 'português');
  conferirTitulo(erros, 'titulo_es', titulo_es, 'espanhol');
  const tipo = umDe(entrada.tipo, TIPOS_DE_CURSO);
  const modo = umDe(entrada.modo, MODOS_DE_CURSO);
  const situacao = umDe(entrada.situacao, SITUACOES);
  if (!tipo) erros.tipo = 'Escolha o tipo do curso.';
  if (!modo) erros.modo = 'Escolha como o aluno avança.';
  if (!situacao) erros.situacao = 'Escolha a situação.';
  if (!tipo || !modo || !situacao || Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, valor: { titulo_pt, titulo_es, tipo, modo, situacao } };
}

export type DadosDoModulo = { titulo_pt: string; titulo_es: string };

export function validarModulo(entrada: Entrada): Resultado<DadosDoModulo> {
  const erros: Erros = {};
  const titulo_pt = limpar(entrada.titulo_pt);
  const titulo_es = limpar(entrada.titulo_es);
  conferirTitulo(erros, 'titulo_pt', titulo_pt, 'português');
  conferirTitulo(erros, 'titulo_es', titulo_es, 'espanhol');
  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, valor: { titulo_pt, titulo_es } };
}

// Duração escrita como "12:34" ou "1:02:03". Vazio = sem duração. Devolve os segundos.
export function lerDuracao(texto: unknown): number | null | 'invalida' {
  const limpo = limpar(texto);
  if (limpo === '') return null;
  const partes = limpo.split(':');
  if (partes.length < 2 || partes.length > 3) return 'invalida';
  if (!partes.every((parte) => /^\d{1,3}$/.test(parte))) return 'invalida';
  const numeros = partes.map(Number);
  const segundos = numeros[numeros.length - 1] ?? 0;
  const minutos = numeros[numeros.length - 2] ?? 0;
  const horas = numeros.length === 3 ? (numeros[0] ?? 0) : 0;
  if (segundos > 59) return 'invalida';
  if (numeros.length === 3 && minutos > 59) return 'invalida';
  return horas * 3600 + minutos * 60 + segundos;
}

export function formatarDuracao(segundos: number | null | undefined): string {
  if (segundos === null || segundos === undefined || !Number.isFinite(segundos) || segundos < 0) return '';
  const total = Math.floor(segundos);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dois = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${m}:${dois(s)}`;
}

// Os vídeos ficam no YouTube. Aceita o link copiado de qualquer jeito (barra de endereço,
// botão Compartilhar, incorporar, Shorts, ao vivo) ou só o código de 11 letras, e devolve o código.
// Vazio = sem vídeo.
export function lerVideoDoYoutube(texto: unknown): string | null | 'invalido' {
  const limpo = limpar(texto);
  if (limpo === '') return null;
  if (CODIGO_DO_YOUTUBE.test(limpo)) return limpo;

  let endereco: URL;
  try {
    endereco = new URL(/^https?:\/\//i.test(limpo) ? limpo : `https://${limpo}`);
  } catch {
    return 'invalido';
  }
  const site = endereco.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  const partes = endereco.pathname.split('/').filter(Boolean);
  let codigo: string | undefined;
  if (site === 'youtu.be') {
    codigo = partes[0];
  } else if (site === 'youtube.com' || site === 'youtube-nocookie.com') {
    if (partes[0] === 'watch') codigo = endereco.searchParams.get('v') ?? undefined;
    else if (partes[0] === 'embed' || partes[0] === 'shorts' || partes[0] === 'live' || partes[0] === 'v') codigo = partes[1];
  }
  return codigo !== undefined && CODIGO_DO_YOUTUBE.test(codigo) ? codigo : 'invalido';
}

export function linkDoYoutube(codigo: string): string {
  return `https://youtu.be/${codigo}`;
}

// Endereço do reprodutor incorporado. O domínio "nocookie" não grava cookies até a pessoa dar play.
export function incorporarYoutube(codigo: string): string {
  return `https://www.youtube-nocookie.com/embed/${codigo}`;
}

export type DadosDaAula = {
  modulo_id: string;
  numero: number;
  titulo_pt: string;
  titulo_es: string;
  video_id: string | null;
  duracao_seg: number | null;
  situacao: Situacao;
};

// numerosEmUso: números das outras aulas do mesmo curso (fora da lixeira).
export function validarAula(entrada: Entrada, numerosEmUso: readonly number[] = []): Resultado<DadosDaAula> {
  const erros: Erros = {};

  const modulo_id = ehUuid(entrada.modulo_id) ? entrada.modulo_id : '';
  if (modulo_id === '') erros.modulo_id = 'Escolha o módulo da aula.';

  const numeroEscrito = limpar(entrada.numero);
  const numero = /^\d{1,4}$/.test(numeroEscrito) ? Number(numeroEscrito) : 0;
  if (numeroEscrito === '') erros.numero = 'Escreva o número da aula.';
  else if (numero < 1) erros.numero = 'O número da aula vai de 1 a 9999.';
  else if (numerosEmUso.includes(numero)) erros.numero = `Já existe a aula nº ${numero} neste curso.`;

  const titulo_pt = limpar(entrada.titulo_pt);
  const titulo_es = limpar(entrada.titulo_es);
  conferirTitulo(erros, 'titulo_pt', titulo_pt, 'português');
  conferirTitulo(erros, 'titulo_es', titulo_es, 'espanhol');

  const video = lerVideoDoYoutube(entrada.video_id);
  if (video === 'invalido') {
    erros.video_id = 'Cole o link de um vídeo do YouTube. Exemplo: https://youtu.be/aB3dE6gH9jK';
  }

  const duracao = lerDuracao(entrada.duracao);
  if (duracao === 'invalida') erros.duracao = 'Escreva a duração como minutos:segundos, por exemplo 12:30.';

  const situacao = umDe(entrada.situacao, SITUACOES);
  if (!situacao) erros.situacao = 'Escolha entre salvar como rascunho e publicar.';
  // Aula publicada sem vídeo seria uma tela vazia para o aluno.
  if (situacao === 'publicado' && video === null) {
    erros.video_id = 'Para publicar, a aula precisa de um vídeo. Sem vídeo, salve como rascunho.';
  }

  if (!situacao || duracao === 'invalida' || video === 'invalido' || Object.keys(erros).length > 0) return { ok: false, erros };
  return {
    ok: true,
    valor: {
      modulo_id,
      numero,
      titulo_pt,
      titulo_es,
      video_id: video,
      duracao_seg: duracao,
      situacao,
    },
  };
}

export const LINK_MAX = 500;

// Link de um material guardado fora da plataforma (Google Drive e parecidos). Só https.
// Quem cola sem o "https://" na frente ganha o prefixo. Vazio = sem link.
export function lerLink(texto: unknown): string | null | 'invalido' {
  const limpo = typeof texto === 'string' ? texto.trim() : '';
  if (limpo === '') return null;
  if (/\s/.test(limpo) || limpo.length > LINK_MAX) return 'invalido';
  const comEsquema = /^[a-z][a-z0-9+.-]*:/i.test(limpo) ? limpo : `https://${limpo}`;
  let endereco: URL;
  try {
    endereco = new URL(comEsquema);
  } catch {
    return 'invalido';
  }
  if (endereco.protocol !== 'https:' || endereco.username !== '' || endereco.password !== '') return 'invalido';
  if (!endereco.hostname.includes('.') || endereco.href.length > LINK_MAX) return 'invalido';
  return endereco.href;
}

export type DadosDoMaterial = { titulo_pt: string; titulo_es: string; descricao_es: string | null; link: string };

export function validarMaterial(entrada: Entrada): Resultado<DadosDoMaterial> {
  const erros: Erros = {};
  const titulo_pt = limpar(entrada.titulo_pt);
  const titulo_es = limpar(entrada.titulo_es);
  conferirTitulo(erros, 'titulo_pt', titulo_pt, 'português');
  conferirTitulo(erros, 'titulo_es', titulo_es, 'espanhol');
  const descricao = limpar(entrada.descricao_es);
  if (descricao.length > 300) erros.descricao_es = 'A descrição pode ter até 300 letras.';
  const link = lerLink(entrada.link);
  if (link === null) erros.link = 'Cole o link do material.';
  if (link === 'invalido') erros.link = 'Cole um link que comece com https://, sem espaços. Exemplo: https://drive.google.com/file/d/...';
  if (link === null || link === 'invalido' || Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, valor: { titulo_pt, titulo_es, descricao_es: descricao === '' ? null : descricao, link } };
}

// Texto de várias linhas: mantém as quebras, sem espaços sobrando nem mais de uma linha em branco seguida.
export function limparTexto(valor: unknown): string {
  if (typeof valor !== 'string') return '';
  return valor
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((linha) => linha.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const INSTRUCAO_MAX = 2000;

// Tarefa: o que o aluno deve fazer fora do vídeo e do quiz. Fica ligada ao curso e, se fizer
// sentido, a uma aula. O texto é em espanhol, que é o que o aluno lê.
export type DadosDaTarefa = { aula_id: string | null; titulo_es: string; instrucao_es: string; link: string | null };

export function validarTarefa(entrada: Entrada): Resultado<DadosDaTarefa> {
  const erros: Erros = {};
  const aulaEscrita = typeof entrada.aula_id === 'string' ? entrada.aula_id.trim() : '';
  if (aulaEscrita !== '' && !ehUuid(aulaEscrita)) erros.aula_id = 'Escolha uma aula da lista.';
  const titulo_es = limpar(entrada.titulo_es);
  conferirTitulo(erros, 'titulo_es', titulo_es, 'espanhol');
  const instrucao_es = limparTexto(entrada.instrucao_es);
  if (instrucao_es === '') erros.instrucao_es = 'Escreva o que o aluno deve fazer.';
  else if (instrucao_es.length > INSTRUCAO_MAX) erros.instrucao_es = `A instrução pode ter até ${INSTRUCAO_MAX} letras.`;
  const link = lerLink(entrada.link);
  if (link === 'invalido') erros.link = 'Cole um link que comece com https://, sem espaços, ou deixe em branco.';
  if (link === 'invalido' || Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, valor: { aula_id: aulaEscrita === '' ? null : aulaEscrita, titulo_es, instrucao_es, link } };
}

// Próximo número livre: um a mais que o maior em uso.
export function proximoNumero(numeros: readonly number[]): number {
  return numeros.reduce((maior, n) => (n > maior ? n : maior), 0) + 1;
}

// Troca um item de lugar com o vizinho de cima ou de baixo. Na ponta, devolve a lista igual.
export function mover<T>(lista: readonly T[], indice: number, direcao: 'subir' | 'descer'): T[] {
  const copia = [...lista];
  const destino = direcao === 'subir' ? indice - 1 : indice + 1;
  const item = copia[indice];
  const vizinho = copia[destino];
  if (item === undefined || vizinho === undefined || indice < 0 || destino < 0) return copia;
  copia[indice] = vizinho;
  copia[destino] = item;
  return copia;
}
