'use client';

import { startTransition, useActionState, useState } from 'react';
import { responderQuiz } from '@/app/(aluno)/acoes';
import { Aviso, Boton, Sello } from '@/components/aluno/ui';
import { usePronto } from '@/components/usePronto';
import { es } from '@/i18n/es';
import { RESPOSTA_INICIAL, type PerguntaEntregue } from '@/lib/quiz-aluno';

// O quiz respondido pelo aluno. As perguntas chegam sem a resposta certa; o que ele escolhe vai
// para o servidor, que corrige e devolve acerto por acerto. Para tentar de novo, a página é
// carregada outra vez (com as opções em outra ordem).

// O que o aluno escolheu em cada pergunta: o texto da opção, ou (em "ordenar") as posições das
// palavras tocadas, na ordem em que foram tocadas.
type Escolha = string | number[];

function respondida(pergunta: PerguntaEntregue, escolha: Escolha | undefined): boolean {
  if (pergunta.tipo === 'ordenar') return Array.isArray(escolha) && escolha.length === pergunta.palavras.length;
  return typeof escolha === 'string';
}

function paraEnviar(pergunta: PerguntaEntregue, escolha: Escolha | undefined): unknown {
  if (pergunta.tipo === 'ordenar') return Array.isArray(escolha) ? escolha.map((posicao) => pergunta.palavras[posicao] ?? '') : [];
  return typeof escolha === 'string' ? escolha : null;
}

function enunciado(pergunta: PerguntaEntregue): string {
  if (pergunta.tipo === 'multipla_escolha') return es.quiz.elige;
  if (pergunta.tipo === 'completar') return es.quiz.completa;
  return es.quiz.ordena;
}

const classeDaOpcao =
  'flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[14px] border border-borda-campo bg-cartao px-4 py-2.5 text-base leading-snug transition-colors has-[:checked]:border-verde has-[:checked]:bg-verde-suave';
// A cor de cada palavra vem à parte (solta ou já na frase), para as classes não brigarem entre si.
const formaDaPalavra = 'min-h-11 cursor-pointer rounded-xl border px-3.5 text-base font-semibold text-texto';
const palavraSolta = `${formaDaPalavra} border-borda-campo bg-cartao hover:bg-fundo`;
const palavraNaFrase = `${formaDaPalavra} border-verde bg-verde-suave`;

