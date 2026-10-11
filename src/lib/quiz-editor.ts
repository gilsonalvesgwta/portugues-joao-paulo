import { LACUNA, validarPergunta, type Pergunta } from './quiz.ts';

// O quiz como o editor da administração o enxerga, e a conferência do que ele manda gravar.
// Por enquanto o editor cria os três tipos de pergunta de texto. Os dois tipos com áudio
// (parear áudio e ditado) entram quando a forma de gerar o áudio estiver definida.
// Sem dependências: vale na tela, no servidor e nos testes.

export type PerguntaNoEditor =
  | { id: string; tipo: 'multipla_escolha'; enunciado: string; opcoes: string[]; correta: number }
  | { id: string; tipo: 'completar'; frase: string; opcoes: string[]; correta: number }
  // "frase" é a frase inteira, na ordem certa; ao gravar, vira a lista de palavras.
  | { id: string; tipo: 'ordenar'; frase: string; traducao: string };

export type TipoNoEditor = PerguntaNoEditor['tipo'];
export type Dificuldade = 'facil' | 'medio' | 'dificil';
export type QuizNoEditor = { dificuldade: Dificuldade; nota_minima: number; perguntas: PerguntaNoEditor[] };

export const QUIZ_VAZIO: QuizNoEditor = { dificuldade: 'facil', nota_minima: 70, perguntas: [] };

export const LIMITES_DO_QUIZ = {
  perguntas: 30,
  opcoesMin: 2,
  opcoesMax: 6,
  enunciado: 500,
  opcao: 200,
  palavras: 15,
} as const;

export const DIFICULDADES: { valor: Dificuldade; nome: string }[] = [
  { valor: 'facil', nome: 'Fácil' },
  { valor: 'medio', nome: 'Médio' },
  { valor: 'dificil', nome: 'Difícil' },
];

export const TIPOS_DE_PERGUNTA: { tipo: TipoNoEditor; nome: string; ajuda: string }[] = [
  { tipo: 'multipla_escolha', nome: 'Múltipla escolha', ajuda: 'Uma pergunta e várias opções; só uma é a certa.' },
  { tipo: 'completar', nome: 'Completar a frase', ajuda: 'Uma frase com uma lacuna e as opções para preencher.' },
  { tipo: 'ordenar', nome: 'Ordenar a frase', ajuda: 'O aluno recebe as palavras embaralhadas e monta a frase.' },
];

export function nomeDaPergunta(tipo: TipoNoEditor): string {
  return TIPOS_DE_PERGUNTA.find((t) => t.tipo === tipo)?.nome ?? tipo;
}

const ID = /^[a-z0-9]{6,16}$/;

function novoId(): string {
  let id = '';
  while (id.length < 10) id += Math.random().toString(36).slice(2);
  return id.slice(0, 10);
}

export function perguntaVazia(tipo: TipoNoEditor): PerguntaNoEditor {
  const id = novoId();
  if (tipo === 'multipla_escolha') return { id, tipo, enunciado: '', opcoes: ['', ''], correta: -1 };
  if (tipo === 'completar') return { id, tipo, frase: '', opcoes: ['', ''], correta: -1 };
  return { id, tipo, frase: '', traducao: '' };
}

