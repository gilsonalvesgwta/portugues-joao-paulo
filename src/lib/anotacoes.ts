// Anotações da aula: o resumo que o aluno lê ao lado do vídeo, montado em blocos pelo professor.
// Ficam gravadas em aulas.anotacoes como uma lista. Este arquivo define os tipos de bloco, os
// limites e a conferência do que chega do editor. Sem dependências: vale na tela, no servidor e
// nos testes. Nenhum bloco guarda HTML; o texto é sempre texto, e quem desenha é a tela.

export type Item = Record<string, string>;

export type TipoDeLista = 'pares' | 'vocabulario' | 'termos' | 'certo_errado';

export type Bloco =
  | { id: string; tipo: 'capa'; titulo: string; resumo: string }
  | { id: string; tipo: 'secao'; titulo: string }
  | { id: string; tipo: 'texto'; texto: string }
  | { id: string; tipo: 'nota'; texto: string }
  | { id: string; tipo: TipoDeLista; itens: Item[] }
  | { id: string; tipo: 'tabela'; colunas: string[]; linhas: string[][] };

export type TipoDeBloco = Bloco['tipo'];

export const LIMITES = {
  blocos: 80,
  linha: 300, // campo de uma linha
  texto: 3000, // campo de várias linhas
  itens: 40, // linhas de uma lista
  colunasMin: 2,
  colunasMax: 6,
  linhasDaTabela: 30,
} as const;

// Ordem em que os tipos aparecem no editor, com o nome mostrado ao professor.
export const TIPOS: { tipo: TipoDeBloco; nome: string; ajuda: string }[] = [
  { tipo: 'capa', nome: 'Capa', ajuda: 'Título e resumo, no começo das anotações.' },
  { tipo: 'secao', nome: 'Seção numerada', ajuda: 'Um título que divide as anotações: 01, 02, 03...' },
  { tipo: 'texto', nome: 'Texto', ajuda: 'Explicação em parágrafos.' },
  { tipo: 'pares', nome: 'Pares de exemplo', ajuda: 'Frases em português com a tradução.' },
  { tipo: 'termos', nome: 'Cartões de termo', ajuda: 'Um termo e a explicação dele.' },
  { tipo: 'certo_errado', nome: 'Certo e errado', ajuda: 'O erro comum e o jeito certo.' },
  { tipo: 'nota', nome: 'Nota do professor', ajuda: 'Um recado em destaque.' },
  { tipo: 'vocabulario', nome: 'Vocabulário', ajuda: 'Palavras com a tradução.' },
  { tipo: 'tabela', nome: 'Tabela-resumo', ajuda: 'Uma tabela pequena, como uma conjugação.' },
];

export function nomeDoTipo(tipo: TipoDeBloco): string {
  return TIPOS.find((t) => t.tipo === tipo)?.nome ?? tipo;
}

// Campos de cada linha das listas. "idioma" marca em que língua o texto é escrito.
export type CampoDeLista = { chave: string; rotulo: string; obrigatorio: boolean; idioma: 'pt-BR' | 'es' };

export const CAMPOS_DA_LISTA: Record<TipoDeLista, CampoDeLista[]> = {
  pares: [
    { chave: 'pt', rotulo: 'Frase em português', obrigatorio: true, idioma: 'pt-BR' },
    { chave: 'es', rotulo: 'Tradução em espanhol', obrigatorio: true, idioma: 'es' },
  ],
  vocabulario: [
    { chave: 'pt', rotulo: 'Palavra em português', obrigatorio: true, idioma: 'pt-BR' },
    { chave: 'es', rotulo: 'Tradução em espanhol', obrigatorio: true, idioma: 'es' },
  ],
  termos: [
    { chave: 'termo', rotulo: 'Termo', obrigatorio: true, idioma: 'pt-BR' },
    { chave: 'explicacao', rotulo: 'Explicação em espanhol', obrigatorio: true, idioma: 'es' },
  ],
  certo_errado: [
    { chave: 'errado', rotulo: 'Jeito errado', obrigatorio: true, idioma: 'pt-BR' },
    { chave: 'certo', rotulo: 'Jeito certo', obrigatorio: true, idioma: 'pt-BR' },
    { chave: 'nota', rotulo: 'Observação em espanhol (opcional)', obrigatorio: false, idioma: 'es' },
  ],
};

export function ehLista(tipo: string): tipo is TipoDeLista {
  return tipo === 'pares' || tipo === 'vocabulario' || tipo === 'termos' || tipo === 'certo_errado';
}

const ID = /^[a-z0-9]{6,16}$/;

export function novoId(): string {
  let id = '';
  while (id.length < 10) id += Math.random().toString(36).slice(2);
  return id.slice(0, 10);
}

export function itemVazio(tipo: TipoDeLista): Item {
  return Object.fromEntries(CAMPOS_DA_LISTA[tipo].map((campo) => [campo.chave, '']));
}

