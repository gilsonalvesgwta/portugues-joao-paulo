import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { marcarTarea } from '@/app/(aluno)/acoes';
import { Antetitulo, Aviso, Boton, EnlaceBoton, Marca, Sello, Tarjeta } from '@/components/aluno/ui';
import { es } from '@/i18n/es';
import { duracaoCurta, montarPainel } from '@/lib/aluno';
import { carregarCurso, carregarMateriaisDoCurso, cursosVisiveis } from '@/lib/aluno/dados';
import { ehEquipe } from '@/lib/papeis';
import { pessoaLogada } from '@/lib/supabase/servidor';

export const metadata: Metadata = { title: es.inicio.titulo };

type Texto = string | string[] | undefined;
type Props = { searchParams: Promise<{ curso?: Texto; aviso?: Texto }> };

const t = es.inicio;

function avisoDe(codigo: Texto): string | null {
  return typeof codigo === 'string' && codigo in t.avisos ? t.avisos[codigo as keyof typeof t.avisos] : null;
}

// A tela de início do aluno: o curso, o que fazer hoje e todas as aulas.
export default async function PaginaInicio({ searchParams }: Props) {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  const { curso: pedido, aviso } = await searchParams;
  const equipe = ehEquipe(pessoa.papel);
  const primeiroNome = pessoa.nome.trim().split(/\s+/)[0] ?? '';
  const saudacao = (
    <h1 className="font-titulo text-4xl font-bold leading-tight">{primeiroNome ? `${t.saludo}, ${primeiroNome}` : t.saludo}</h1>
  );

  const cursos = await cursosVisiveis();
  const escolhido = cursos.find((curso) => curso.id === pedido) ?? cursos[0];
  const carregado = escolhido ? await carregarCurso(escolhido.id) : null;

  if (!escolhido || !carregado) {
    return (
      <div className="flex flex-col gap-6">
        {saudacao}
        <Tarjeta>
          <h2 className="text-xl font-bold">{t.sinCurso}</h2>
          <p className="mt-2 text-base leading-normal text-apoio">{equipe ? t.equipoSinCurso : t.sinCursoTexto}</p>
          {equipe ? (
            <div className="mt-4">
              <EnlaceBoton href="/admin">{t.irAdmin}</EnlaceBoton>
            </div>
          ) : null}
        </Tarjeta>
      </div>
    );
  }

  const { curso, progresso } = carregado;
  const materiais = await carregarMateriaisDoCurso(curso.curso.id);
  const painel = montarPainel(curso, progresso, equipe);
  const aulaPorId = new Map(curso.aulas.map((aula) => [aula.id, aula]));
  const aulaDoQuiz = new Map(curso.quizzes.map((quiz) => [quiz.id, aulaPorId.get(quiz.aula_id)]));
  const tarefaPorId = new Map(curso.tarefas.map((tarefa) => [tarefa.id, tarefa]));
  const hoje = painel.dias.find((dia) => dia.numero === painel.resumo.hoje);
  // Sem âncora, de propósito: voltar para o mesmo endereço mudando só a âncora não recarrega os
  // dados da tela, e a tarefa continuaria aparecendo como estava.
  const volta = `/inicio?curso=${curso.curso.id}`;
  const outros = cursos.filter((item) => item.id !== curso.curso.id);
  const mensagem = avisoDe(aviso);

  return (
    <div className="flex flex-col gap-6">
      {saudacao}
      {mensagem ? <Aviso tipo="error">{mensagem}</Aviso> : null}
      {equipe ? (
        <Aviso tipo="info">
          {t.vistaPrevia}{' '}
          <Link href="/admin" className="underline">
            {t.irAdmin}
          </Link>
        </Aviso>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Tarjeta className="flex flex-col gap-4">
          <Antetitulo>{t.tuCurso}</Antetitulo>
          <div className="flex flex-col gap-1">
            <h2 className="font-titulo text-3xl font-bold leading-tight">{curso.curso.titulo_es}</h2>
            {curso.curso.titulo_pt !== curso.curso.titulo_es ? (
              <p lang="pt-BR" className="text-base text-apoio">
                {curso.curso.titulo_pt}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <div
              role="progressbar"
              aria-label={t.clasesVistas}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={painel.percentual}
              className="h-3 overflow-hidden rounded-full bg-fundo"
            >
              <div className="h-full rounded-full bg-verde" style={{ width: `${painel.percentual}%` }} />
            </div>
            <p className="text-[15px] text-apoio">
              <span className="font-bold text-texto">{painel.percentual} %</span> · {painel.aulasVistas.size} {t.de} {curso.aulas.length} {t.clasesVistas}
            </p>
          </div>
          {painel.continuar ? (
            <div>
              <EnlaceBoton href={painel.continuar.tipo === 'aula' ? `/clase/${painel.continuar.id}` : `/quiz/${painel.continuar.id}`}>
                {painel.aulasVistas.size === 0 && painel.feitos.size === 0 ? t.empezar : t.continuar}
              </EnlaceBoton>
            </div>
          ) : null}
        </Tarjeta>

        {painel.dias.length > 0 ? (
          <Tarjeta id="hoy" className="flex flex-col gap-4">
            {painel.resumo.concluida || !hoje ? (
              <>
                <Antetitulo>{t.hoy.toUpperCase()}</Antetitulo>
                <h2 className="text-xl font-bold">{t.cursoCompleto}</h2>
                <p className="text-base leading-normal text-apoio">{t.cursoCompletoTexto}</p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Antetitulo>{t.hoy.toUpperCase()}</Antetitulo>
                  <Sello tom="verde">
                    {t.dia} {hoje.numero} {t.de} {painel.resumo.totalDias}
                  </Sello>
                </div>
                <ul className="flex flex-col gap-3">
                  {hoje.itens.map((item) => {
                    const feito = painel.feitos.has(item.id);
                    const aula = item.aulaId ? aulaPorId.get(item.aulaId) : item.quizId ? aulaDoQuiz.get(item.quizId) : undefined;
                    const tarefa = item.tarefaId ? tarefaPorId.get(item.tarefaId) : undefined;
                    return (
                      <li key={item.id} className="flex items-start gap-3 rounded-xl border border-linha p-3.5">
                        <Marca hecho={feito} textoHecho={t.hecho} textoPendiente={t.pendiente} />
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          {item.tipo === 'aula' && aula ? (
                            <Link href={`/clase/${aula.id}`} className="text-base font-bold text-verde-link underline hover:text-verde">
                              {t.verClase} {aula.numero}: {aula.titulo_es}
                            </Link>
                          ) : null}
                          {item.tipo === 'quiz' && aula && item.quizId ? (
                            <Link href={`/quiz/${item.quizId}`} className="text-base font-bold text-verde-link underline hover:text-verde">
                              {t.hacerQuiz} {aula.numero}
                            </Link>
                          ) : null}
                          {item.tipo === 'tarefa' && tarefa ? (
                            <>
                              <p className="text-base font-bold">
                                {t.tarea}: {tarefa.titulo_es}
                              </p>
                              <p className="whitespace-pre-line text-[15px] leading-normal text-apoio">{tarefa.instrucao_es}</p>
                              {tarefa.link ? (
                                <a
                                  href={tarefa.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="self-start text-[15px] font-semibold text-verde-link underline hover:text-verde"
                                >
                                  {t.abrirEnlace}
                                </a>
                              ) : null}
                              {equipe ? null : (
                                <form action={marcarTarea} className="mt-1">
                                  <input type="hidden" name="item_id" value={item.id} />
                                  <input type="hidden" name="hecha" value={feito ? '0' : '1'} />
                                  <input type="hidden" name="volver" value={volta} />
                                  <Boton variante="secundario" aria-label={`${feito ? t.desmarcar : t.marcarHecha}: ${tarefa.titulo_es}`}>
                                    {feito ? t.desmarcar : t.marcarHecha}
                                  </Boton>
                                </form>
                              )}
                            </>
                          ) : null}
                          {item.obrigatorio ? null : (
                            <div>
                              <Sello>{t.opcional}</Sello>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Tarjeta>
        ) : null}
      </div>

      <Tarjeta className="flex flex-col gap-5">
        <h2 className="text-xl font-bold">{t.todasLasClases}</h2>
        {curso.aulas.length === 0 ? <p className="text-base text-apoio">{t.sinClases}</p> : null}
        {curso.modulos.map((modulo) => {
          const aulas = curso.aulas.filter((aula) => aula.modulo_id === modulo.id);
          if (aulas.length === 0) return null;
          return (
            <section key={modulo.id} aria-labelledby={`modulo-${modulo.id}`} className="flex flex-col gap-2">
              <h3 id={`modulo-${modulo.id}`} className="text-xs font-bold tracking-[0.14em] text-dourado-texto">
                {modulo.titulo_es.toUpperCase()}
              </h3>
              <ul className="flex flex-col">
                {aulas.map((aula) => {
                  const vista = painel.aulasVistas.has(aula.id);
                  const fechada = painel.fechados.has(aula.id);
                  const duracao = duracaoCurta(aula.duracao_seg);
                  return (
                    <li key={aula.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-linha py-3 last:border-b-0">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="shrink-0 text-[15px] font-semibold text-apoio">
                          {t.clase} {aula.numero}
                        </span>
                        {fechada ? (
                          <span className="text-base font-semibold text-apoio">{aula.titulo_es}</span>
                        ) : (
                          <Link href={`/clase/${aula.id}`} className="text-base font-semibold text-verde-link underline hover:text-verde">
                            {aula.titulo_es}
                          </Link>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-[15px] text-apoio">
                        {duracao}
                        {vista ? <Sello tom="verde">{t.vista}</Sello> : null}
                        {fechada ? <Sello>{t.cerrada}</Sello> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </Tarjeta>

      {materiais.length > 0 ? (
        <Tarjeta id="materiales" className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">{t.materialesDelCurso}</h2>
          <ul className="flex flex-col gap-3">
            {materiais.map((material) => (
              <li key={material.id} className="flex flex-col gap-0.5">
                <a
                  href={material.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-start text-base font-semibold text-verde-link underline hover:text-verde"
                >
                  {material.titulo_es} <span className="font-normal text-apoio">{es.clase.otraPestana}</span>
                </a>
                {material.descricao_es ? <p className="text-[15px] leading-normal text-apoio">{material.descricao_es}</p> : null}
              </li>
            ))}
          </ul>
        </Tarjeta>
      ) : null}

      {outros.length > 0 ? (
        <Tarjeta className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">{t.otrosCursos}</h2>
          <ul className="flex flex-col gap-2">
            {outros.map((item) => (
              <li key={item.id}>
                <Link href={`/inicio?curso=${item.id}`} className="text-base font-semibold text-verde-link underline hover:text-verde">
                  {item.titulo_es}
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
      ) : null}
    </div>
  );
}
