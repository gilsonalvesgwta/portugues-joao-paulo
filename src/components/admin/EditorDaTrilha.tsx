'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { salvarTrilha } from '@/app/admin/acoes';
import { useAvisoAoSair } from '@/components/admin/aoSair';
import { TRILHA_INICIAL } from '@/lib/formulario';
import {
  chave, foraDaTrilha, itemPara, LIMITES_DA_TRILHA, montarSozinho, moverDia, moverItem, type DiaDaTrilha, type Disponivel, type TipoDeItem,
} from '@/lib/trilha-editor';

// Editor da trilha por dia de um curso: o que o aluno faz em cada dia, a contar da matrícula dele.
// Como nos outros editores, nada é gravado até salvar, e a tela avisa antes de sair sem salvar.

const classeDoBotaoMenor =
  'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border border-borda-campo bg-cartao px-3 text-sm font-semibold text-texto hover:bg-fundo disabled:cursor-default disabled:opacity-40';
const classeDaSelecao =
  'box-border h-11 w-full min-w-0 rounded-[10px] border border-borda-campo bg-cartao px-3 text-[15px] text-texto';

const NOME_DO_TIPO: Record<TipoDeItem, string> = { aula: 'Aula', quiz: 'Quiz', tarefa: 'Tarefa' };
const CLASSE_DO_TIPO: Record<TipoDeItem, string> = {
  aula: 'bg-verde-suave text-verde',
  quiz: 'bg-aviso-suave text-aviso',
  tarefa: 'bg-fundo text-apoio',
};

