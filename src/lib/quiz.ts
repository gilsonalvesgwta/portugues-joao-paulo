// Quizzes: os cinco tipos de pergunta, o que o aluno recebe (sem gabarito) e a correção.
// A tabela "perguntas" guarda o formato completo; o aluno nunca a lê direto.
// As respostas são dadas pelo conteúdo (texto escolhido), não por posição, para que
// embaralhar as opções não mude a correção.

// "parear_audio": combinar cada palavra em português com a tradução em espanhol. No modo
// "audio" o aluno ouve a palavra (a gravação do professor; sem gravação, a voz do navegador); no
// modo "escrita" ele lê a palavra. "audio" de um par é o identificador da gravação.
export type ModoDosPares = 'audio' | 'escrita';
export type Par = { palavra: string; traducao: string; audio?: string };

export type Pergunta =
  | { tipo: 'parear_audio'; modo: ModoDosPares; pares: Par[] }
  | { tipo: 'multipla_escolha'; enunciado: string; opcoes: string[]; correta: number; audio?: string }
  | { tipo: 'completar'; frase: string; opcoes: string[]; correta: number }
  | { tipo: 'ordenar'; palavras: string[]; traducao: string }
  | { tipo: 'ouvir_escrever'; audio: string; texto: string };

// Um cartão de cima do jogo de pares. "indice" diz qual par ele é (sem dizer a tradução). No modo
// com áudio, o cartão leva a gravação ou, sem gravação, o texto que o navegador lê em voz alta
// ("fala"); no modo escrito, a palavra.
export type CartaoDoPar = { indice: number; audio?: string; fala?: string; palavra?: string };

export type PerguntaDoAluno =
  | { tipo: 'parear_audio'; modo: ModoDosPares; cartoes: CartaoDoPar[]; traducoes: string[] }
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
    case 'parear_audio': {
      const cartoes = pergunta.pares.map((par, indice): CartaoDoPar => {
        if (pergunta.modo === 'escrita') return { indice, palavra: par.palavra };
        return par.audio ? { indice, audio: par.audio } : { indice, fala: par.palavra };
      });
      return {
        tipo: 'parear_audio',
        modo: pergunta.modo,
        cartoes: embaralhar(cartoes, sorteio),
        traducoes: embaralhar(pergunta.pares.map((p) => p.traducao), sorteio),
      };
    }
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

// Uma tentativa no jogo de pares: o cartão de cima (pelo índice do par) com uma tradução.
// Devolve se acertou e, quando acertou, a palavra em português, que passa a aparecer no cartão.
export function conferirPar(pergunta: Pergunta, indice: unknown, traducao: unknown): { certo: boolean; palavra?: string } {
  if (pergunta.tipo !== 'parear_audio' || typeof indice !== 'number' || typeof traducao !== 'string') return { certo: false };
  const par = pergunta.pares[indice];
  return par && par.traducao === traducao ? { certo: true, palavra: par.palavra } : { certo: false };
}

// Formato esperado da resposta por tipo:
// - parear_audio: a lista das tentativas, na ordem, cada uma { i: índice do cartão, t: tradução };
//   a pergunta conta como certa quando todos os pares foram combinados sem nenhum erro;
// - multipla_escolha e completar: o texto da opção escolhida;
// - ordenar: a lista de palavras na ordem montada;
// - ouvir_escrever: o texto digitado.
// Resposta em formato inesperado é simplesmente errada: nada aqui lança erro.
export function corrigir(pergunta: Pergunta, resposta: unknown): Correcao {
  switch (pergunta.tipo) {
    case 'parear_audio': {
      if (!Array.isArray(resposta) || resposta.length !== pergunta.pares.length) return ERRADA;
      const combinados = new Set<number>();
      for (const tentativa of resposta) {
        if (typeof tentativa !== 'object' || tentativa === null) return ERRADA;
        const { i, t } = tentativa as { i?: unknown; t?: unknown };
        if (typeof i !== 'number' || combinados.has(i) || !conferirPar(pergunta, i, t).certo) return ERRADA;
        combinados.add(i);
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
      if (pergunta.modo !== 'audio' && pergunta.modo !== 'escrita') erros.push('Escolha se o aluno ouve ou lê a palavra.');
      if (pergunta.pares.length < 2) erros.push('Inclua pelo menos 2 pares.');
      if (pergunta.pares.some((p) => vazio(p.palavra) || vazio(p.traducao))) erros.push('Todo par precisa da palavra em português e da tradução.');
      if (repetidos(pergunta.pares.map((p) => p.palavra.toLowerCase()))) erros.push('As palavras em português não podem se repetir.');
      if (repetidos(pergunta.pares.map((p) => p.traducao.toLowerCase()))) erros.push('As traduções não podem se repetir.');
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