// Bloco novo, vazio, do jeito que o editor o cria.
export function blocoVazio(tipo: TipoDeBloco): Bloco {
  const id = novoId();
  if (tipo === 'capa') return { id, tipo, titulo: '', resumo: '' };
  if (tipo === 'secao') return { id, tipo, titulo: '' };
  if (tipo === 'texto' || tipo === 'nota') return { id, tipo, texto: '' };
  if (tipo === 'tabela') return { id, tipo, colunas: ['', ''], linhas: [['', '']] };
  return { id, tipo, itens: [itemVazio(tipo), itemVazio(tipo)] };
}

function umaLinha(valor: unknown): string {
  return typeof valor === 'string' ? valor.replace(/\s+/g, ' ').trim() : '';
}

// Texto de várias linhas: mantém as quebras, sem espaços sobrando nem mais de uma linha em branco seguida.
function variasLinhas(valor: unknown): string {
  if (typeof valor !== 'string') return '';
  return valor
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((linha) => linha.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export type ResultadoDasAnotacoes =
  | { ok: true; blocos: Bloco[] }
  // erros: mensagem por id de bloco; "geral" para o que não é de um bloco só.
  | { ok: false; erros: Record<string, string> };

function conferirLinha(valor: string, nome: string, obrigatorio: boolean): string | null {
  if (valor === '') return obrigatorio ? `Preencha: ${nome}.` : null;
  if (valor.length > LIMITES.linha) return `${nome}: até ${LIMITES.linha} letras.`;
  return null;
}

function conferirTexto(valor: string, nome: string): string | null {
  if (valor === '') return `Preencha: ${nome}.`;
  if (valor.length > LIMITES.texto) return `${nome}: até ${LIMITES.texto} letras.`;
  return null;
}

// Confere e arruma o que veio do editor. Devolve os blocos prontos para gravar, ou o erro de cada bloco.
export function validarAnotacoes(entrada: unknown): ResultadoDasAnotacoes {
  if (!Array.isArray(entrada)) return { ok: false, erros: { geral: 'As anotações chegaram em um formato inesperado.' } };
  if (entrada.length > LIMITES.blocos) {
    return { ok: false, erros: { geral: `As anotações podem ter até ${LIMITES.blocos} blocos.` } };
  }

  const erros: Record<string, string> = {};
  const blocos: Bloco[] = [];
  const usados = new Set<string>();

  for (const [posicao, bruto] of entrada.entries()) {
    if (!ehObjeto(bruto) || typeof bruto.tipo !== 'string') {
      return { ok: false, erros: { geral: 'As anotações chegaram em um formato inesperado.' } };
    }
    let id = typeof bruto.id === 'string' && ID.test(bruto.id) && !usados.has(bruto.id) ? bruto.id : novoId();
    while (usados.has(id)) id = novoId();
    usados.add(id);
    const falha = (mensagem: string | null) => {
      if (mensagem && !erros[id]) erros[id] = mensagem;
    };
    const tipo = bruto.tipo;

    if (tipo === 'capa') {
      const titulo = umaLinha(bruto.titulo);
      const resumo = variasLinhas(bruto.resumo);
      if (posicao !== 0) falha('A capa fica no começo das anotações. Suba este bloco até o topo.');
      falha(conferirLinha(titulo, 'título da capa', true));
      if (resumo.length > LIMITES.texto) falha(`resumo: até ${LIMITES.texto} letras.`);
      blocos.push({ id, tipo, titulo, resumo });
    } else if (tipo === 'secao') {
      const titulo = umaLinha(bruto.titulo);
      falha(conferirLinha(titulo, 'título da seção', true));
      blocos.push({ id, tipo, titulo });
    } else if (tipo === 'texto' || tipo === 'nota') {
      const texto = variasLinhas(bruto.texto);
      falha(conferirTexto(texto, tipo === 'nota' ? 'o texto da nota' : 'o texto'));
      blocos.push({ id, tipo, texto });
    } else if (ehLista(tipo)) {
      const campos = CAMPOS_DA_LISTA[tipo];
      const itens: Item[] = [];
      for (const linha of Array.isArray(bruto.itens) ? bruto.itens : []) {
        const item: Item = {};
        for (const campo of campos) item[campo.chave] = umaLinha(ehObjeto(linha) ? linha[campo.chave] : '');
        // Linha toda em branco é descartada: o editor sempre deixa uma sobrando.
        if (campos.every((campo) => item[campo.chave] === '')) continue;
        for (const campo of campos) falha(conferirLinha(item[campo.chave] ?? '', campo.rotulo.toLowerCase(), campo.obrigatorio));
        itens.push(item);
      }
      if (itens.length === 0) falha('Preencha pelo menos uma linha.');
      if (itens.length > LIMITES.itens) falha(`Até ${LIMITES.itens} linhas por bloco.`);
      blocos.push({ id, tipo, itens });
    } else if (tipo === 'tabela') {
      const colunas = (Array.isArray(bruto.colunas) ? bruto.colunas : []).map(umaLinha);
      const largura = colunas.length;
      if (largura < LIMITES.colunasMin || largura > LIMITES.colunasMax) {
        falha(`A tabela tem de ${LIMITES.colunasMin} a ${LIMITES.colunasMax} colunas.`);
      }
      if (colunas.some((coluna) => coluna === '')) falha('Dê um título a cada coluna da tabela.');
      const linhas: string[][] = [];
      for (const linha of Array.isArray(bruto.linhas) ? bruto.linhas : []) {
        const celulas = Array.from({ length: largura }, (_, i) => umaLinha(Array.isArray(linha) ? linha[i] : ''));
        if (celulas.every((celula) => celula === '')) continue;
        linhas.push(celulas);
      }
      if (linhas.length === 0) falha('Preencha pelo menos uma linha da tabela.');
      if (linhas.length > LIMITES.linhasDaTabela) falha(`Até ${LIMITES.linhasDaTabela} linhas por tabela.`);
      for (const celula of [...colunas, ...linhas.flat()]) {
        if (celula.length > LIMITES.linha) falha(`Cada célula da tabela pode ter até ${LIMITES.linha} letras.`);
      }
      blocos.push({ id, tipo, colunas, linhas });
    } else {
      return { ok: false, erros: { geral: 'Há um bloco de um tipo desconhecido nas anotações.' } };
    }
  }

  if (blocos.filter((bloco) => bloco.tipo === 'capa').length > 1) {
    return { ok: false, erros: { ...erros, geral: 'As anotações só podem ter uma capa.' } };
  }
  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, blocos };
}

// O que está gravado no banco, pronto para a tela. O que não passar na conferência vira lista vazia:
// a tela nunca tenta desenhar um bloco quebrado.
export function lerAnotacoes(gravado: unknown): Bloco[] {
  const conferido = validarAnotacoes(gravado);
  return conferido.ok ? conferido.blocos : [];
}

// O que a prévia do editor mostra enquanto o professor digita: os blocos sem as linhas em branco
// e sem os blocos ainda vazios. É o mais perto do que será gravado, sem exigir que tudo esteja pronto.
export function paraPrevia(blocos: readonly Bloco[]): Bloco[] {
  const prontos: Bloco[] = [];
  for (const bloco of blocos) {
    if (bloco.tipo === 'capa') {
      if (bloco.titulo.trim() !== '' || bloco.resumo.trim() !== '') prontos.push(bloco);
    } else if (bloco.tipo === 'secao') {
      if (bloco.titulo.trim() !== '') prontos.push(bloco);
    } else if (bloco.tipo === 'texto' || bloco.tipo === 'nota') {
      if (bloco.texto.trim() !== '') prontos.push(bloco);
    } else if (bloco.tipo === 'tabela') {
      const linhas = bloco.linhas.filter((linha) => linha.some((celula) => celula.trim() !== ''));
      if (linhas.length > 0 || bloco.colunas.some((coluna) => coluna.trim() !== '')) prontos.push({ ...bloco, linhas });
    } else {
      const itens = bloco.itens.filter((item) => Object.values(item).some((valor) => valor.trim() !== ''));
      if (itens.length > 0) prontos.push({ ...bloco, itens });
    }
  }
  return prontos;
}

export function contarBlocos(gravado: unknown): number {
  return Array.isArray(gravado) ? gravado.length : 0;
}

// Número de cada seção ("01", "02"...), pelo id do bloco.
export function numerosDasSecoes(blocos: readonly Bloco[]): Map<string, string> {
  const numeros = new Map<string, string>();
  let n = 0;
  for (const bloco of blocos) {
    if (bloco.tipo !== 'secao') continue;
    n += 1;
    numeros.set(bloco.id, String(n).padStart(2, '0'));
  }
  return numeros;
}

export type Trecho = { texto: string; forte: boolean };

// Único destaque aceito no texto: **assim** vira negrito. Asteriscos sem par ficam como estão.
export function trechos(linha: string): Trecho[] {
  const partes: Trecho[] = [];
  const marca = /\*\*([^*\n]+)\*\*/g;
  let ultimo = 0;
  for (const achado of linha.matchAll(marca)) {
    const inicio = achado.index ?? 0;
    if (inicio > ultimo) partes.push({ texto: linha.slice(ultimo, inicio), forte: false });
    partes.push({ texto: achado[1] ?? '', forte: true });
    ultimo = inicio + achado[0].length;
  }
  if (ultimo < linha.length) partes.push({ texto: linha.slice(ultimo), forte: false });
  return partes;
}

// Parágrafos (separados por linha em branco), cada um com suas linhas.
export function paragrafos(texto: string): string[][] {
  return texto
    .split(/\n{2,}/)
    .map((paragrafo) => paragrafo.split('\n').filter((linha) => linha !== ''))
    .filter((linhas) => linhas.length > 0);
}