function umaLinha(valor: unknown): string {
  return typeof valor === 'string' ? valor.replace(/\s+/g, ' ').trim() : '';
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

// Qualquer sequência de dois ou mais traços baixos vale como a lacuna.
function comLacunaPadrao(frase: string): string {
  return frase.replace(/_{2,}/g, LACUNA);
}

export function palavrasDe(frase: string): string[] {
  return umaLinha(frase).split(' ').filter((palavra) => palavra !== '');
}

// As opções em branco são descartadas, e a marcação da correta acompanha a opção certa.
function opcoesLimpas(brutas: unknown, corretaBruta: unknown): { opcoes: string[]; correta: number } {
  const lista = Array.isArray(brutas) ? brutas.map(umaLinha) : [];
  const marcada = typeof corretaBruta === 'number' && Number.isInteger(corretaBruta) ? corretaBruta : -1;
  const opcoes: string[] = [];
  let correta = -1;
  for (const [indice, opcao] of lista.entries()) {
    if (opcao === '') continue;
    if (indice === marcada) correta = opcoes.length;
    opcoes.push(opcao);
  }
  return { opcoes, correta };
}

// A pergunta do editor no formato gravado no banco (o mesmo que a correção usa).
export function paraOBanco(pergunta: PerguntaNoEditor): Pergunta {
  if (pergunta.tipo === 'multipla_escolha') {
    return { tipo: pergunta.tipo, enunciado: pergunta.enunciado, opcoes: pergunta.opcoes, correta: pergunta.correta };
  }
  if (pergunta.tipo === 'completar') {
    return { tipo: pergunta.tipo, frase: pergunta.frase, opcoes: pergunta.opcoes, correta: pergunta.correta };
  }
  return { tipo: pergunta.tipo, palavras: palavrasDe(pergunta.frase), traducao: pergunta.traducao };
}

export type ResultadoDoQuizNoEditor =
  | { ok: true; quiz: QuizNoEditor }
  // erros: mensagem por id de pergunta; "geral" para o que não é de uma pergunta só.
  | { ok: false; erros: Record<string, string> };

const INESPERADO = 'O quiz chegou em um formato inesperado.';

// Confere e arruma o que veio do editor. "publicar" liga as exigências de um quiz que o aluno vai ver.
export function validarQuiz(entrada: unknown, publicar: boolean): ResultadoDoQuizNoEditor {
  if (!ehObjeto(entrada) || !Array.isArray(entrada.perguntas)) return { ok: false, erros: { geral: INESPERADO } };
  const erros: Record<string, string> = {};

  const dificuldade = DIFICULDADES.find((d) => d.valor === entrada.dificuldade)?.valor;
  if (!dificuldade) erros.geral = 'Escolha a dificuldade do quiz.';
  const nota = typeof entrada.nota_minima === 'number' ? entrada.nota_minima : Number.NaN;
  if (!Number.isInteger(nota) || nota < 0 || nota > 100) erros.geral = 'A nota mínima é um número inteiro de 0 a 100.';
  if (entrada.perguntas.length > LIMITES_DO_QUIZ.perguntas) {
    return { ok: false, erros: { geral: `O quiz pode ter até ${LIMITES_DO_QUIZ.perguntas} perguntas.` } };
  }

  const perguntas: PerguntaNoEditor[] = [];
  const usados = new Set<string>();
  for (const bruta of entrada.perguntas) {
    if (!ehObjeto(bruta)) return { ok: false, erros: { geral: INESPERADO } };
    let id = typeof bruta.id === 'string' && ID.test(bruta.id) && !usados.has(bruta.id) ? bruta.id : novoId();
    while (usados.has(id)) id = novoId();
    usados.add(id);

    let pergunta: PerguntaNoEditor;
    let extra: string | null = null;
    if (bruta.tipo === 'multipla_escolha') {
      const enunciado = umaLinha(bruta.enunciado);
      if (enunciado.length > LIMITES_DO_QUIZ.enunciado) extra = `A pergunta pode ter até ${LIMITES_DO_QUIZ.enunciado} letras.`;
      pergunta = { id, tipo: bruta.tipo, enunciado, ...opcoesLimpas(bruta.opcoes, bruta.correta) };
    } else if (bruta.tipo === 'completar') {
      const frase = comLacunaPadrao(umaLinha(bruta.frase));
      if (frase.length > LIMITES_DO_QUIZ.enunciado) extra = `A frase pode ter até ${LIMITES_DO_QUIZ.enunciado} letras.`;
      pergunta = { id, tipo: bruta.tipo, frase, ...opcoesLimpas(bruta.opcoes, bruta.correta) };
    } else if (bruta.tipo === 'ordenar') {
      const frase = umaLinha(bruta.frase);
      const traducao = umaLinha(bruta.traducao);
      if (palavrasDe(frase).length > LIMITES_DO_QUIZ.palavras) extra = `A frase pode ter até ${LIMITES_DO_QUIZ.palavras} palavras.`;
      if (traducao.length > LIMITES_DO_QUIZ.enunciado) extra = `A tradução pode ter até ${LIMITES_DO_QUIZ.enunciado} letras.`;
      pergunta = { id, tipo: bruta.tipo, frase, traducao };
    } else {
      return { ok: false, erros: { geral: 'Há uma pergunta de um tipo que este editor ainda não aceita.' } };
    }

    if (pergunta.tipo !== 'ordenar') {
      if (pergunta.opcoes.length > LIMITES_DO_QUIZ.opcoesMax) extra = `Até ${LIMITES_DO_QUIZ.opcoesMax} opções por pergunta.`;
      if (pergunta.opcoes.some((opcao) => opcao.length > LIMITES_DO_QUIZ.opcao)) extra = `Cada opção pode ter até ${LIMITES_DO_QUIZ.opcao} letras.`;
    }
    const problema = validarPergunta(paraOBanco(pergunta))[0] ?? extra;
    if (problema) erros[id] = problema;
    perguntas.push(pergunta);
  }

  if (publicar && perguntas.length === 0 && !erros.geral) erros.geral = 'Para publicar, o quiz precisa de pelo menos uma pergunta.';
  if (!dificuldade || Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, quiz: { dificuldade, nota_minima: nota, perguntas } };
}

// Do banco para o editor. Perguntas de tipos que o editor ainda não conhece ficam de fora da tela.
export function doBanco(linhas: readonly { tipo: string; conteudo: unknown }[]): PerguntaNoEditor[] {
  const perguntas: PerguntaNoEditor[] = [];
  for (const linha of linhas) {
    const c = ehObjeto(linha.conteudo) ? linha.conteudo : {};
    const texto = (valor: unknown) => (typeof valor === 'string' ? valor : '');
    const lista = (valor: unknown) => (Array.isArray(valor) ? valor.filter((v): v is string => typeof v === 'string') : []);
    const numero = (valor: unknown) => (typeof valor === 'number' && Number.isInteger(valor) ? valor : -1);
    if (linha.tipo === 'multipla_escolha') {
      perguntas.push({ id: novoId(), tipo: linha.tipo, enunciado: texto(c.enunciado), opcoes: lista(c.opcoes), correta: numero(c.correta) });
    } else if (linha.tipo === 'completar') {
      perguntas.push({ id: novoId(), tipo: linha.tipo, frase: texto(c.frase), opcoes: lista(c.opcoes), correta: numero(c.correta) });
    } else if (linha.tipo === 'ordenar') {
      perguntas.push({ id: novoId(), tipo: linha.tipo, frase: lista(c.palavras).join(' '), traducao: texto(c.traducao) });
    }
  }
  return perguntas;
}
