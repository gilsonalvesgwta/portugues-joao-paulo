import type { ReactNode } from 'react';
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

function Caixa({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1 rounded-xl bg-fundo px-3.5 py-3">{children}</div>;
}

function UmBloco({ bloco, numero }: { bloco: Bloco; numero: string | undefined }) {
  switch (bloco.tipo) {
    case 'capa':
      return null; // a capa é desenhada no topo, junto da etiqueta da aula
    case 'secao':
      return (
        <h3 className="pt-1 text-xs font-bold tracking-[0.14em] text-dourado-texto">
          {numero} — {bloco.titulo.toUpperCase()}
        </h3>
      );
    case 'texto':
      return (
        <div className="flex flex-col gap-2">
          <Rico texto={bloco.texto} className="text-[15px] leading-relaxed text-texto" />
        </div>
      );
    case 'nota':
      return (
        <div className="flex flex-col gap-1.5 rounded-xl border border-linha px-3.5 py-3">
          <p className="text-[13px] font-bold text-verde">{es.apuntes.notaDelProfesor}</p>
          <Rico texto={bloco.texto} className="text-sm leading-normal text-texto" />
        </div>
      );
    case 'pares':
      return (
        <div className="flex flex-col gap-2.5">
          {bloco.itens.map((item, i) => (
            <Caixa key={i}>
              <p lang="pt-BR" className="text-base font-bold text-texto">
                {item.pt}
              </p>
              <p className="text-sm text-apoio">{item.es}</p>
            </Caixa>
          ))}
        </div>
      );
    case 'vocabulario':
      return (
        <div className="grid grid-cols-2 gap-2">
          {bloco.itens.map((item, i) => (
            <div key={i} className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-linha px-3 py-2.5">
              <p lang="pt-BR" className="break-words text-[15px] font-bold text-texto">
                {item.pt}
              </p>
              <p className="break-words text-[13px] text-apoio">{item.es}</p>
            </div>
          ))}
        </div>
      );
    case 'termos':
      return (
        <div className="flex flex-col gap-2.5">
          {bloco.itens.map((item, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-xl border border-linha border-l-4 border-l-verde px-3.5 py-3">
              <p lang="pt-BR" className="text-[15px] font-bold text-verde">
                {item.termo}
              </p>
              <p className="text-sm leading-normal text-texto">{item.explicacao}</p>
            </div>
          ))}
        </div>
      );
    case 'certo_errado':
      return (
        <div className="flex flex-col gap-2.5">
          {bloco.itens.map((item, i) => (
            <Caixa key={i}>
              <p lang="pt-BR" className="text-[15px] text-perigo">
                <span aria-hidden="true">✗ </span>
                <span className="sr-only">{es.apuntes.incorrecto}: </span>
                {item.errado}
              </p>
              <p lang="pt-BR" className="text-[15px] font-bold text-verde">
                <span aria-hidden="true">✓ </span>
                <span className="sr-only">{es.apuntes.correcto}: </span>
                {item.certo}
              </p>
              {item.nota ? <p className="text-[13px] text-apoio">{item.nota}</p> : null}
            </Caixa>
          ))}
        </div>
      );
    case 'tabela':
      return (
        // "relative" prende os textos só para leitor de tela à área que rola.
        <div className="relative overflow-x-auto rounded-xl border border-linha">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-fundo">
                {bloco.colunas.map((coluna, c) => (
                  <th key={c} scope="col" className="px-3 py-2 font-bold text-texto">
                    {coluna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloco.linhas.map((linha, l) => (
                <tr key={l} className="border-t border-linha">
                  {linha.map((celula, c) => (
                    <td key={c} lang="pt-BR" className="px-3 py-2 text-texto">
                      {celula}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

type Props = { numero: number; tituloDaAula: string; blocos: Bloco[] };

export function Apuntes({ numero, tituloDaAula, blocos }: Props) {
  const capa = blocos.find((bloco) => bloco.tipo === 'capa');
  const numeros = numerosDasSecoes(blocos);

  return (
    <article lang="es" className="flex flex-col gap-4 rounded-2xl border border-linha bg-cartao px-5 pb-7 pt-6">
      <header className="flex flex-col items-start gap-2.5">
        <p className="rounded border border-verde px-2.5 py-1.5 text-[11px] font-bold tracking-[0.16em] text-verde">
          {es.apuntes.clase.toUpperCase()} {numero} — {es.apuntes.apuntes.toUpperCase()}
        </p>
        <h2 className="font-titulo text-2xl font-bold leading-[1.15] text-texto">
          {capa && capa.tipo === 'capa' ? capa.titulo : tituloDaAula}
        </h2>
        {capa && capa.tipo === 'capa' && capa.resumo ? <Rico texto={capa.resumo} className="text-sm leading-normal text-apoio" /> : null}
      </header>
      {blocos.map((bloco) => (
        <UmBloco key={bloco.id} bloco={bloco} numero={numeros.get(bloco.id)} />
      ))}
    </article>
  );
}
