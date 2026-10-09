// Quizzes: os cinco tipos de pergunta, o que o aluno recebe (sem gabarito) e a correção.
// A tabela "perguntas" guarda o formato completo; o aluno nunca a lê direto.
// As respostas são dadas pelo conteúdo (texto escolhido), não por posição, para que
// embaralhar as opções não mude a correção.

export type Pergunta =
  | { tipo: 'parear_audio'; pares: { audio: string; traducao: string }[] }
  | { tipo: 'multipla_escolha'; enunciado: string; opcoes: string[]; correta: number; audio?: string }
  | { tipo: 'completar'; frase: string; opcoes: string[]; correta: number }
  | { tipo: 'ordenar'; palavras: string[]; traducao: string }
  | { tipo: 'ouvir_escrever'; audio: string; texto: string };

export type PerguntaDoAluno =
  | { tipo: 'parear_audio'; audios: string[]; traducoes: string[] }
  | { tipo: 'multipla_escolha'; enunciado: string; opcoes: string[]; audio?: string }
  | { tipo: 'completar'; frase: string; opcoes: string[] }
  | { tipo: 'ordenar'; palavras: string[]; traducao: string }
  | { tipo: 'ouvir_escrever'; audio: string };

export type Correcao = {
  correta: boolean;
  // 'acento': a resposta está certa, mas faltou ou sobrou acento; conta como acerto e o aluno é avisado.
  aviso?: 'acento';
};

export type ResultadoDoQuiz = {
  acertos: number;
  total: number;
  percentual: number;
  aprovado: boolean;
  correcoes: Correcao[];
};

export const LACUNA = '___';

type Sorteio = () => number;

function embaralhar<T>(itens: readonly T[], sorteio: Sorteio): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(sorteio() * (i + 1));
    const a = copia[i] as T;
    copia[i] = copia[j] as T;
    copia[j] = a;
  }
  return copia;
}

function iguais(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((valor, i) => valor === b[i]);
}

// Versão da pergunta que pode ir para o navegador: sem índice correto, sem texto do ditado
// e com a ordem embaralhada.
export function paraAluno(pergunta: Pergunta, sorteio: Sorteio = Math.random): PerguntaDoAluno {
  switch (pergunta.tipo) {
    case 'parear_audio':
      return {
        tipo: 'parear_audio',
        audios: embaralhar(pergunta.pares.map((p) => p.audio), sorteio),
        traducoes: embaralhar(pergunta.pares.map((p) => p.traducao), sorteio),
      };
    case 'multipla_escolha': {
      const base = { tipo: 'multipla_escolha' as const, enunciado: pergunta.enunciado, opcoes: embaralhar(pergunta.opcoes, sorteio) };
      return pergunta.audio === undefined ? base : { ...base, audio: pergunta.audio };
    }
    case 'completar':
      return { tipo: 'completar', frase: pergunta.frase, opcoes: embaralhar(pergunta.opcoes, sorteio) };
    case 'ordenar': {
      let palavras = embaralhar(pergunta.palavras, sorteio);
      // Nunca entregar a frase já na ordem certa (quando existe outra ordem possível).
      if (iguais(palavras, pergunta.palavras) && new Set(pergunta.palavras).size > 1) {
        palavras = [...palavras.slice(1), palavras[0] as string];
      }
      return { tipo: 'ordenar', palavras, traducao: pergunta.traducao };
    }
    case 'ouvir_escrever':
      return { tipo: 'ouvir_escrever', audio: pergunta.audio };
  }
}

