import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { marcarClase, marcarTarea } from '@/app/(aluno)/acoes';
import { IconoAdelante, IconoAtras, IconoCandado, IconoHecho } from '@/components/aluno/iconos';
import { VideoDeLaClase } from '@/components/aluno/VideoDeLaClase';
import { Antetitulo, Aviso, Boton, CLASE_DEL_ENLACE, EnlaceBoton, Material, Tarjeta, TITULO_DE_TARJETA } from '@/components/aluno/ui';
import { Apuntes } from '@/components/aula/Apuntes';
import { es } from '@/i18n/es';
import { diaDeApertura, duracionEnPalabras, itemDaTarefa, montarPainel, pontoDeRetomada, vizinhas } from '@/lib/aluno';
import { carregarAulaNoCurso, carregarEnVivo } from '@/lib/aluno/dados';
import { linkDoYoutube } from '@/lib/conteudo';
import { configDoPapo } from '@/lib/papo';
import { ehEquipe } from '@/lib/papeis';
import { pessoaLogada } from '@/lib/supabase/servidor';

export const metadata: Metadata = { title: es.clase.clase };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string | string[] }> };

const t = es.clase;
const BOTON_DE_PASO = 'min-h-[46px] rounded-xl px-[18px] text-[15px]';
const BOTON_DE_NAVEGACION = 'inline-flex h-12 items-center gap-2 rounded-[14px] border text-[15px] font-bold';

