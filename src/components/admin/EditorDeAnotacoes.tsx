'use client';

import { useActionState, useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { salvarAnotacoes } from '@/app/admin/acoes';
import { useAvisoAoSair } from '@/components/admin/aoSair';
import { Apuntes } from '@/components/aula/Apuntes';
import {
  blocoVazio, CAMPOS_DA_LISTA, itemVazio, LIMITES, nomeDoTipo, paraPrevia, TIPOS, type Bloco, type Item, type TipoDeBloco, type TipoDeLista,
} from '@/lib/anotacoes';
import { mover } from '@/lib/conteudo';
import { ANOTACOES_INICIAL } from '@/lib/formulario';

// Editor das anotações da aula. O professor monta o resumo em blocos, à esquerda, e vê à direita
// como o aluno vai ler. Nada é gravado até clicar em "Salvar anotações"; enquanto houver
// alteração sem salvar, a tela avisa antes de sair.

const classeDaEntrada =
  'box-border h-11 w-full min-w-0 rounded-[10px] border border-borda-campo bg-cartao px-3 text-[15px] text-texto placeholder:text-apoio';
const classeDaArea =
  'box-border min-h-28 w-full min-w-0 rounded-[10px] border border-borda-campo bg-cartao px-3 py-2.5 text-[15px] leading-normal text-texto placeholder:text-apoio';
const classeDoBotaoMenor =
  'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border border-borda-campo bg-cartao px-3 text-sm font-semibold text-texto hover:bg-fundo disabled:cursor-default disabled:opacity-40';

type Mudar = (bloco: Bloco) => void;

function Rotulo({ para, children }: { para: string; children: ReactNode }) {
  return (
    <label htmlFor={para} className="text-sm font-semibold">
      {children}
    </label>
  );
}

function CampoDeLinha({
  id, rotulo, valor, aoMudar, foco = false, idioma,
}: { id: string; rotulo: string; valor: string; aoMudar: (v: string) => void; foco?: boolean; idioma?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Rotulo para={id}>{rotulo}</Rotulo>
      <input
        id={id}
        type="text"
        value={valor}
        maxLength={LIMITES.linha}
        lang={idioma}
        autoFocus={foco}
        onChange={(e) => aoMudar(e.target.value)}
        className={classeDaEntrada}
      />
    </div>
  );
}

function CampoDeTexto({
  id, rotulo, ajuda, valor, aoMudar, foco = false,
}: { id: string; rotulo: string; ajuda?: string; valor: string; aoMudar: (v: string) => void; foco?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Rotulo para={id}>{rotulo}</Rotulo>
      <textarea
        id={id}
        value={valor}
        maxLength={LIMITES.texto}
        lang="es"
        autoFocus={foco}
        aria-describedby={ajuda ? `${id}-ajuda` : undefined}
        onChange={(e) => aoMudar(e.target.value)}
        className={classeDaArea}
      />
      {ajuda ? (
        <p id={`${id}-ajuda`} className="text-[13px] leading-normal text-apoio">
          {ajuda}
        </p>
      ) : null}
    </div>
  );
}

const AJUDA_DO_TEXTO = 'Escreva em espanhol. Deixe uma linha em branco entre os parágrafos. Para destacar, use **assim**.';

function CamposDaLista({
  bloco, aoMudar, foco,
}: { bloco: Extract<Bloco, { tipo: TipoDeLista }>; aoMudar: Mudar; foco: boolean }) {
  const campos = CAMPOS_DA_LISTA[bloco.tipo];
  const trocar = (linha: number, chave: string, valor: string) =>
    aoMudar({ ...bloco, itens: bloco.itens.map((item, i) => (i === linha ? { ...item, [chave]: valor } : item)) });
  const colunas = campos.length === 3 ? 'sm:grid-cols-[1fr_1fr_1fr_44px]' : 'sm:grid-cols-[1fr_1fr_44px]';

  return (
    <div className="flex flex-col gap-3">
      <div className={`hidden gap-2 text-[13px] font-semibold text-apoio sm:grid ${colunas}`} aria-hidden="true">
        {campos.map((campo) => (
          <span key={campo.chave}>{campo.rotulo}</span>
        ))}
        <span />
      </div>
      {bloco.itens.map((item: Item, linha) => (
        // No celular, os campos da linha ficam empilhados e o botão de remover fica ao lado do primeiro.
        <div
          key={linha}
          className={`grid grid-cols-[minmax(0,1fr)_44px] gap-2 border-t border-linha pt-3 first:border-t-0 first:pt-0 sm:border-t-0 sm:pt-0 ${colunas}`}
        >
          {campos.map((campo, c) => (
            <input
              key={campo.chave}
              type="text"
              value={item[campo.chave] ?? ''}
              maxLength={LIMITES.linha}
              lang={campo.idioma}
              placeholder={campo.rotulo}
              aria-label={`${campo.rotulo}, linha ${linha + 1}`}
              autoFocus={foco && linha === 0 && c === 0}
              onChange={(e) => trocar(linha, campo.chave, e.target.value)}
              className={`${classeDaEntrada} col-start-1 sm:col-auto`}
            />
          ))}
          <button
            type="button"
            aria-label={`Remover a linha ${linha + 1}`}
            disabled={bloco.itens.length <= 1}
            onClick={() => aoMudar({ ...bloco, itens: bloco.itens.filter((_, i) => i !== linha) })}
            className={`${classeDoBotaoMenor} col-start-2 row-start-1 px-0 sm:col-auto sm:row-auto`}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={bloco.itens.length >= LIMITES.itens}
        onClick={() => aoMudar({ ...bloco, itens: [...bloco.itens, itemVazio(bloco.tipo)] })}
        className={`${classeDoBotaoMenor} self-start`}
      >
        Adicionar linha
      </button>
    </div>
  );
}

function CamposDaTabela({ bloco, aoMudar, foco }: { bloco: Extract<Bloco, { tipo: 'tabela' }>; aoMudar: Mudar; foco: boolean }) {
  const largura = bloco.colunas.length;
  const comCelula = (linha: number, coluna: number, valor: string) =>
    aoMudar({ ...bloco, linhas: bloco.linhas.map((l, i) => (i === linha ? l.map((c, j) => (j === coluna ? valor : c)) : l)) });

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-x-auto">
        <div className="grid min-w-max gap-2" style={{ gridTemplateColumns: `repeat(${largura}, minmax(120px, 1fr)) 44px` }}>
          {bloco.colunas.map((coluna, c) => (
            <input
              key={`titulo-${c}`}
              type="text"
              value={coluna}
              maxLength={LIMITES.linha}
              placeholder={`Coluna ${c + 1}`}
              aria-label={`Título da coluna ${c + 1}`}
              autoFocus={foco && c === 0}
              onChange={(e) => aoMudar({ ...bloco, colunas: bloco.colunas.map((v, i) => (i === c ? e.target.value : v)) })}
              className={`${classeDaEntrada} font-bold`}
            />
          ))}
          <span />
          {bloco.linhas.map((linha, l) => (
            <div key={`linha-${l}`} className="contents">
              {Array.from({ length: largura }, (_, c) => (
                <input
                  key={c}
                  type="text"
                  value={linha[c] ?? ''}
                  maxLength={LIMITES.linha}
                  lang="pt-BR"
                  aria-label={`Linha ${l + 1}, coluna ${c + 1}`}
                  onChange={(e) => comCelula(l, c, e.target.value)}
                  className={classeDaEntrada}
                />
              ))}
              <button
                type="button"
                aria-label={`Remover a linha ${l + 1} da tabela`}
                disabled={bloco.linhas.length <= 1}
                onClick={() => aoMudar({ ...bloco, linhas: bloco.linhas.filter((_, i) => i !== l) })}
                className={`${classeDoBotaoMenor} px-0`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={bloco.linhas.length >= LIMITES.linhasDaTabela}
          onClick={() => aoMudar({ ...bloco, linhas: [...bloco.linhas, Array.from({ length: largura }, () => '')] })}
          className={classeDoBotaoMenor}
        >
          Adicionar linha
        </button>
        <button
          type="button"
          disabled={largura >= LIMITES.colunasMax}
          onClick={() => aoMudar({ ...bloco, colunas: [...bloco.colunas, ''], linhas: bloco.linhas.map((l) => [...l, '']) })}
          className={classeDoBotaoMenor}
        >
          Adicionar coluna
        </button>
        <button
          type="button"
          disabled={largura <= LIMITES.colunasMin}
          onClick={() => aoMudar({ ...bloco, colunas: bloco.colunas.slice(0, -1), linhas: bloco.linhas.map((l) => l.slice(0, largura - 1)) })}
          className={classeDoBotaoMenor}
        >
          Remover a última coluna
        </button>
      </div>
    </div>
  );
}

function CamposDoBloco({ bloco, aoMudar, foco }: { bloco: Bloco; aoMudar: Mudar; foco: boolean }) {
  switch (bloco.tipo) {
    case 'capa':
      return (
        <div className="flex flex-col gap-4">
          <CampoDeLinha
            id={`${bloco.id}-titulo`}
            rotulo="Título (em espanhol)"
            valor={bloco.titulo}
            aoMudar={(titulo) => aoMudar({ ...bloco, titulo })}
            foco={foco}
            idioma="es"
          />
          <CampoDeTexto
            id={`${bloco.id}-resumo`}
            rotulo="Resumo (opcional)"
            ajuda="Uma ou duas frases, em espanhol, sobre o que a aula ensina."
            valor={bloco.resumo}
            aoMudar={(resumo) => aoMudar({ ...bloco, resumo })}
          />
        </div>
      );
    case 'secao':
      return (
        <CampoDeLinha
          id={`${bloco.id}-titulo`}
          rotulo="Título da seção (em espanhol)"
          valor={bloco.titulo}
          aoMudar={(titulo) => aoMudar({ ...bloco, titulo })}
          foco={foco}
          idioma="es"
        />
      );
    case 'texto':
    case 'nota':
      return (
        <CampoDeTexto
          id={`${bloco.id}-texto`}
          rotulo={bloco.tipo === 'nota' ? 'Texto da nota' : 'Texto'}
          ajuda={AJUDA_DO_TEXTO}
          valor={bloco.texto}
          aoMudar={(texto) => aoMudar({ ...bloco, texto })}
          foco={foco}
        />
      );
    case 'tabela':
      return <CamposDaTabela bloco={bloco} aoMudar={aoMudar} foco={foco} />;
    default:
      return <CamposDaLista bloco={bloco} aoMudar={aoMudar} foco={foco} />;
  }
}

type Props = { aulaId: string; numero: number; tituloEs: string; iniciais: Bloco[] };

export function EditorDeAnotacoes({ aulaId, numero, tituloEs, iniciais }: Props) {
  const [blocos, setBlocos] = useState<Bloco[]>(iniciais);
  const [sujo, setSujo] = useState(false);
  const [recemCriado, setRecemCriado] = useState<string | null>(null);
  // Resposta do servidor cujo aviso geral já ficou para trás, porque o professor mexeu nos blocos depois dela.
  const [avisoVencido, setAvisoVencido] = useState(-1);
  const [estado, acao, enviando] = useActionState(salvarAnotacoes, ANOTACOES_INICIAL);

  // Depois de salvar, a tela passa a mostrar exatamente o que ficou gravado.
  useEffect(() => {
    if (estado.situacao === 'salvo' && estado.blocos) {
      setBlocos(estado.blocos);
      setSujo(false);
      setRecemCriado(null);
    }
  }, [estado]);

  useAvisoAoSair(sujo, 'Há alterações nas anotações que ainda não foram salvas. Sair mesmo assim?');

  const mudar = (proximos: Bloco[]) => {
    setBlocos(proximos);
    setSujo(true);
    setAvisoVencido(estado.vez);
  };
  const temCapa = blocos.some((bloco) => bloco.tipo === 'capa');
  const adicionar = (tipo: TipoDeBloco) => {
    const novo = blocoVazio(tipo);
    mudar(tipo === 'capa' ? [novo, ...blocos] : [...blocos, novo]);
    setRecemCriado(novo.id);
  };
  // Enter em um campo de uma linha não envia o formulário: salvar é só pelo botão.
  const semEnviarNoEnter = (evento: KeyboardEvent<HTMLFormElement>) => {
    if (evento.key === 'Enter' && evento.target instanceof HTMLInputElement) evento.preventDefault();
  };

  // Erros da última tentativa de salvar, só dos blocos que ainda existem.
  const erros: Record<string, string> = {};
  if (estado.situacao === 'erro') {
    for (const [chave, mensagem] of Object.entries(estado.erros)) {
      const vale = chave === 'geral' ? avisoVencido !== estado.vez : blocos.some((bloco) => bloco.id === chave);
      if (vale) erros[chave] = mensagem;
    }
  }
  const comErro = Object.keys(erros).length > 0;
  const previa = paraPrevia(blocos);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <form action={acao} onKeyDown={semEnviarNoEnter} className="flex min-w-0 flex-col gap-4">
        <input type="hidden" name="aula_id" value={aulaId} />
        <input type="hidden" name="anotacoes" value={JSON.stringify(blocos)} />

        <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-linha bg-cartao px-5 py-4 shadow-sm">
          <p role="status" className={`text-[15px] font-semibold ${sujo ? 'text-aviso' : 'text-verde'}`}>
            {sujo
              ? 'Há alterações que ainda não foram salvas.'
              : estado.situacao === 'salvo'
                ? 'Anotações salvas.'
                : blocos.length === 0
                  ? 'Esta aula ainda não tem anotações.'
                  : 'Tudo salvo.'}
          </p>
          <button
            type="submit"
            disabled={enviando}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border border-verde bg-verde px-4 text-[15px] font-bold text-white hover:bg-verde-link disabled:cursor-default disabled:opacity-50"
          >
            {enviando ? 'Salvando…' : 'Salvar anotações'}
          </button>
        </div>

        {comErro ? (
          <p role="alert" className="rounded-xl border border-perigo bg-cartao px-4 py-3 text-[15px] font-semibold text-perigo">
            {erros.geral ?? 'Nada foi salvo. Corrija os blocos marcados e salve de novo.'}
          </p>
        ) : null}

        <fieldset disabled={enviando} className="flex min-w-0 flex-col gap-4">
          <legend className="sr-only">Blocos das anotações</legend>
          {blocos.map((bloco, indice) => {
            const presoNoTopo = bloco.tipo === 'capa';
            const logoAbaixoDaCapa = indice === 1 && blocos[0]?.tipo === 'capa';
            const nome = nomeDoTipo(bloco.tipo);
            const erro = erros[bloco.id];
            return (
              <section
                key={bloco.id}
                aria-label={`Bloco ${indice + 1}: ${nome}`}
                className={`flex flex-col gap-4 rounded-2xl border bg-cartao p-5 ${erro ? 'border-perigo' : 'border-linha'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xs font-bold tracking-[0.1em] text-apoio">{nome.toUpperCase()}</h2>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      aria-label={`Subir o bloco ${indice + 1}`}
                      disabled={indice === 0 || presoNoTopo || logoAbaixoDaCapa}
                      onClick={() => mudar(mover(blocos, indice, 'subir'))}
                      className={`${classeDoBotaoMenor} w-11 px-0`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Descer o bloco ${indice + 1}`}
                      disabled={indice === blocos.length - 1 || presoNoTopo}
                      onClick={() => mudar(mover(blocos, indice, 'descer'))}
                      className={`${classeDoBotaoMenor} w-11 px-0`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={`Remover o bloco ${indice + 1}`}
                      onClick={() => mudar(blocos.filter((b) => b.id !== bloco.id))}
                      className={classeDoBotaoMenor}
                    >
                      Remover
                    </button>
                  </div>
                </div>
                {erro ? <p className="text-sm font-semibold text-perigo">{erro}</p> : null}
                <CamposDoBloco
                  bloco={bloco}
                  aoMudar={(novo) => mudar(blocos.map((b) => (b.id === novo.id ? novo : b)))}
                  foco={recemCriado === bloco.id}
                />
              </section>
            );
          })}

          <section aria-label="Adicionar bloco" className="flex flex-col gap-3 rounded-2xl border border-dashed border-borda-campo p-5">
            <h2 className="text-base font-bold">Adicionar bloco</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {TIPOS.map(({ tipo, nome, ajuda }) => (
                <button
                  key={tipo}
                  type="button"
                  disabled={blocos.length >= LIMITES.blocos || (tipo === 'capa' && temCapa)}
                  onClick={() => adicionar(tipo)}
                  className="flex min-h-11 cursor-pointer flex-col items-start gap-0.5 rounded-[10px] border border-borda-campo bg-cartao px-3 py-2 text-left hover:bg-fundo disabled:cursor-default disabled:opacity-40"
                >
                  <span className="text-[15px] font-bold text-texto">{nome}</span>
                  <span className="text-[13px] leading-snug text-apoio">{ajuda}</span>
                </button>
              ))}
            </div>
          </section>
        </fieldset>
      </form>

      {/* Em tela larga a prévia acompanha a rolagem; se for mais alta que a tela, rola por dentro. */}
      <aside
        aria-label="Prévia do aluno"
        className="flex min-w-0 flex-col gap-2.5 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:overflow-y-auto"
      >
        <p className="text-xs font-bold tracking-[0.12em] text-apoio">PRÉVIA DO ALUNO</p>
        {previa.length === 0 ? (
          <p className="rounded-2xl border border-linha bg-cartao px-5 py-6 text-[15px] leading-normal text-apoio">
            A prévia aparece aqui conforme você preenche os blocos.
          </p>
        ) : (
          <Apuntes numero={numero} tituloDaAula={tituloEs} blocos={previa} />
        )}
      </aside>
    </div>
  );
}