function Ordenar({
  pergunta,
  escolha,
  mudar,
}: {
  pergunta: Extract<PerguntaEntregue, { tipo: 'ordenar' }>;
  escolha: number[];
  mudar: (nova: number[]) => void;
}) {
  const livres = pergunta.palavras.map((_, posicao) => posicao).filter((posicao) => !escolha.includes(posicao));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] text-apoio">{pergunta.traducao}</p>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold">{es.quiz.tuFrase}</p>
        <div lang="pt-BR" aria-live="polite" className="flex min-h-[60px] flex-wrap items-center gap-2 rounded-[14px] border border-dashed border-borda-campo bg-fundo p-2">
          {escolha.length === 0 ? <span lang="es" className="px-2 text-[15px] text-apoio">{es.quiz.fraseVacia}</span> : null}
          {escolha.map((posicao, ordem) => (
            <button
              key={`${posicao}-${ordem}`}
              type="button"
              onClick={() => mudar(escolha.filter((_, i) => i !== ordem))}
              aria-label={`${es.quiz.quitar}: ${pergunta.palavras[posicao] ?? ''}`}
              className={palavraNaFrase}
            >
              {pergunta.palavras[posicao]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold">{es.quiz.palabras}</p>
        <div lang="pt-BR" className="flex min-h-11 flex-wrap gap-2">
          {livres.map((posicao) => (
            <button key={posicao} type="button" onClick={() => mudar([...escolha, posicao])} className={palavraSolta}>
              {pergunta.palavras[posicao]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type Props = { quizId: string; notaMinima: number; perguntas: PerguntaEntregue[]; previa: boolean };

export function QuizDelAlumno({ quizId, notaMinima, perguntas, previa }: Props) {
  const [estado, acao, enviando] = useActionState(responderQuiz, RESPOSTA_INICIAL);
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const [faltam, setFaltam] = useState<number[]>([]);
  // Até a página acordar no navegador, as respostas ficam paradas: o que fosse marcado antes se perderia.
  const pronto = usePronto();

  const escolher = (id: string, escolha: Escolha) => {
    setEscolhas((atuais) => ({ ...atuais, [id]: escolha }));
    setFaltam([]);
  };

  const corrigido = estado.situacao === 'corregido' && estado.correcao !== null;
  const conferencia = new Map((estado.correcao?.conferencia ?? []).map((item) => [item.id, item]));
  const respostas = JSON.stringify(perguntas.map((pergunta) => ({ id: pergunta.id, resposta: paraEnviar(pergunta, escolhas[pergunta.id]) })));

  return (
    // O envio é feito pela tela (e não pelo "action" do formulário) para o navegador não devolver
    // os campos ao estado inicial depois da resposta: o aluno precisa ver o que marcou ao lado da
    // correção.
    <form
      noValidate
      data-vez={estado.vez}
      onSubmit={(evento) => {
        evento.preventDefault();
        const semResposta = perguntas.map((pergunta, i) => (respondida(pergunta, escolhas[pergunta.id]) ? 0 : i + 1)).filter((n) => n > 0);
        if (semResposta.length > 0) {
          setFaltam(semResposta);
          return;
        }
        const dados = new FormData();
        dados.set('quiz_id', quizId);
        dados.set('respuestas', respostas);
        startTransition(() => acao(dados));
      }}
      className="flex flex-col gap-5"
    >
      {previa ? <Aviso tipo="info">{es.quiz.vistaPrevia}</Aviso> : null}

      {corrigido && estado.correcao ? (
        <section aria-labelledby="resultado" className="flex flex-col gap-2 rounded-3xl border border-verde bg-verde-suave px-[18px] py-[22px] sm:rounded-[28px] sm:p-7">
          <h2 id="resultado" className="text-sm font-semibold text-verde sm:text-[15px]">
            {es.quiz.resultado}
          </h2>
          <p className="font-titulo text-[34px] font-bold leading-[1.1] sm:text-[40px]">
            {estado.correcao.acertos} {es.inicio.de} {estado.correcao.total} · {estado.correcao.percentual} %
          </p>
          <p className="text-base font-semibold">
            {estado.correcao.aprovado ? es.quiz.aprobado : es.quiz.noAprobado}{' '}
            <span className="font-normal text-apoio">
              {es.quiz.notaMinima}: {notaMinima} %
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {/* Endereço comum, de propósito: recarrega a página, limpa as respostas e embaralha de novo. */}
            <a
              href={`/quiz/${quizId}`}
              className="inline-flex min-h-12 items-center justify-center rounded-[14px] border border-linha bg-cartao px-5 text-base font-bold text-texto no-underline transition-colors hover:bg-fundo"
            >
              {es.quiz.otraVez}
            </a>
          </div>
        </section>
      ) : null}
      {estado.situacao === 'error' && estado.error ? <Aviso tipo="error">{es.quiz.errores[estado.error]}</Aviso> : null}

      <fieldset disabled={enviando || corrigido || !pronto} className="flex min-w-0 flex-col gap-5">
        <legend className="sr-only">{es.quiz.titulo}</legend>
        {perguntas.map((pergunta, i) => {
          const conferida = corrigido ? conferencia.get(pergunta.id) : undefined;
          const escolha = escolhas[pergunta.id];
          return (
            <section
              key={pergunta.id}
              aria-labelledby={`pergunta-${pergunta.id}`}
              className="flex flex-col gap-3.5 rounded-3xl border border-borda bg-cartao px-[18px] py-[22px] sm:rounded-[28px] sm:p-7 sm:shadow-cartao"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id={`pergunta-${pergunta.id}`} className="flex items-baseline gap-2 text-sm font-semibold text-dourado-texto sm:text-[15px]">
                  <span className="font-titulo text-lg font-bold italic">{i + 1}</span> <span>{enunciado(pergunta)}</span>
                </h2>
                {conferida ? <Sello tom={conferida.correta ? 'verde' : 'aviso'}>{conferida.correta ? es.quiz.correcta : es.quiz.incorrecta}</Sello> : null}
              </div>

              {pergunta.tipo === 'ordenar' ? (
                <Ordenar pergunta={pergunta} escolha={Array.isArray(escolha) ? escolha : []} mudar={(nova) => escolher(pergunta.id, nova)} />
              ) : (
                <>
                  {pergunta.tipo === 'multipla_escolha' ? (
                    <p className="text-lg font-bold">{pergunta.enunciado}</p>
                  ) : (
                    <p lang="pt-BR" className="text-lg font-bold">
                      {pergunta.frase.replace(/_{2,}/g, '______')}
                    </p>
                  )}
                  <div role="radiogroup" aria-labelledby={`pergunta-${pergunta.id}`} className="flex flex-col gap-2">
                    {pergunta.opcoes.map((opcao) => (
                      <label key={opcao} className={classeDaOpcao}>
                        <input
                          type="radio"
                          name={`opcao-${pergunta.id}`}
                          value={opcao}
                          checked={escolha === opcao}
                          onChange={() => escolher(pergunta.id, opcao)}
                          className="size-5 shrink-0 accent-verde"
                        />
                        <span>{opcao}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}

              {conferida && !conferida.correta ? (
                <p className="rounded-[14px] bg-fundo px-4 py-3 text-[15px] leading-normal">
                  <span className="font-semibold">{es.quiz.respuestaCorrecta}:</span> <span lang="pt-BR">{conferida.certa}</span>
                </p>
              ) : null}
            </section>
          );
        })}
      </fieldset>

      {faltam.length > 0 ? (
        <Aviso tipo="error">
          {es.quiz.faltan} {faltam.join(', ')}
        </Aviso>
      ) : null}
      {corrigido ? null : (
        <Boton disabled={enviando || !pronto} className="min-h-[54px] text-[17px] shadow-botao sm:self-start sm:px-7">
          {es.quiz.enviar}
        </Boton>
      )}
    </form>
  );
}