// Compara frases ignorando maiúsculas, pontuação e espaços repetidos.
function normalizar(frase: string): string {
  return frase
    .normalize('NFC')
    .toLowerCase()
    .replace(/[.,;:!?¡¿"“”'’()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function semAcentos(frase: string): string {
  return frase.normalize('NFD').replace(/\p{Diacritic}/gu, '').normalize('NFC');
}

function listaDeTextos(valor: unknown): string[] | null {
  return Array.isArray(valor) && valor.every((v) => typeof v === 'string') ? (valor as string[]) : null;
}

const ERRADA: Correcao = { correta: false };
const CERTA: Correcao = { correta: true };

// Formato esperado da resposta por tipo:
// - parear_audio: lista de { audio, traducao };
// - multipla_escolha e completar: o texto da opção escolhida;
// - ordenar: a lista de palavras na ordem montada;
// - ouvir_escrever: o texto digitado.
// Resposta em formato inesperado é simplesmente errada: nada aqui lança erro.
export function corrigir(pergunta: Pergunta, resposta: unknown): Correcao {
  switch (pergunta.tipo) {
    case 'parear_audio': {
      if (!Array.isArray(resposta) || resposta.length !== pergunta.pares.length) return ERRADA;
      const gabarito = new Map(pergunta.pares.map((p) => [p.audio, p.traducao]));
      const usados = new Set<string>();
      for (const par of resposta) {
        if (typeof par !== 'object' || par === null) return ERRADA;
        const { audio, traducao } = par as { audio?: unknown; traducao?: unknown };
        if (typeof audio !== 'string' || typeof traducao !== 'string') return ERRADA;
        if (usados.has(audio) || gabarito.get(audio) !== traducao) return ERRADA;
        usados.add(audio);
      }
      return CERTA;
    }
    case 'multipla_escolha':
    case 'completar':
      return typeof resposta === 'string' && resposta === pergunta.opcoes[pergunta.correta] ? CERTA : ERRADA;
    case 'ordenar': {
      const palavras = listaDeTextos(resposta);
      return palavras && iguais(palavras, pergunta.palavras) ? CERTA : ERRADA;
    }
    case 'ouvir_escrever': {
      if (typeof resposta !== 'string') return ERRADA;
      const dada = normalizar(resposta);
      const certa = normalizar(pergunta.texto);
      if (dada === '') return ERRADA;
      if (dada === certa) return CERTA;
      if (semAcentos(dada) === semAcentos(certa)) return { correta: true, aviso: 'acento' };
      return ERRADA;
    }
  }
}

export function corrigirQuiz(perguntas: readonly Pergunta[], respostas: readonly unknown[], notaMinima = 70): ResultadoDoQuiz {
  const correcoes = perguntas.map((pergunta, i) => corrigir(pergunta, respostas[i]));
  const acertos = correcoes.filter((c) => c.correta).length;
  const total = perguntas.length;
  const percentual = total === 0 ? 0 : Math.round((acertos / total) * 100);
  return { acertos, total, percentual, aprovado: total > 0 && percentual >= notaMinima, correcoes };
}

function repetidos(itens: readonly string[]): boolean {
  return new Set(itens.map((i) => i.trim())).size !== itens.length;
}

// Usada pela administração antes de salvar: devolve os problemas encontrados, em português.
// Lista vazia = pergunta válida.
export function validarPergunta(pergunta: Pergunta): string[] {
  const erros: string[] = [];
  const vazio = (t: string) => t.trim() === '';
  switch (pergunta.tipo) {
    case 'parear_audio':
      if (pergunta.pares.length < 2) erros.push('Inclua pelo menos 2 pares.');
      if (pergunta.pares.some((p) => vazio(p.audio) || vazio(p.traducao))) erros.push('Todo par precisa de áudio e de tradução.');
      if (repetidos(pergunta.pares.map((p) => p.traducao))) erros.push('As traduções não podem se repetir.');
      if (repetidos(pergunta.pares.map((p) => p.audio))) erros.push('Os áudios não podem se repetir.');
      break;
    case 'multipla_escolha':
    case 'completar':
      if (pergunta.tipo === 'multipla_escolha' && vazio(pergunta.enunciado)) erros.push('Escreva o enunciado.');
      if (pergunta.tipo === 'completar' && pergunta.frase.split(LACUNA).length !== 2) erros.push(`A frase precisa de exatamente uma lacuna (${LACUNA}).`);
      if (pergunta.opcoes.length < 2) erros.push('Inclua pelo menos 2 opções.');
      if (pergunta.opcoes.some(vazio)) erros.push('Nenhuma opção pode ficar em branco.');
      if (repetidos(pergunta.opcoes)) erros.push('As opções não podem se repetir.');
      if (!Number.isInteger(pergunta.correta) || pergunta.correta < 0 || pergunta.correta >= pergunta.opcoes.length) erros.push('Marque qual opção é a correta.');
      break;
    case 'ordenar':
      if (pergunta.palavras.length < 2) erros.push('A frase precisa de pelo menos 2 palavras.');
      if (pergunta.palavras.some(vazio)) erros.push('Nenhuma palavra pode ficar em branco.');
      if (vazio(pergunta.traducao)) erros.push('Escreva a tradução da frase.');
      break;
    case 'ouvir_escrever':
      if (vazio(pergunta.audio)) erros.push('Envie ou gere o áudio.');
      if (normalizar(pergunta.texto) === '') erros.push('Escreva o texto que o aluno deve digitar.');
      break;
  }
  return erros;
}
