'use client';

import { useActionState, useEffect, useState, type KeyboardEvent } from 'react';
import { salvarQuiz } from '@/app/admin/acoes';
import { useAvisoAoSair } from '@/components/admin/aoSair';
import { es } from '@/i18n/es';
import { mover } from '@/lib/conteudo';
import { QUIZ_INICIAL } from '@/lib/formulario';
import { LACUNA } from '@/lib/quiz';
import {
  DIFICULDADES, LIMITES_DO_QUIZ, nomeDaPergunta, palavrasDe, perguntaVazia, TIPOS_DE_PERGUNTA, type Dificuldade, type PerguntaNoEditor,
  type QuizNoEditor, type TipoNoEditor,
} from '@/lib/quiz-editor';

// Editor do quiz da aula. Como nas anotações: o professor monta as perguntas à esquerda, vê à
// direita como o aluno as recebe (sem a resposta marcada), e nada é gravado até salvar.

const classeDaEntrada =
  'box-border h-11 w-full min-w-0 rounded-[10px] border border-borda-campo bg-cartao px-3 text-[15px] text-texto placeholder:text-apoio';
const classeDoBotaoMenor =
  'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border border-borda-campo bg-cartao px-3 text-sm font-semibold text-texto hover:bg-fundo disabled:cursor-default disabled:opacity-40';
const classeDoBotaoDeSalvar =
  'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border px-4 text-[15px] font-bold disabled:cursor-default disabled:opacity-50';

type Mudar = (pergunta: PerguntaNoEditor) => void;

function Campo({
  id, rotulo, ajuda, valor, aoMudar, foco = false, idioma,
}: { id: string; rotulo: string; ajuda?: string; valor: string; aoMudar: (v: string) => void; foco?: boolean; idioma?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {rotulo}
      </label>
      <input
        id={id}
        type="text"
        value={valor}
        maxLength={LIMITES_DO_QUIZ.enunciado}
        lang={idioma}
        autoFocus={foco}
        aria-describedby={ajuda ? `${id}-ajuda` : undefined}
        onChange={(e) => aoMudar(e.target.value)}
        className={classeDaEntrada}
      />
      {ajuda ? (
        <p id={`${id}-ajuda`} className="text-[13px] leading-normal text-apoio">
          {ajuda}
        </p>
      ) : null}
    </div>
  );
}

