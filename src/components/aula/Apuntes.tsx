import { es } from '@/i18n/es';
import { numerosDasSecoes, paragrafos, trechos, type Bloco } from '@/lib/anotacoes';

// As anotações da aula como o aluno as lê (em espanhol, com os exemplos em português).
// A mesma peça serve à prévia do editor e à tela da aula. Todo texto entra como texto:
// nada do que o professor escreve é tratado como HTML.

function Linha({ texto }: { texto: string }) {
  return (
    <>
      {trechos(texto).map((trecho, i) => (trecho.forte ? <strong key={i}>{trecho.texto}</strong> : <span key={i}>{trecho.texto}</span>))}
    </>
  );
}

function Rico({ texto, className }: { texto: string; className: string }) {
  return (
    <>
      {paragrafos(texto).map((linhas, p) => (
        <p key={p} className={className}>
          {linhas.map((linha, l) => (
            <span key={l}>
              {l > 0 ? <br /> : null}
              <Linha texto={linha} />
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

function UmBloco({ bloco, numero }: { bloco: Bloco; numero: string | undefined }) {
  switch (bloco.tipo) {
    case 'capa':
      return null; // a capa é desenhada no topo, junto do rótulo das anotações
    case 'secao':
      return (
        <h3 className="flex items-baseline gap-2.5 pt-1 text-lg font-bold leading-snug text-texto @xl:text-xl">
          <span className="font-titulo text-[17px] italic text-dourado-texto @xl:text-lg">{numero}</span> <span className="min-w-0 break-words">{bloco.titulo}</span>
        </h3>
      );
    case 'texto':
      return (
        <div className="flex max-w-[68ch] flex-col gap-3">
          <Rico texto={bloco.texto} className="text-base leading-[1.6] text-texto @xl:text-[17px]" />
        </div>
      );
    case 'nota':
      return (
        <div className="flex gap-3 rounded-[18px] bg-verde-suave p-4 @xl:gap-4 @xl:rounded-[20px] @xl:p-[22px]">
          <img
            src="/marca/professor-avatar.webp"
            alt=""
            width={192}
            height={192}
            loading="lazy"
            className="block size-12 shrink-0 rounded-full border-[1.5px] border-dourado bg-fundo @xl:size-[60px]"
          />
          <div className="flex min-w-0 flex-col gap-1 @xl:gap-1.5">
            <p className="text-sm font-bold text-verde @xl:text-[15px]">{es.apuntes.notaDelProfesor}</p>
            <Rico texto={bloco.texto} className="break-words text-base leading-normal text-texto @xl:text-[17px] @xl:leading-[1.55]" />
          </div>
        </div>
      );
    case 'pares':
      return (
        <div className="flex flex-col items-start gap-2.5">
          {bloco.itens.map((item, i) => (
            <div key={i} className="flex max-w-full flex-col gap-1 rounded-[18px] rounded-bl-md bg-fundo px-4 py-3 @xl:max-w-[560px] @xl:px-[18px] @xl:py-3.5">
              <p lang="pt-BR" className="break-words text-base font-bold leading-[1.35] text-texto @xl:text-lg">
                {item.pt}
              </p>
              <p className="break-words text-sm leading-snug text-apoio @xl:text-[15px]">{item.es}</p>
            </div>
          ))}
        </div>
      );
    case 'vocabulario':
      return (
        <div className="grid grid-cols-2 gap-2 @xl:grid-cols-3 @xl:gap-2.5">
          {bloco.itens.map((item, i) => (
            <div key={i} className="flex min-w-0 flex-col gap-0.5 rounded-[14px] border border-borda px-3.5 py-3">
              <p lang="pt-BR" className="break-words text-base font-bold leading-snug text-verde">
                {item.pt}
              </p>
              <p className="break-words text-sm leading-snug text-apoio">{item.es}</p>
            </div>
          ))}
        </div>
      );
    case 'termos':
      return (
        <div className="flex flex-col gap-2.5">
          {bloco.itens.map((item, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-2xl border border-l-4 border-borda border-l-verde px-4 py-3.5">
              <p lang="pt-BR" className="break-words text-[17px] font-bold leading-snug text-verde">
                {item.termo}
              </p>
              <p className="break-words text-[15px] leading-normal text-texto @xl:text-base">{item.explicacao}</p>
            </div>
          ))}
        </div>
      );
    case 'certo_errado':
      return (
        <div className="flex flex-col gap-2.5">
          {bloco.itens.map((item, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-2xl bg-fundo px-4 py-3.5">
              <p lang="pt-BR" className="flex items-start gap-2.5 break-words text-base leading-snug text-perigo">
                <Sinal certo={false} />
                <span className="min-w-0">
                  <span lang="es" className="sr-only">
                    {es.apuntes.incorrecto}:{' '}
                  </span>
                  {item.errado}
                </span>
              </p>
              <p lang="pt-BR" className="flex items-start gap-2.5 break-words text-base font-bold leading-snug text-verde">
                <Sinal certo />
                <span className="min-w-0">
                  <span lang="es" className="sr-only">
                    {es.apuntes.correcto}:{' '}
                  </span>
                  {item.certo}
                </span>
              </p>
              {item.nota ? <p className="break-words pl-[30px] text-sm leading-snug text-apoio">{item.nota}</p> : null}
            </div>
          ))}
        </div>
      );
    case 'tabela': {
      // Tabela de quatro colunas ou mais não cabe em tela estreita: lá, cada linha vira uma ficha
      // (título da coluna à esquerda, valor à direita) e nada fica cortado. Só uma das duas formas
      // fica visível, e é lida, de cada vez.
      const larga = bloco.colunas.length >= 4;
      return (
        <>
          {/* "relative" prende os textos só para leitor de tela à área que rola. */}
          <div className={`relative overflow-x-auto rounded-2xl border border-borda @xl:rounded-[18px] ${larga ? 'hidden @xl:block' : ''}`}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-fundo">
                  {bloco.colunas.map((coluna, c) => (
                    <th key={c} scope="col" className="px-3.5 py-2.5 text-[13px] font-bold text-apoio @xl:px-5 @xl:py-3 @xl:text-sm">
                      {coluna}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bloco.linhas.map((linha, l) => (
                  <tr key={l} className="border-t border-borda">
                    {linha.map((celula, c) => (
                      <td key={c} lang="pt-BR" className={`px-3.5 py-3 text-base leading-snug @xl:px-5 @xl:py-3.5 @xl:text-lg ${c === 0 ? 'font-bold text-verde' : 'text-texto'}`}>
                        {celula}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {larga ? (
            <div className="flex flex-col overflow-hidden rounded-2xl border border-borda @xl:hidden">
              {bloco.linhas.map((linha, l) => (
                <dl key={l} className={`grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-1.5 px-3.5 py-3 ${l > 0 ? 'border-t border-borda' : ''}`}>
                  {linha.map((celula, c) => (
                    <div key={c} className="contents">
                      <dt className="break-words pt-0.5 text-[13px] font-bold leading-snug text-apoio">{bloco.colunas[c]}</dt>
                      <dd lang="pt-BR" className={`break-words text-base leading-snug ${c === 0 ? 'font-bold text-verde' : 'text-texto'}`}>
                        {celula}
                      </dd>
                    </div>
                  ))}
                </dl>
              ))}
            </div>
          ) : null}
        </>
      );
    }
  }
}

// O sinal de certo ou de errado antes de cada frase: enfeite, o texto para leitor de tela vem ao lado.
function Sinal({ certo }: { certo: boolean }) {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0">
      {certo ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />}
    </svg>
  );
}

type Props = { numero: number; tituloDaAula: string; blocos: Bloco[]; className?: string };

// O tamanho das letras e dos espaços acompanha a largura do próprio quadro (e não a da tela):
// assim a mesma peça fica certa na tela da aula, larga, e na prévia do editor, estreita.
export function Apuntes({ numero, tituloDaAula, blocos, className = '' }: Props) {
  const capa = blocos.find((bloco) => bloco.tipo === 'capa');
  const numeros = numerosDasSecoes(blocos);

  return (
    <article lang="es" className={`@container rounded-3xl border border-borda bg-cartao sm:rounded-[28px] sm:shadow-cartao ${className}`}>
      <div className="flex flex-col gap-[22px] px-[18px] py-6 @xl:gap-7 @xl:p-10">
        <header className="flex flex-col gap-2 @xl:gap-2.5">
          <p className="text-sm font-semibold text-dourado-texto @xl:text-[15px]">
            {es.apuntes.titulo} {numero}
          </p>
          <h2 className="break-words font-titulo text-[27px] font-bold leading-[1.15] text-texto @xl:text-[34px] @xl:leading-[1.12]">
            {capa && capa.tipo === 'capa' ? capa.titulo : tituloDaAula}
          </h2>
          {capa && capa.tipo === 'capa' && capa.resumo ? (
            <div className="flex max-w-[62ch] flex-col gap-2">
              <Rico texto={capa.resumo} className="text-[17px] leading-[1.6] text-texto-suave @xl:text-lg" />
            </div>
          ) : null}
        </header>
        {blocos.map((bloco) => (
          <UmBloco key={bloco.id} bloco={bloco} numero={numeros.get(bloco.id)} />
        ))}
      </div>
    </article>
  );
}