// Um passo da aula: a bolinha com o número (ou o visto, quando feito) e o conteúdo ao lado.
// "atual" é o primeiro passo que ainda falta: vem com a bolinha cheia.
function Paso({ numero, hecho, actual, ultimo, children }: { numero: number; hecho: boolean; actual: boolean; ultimo: boolean; children: ReactNode }) {
  return (
    <li className={`flex gap-3 py-3 lg:gap-3.5 lg:py-3.5 ${ultimo ? 'pb-0 lg:pb-1' : 'border-b border-borda'}`}>
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold lg:size-[34px] ${
          hecho || actual ? 'bg-verde text-white' : 'border-2 border-borda-campo text-apoio'
        }`}
      >
        {hecho ? <IconoHecho tamano={16} /> : <span aria-hidden="true">{numero}</span>}
        <span className="sr-only">{hecho ? t.pasoHecho : t.pasoPendiente}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">{children}</div>
    </li>
  );
}

function TextoDelPaso({ titulo, children }: { titulo: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 lg:gap-[3px]">
      <p className="break-words text-base font-bold leading-snug lg:text-[17px]">{titulo}</p>
      {children}
    </div>
  );
}

const DETALLE_DEL_PASO = 'break-words text-sm leading-[1.45] text-apoio lg:text-[15px]';

// A tela da aula: o vídeo, o botão de aula vista, os passos (vídeo, quiz, tarefas), as anotações,
// os materiais e onde tirar dúvidas.
export default async function PaginaDaClase({ params, searchParams }: Props) {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  const { id } = await params;
  const { aviso } = await searchParams;

  const contexto = await carregarAulaNoCurso(id);
  if (!contexto) redirect('/inicio?aviso=no_encontrada');
  const { aula, curso, progresso } = contexto;
  const equipe = ehEquipe(pessoa.papel);
  const painel = montarPainel(curso, progresso, equipe);
  const inicio = `/inicio?curso=${curso.curso.id}`;
  if (painel.fechados.has(aula.id)) redirect(`${inicio}&aviso=bloqueada`);

  const vista = painel.aulasVistas.has(aula.id);
  const modulo = curso.modulos.find((item) => item.id === aula.modulo_id);
  const { anterior, seguinte } = vizinhas(curso, aula.id);
  const aulaAnterior = curso.aulas.find((item) => item.id === anterior);
  const aulaSeguinte = curso.aulas.find((item) => item.id === seguinte);
  const quiz = curso.quizzes.find((item) => item.aula_id === aula.id);
  const feitoNoQuiz = quiz ? painel.quizzes.get(quiz.id) : undefined;
  const tarefas = curso.tarefas
    .filter((tarefa) => tarefa.aula_id === aula.id)
    .map((tarefa) => {
      const item = itemDaTarefa(painel.dias, tarefa.id);
      return { tarefa, item, feita: item !== null && painel.feitos.has(item) };
    });
  const posicao = progresso.aulas.find((item) => item.aula_id === aula.id)?.posicao_seg;
  const comPapo = configDoPapo() !== null;
  const comEnVivo = equipe ? false : (await carregarEnVivo(pessoa.id)).limite > 0;
  const duracao = duracionEnPalabras(aula.duracao_seg);

  // Os passos, na ordem em que o aluno faz: o vídeo, o quiz e as tarefas desta aula.
  const feitos = [...(aula.video_id ? [vista] : []), ...(quiz ? [feitoNoQuiz !== undefined] : []), ...tarefas.map(({ feita }) => feita)];
  const primeiroPendente = feitos.indexOf(false);
  let numeroDoPaso = 0;
  const proximoPaso = () => {
    numeroDoPaso += 1;
    return { numero: numeroDoPaso, hecho: feitos[numeroDoPaso - 1] === true, actual: numeroDoPaso - 1 === primeiroPendente, ultimo: numeroDoPaso === feitos.length };
  };

  const enlaceDeYoutube = aula.video_id ? (
    <a href={linkDoYoutube(aula.video_id)} target="_blank" rel="noopener noreferrer" className={`${CLASE_DEL_ENLACE} self-center`}>
      {t.verEnYoutube}
    </a>
  ) : null;

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_auto_auto_auto_1fr] lg:gap-x-7 lg:gap-y-6">
      {/* No computador, a ordem é: voltar, título, vídeo, botão e anotações à esquerda; passos, materiais e dúvidas à direita.
          No celular, o vídeo vem primeiro, de ponta a ponta, e os passos vêm antes das anotações ("order-N"). */}
      <div className="order-1 -mb-2 -mt-2 flex flex-col gap-3 lg:order-none lg:col-span-2 lg:m-0">
        <Link href={inicio} className="inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-semibold text-verde-link no-underline hover:text-verde">
          <IconoAtras />
          <span>{t.volver}</span>
        </Link>
        {aviso === 'no_guardado' ? <Aviso tipo="error">{t.noGuardado}</Aviso> : null}
        {equipe ? <Aviso tipo="info">{es.inicio.vistaPrevia}</Aviso> : null}
      </div>

      <header className="order-3 flex min-w-0 flex-col gap-2 lg:order-none lg:col-start-1 lg:row-start-2 lg:gap-2.5">
        <Antetitulo>
          {modulo ? `${modulo.titulo_es}, ${t.claseMinuscula}` : t.clase} {aula.numero}
        </Antetitulo>
        <h1 className="break-words font-titulo text-[32px] font-bold leading-[1.1] lg:text-[46px] lg:leading-[1.08] lg:tracking-[-0.01em]">{aula.titulo_es}</h1>
        {aula.titulo_pt !== aula.titulo_es ? (
          <p lang="pt-BR" className="break-words font-titulo text-lg italic text-apoio lg:text-[21px]">
            {aula.titulo_pt}
          </p>
        ) : null}
      </header>

      {aulaAnterior || aulaSeguinte ? (
        <nav aria-label={t.otrasClases} className="order-9 flex justify-between gap-2.5 lg:order-none lg:col-start-2 lg:row-start-2 lg:justify-end lg:self-end">
          {aulaAnterior && !painel.fechados.has(aulaAnterior.id) ? (
            <Link
              href={`/clase/${aulaAnterior.id}`}
              aria-label={`${t.anterior}: ${aulaAnterior.titulo_es}`}
              className={`${BOTON_DE_NAVEGACION} border-linha bg-cartao pl-3.5 pr-[18px] text-texto no-underline transition-colors hover:bg-fundo`}
            >
              <IconoAtras />
              <span>
                {t.clase} {aulaAnterior.numero}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {aulaSeguinte ? (
            painel.fechados.has(aulaSeguinte.id) ? (
              <span className={`${BOTON_DE_NAVEGACION} border-borda bg-areia pl-[18px] pr-3.5 text-apoio`}>
                <span>
                  {t.clase} {aulaSeguinte.numero}
                </span>
                <IconoCandado />
                <span className="sr-only">
                  {(() => {
                    const abre = diaDeApertura(painel.dias, aulaSeguinte.id);
                    return abre !== null ? `${t.seAbreElDia} ${abre}` : t.cerrada;
                  })()}
                </span>
              </span>
            ) : (
              <Link
                href={`/clase/${aulaSeguinte.id}`}
                aria-label={`${t.siguiente}: ${aulaSeguinte.titulo_es}`}
                className={`${BOTON_DE_NAVEGACION} border-linha bg-cartao pl-[18px] pr-3.5 text-texto no-underline transition-colors hover:bg-fundo`}
              >
                <span>
                  {t.clase} {aulaSeguinte.numero}
                </span>
                <IconoAdelante />
              </Link>
            )
          ) : null}
        </nav>
      ) : null}

      <div className="order-2 -mx-5 min-w-0 sm:mx-0 lg:order-none lg:col-start-1 lg:row-start-3">
        {aula.video_id ? (
          <VideoDeLaClase
            aulaId={aula.id}
            codigo={aula.video_id}
            titulo={`${t.video}: ${aula.titulo_es}`}
            inicio={pontoDeRetomada(posicao, vista)}
            origem={process.env.SITE_URL ?? ''}
            registrar={!equipe && !vista}
          />
        ) : (
          <div className="px-5 sm:px-0">
            <Tarjeta>
              <p className="text-base text-apoio">{t.sinVideo}</p>
            </Tarjeta>
          </div>
        )}
      </div>

      {equipe && !enlaceDeYoutube ? null : (
        <div className="order-4 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2 lg:order-none lg:col-start-1 lg:row-start-4">
          {equipe ? null : (
            <form action={marcarClase} className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
              <input type="hidden" name="aula_id" value={aula.id} />
              <input type="hidden" name="vista" value={vista ? '0' : '1'} />
              {vista ? (
                <>
                  <span className="inline-flex h-[46px] items-center justify-center gap-2 rounded-[14px] bg-verde-suave px-4 text-base font-bold text-verde">
                    <IconoHecho tamano={18} />
                    <span>{t.vista}</span>
                  </span>
                  <Boton variante="secundario" className="min-h-[46px] text-[15px]">
                    {t.desmarcar}
                  </Boton>
                </>
              ) : (
                <Boton className="min-h-[54px] gap-2.5 px-6 text-[17px] shadow-botao">
                  <IconoHecho tamano={20} />
                  <span>{t.marcarVista}</span>
                </Boton>
              )}
            </form>
          )}
          {enlaceDeYoutube}
        </div>
      )}

      {/* No computador, estes três cartões formam a coluna da direita; no celular, cada um entra na fila da página. */}
      <div className="contents lg:col-start-2 lg:row-span-3 lg:row-start-3 lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
        {quiz || tarefas.length > 0 ? (
          <Tarjeta rotulo="pasos" className="order-5 flex flex-col lg:order-none">
            <h2 id="pasos" className={`${TITULO_DE_TARJETA} pb-1.5 lg:pb-2`}>
              {t.pasos}
            </h2>
            <ol className="flex flex-col">
              {aula.video_id ? (
                <Paso {...proximoPaso()}>
                  <TextoDelPaso titulo={t.miraElVideo}>
                    <p className={DETALLE_DEL_PASO}>{duracao ? `${duracao.charAt(0).toLocaleUpperCase('es')}${duracao.slice(1)}. ${t.miraElVideoTexto}` : t.miraElVideoTexto}</p>
                  </TextoDelPaso>
                </Paso>
              ) : null}
              {quiz ? (
                <Paso {...proximoPaso()}>
                  <TextoDelPaso titulo={t.hazElQuiz}>
                    {feitoNoQuiz ? (
                      <p className={DETALLE_DEL_PASO}>
                        {t.mejorNota}: <span className="font-bold text-texto">{feitoNoQuiz.melhor} %</span>
                      </p>
                    ) : (
                      <p className={DETALLE_DEL_PASO}>{t.quizTexto}</p>
                    )}
                  </TextoDelPaso>
                  <EnlaceBoton href={`/quiz/${quiz.id}`} variante={feitoNoQuiz ? 'secundario' : 'contorno'} className={`${BOTON_DE_PASO} lg:self-start`}>
                    {feitoNoQuiz ? t.quizRepetir : t.quizBoton}
                  </EnlaceBoton>
                </Paso>
              ) : null}
              {tarefas.map(({ tarefa, item, feita }) => (
                <Paso key={tarefa.id} {...proximoPaso()}>
                  <TextoDelPaso
                    titulo={
                      <>
                        {es.inicio.tarea}: <span>{tarefa.titulo_es}</span>
                      </>
                    }
                  >
                    <p className={`${DETALLE_DEL_PASO} whitespace-pre-line`}>{tarefa.instrucao_es}</p>
                  </TextoDelPaso>
                  {tarefa.link || (item !== null && !equipe) ? (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      {item !== null && !equipe ? (
                        <form action={marcarTarea}>
                          <input type="hidden" name="item_id" value={item} />
                          <input type="hidden" name="hecha" value={feita ? '0' : '1'} />
                          <input type="hidden" name="volver" value={`/clase/${aula.id}`} />
                          <Boton variante="secundario" className={BOTON_DE_PASO} aria-label={`${feita ? es.inicio.desmarcar : es.inicio.marcarHecha}: ${tarefa.titulo_es}`}>
                            {feita ? es.inicio.desmarcar : es.inicio.marcarHecha}
                          </Boton>
                        </form>
                      ) : null}
                      {tarefa.link ? (
                        <a href={tarefa.link} target="_blank" rel="noopener noreferrer" className={CLASE_DEL_ENLACE}>
                          {es.inicio.abrirEnlace}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </Paso>
              ))}
            </ol>
          </Tarjeta>
        ) : null}

        {aula.materiais.length > 0 ? (
          <Tarjeta rotulo="materiales" className="order-7 flex flex-col gap-3 lg:order-none lg:gap-3.5">
            <h2 id="materiales" className={TITULO_DE_TARJETA}>
              {t.materiales}
            </h2>
            <ul className="flex flex-col gap-2.5">
              {aula.materiais.map((material) => (
                <li key={material.id}>
                  <Material titulo={material.titulo_es} descripcion={material.descricao_es} enlace={material.link} aviso={t.enOtraPestana} />
                </li>
              ))}
            </ul>
          </Tarjeta>
        ) : null}

        {comPapo || comEnVivo ? (
          <Tarjeta fondo="papel" rotulo="dudas" className="order-8 flex flex-col gap-3.5 lg:order-none">
            <div className="flex flex-col gap-1.5">
              <h2 id="dudas" className={TITULO_DE_TARJETA}>
                {t.dudas}
              </h2>
              <p className="text-[15px] leading-normal text-apoio lg:text-base">{comPapo && comEnVivo ? t.dudasPapoYEnVivo : comPapo ? t.dudasPapo : t.dudasEnVivo}</p>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
              {comPapo ? (
                <EnlaceBoton href="/papo" variante="contorno" className={BOTON_DE_PASO}>
                  {es.inicio.papo.boton}
                </EnlaceBoton>
              ) : null}
              {comEnVivo ? (
                <Link href="/conversacion" className={`${CLASE_DEL_ENLACE} self-center`}>
                  {t.reservarEnVivo}
                </Link>
              ) : null}
            </div>
          </Tarjeta>
        ) : null}
      </div>

      {aula.blocos.length > 0 ? (
        <Apuntes numero={aula.numero} tituloDaAula={aula.titulo_es} blocos={aula.blocos} className="order-6 min-w-0 lg:order-none lg:col-start-1 lg:row-start-5" />
      ) : null}
    </div>
  );
}