// Escolher o que entra em um dia: só aparece o que ainda está fora da trilha.
function AdicionarAoDia({ numero, fora, cheio, aoAdicionar }: { numero: number; fora: Disponivel[]; cheio: boolean; aoAdicionar: (d: Disponivel) => void }) {
  const [escolhido, setEscolhido] = useState('');
  const id = `adicionar-ao-dia-${numero}`;
  if (fora.length === 0) return null;
  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-linha pt-4">
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-semibold">
          Adicionar ao dia {numero}
        </label>
        <select id={id} value={escolhido} onChange={(e) => setEscolhido(e.target.value)} className={classeDaSelecao}>
          <option value="">Escolha uma aula, um quiz ou uma tarefa</option>
          {fora.map((d) => (
            <option key={chave(d)} value={chave(d)}>
              {d.rotulo}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={escolhido === '' || cheio}
        onClick={() => {
          const disponivel = fora.find((d) => chave(d) === escolhido);
          if (disponivel) aoAdicionar(disponivel);
          setEscolhido('');
        }}
        className={classeDoBotaoMenor}
      >
        Adicionar
      </button>
    </div>
  );
}

type Props = { cursoId: string; iniciais: DiaDaTrilha[]; disponiveis: Disponivel[] };

export function EditorDaTrilha({ cursoId, iniciais, disponiveis }: Props) {
  const [dias, setDias] = useState<DiaDaTrilha[]>(iniciais);
  const [gravados, setGravados] = useState<DiaDaTrilha[]>(iniciais);
  const [sujo, setSujo] = useState(false);
  const [avisoVencido, setAvisoVencido] = useState(-1);
  const [estado, acao, enviando] = useActionState(salvarTrilha, TRILHA_INICIAL);

  // Depois de salvar, a tela passa a mostrar exatamente o que ficou gravado (com o id de cada item).
  useEffect(() => {
    if (estado.situacao === 'salvo' && estado.dias) {
      setDias(estado.dias);
      setGravados(estado.dias);
      setSujo(false);
    }
  }, [estado]);

  useAvisoAoSair(sujo, 'Há alterações na trilha que ainda não foram salvas. Sair mesmo assim?');

  const porChave = useMemo(() => new Map(disponiveis.map((d) => [chave(d), d])), [disponiveis]);
  // Id de cada item da trilha gravada: quem sai e volta na mesma edição mantém o mesmo id.
  const idsGravados = useMemo(() => {
    const ids = new Map<string, string>();
    for (const dia of gravados) for (const item of dia.itens) if (item.id) ids.set(chave(item), item.id);
    return ids;
  }, [gravados]);

  const mudar = (proximos: DiaDaTrilha[]) => {
    setDias(proximos);
    setSujo(true);
    setAvisoVencido(estado.vez);
  };
  const comItens = (dia: number, itens: DiaDaTrilha['itens']) => mudar(dias.map((d, i) => (i === dia ? { itens } : d)));

  const fora = foraDaTrilha(dias, disponiveis);
  const aulasFora = fora.filter((d) => d.tipo === 'aula').length;
  const erro = estado.situacao === 'erro' && avisoVencido !== estado.vez ? estado.erro : null;
  const totalDeItens = dias.reduce((soma, dia) => soma + dia.itens.length, 0);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <form action={acao} className="flex min-w-0 flex-col gap-4">
        <input type="hidden" name="curso_id" value={cursoId} />
        <input type="hidden" name="trilha" value={JSON.stringify(dias)} />

        <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-linha bg-cartao px-5 py-4 shadow-sm">
          <p role="status" className={`text-[15px] font-semibold ${sujo ? 'text-aviso' : 'text-verde'}`}>
            {sujo
              ? 'Há alterações que ainda não foram salvas.'
              : estado.situacao === 'salvo'
                ? 'Trilha salva.'
                : totalDeItens === 0
                  ? 'Este curso ainda não tem dias na trilha.'
                  : 'Tudo salvo.'}
          </p>
          <button
            type="submit"
            disabled={enviando}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border border-verde bg-verde px-4 text-[15px] font-bold text-white hover:bg-verde-link disabled:cursor-default disabled:opacity-50"
          >
            {enviando ? 'Salvando…' : 'Salvar trilha'}
          </button>
        </div>

        {erro ? (
          <p role="alert" className="rounded-xl border border-perigo bg-cartao px-4 py-3 text-[15px] font-semibold text-perigo">
            {erro}
          </p>
        ) : null}

        <fieldset disabled={enviando} className="flex min-w-0 flex-col gap-4">
          <legend className="sr-only">Dias da trilha</legend>
          {dias.map((dia, d) => (
            <section key={d} aria-label={`Dia ${d + 1}`} className="flex flex-col gap-4 rounded-2xl border border-linha bg-cartao p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-titulo text-xl font-bold">Dia {d + 1}</h2>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    aria-label={`Subir o dia ${d + 1}`}
                    disabled={d === 0}
                    onClick={() => mudar(moverDia(dias, d, 'subir'))}
                    className={`${classeDoBotaoMenor} w-11 px-0`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Descer o dia ${d + 1}`}
                    disabled={d === dias.length - 1}
                    onClick={() => mudar(moverDia(dias, d, 'descer'))}
                    className={`${classeDoBotaoMenor} w-11 px-0`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover o dia ${d + 1}`}
                    onClick={() => mudar(dias.filter((_, i) => i !== d))}
                    className={classeDoBotaoMenor}
                  >
                    Remover dia
                  </button>
                </div>
              </div>

              {dia.itens.length === 0 ? (
                <p className="rounded-xl bg-fundo px-4 py-3 text-[15px] text-apoio">Dia vazio. Dias sem nenhum item não são gravados.</p>
              ) : (
                <ol className="flex flex-col divide-y divide-linha border-y border-linha">
                  {dia.itens.map((item, i) => {
                    const disponivel = porChave.get(chave(item));
                    const rotulo = disponivel?.rotulo ?? 'Item que não existe mais';
                    const primeiro = d === 0 && i === 0;
                    const ultimo = d === dias.length - 1 && i === dia.itens.length - 1;
                    return (
                      <li key={chave(item)} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="flex min-w-0 flex-1 basis-60 flex-wrap items-center gap-2.5">
                          <span className={`inline-flex h-7 items-center rounded-full px-3 text-[13px] font-semibold ${CLASSE_DO_TIPO[item.tipo]}`}>
                            {NOME_DO_TIPO[item.tipo]}
                          </span>
                          <span className="min-w-0 text-[15px] font-semibold">{rotulo}</span>
                          {disponivel === undefined ? (
                            <span className="text-sm font-semibold text-perigo">tire este item da trilha</span>
                          ) : !disponivel.publicado ? (
                            <span className="text-sm font-semibold text-aviso">em rascunho: o aluno ainda não vê</span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <label className="flex min-h-11 cursor-pointer items-center gap-2 px-1 text-sm">
                            <input
                              type="checkbox"
                              checked={item.obrigatorio}
                              aria-label={`Obrigatório: ${rotulo}`}
                              onChange={(e) => comItens(d, dia.itens.map((it, j) => (j === i ? { ...it, obrigatorio: e.target.checked } : it)))}
                              className="size-5 cursor-pointer accent-verde"
                            />
                            Obrigatório
                          </label>
                          <button
                            type="button"
                            aria-label={`Subir: ${rotulo}`}
                            disabled={primeiro}
                            onClick={() => mudar(moverItem(dias, d, i, 'subir'))}
                            className={`${classeDoBotaoMenor} w-11 px-0`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label={`Descer: ${rotulo}`}
                            disabled={ultimo}
                            onClick={() => mudar(moverItem(dias, d, i, 'descer'))}
                            className={`${classeDoBotaoMenor} w-11 px-0`}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            aria-label={`Tirar da trilha: ${rotulo}`}
                            onClick={() => comItens(d, dia.itens.filter((_, j) => j !== i))}
                            className={classeDoBotaoMenor}
                          >
                            Tirar
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              <AdicionarAoDia
                numero={d + 1}
                fora={fora}
                cheio={dia.itens.length >= LIMITES_DA_TRILHA.itensPorDia}
                aoAdicionar={(disponivel) => comItens(d, [...dia.itens, itemPara(disponivel, idsGravados)])}
              />
            </section>
          ))}

          <button
            type="button"
            disabled={dias.length >= LIMITES_DA_TRILHA.dias}
            onClick={() => mudar([...dias, { itens: [] }])}
            className={`${classeDoBotaoMenor} self-start`}
          >
            Adicionar dia
          </button>
        </fieldset>
      </form>

      <aside aria-label="Fora da trilha" className="flex min-w-0 flex-col gap-3 rounded-2xl border border-linha bg-cartao p-5 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:overflow-y-auto">
        <h2 className="text-xs font-bold tracking-[0.12em] text-apoio">FORA DA TRILHA</h2>
        {fora.length === 0 ? (
          <p className="text-[15px] leading-normal text-apoio">
            {disponiveis.length === 0 ? 'Este curso ainda não tem aulas, quizzes nem tarefas.' : 'Tudo o que existe no curso já está em algum dia.'}
          </p>
        ) : (
          <>
            <p className="text-[15px] leading-normal text-apoio">
              O que existe no curso e ainda não está em nenhum dia. O aluno só recebe pela trilha o que estiver em um dia.
            </p>
            <ul className="flex flex-col gap-1.5">
              {fora.map((d) => (
                <li key={chave(d)} className="text-[15px] leading-snug">
                  {d.rotulo}
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={aulasFora === 0 || enviando}
              onClick={() => mudar(montarSozinho(dias, disponiveis, idsGravados))}
              className={classeDoBotaoMenor}
            >
              Montar sozinho o que falta
            </button>
            <p className="text-[13px] leading-normal text-apoio">
              Cria um dia para cada aula que está de fora, com o quiz e as tarefas dela. Depois é só ajustar.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
