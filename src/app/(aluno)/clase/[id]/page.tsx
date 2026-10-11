import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { marcarClase, marcarTarea } from '@/app/(aluno)/acoes';
import { VideoDeLaClase } from '@/components/aluno/VideoDeLaClase';
import { Antetitulo, Aviso, Boton, EnlaceBoton, Marca, Sello, Tarjeta } from '@/components/aluno/ui';
import { Apuntes } from '@/components/aula/Apuntes';
import { es } from '@/i18n/es';
import { itemDaTarefa, montarPainel, pontoDeRetomada, vizinhas } from '@/lib/aluno';
import { carregarAulaNoCurso } from '@/lib/aluno/dados';
import { linkDoYoutube } from '@/lib/conteudo';
import { ehEquipe } from '@/lib/papeis';
import { pessoaLogada } from '@/lib/supabase/servidor';

export const metadata: Metadata = { title: es.clase.clase };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string | string[] }> };

const t = es.clase;

// A tela da aula: vídeo, o botão de aula vista, o quiz, as tarefas, os materiais e as anotações.
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
  const quiz = curso.quizzes.find((item) => item.aula_id === aula.id);
  const feitoNoQuiz = quiz ? painel.quizzes.get(quiz.id) : undefined;
  const tarefas = curso.tarefas.filter((tarefa) => tarefa.aula_id === aula.id);
  const posicao = progresso.aulas.find((item) => item.aula_id === aula.id)?.posicao_seg;

  return (
    <div className="flex flex-col gap-6">
      <Link href={inicio} className="self-start text-[15px] font-semibold text-verde-link underline hover:text-verde">
        ← {t.volver}
      </Link>
      {aviso === 'no_guardado' ? <Aviso tipo="error">{t.noGuardado}</Aviso> : null}
      {equipe ? <Aviso tipo="info">{es.inicio.vistaPrevia}</Aviso> : null}

      <header className="flex flex-col gap-1.5">
        <Antetitulo>
          {modulo ? `${modulo.titulo_es.toUpperCase()} · ` : ''}
          {t.clase.toUpperCase()} {aula.numero}
        </Antetitulo>
        <h1 className="font-titulo text-4xl font-bold leading-tight">{aula.titulo_es}</h1>
        {aula.titulo_pt !== aula.titulo_es ? (
          <p lang="pt-BR" className="text-lg text-apoio">
            {aula.titulo_pt}
          </p>
        ) : null}
      </header>

      {/* No computador, o vídeo e as anotações ficam à esquerda; quiz, tarefas e materiais, ao lado. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex min-w-0 flex-col gap-6">
          {aula.video_id ? (
            <div className="flex flex-col gap-2">
              <VideoDeLaClase
                aulaId={aula.id}
                codigo={aula.video_id}
                titulo={`${t.video}: ${aula.titulo_es}`}
                inicio={pontoDeRetomada(posicao, vista)}
                origem={process.env.SITE_URL ?? ''}
                registrar={!equipe && !vista}
              />
              <a
                href={linkDoYoutube(aula.video_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="self-start text-[15px] text-verde-link underline hover:text-verde"
              >
                {t.verEnYoutube} <span className="text-apoio">{t.otraPestana}</span>
              </a>
            </div>
          ) : (
            <Tarjeta>
              <p className="text-base text-apoio">{t.sinVideo}</p>
            </Tarjeta>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {vista ? <Sello tom="verde">✓ {t.vista}</Sello> : null}
              {equipe ? null : (
                <form action={marcarClase}>
                  <input type="hidden" name="aula_id" value={aula.id} />
                  <input type="hidden" name="vista" value={vista ? '0' : '1'} />
                  <Boton variante={vista ? 'secundario' : 'principal'}>{vista ? t.desmarcar : t.marcarVista}</Boton>
                </form>
              )}
            </div>
            <nav aria-label={es.inicio.todasLasClases} className="flex flex-wrap gap-3">
              {anterior && !painel.fechados.has(anterior) ? (
                <EnlaceBoton href={`/clase/${anterior}`} variante="secundario">
                  ← {t.anterior}
                </EnlaceBoton>
              ) : null}
              {seguinte && !painel.fechados.has(seguinte) ? (
                <EnlaceBoton href={`/clase/${seguinte}`} variante="secundario">
                  {t.siguiente} →
                </EnlaceBoton>
              ) : null}
            </nav>
          </div>

          {aula.blocos.length > 0 ? <Apuntes numero={aula.numero} tituloDaAula={aula.titulo_es} blocos={aula.blocos} /> : null}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {quiz ? (
            <Tarjeta className="flex flex-col gap-3">
              <h2 className="text-xl font-bold">{t.quizTitulo}</h2>
              {feitoNoQuiz ? (
                <p className="text-base">
                  {t.mejorNota}: <span className="font-bold">{feitoNoQuiz.melhor} %</span>
                </p>
              ) : (
                <p className="text-base text-apoio">{t.quizTexto}</p>
              )}
              <div>
                <EnlaceBoton href={`/quiz/${quiz.id}`} variante={feitoNoQuiz ? 'secundario' : 'principal'}>
                  {feitoNoQuiz ? t.quizRepetir : t.quizBoton}
                </EnlaceBoton>
              </div>
            </Tarjeta>
          ) : null}

          {tarefas.length > 0 ? (
            <Tarjeta className="flex flex-col gap-3">
              <h2 className="text-xl font-bold">{t.tareas}</h2>
              <ul className="flex flex-col gap-4">
                {tarefas.map((tarefa) => {
                  const item = itemDaTarefa(painel.dias, tarefa.id);
                  const feita = item !== null && painel.feitos.has(item);
                  return (
                    <li key={tarefa.id} className="flex items-start gap-3">
                      {item !== null ? <Marca hecho={feita} textoHecho={es.inicio.hecho} textoPendiente={es.inicio.pendiente} /> : null}
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <p className="text-base font-bold">{tarefa.titulo_es}</p>
                        <p className="whitespace-pre-line text-[15px] leading-normal text-apoio">{tarefa.instrucao_es}</p>
                        {tarefa.link ? (
                          <a
                            href={tarefa.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="self-start text-[15px] font-semibold text-verde-link underline hover:text-verde"
                          >
                            {es.inicio.abrirEnlace}
                          </a>
                        ) : null}
                        {item !== null && !equipe ? (
                          <form action={marcarTarea} className="mt-1">
                            <input type="hidden" name="item_id" value={item} />
                            <input type="hidden" name="hecha" value={feita ? '0' : '1'} />
                            <input type="hidden" name="volver" value={`/clase/${aula.id}`} />
                            <Boton variante="secundario" aria-label={`${feita ? es.inicio.desmarcar : es.inicio.marcarHecha}: ${tarefa.titulo_es}`}>
                              {feita ? es.inicio.desmarcar : es.inicio.marcarHecha}
                            </Boton>
                          </form>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Tarjeta>
          ) : null}

          {aula.materiais.length > 0 ? (
            <Tarjeta className="flex flex-col gap-3">
              <h2 className="text-xl font-bold">{t.materiales}</h2>
              <ul className="flex flex-col gap-3">
                {aula.materiais.map((material) => (
                  <li key={material.id} className="flex flex-col gap-0.5">
                    <a
                      href={material.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="self-start text-base font-semibold text-verde-link underline hover:text-verde"
                    >
                      {material.titulo_es} <span className="font-normal text-apoio">{t.otraPestana}</span>
                    </a>
                    {material.descricao_es ? <p className="text-[15px] leading-normal text-apoio">{material.descricao_es}</p> : null}
                  </li>
                ))}
              </ul>
            </Tarjeta>
          ) : null}
        </div>
      </div>
    </div>
  );
}