// Opções de resposta, com a marcação de qual é a correta.
function Opcoes({
  pergunta, aoMudar,
}: { pergunta: Extract<PerguntaNoEditor, { opcoes: string[] }>; aoMudar: Mudar }) {
  const { opcoes, correta } = pergunta;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-semibold">Opções de resposta (marque a correta)</legend>
      {opcoes.map((opcao, i) => (
        <div key={i} className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
          <label className="flex h-11 cursor-pointer items-center justify-center rounded-[10px] border border-borda-campo bg-cartao has-[:checked]:border-verde has-[:checked]:bg-verde-suave">
            <input
              type="radio"
              name={`correta-${pergunta.id}`}
              checked={correta === i}
              aria-label={`A opção ${i + 1} é a correta`}
              onChange={() => aoMudar({ ...pergunta, correta: i })}
              className="size-5 cursor-pointer accent-verde"
            />
          </label>
          <input
            type="text"
            value={opcao}
            maxLength={LIMITES_DO_QUIZ.opcao}
            lang="pt-BR"
            placeholder={`Opção ${i + 1}`}
            aria-label={`Opção ${i + 1}`}
            onChange={(e) => aoMudar({ ...pergunta, opcoes: opcoes.map((v, j) => (j === i ? e.target.value : v)) })}
            className={classeDaEntrada}
          />
          <button
            type="button"
            aria-label={`Remover a opção ${i + 1}`}
            disabled={opcoes.length <= LIMITES_DO_QUIZ.opcoesMin}
            onClick={() =>
              aoMudar({
                ...pergunta,
                opcoes: opcoes.filter((_, j) => j !== i),
                // A marcação acompanha a opção: se a removida era a correta, fica sem nenhuma marcada.
                correta: correta === i ? -1 : correta > i ? correta - 1 : correta,
              })
            }
            className={`${classeDoBotaoMenor} px-0`}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={opcoes.length >= LIMITES_DO_QUIZ.opcoesMax}
        onClick={() => aoMudar({ ...pergunta, opcoes: [...opcoes, ''] })}
        className={`${classeDoBotaoMenor} self-start`}
      >
        Adicionar opção
      </button>
    </fieldset>
  );
}

function CamposDaPergunta({ pergunta, aoMudar, foco }: { pergunta: PerguntaNoEditor; aoMudar: Mudar; foco: boolean }) {
  switch (pergunta.tipo) {
    case 'multipla_escolha':
      return (
        <div className="flex flex-col gap-4">
          <Campo
            id={`${pergunta.id}-enunciado`}
            rotulo="Pergunta"
            valor={pergunta.enunciado}
            aoMudar={(enunciado) => aoMudar({ ...pergunta, enunciado })}
            foco={foco}
          />
          <Opcoes pergunta={pergunta} aoMudar={aoMudar} />
        </div>
      );
    case 'completar':
      return (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Campo
              id={`${pergunta.id}-frase`}
              rotulo="Frase com a lacuna"
              ajuda={`No lugar da palavra que falta, escreva ${LACUNA} (três traços baixos). Exemplo: Eu ${LACUNA} brasileiro.`}
              valor={pergunta.frase}
              aoMudar={(frase) => aoMudar({ ...pergunta, frase })}
              foco={foco}
              idioma="pt-BR"
            />
            <button
              type="button"
              disabled={pergunta.frase.includes('__')}
              onClick={() => aoMudar({ ...pergunta, frase: `${pergunta.frase.trimEnd()} ${LACUNA}`.trimStart() })}
              className={`${classeDoBotaoMenor} self-start`}
            >
              Inserir a lacuna no fim
            </button>
          </div>
          <Opcoes pergunta={pergunta} aoMudar={aoMudar} />
        </div>
      );
    case 'ordenar':
      return (
        <div className="flex flex-col gap-4">
          <Campo
            id={`${pergunta.id}-frase`}
            rotulo="Frase em português, na ordem certa"
            ajuda="O aluno recebe as palavras embaralhadas e monta a frase."
            valor={pergunta.frase}
            aoMudar={(frase) => aoMudar({ ...pergunta, frase })}
            foco={foco}
            idioma="pt-BR"
          />
          <Campo
            id={`${pergunta.id}-traducao`}
            rotulo="Tradução em espanhol"
            ajuda="Aparece para o aluno como a pista da frase."
            valor={pergunta.traducao}
            aoMudar={(traducao) => aoMudar({ ...pergunta, traducao })}
            idioma="es"
          />
        </div>
      );
  }
}

// Como o aluno recebe cada pergunta: sem a resposta marcada, e com as palavras fora de ordem.
function PreviaDoQuiz({ numero, perguntas }: { numero: number; perguntas: PerguntaNoEditor[] }) {
  const chip = 'rounded-[10px] border border-borda-campo bg-cartao px-3 py-2 text-[15px] text-texto';
  return (
    <article lang="es" className="flex flex-col gap-5 rounded-2xl border border-linha bg-cartao px-5 pb-7 pt-6">
      <p className="self-start rounded border border-verde px-2.5 py-1.5 text-[11px] font-bold tracking-[0.16em] text-verde">
        {es.apuntes.clase.toUpperCase()} {numero} — {es.quiz.titulo.toUpperCase()}
      </p>
      {perguntas.map((pergunta, i) => (
        <section key={pergunta.id} className="flex flex-col gap-2.5">
          <p className="text-xs font-bold tracking-[0.14em] text-dourado-texto">
            {String(i + 1).padStart(2, '0')} —{' '}
            {(pergunta.tipo === 'multipla_escolha' ? es.quiz.elige : pergunta.tipo === 'completar' ? es.quiz.completa : es.quiz.ordena).toUpperCase()}
          </p>
          {pergunta.tipo === 'multipla_escolha' ? <p className="text-base font-bold text-texto">{pergunta.enunciado}</p> : null}
          {pergunta.tipo === 'completar' ? (
            <p lang="pt-BR" className="text-base font-bold text-texto">
              {pergunta.frase.replace(/_{2,}/g, '______')}
            </p>
          ) : null}
          {pergunta.tipo === 'ordenar' ? <p className="text-[15px] text-apoio">{pergunta.traducao}</p> : null}
          <div lang="pt-BR" className="flex flex-wrap gap-2">
            {(pergunta.tipo === 'ordenar'
              ? [...palavrasDe(pergunta.frase)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
              : pergunta.opcoes.filter((opcao) => opcao.trim() !== '')
            ).map((texto, j) => (
              <span key={j} className={chip}>
                {texto}
              </span>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}

type Props = { aulaId: string; numero: number; inicial: QuizNoEditor; publicadoNoInicio: boolean; existeNoInicio: boolean };

export function EditorDeQuiz({ aulaId, numero, inicial, publicadoNoInicio, existeNoInicio }: Props) {
  const [quiz, setQuiz] = useState<QuizNoEditor>(inicial);
  const [sujo, setSujo] = useState(false);
  const [recemCriada, setRecemCriada] = useState<string | null>(null);
  // Resposta do servidor cujo aviso geral já ficou para trás, porque o professor mexeu no quiz depois dela.
  const [avisoVencido, setAvisoVencido] = useState(-1);
  const [estado, acao, enviando] = useActionState(salvarQuiz, { ...QUIZ_INICIAL, publicado: publicadoNoInicio });

  // Depois de salvar, a tela passa a mostrar exatamente o que ficou gravado.
  useEffect(() => {
    if (estado.situacao === 'salvo' && estado.quiz) {
      setQuiz(estado.quiz);
      setSujo(false);
      setRecemCriada(null);
    }
  }, [estado]);

  useAvisoAoSair(sujo, 'Há alterações no quiz que ainda não foram salvas. Sair mesmo assim?');

  const mudar = (proximo: QuizNoEditor) => {
    setQuiz(proximo);
    setSujo(true);
    setAvisoVencido(estado.vez);
  };
  const comPerguntas = (perguntas: PerguntaNoEditor[]) => mudar({ ...quiz, perguntas });
  const adicionar = (tipo: TipoNoEditor) => {
    const nova = perguntaVazia(tipo);
    comPerguntas([...quiz.perguntas, nova]);
    setRecemCriada(nova.id);
  };
  // Enter em um campo de uma linha não envia o formulário: salvar é só pelos botões.
  const semEnviarNoEnter = (evento: KeyboardEvent<HTMLFormElement>) => {
    if (evento.key === 'Enter' && evento.target instanceof HTMLInputElement) evento.preventDefault();
  };

  // Erros da última tentativa de salvar, só das perguntas que ainda existem.
  const erros: Record<string, string> = {};
  if (estado.situacao === 'erro') {
    for (const [chave, mensagem] of Object.entries(estado.erros)) {
      const vale = chave === 'geral' ? avisoVencido !== estado.vez : quiz.perguntas.some((pergunta) => pergunta.id === chave);
      if (vale) erros[chave] = mensagem;
    }
  }
  const comErro = Object.keys(erros).length > 0;
  const publicado = estado.publicado;
  const existe = existeNoInicio || estado.situacao === 'salvo';

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <form action={acao} onKeyDown={semEnviarNoEnter} className="flex min-w-0 flex-col gap-4">
        <input type="hidden" name="aula_id" value={aulaId} />
        <input type="hidden" name="quiz" value={JSON.stringify(quiz)} />

        <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-linha bg-cartao px-5 py-4 shadow-sm">
          <p role="status" className={`text-[15px] font-semibold ${sujo ? 'text-aviso' : 'text-verde'}`}>
            {sujo
              ? 'Há alterações que ainda não foram salvas.'
              : estado.situacao === 'salvo'
                ? publicado
                  ? 'Quiz salvo e publicado.'
                  : 'Quiz salvo como rascunho.'
                : !existe
                  ? 'Esta aula ainda não tem quiz.'
                  : publicado
                    ? 'Tudo salvo. O quiz está publicado.'
                    : 'Tudo salvo. O quiz está em rascunho.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              name="situacao"
              value="rascunho"
              disabled={enviando}
              className={`${classeDoBotaoDeSalvar} border-borda-campo bg-cartao text-texto hover:bg-fundo`}
            >
              Salvar como rascunho
            </button>
            <button
              type="submit"
              name="situacao"
              value="publicado"
              disabled={enviando}
              className={`${classeDoBotaoDeSalvar} border-verde bg-verde text-white hover:bg-verde-link`}
            >
              Salvar e publicar
            </button>
          </div>
        </div>

        {comErro ? (
          <p role="alert" className="rounded-xl border border-perigo bg-cartao px-4 py-3 text-[15px] font-semibold text-perigo">
            {erros.geral ?? 'Nada foi salvo. Corrija as perguntas marcadas e salve de novo.'}
          </p>
        ) : null}

        <fieldset disabled={enviando} className="flex min-w-0 flex-col gap-4">
          <legend className="sr-only">Quiz da aula</legend>

          <section aria-label="Configuração do quiz" className="grid gap-4 rounded-2xl border border-linha bg-cartao p-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dificuldade" className="text-sm font-semibold">
                Dificuldade
              </label>
              <select
                id="dificuldade"
                value={quiz.dificuldade}
                onChange={(e) => mudar({ ...quiz, dificuldade: e.target.value as Dificuldade })}
                className={classeDaEntrada}
              >
                {DIFICULDADES.map((d) => (
                  <option key={d.valor} value={d.valor}>
                    {d.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nota_minima" className="text-sm font-semibold">
                Nota mínima para passar (%)
              </label>
              <input
                id="nota_minima"
                type="number"
                min={0}
                max={100}
                step={1}
                value={Number.isFinite(quiz.nota_minima) ? quiz.nota_minima : ''}
                onChange={(e) => mudar({ ...quiz, nota_minima: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
                className={classeDaEntrada}
              />
            </div>
          </section>

          {quiz.perguntas.map((pergunta, indice) => {
            const nome = nomeDaPergunta(pergunta.tipo);
            const erro = erros[pergunta.id];
            return (
              <section
                key={pergunta.id}
                aria-label={`Pergunta ${indice + 1}: ${nome}`}
                className={`flex flex-col gap-4 rounded-2xl border bg-cartao p-5 ${erro ? 'border-perigo' : 'border-linha'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xs font-bold tracking-[0.1em] text-apoio">
                    {indice + 1}. {nome.toUpperCase()}
                  </h2>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      aria-label={`Subir a pergunta ${indice + 1}`}
                      disabled={indice === 0}
                      onClick={() => comPerguntas(mover(quiz.perguntas, indice, 'subir'))}
                      className={`${classeDoBotaoMenor} w-11 px-0`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Descer a pergunta ${indice + 1}`}
                      disabled={indice === quiz.perguntas.length - 1}
                      onClick={() => comPerguntas(mover(quiz.perguntas, indice, 'descer'))}
                      className={`${classeDoBotaoMenor} w-11 px-0`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={`Remover a pergunta ${indice + 1}`}
                      onClick={() => comPerguntas(quiz.perguntas.filter((p) => p.id !== pergunta.id))}
                      className={classeDoBotaoMenor}
                    >
                      Remover
                    </button>
                  </div>
                </div>
                {erro ? <p className="text-sm font-semibold text-perigo">{erro}</p> : null}
                <CamposDaPergunta
                  pergunta={pergunta}
                  aoMudar={(nova) => comPerguntas(quiz.perguntas.map((p) => (p.id === nova.id ? nova : p)))}
                  foco={recemCriada === pergunta.id}
                />
              </section>
            );
          })}

          <section aria-label="Adicionar pergunta" className="flex flex-col gap-3 rounded-2xl border border-dashed border-borda-campo p-5">
            <h2 className="text-base font-bold">Adicionar pergunta</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {TIPOS_DE_PERGUNTA.map(({ tipo, nome, ajuda }) => (
                <button
                  key={tipo}
                  type="button"
                  disabled={quiz.perguntas.length >= LIMITES_DO_QUIZ.perguntas}
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
        {quiz.perguntas.length === 0 ? (
          <p className="rounded-2xl border border-linha bg-cartao px-5 py-6 text-[15px] leading-normal text-apoio">
            A prévia aparece aqui conforme você adiciona as perguntas.
          </p>
        ) : (
          <PreviaDoQuiz numero={numero} perguntas={quiz.perguntas} />
        )}
      </aside>
    </div>
  );
}
