// Gravação da voz do professor no navegador, em WAV: o formato que todo navegador toca (o que o
// gravador nativo produz muda de um navegador para outro, e nem todo celular toca o do outro).
// Aqui fica a parte de conta, sem dependências: cortar o silêncio do começo e do fim, reduzir a
// taxa de amostras, ajustar o volume e escrever o arquivo.

export const TAXA_DO_ARQUIVO = 22_050;

// Corta o silêncio das pontas, deixando uma pequena folga para o som não começar seco.
// Sem nenhum trecho acima do limiar, devolve vazio.
export function semSilencio(amostras: Float32Array, taxa: number, limiar = 0.02, folgaSeg = 0.12): Float32Array {
  let inicio = 0;
  while (inicio < amostras.length && Math.abs(amostras[inicio] ?? 0) < limiar) inicio += 1;
  if (inicio === amostras.length) return new Float32Array(0);
  let fim = amostras.length - 1;
  while (fim > inicio && Math.abs(amostras[fim] ?? 0) < limiar) fim -= 1;
  const folga = Math.round(folgaSeg * taxa);
  return amostras.slice(Math.max(inicio - folga, 0), Math.min(fim + folga + 1, amostras.length));
}

// Média das amostras de cada intervalo: reduz a taxa sem criar chiado.
export function reduzirTaxa(amostras: Float32Array, de: number, para: number): Float32Array {
  if (para >= de) return amostras.slice();
  const razao = de / para;
  const tamanho = Math.floor((amostras.length * para) / de);
  const saida = new Float32Array(tamanho);
  for (let i = 0; i < tamanho; i += 1) {
    const inicio = Math.floor(i * razao);
    const fim = Math.min(Math.floor((i + 1) * razao), amostras.length);
    let soma = 0;
    for (let j = inicio; j < fim; j += 1) soma += amostras[j] ?? 0;
    saida[i] = fim > inicio ? soma / (fim - inicio) : 0;
  }
  return saida;
}

// Leva o pico a 90% do máximo: gravações baixas ficam audíveis, sem estourar.
export function ajustarVolume(amostras: Float32Array, alvo = 0.9): Float32Array {
  let pico = 0;
  for (const valor of amostras) pico = Math.max(pico, Math.abs(valor));
  if (pico === 0) return amostras.slice();
  const ganho = Math.min(alvo / pico, 8);
  return amostras.map((valor) => valor * ganho);
}

// WAV de 16 bits, um canal.
export function escreverWav(amostras: Float32Array, taxa: number): Uint8Array<ArrayBuffer> {
  const dados = amostras.length * 2;
  const arquivo = new DataView(new ArrayBuffer(44 + dados));
  const texto = (posicao: number, valor: string) => {
    for (let i = 0; i < valor.length; i += 1) arquivo.setUint8(posicao + i, valor.charCodeAt(i));
  };
  texto(0, 'RIFF');
  arquivo.setUint32(4, 36 + dados, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  arquivo.setUint32(16, 16, true);
  arquivo.setUint16(20, 1, true); // PCM
  arquivo.setUint16(22, 1, true); // um canal
  arquivo.setUint32(24, taxa, true);
  arquivo.setUint32(28, taxa * 2, true);
  arquivo.setUint16(32, 2, true);
  arquivo.setUint16(34, 16, true);
  texto(36, 'data');
  arquivo.setUint32(40, dados, true);
  for (let i = 0; i < amostras.length; i += 1) {
    const valor = Math.max(-1, Math.min(1, amostras[i] ?? 0));
    arquivo.setInt16(44 + i * 2, valor < 0 ? valor * 0x8000 : valor * 0x7fff, true);
  }
  return new Uint8Array(arquivo.buffer);
}

// Da gravação crua (amostras do microfone) ao arquivo pronto. null quando não houve som.
export function gravacaoParaWav(amostras: Float32Array, taxa: number): Uint8Array<ArrayBuffer> | null {
  const cortada = semSilencio(amostras, taxa);
  if (cortada.length < taxa * 0.15) return null;
  return escreverWav(ajustarVolume(reduzirTaxa(cortada, taxa, TAXA_DO_ARQUIVO)), Math.min(taxa, TAXA_DO_ARQUIVO));
}
