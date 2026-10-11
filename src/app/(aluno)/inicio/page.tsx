import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { marcarTarea } from '@/app/(aluno)/acoes';
import { IconoAdelante, IconoCandado, IconoEnVivo, IconoHecho, IconoReproducir } from '@/components/aluno/iconos';
import { Aviso, Boton, CLASE_DEL_ENLACE, EnlaceBoton, Marca, Material, Sello, Tarjeta, TITULO_DE_TARJETA } from '@/components/aluno/ui';
import { es } from '@/i18n/es';
import { diaDeApertura, duracaoCurta, fraseDeHoy, miniaturaDoYoutube, montarPainel, pendientesDeHoy } from '@/lib/aluno';
import { carregarCurso, carregarEnVivo, carregarMateriaisDoCurso, carregarVideoDaAula, cursosVisiveis, type EnVivo } from '@/lib/aluno/dados';
import { lerNivel, NOMBRE_DEL_NIVEL } from '@/lib/conversacao';
import { fechaYHora } from '@/lib/emails';
import { configDoPapo } from '@/lib/papo';
import { ehEquipe } from '@/lib/papeis';
import { partesDeLaFecha } from '@/lib/reservas';
import { pessoaLogada } from '@/lib/supabase/servidor';

export const metadata: Metadata = { title: es.inicio.titulo };

type Texto = string | string[] | undefined;
type Props = { searchParams: Promise<{ curso?: Texto; aviso?: Texto }> };

const t = es.inicio;

function avisoDe(codigo: Texto): string | null {
  return typeof codigo === 'string' && codigo in t.avisos ? t.avisos[codigo as keyof typeof t.avisos] : null;
}

// No computador, duas colunas independentes (a principal mais larga): cada cartão tem a altura do
// próprio conteúdo, sem esticar para acompanhar o vizinho. No celular as colunas se desfazem
// ("contents") e os cartões entram em uma fila só, na ordem dada por "order-N": o curso, o dia de
// hoje, a aula ao vivo, o tutor, as aulas e os materiais.
const COLUMNAS = 'contents lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start lg:gap-6';
const COLUMNA = 'contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6';

function Saludo({ nombre, texto }: { nombre: string; texto?: string }) {
  return (
    <header className="flex flex-col gap-1.5 lg:gap-2">
      <h1 className="break-words font-titulo text-[34px] font-bold leading-[1.1] lg:text-5xl lg:leading-[1.08] lg:tracking-[-0.01em]">
        {nombre ? `${t.saludo}, ${nombre}` : t.saludo}
      </h1>
      {texto ? <p className="text-base leading-normal text-apoio lg:text-lg">{texto}</p> : null}
    </header>
  );
}

// O cartão das aulas ao vivo: a próxima aula reservada, com a data no fuso do aluno, ou o
// convite para reservar. Só aparece para quem tem conversação na matrícula.
function TarjetaEnVivo({ enVivo, className }: { enVivo: EnVivo; className: string }) {
  const v = t.enVivo;
  const { proxima } = enVivo;
  if (!proxima) {
    return (
      <Tarjeta rotulo="en-vivo" className={`flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6 ${className}`}>
        <div className="flex items-start gap-3.5 lg:flex-1 lg:items-center lg:gap-6">
          <span aria-hidden="true" className="flex size-[72px] shrink-0 items-center justify-center rounded-2xl bg-verde-suave text-verde lg:size-24 lg:rounded-[20px]">
            <IconoEnVivo tamano={34} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1 lg:gap-1.5">
            <h2 id="en-vivo" className="text-sm font-semibold text-dourado-texto lg:text-[15px]">
              {v.titulo}
            </h2>
            <p className="text-[21px] font-bold leading-[1.2] lg:text-2xl">{v.invitacion}</p>
            <p className="text-[15px] leading-[1.45] text-apoio lg:text-base lg:leading-normal">{v.texto}</p>
          </div>
        </div>
        <EnlaceBoton href="/conversacion" className="min-h-[52px] lg:px-6">
          {v.reservar}
        </EnlaceBoton>
      </Tarjeta>
    );
  }

  const fecha = partesDeLaFecha(proxima.inicio, enVivo.fuso);
  const cuando = fechaYHora(proxima.inicio, enVivo.fuso);
  const nivel = lerNivel(proxima.nivel);
  const detalles = [nivel ? `${v.nivel} ${NOMBRE_DEL_NIVEL[nivel].toLocaleLowerCase('es')}` : '', `${proxima.duracao_min} ${v.minutos}`, v.porMeet].filter((parte) => parte !== '');
  return (
    <Tarjeta rotulo="en-vivo" className={`flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6 ${className}`}>
      <div className="flex items-start gap-3.5 lg:flex-1 lg:items-center lg:gap-6">
        <div aria-hidden="true" className="flex h-[84px] w-[72px] shrink-0 flex-col items-center justify-center gap-px rounded-2xl bg-verde text-fundo lg:h-[104px] lg:w-24 lg:gap-0.5 lg:rounded-[20px]">
          <span className="text-[13px] font-bold text-dourado-claro lg:text-sm">{fecha.diaSemana}</span>
          <span className="font-titulo text-[34px] font-bold leading-none lg:text-[44px]">{fecha.dia}</span>
          <span className="text-[13px] font-semibold lg:text-sm">{fecha.mes}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 lg:gap-1.5">
          <h2 id="en-vivo" className="text-sm font-semibold text-dourado-texto lg:text-[15px]">
            {v.proxima}
          </h2>
          <p className="break-words text-[21px] font-bold leading-[1.2] lg:text-2xl">{proxima.titulo_es}</p>
          <p className="text-[15px] leading-[1.45] text-apoio lg:text-base lg:leading-normal">
            {cuando.charAt(0).toLocaleUpperCase('es')}
            {cuando.slice(1)}. {detalles.join(', ').replace(/^./, (letra) => letra.toLocaleUpperCase('es'))}.
          </p>
        </div>
      </div>
      <div className="flex flex-col items-stretch gap-1 lg:shrink-0 lg:gap-1.5">
        {proxima.meet_url ? (
          <a
            href={proxima.meet_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[52px] items-center justify-center rounded-[14px] bg-verde px-6 text-base font-bold text-white no-underline transition-colors hover:bg-verde-link"
          >
            {v.entrar}
          </a>
        ) : null}
        <Link href="/conversacion#mis-reservas" className={`${CLASE_DEL_ENLACE} self-center`}>
          {v.misReservas}
        </Link>
      </div>
    </Tarjeta>
  );
}

// A tela de início do aluno: o curso, o que fazer hoje, a próxima aula ao vivo e todas as aulas.
export default async function PaginaInicio({ searchParams }: Props) {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  const { curso: pedido, aviso } = await searchParams;
  const equipe = ehEquipe(pessoa.papel);
  const primeiroNome = pessoa.nome.trim().split(/\s+/)[0] ?? '';

  const cursos = await cursosVisiveis();
  const escolhido = cursos.find((curso) => curso.id === pedido) ?? cursos[0];
  const carregado = escolhido ? await carregarCurso(escolhido.id) : null;

  if (!escolhido || !carregado) {
    return (
      <div className="flex flex-col gap-5 lg:gap-8">
        <Saludo nombre={primeiroNome} />
        <Tarjeta className="flex max-w-[720px] flex-col gap-3">
          <h2 className={TITULO_DE_TARJETA}>{t.sinCurso}</h2>
          <p className="text-base leading-normal text-apoio">{equipe ? t.equipoSinCurso : t.sinCursoTexto}</p>
          {equipe ? (
            <div className="pt-1">
              <EnlaceBoton href="/admin">{t.irAdmin}</EnlaceBoton>
            </div>
          ) : null}
        </Tarjeta>
      </div>
    );
  }

  const { curso, progresso } = carregado;
  const painel = montarPainel(curso, progresso, equipe);
  const destino = painel.continuar;
  const [materiais, enVivo, video] = await Promise.all([
    carregarMateriaisDoCurso(curso.curso.id),
    equipe ? null : carregarEnVivo(pessoa.id),
    destino?.tipo === 'aula' ? carregarVideoDaAula(destino.id) : null,
  ]);
  const aulaPorId = new Map(curso.aulas.map((aula) => [aula.id, aula]));
  const aulaDoQuiz = new Map(curso.quizzes.map((quiz) => [quiz.id, aulaPorId.get(quiz.aula_id)]));
  const tarefaPorId = new Map(curso.tarefas.map((tarefa) => [tarefa.id, tarefa]));
  const emCurso = !painel.resumo.concluida;
  const hoje = emCurso ? painel.dias.find((dia) => dia.numero === painel.resumo.hoje) : undefined;
  // Sem âncora, de propósito: voltar para o mesmo endereço mudando só a âncora não recarrega os
  // dados da tela, e a tarefa continuaria aparecendo como estava.
  const volta = `/inicio?curso=${curso.curso.id}`;
  const outros = cursos.filter((item) => item.id !== curso.curso.id);
  const mensagem = avisoDe(aviso);
  const comPapo = configDoPapo() !== null;
  const mostrarEnVivo = enVivo !== null && enVivo.limite > 0;

  // Para onde o botão do cartão do curso leva: a aula ou o quiz que falta.
  const aulaDoDestino = destino ? (destino.tipo === 'aula' ? aulaPorId.get(destino.id) : aulaDoQuiz.get(destino.id)) : undefined;
  const enderecoDoDestino = destino ? (destino.tipo === 'aula' ? `/clase/${destino.id}` : `/quiz/${destino.id}`) : '';
  const comecando = painel.aulasVistas.size === 0 && painel.feitos.size === 0;
  const duracaoDoDestino = aulaDoDestino ? duracaoCurta(aulaDoDestino.duracao_seg) : '';

  const saudacao = hoje ? [`${t.vasEnElDia} ${hoje.numero} ${t.de} ${painel.resumo.totalDias}.`, fraseDeHoy(pendientesDeHoy(painel))].filter((frase) => frase !== '').join(' ') : undefined;

  let seguirCon: ReactNode = null;
  if (destino && aulaDoDestino) {
    seguirCon = (
      <p className="text-base leading-[1.45] lg:text-[17px]">
        {destino.tipo === 'quiz' ? t.sigueConElQuiz : comecando ? t.empiezaPor : t.sigueCon}{' '}
        <strong className="font-bold">
          {t.claseMinuscula} {aulaDoDestino.numero}: {aulaDoDestino.titulo_es}
        </strong>
      </p>
    );
  } else if (emCurso && hoje) {
    seguirCon = <p className="text-base leading-[1.45] text-menta lg:text-[17px]">{t.soloTareas}</p>;
  } else if (painel.dias.length > 0) {
    seguirCon = <p className="text-base leading-[1.45] text-menta lg:text-[17px]">{t.cursoCompletoTexto}</p>;
  }

  const tarjetaDelCurso = (
    <section
      aria-labelledby="curso"
      className="order-1 flex flex-col gap-[18px] rounded-3xl bg-verde p-4 pb-[22px] text-fundo shadow-destaque sm:rounded-[28px] sm:p-7 md:flex-row md:items-center md:gap-7 lg:order-none lg:gap-8 lg:p-9"
    >
      <div className="flex min-w-0 flex-col gap-4 px-1.5 sm:px-0 md:flex-[1_1_300px] lg:gap-[22px]">
        <div className="flex flex-col gap-1.5 lg:gap-2">
          <p className="text-sm font-semibold text-dourado-claro lg:text-[15px]">{t.tuCurso}</p>
          <h2 id="curso" className="break-words font-titulo text-[27px] font-bold leading-[1.15] lg:text-4xl lg:leading-[1.12]">
            {curso.curso.titulo_es}
          </h2>
          {curso.curso.titulo_pt !== curso.curso.titulo_es ? (
            <p lang="pt-BR" className="font-titulo text-base italic text-menta lg:text-lg">
              {curso.curso.titulo_pt}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 lg:gap-2.5">
          <div
            role="progressbar"
            aria-label={t.clasesVistas}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={painel.percentual}
            className="h-2 overflow-hidden rounded-full bg-white/20"
          >
            <div className="h-full rounded-full bg-dourado-vivo" style={{ width: `${painel.percentual}%` }} />
          </div>
          <p className="text-sm text-menta lg:text-[15px]">
            {painel.aulasVistas.size} {t.de} {curso.aulas.length} {t.clasesVistas}
          </p>
        </div>
        {seguirCon}
        {destino ? (
          <Link
            href={enderecoDoDestino}
            className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-[14px] bg-fundo px-6 text-[17px] font-bold text-verde no-underline transition-colors hover:bg-white md:self-start lg:min-h-14"
          >
            <IconoReproducir tamano={18} />
            <span>{destino.tipo === 'quiz' ? es.clase.quizBoton : comecando ? t.empezar : t.continuar}</span>
          </Link>
        ) : null}
      </div>
      {destino?.tipo === 'aula' && aulaDoDestino ? (
        // Mesma aula do botão ao lado: para quem navega por teclado ou leitor de tela vale o
        // botão; a miniatura é um alvo a mais para o dedo e para o mouse.
        <Link
          href={enderecoDoDestino}
          aria-hidden="true"
          tabIndex={-1}
          className="relative order-first flex aspect-video items-center justify-center overflow-hidden rounded-[14px] border border-white/15 bg-verde-profundo text-fundo no-underline md:order-none md:flex-[1_1_280px] md:rounded-[18px]"
        >
          {video ? <img src={miniaturaDoYoutube(video)} alt="" loading="lazy" className="absolute inset-0 block size-full object-cover" /> : null}
          {video ? <span className="absolute inset-0 bg-linear-to-t from-noite/80 via-noite/20 to-noite/10" /> : null}
          <span className="relative flex size-[60px] items-center justify-center rounded-full bg-fundo text-verde lg:size-[68px]">
            <IconoReproducir tamano={26} />
          </span>
          <span className="absolute bottom-3 left-3.5 text-sm font-semibold lg:bottom-3.5 lg:left-4">
            {t.clase} {aulaDoDestino.numero}
            {duracaoDoDestino ? `, ${duracaoDoDestino}` : ''}
          </span>
        </Link>
      ) : null}
    </section>
  );

  const tarjetaDeHoy = painel.dias.length > 0 ? (
    <Tarjeta id="hoy" rotulo="hoy-titulo" className="order-2 flex flex-col gap-3.5 lg:order-none lg:gap-[18px]">
      <div className="flex items-center justify-between gap-3">
        <h2 id="hoy-titulo" className={TITULO_DE_TARJETA}>
          {t.hoy}
        </h2>
        {hoje ? (
          <Sello tom="dorado">
            {t.dia} {hoje.numero} {t.de} {painel.resumo.totalDias}
          </Sello>
        ) : null}
      </div>
      {!hoje ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[17px] font-bold leading-snug">{t.cursoCompleto}</p>
          <p className="text-base leading-normal text-apoio">{t.cursoCompletoTexto}</p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {hoje.itens.map((item) => {
              const feito = painel.feitos.has(item.id);
              const aula = item.aulaId ? aulaPorId.get(item.aulaId) : item.quizId ? aulaDoQuiz.get(item.quizId) : undefined;
              const tarefa = item.tarefaId ? tarefaPorId.get(item.tarefaId) : undefined;
              const opcional = item.obrigatorio ? null : <Sello>{t.opcional}</Sello>;

              if ((item.tipo === 'aula' || item.tipo === 'quiz') && aula) {
                const ehAula = item.tipo === 'aula';
                // O próximo passo de hoje vem destacado: é o mesmo do botão do cartão do curso.
                const proximo = destino !== null && destino.id === (ehAula ? item.aulaId : item.quizId);
                const duracao = ehAula ? duracaoCurta(aula.duracao_seg) : '';
                return (
                  <li key={item.id}>
                    <Link
                      href={ehAula ? `/clase/${aula.id}` : `/quiz/${item.quizId}`}
                      className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-texto no-underline transition-colors sm:gap-3.5 ${
                        proximo ? 'border-verde bg-verde-suave' : 'border-borda bg-cartao hover:border-verde'
                      }`}
                    >
                      <Marca hecho={feito} textoHecho={t.hecho} textoPendiente={t.pendiente} destacada={proximo} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-base font-bold leading-snug">
                          {ehAula ? t.verClase : t.hacerQuiz} {aula.numero}
                          <span className="sr-only">: </span>
                        </span>
                        <span className="break-words text-sm leading-snug text-apoio">
                          {aula.titulo_es}
                          {duracao ? `, ${duracao}` : ''}
                        </span>
                      </span>
                      {opcional}
                      <IconoAdelante tamano={20} className={proximo ? 'text-verde' : 'text-borda-campo'} />
                    </Link>
                  </li>
                );
              }

              if (item.tipo === 'tarefa' && tarefa) {
                return (
                  <li key={item.id} className="flex items-start gap-3 rounded-2xl border border-borda px-3.5 py-3 sm:gap-3.5">
                    <span className="pt-0.5">
                      <Marca hecho={feito} textoHecho={t.hecho} textoPendiente={t.pendiente} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <p className="min-w-0 break-words text-base font-bold leading-snug">
                          {t.tarea}: {tarefa.titulo_es}
                        </p>
                        {opcional}
                      </div>
                      <p className="whitespace-pre-line break-words text-sm leading-normal text-apoio">{tarefa.instrucao_es}</p>
                      {tarefa.link || !equipe ? (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                          {equipe ? null : (
                            <form action={marcarTarea}>
                              <input type="hidden" name="item_id" value={item.id} />
                              <input type="hidden" name="hecha" value={feito ? '0' : '1'} />
                              <input type="hidden" name="volver" value={volta} />
                              <Boton variante="secundario" className="min-h-[46px] rounded-xl px-4 text-[15px]" aria-label={`${feito ? t.desmarcar : t.marcarHecha}: ${tarefa.titulo_es}`}>
                                {feito ? t.desmarcar : t.marcarHecha}
                              </Boton>
                            </form>
                          )}
                          {tarefa.link ? (
                            <a href={tarefa.link} target="_blank" rel="noopener noreferrer" className={CLASE_DEL_ENLACE}>
                              {t.abrirEnlace}
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              }
              return null;
            })}
          </ul>
          {hoje.numero < painel.resumo.totalDias ? (
            <p className="text-sm leading-normal text-apoio">
              {t.alTerminar} {hoje.numero + 1}.
            </p>
          ) : null}
        </>
      )}
    </Tarjeta>
  ) : null;

  const tarjetaEnVivo = mostrarEnVivo ? <TarjetaEnVivo enVivo={enVivo} className="order-3 lg:order-none" /> : null;

  const tarjetaDelPapo = comPapo ? (
    <Tarjeta fondo="papel" rotulo="papo" className="order-4 flex flex-col gap-3.5 lg:order-none lg:gap-4">
      <div className="flex flex-col gap-1.5 lg:gap-2">
        <h2 id="papo" className={TITULO_DE_TARJETA}>
          {t.papo.titulo}
        </h2>
        <p className="max-w-[62ch] text-[15px] leading-normal text-apoio lg:text-base">{t.papo.texto}</p>
      </div>
      <EnlaceBoton href="/papo" variante="contorno" className="sm:self-start">
        {t.papo.boton}
      </EnlaceBoton>
    </Tarjeta>
  ) : null;

  const tarjetaDeClases = (
    <Tarjeta rotulo="clases" className="order-5 flex flex-col gap-5 lg:order-none lg:gap-6 lg:p-8">
      <h2 id="clases" className="font-titulo text-[26px] font-bold leading-[1.15] lg:text-3xl">
        {t.todasLasClases}
      </h2>
      {curso.aulas.length === 0 ? <p className="text-base text-apoio">{t.sinClases}</p> : null}
      {curso.modulos
        .map((modulo) => ({ modulo, aulas: curso.aulas.filter((aula) => aula.modulo_id === modulo.id) }))
        .filter(({ aulas }) => aulas.length > 0)
        .map(({ modulo, aulas }, posicao) => {
          const vistas = aulas.filter((aula) => painel.aulasVistas.has(aula.id)).length;
          return (
            <section
              key={modulo.id}
              aria-labelledby={`modulo-${modulo.id}`}
              className={`flex flex-col gap-1.5 lg:gap-2.5 ${posicao > 0 ? 'border-t border-borda pt-5 lg:pt-6' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-3 pb-1 lg:pb-1.5">
                <h3 id={`modulo-${modulo.id}`} className="min-w-0 break-words text-[17px] font-bold leading-snug lg:text-lg">
                  {modulo.titulo_es}
                </h3>
                <span className="shrink-0 text-sm text-apoio">
                  {vistas > 0 ? `${vistas} ${t.de} ${aulas.length} ${t.vistas}` : `${aulas.length} ${aulas.length === 1 ? t.claseMinuscula : t.clases}`}
                </span>
              </div>
              <ul className="flex flex-col gap-1 lg:gap-0">
                {aulas.map((aula) => {
                  const vista = painel.aulasVistas.has(aula.id);
                  const fechada = painel.fechados.has(aula.id);
                  const atual = destino?.tipo === 'aula' && destino.id === aula.id;
                  const duracao = duracaoCurta(aula.duracao_seg);
                  const abre = fechada ? diaDeApertura(painel.dias, aula.id) : null;
                  return (
                    <li
                      key={aula.id}
                      className={`relative flex items-center gap-3 rounded-[14px] border p-1.5 lg:gap-4 lg:rounded-[18px] lg:p-2.5 ${
                        atual ? 'border-verde bg-verde-suave' : fechada ? 'border-transparent' : 'border-transparent transition-colors hover:bg-fundo'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-[52px] w-[84px] shrink-0 items-center justify-center rounded-[10px] font-titulo text-2xl font-bold italic lg:h-[70px] lg:w-[124px] lg:rounded-xl lg:text-3xl ${
                          fechada ? 'bg-areia text-pedra' : atual ? 'bg-verde text-fundo' : 'bg-verde-fundo text-dourado-claro'
                        }`}
                      >
                        {atual ? <IconoReproducir tamano={24} /> : aula.numero}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5 lg:gap-[3px]">
                        {fechada ? (
                          <span className="break-words text-[15px] font-bold leading-tight lg:text-[17px]">{aula.titulo_es}</span>
                        ) : (
                          // O link é o título; a área dele (::after) cobre a linha inteira.
                          <Link href={`/clase/${aula.id}`} className="break-words text-[15px] font-bold leading-tight text-texto no-underline after:absolute after:inset-0 after:rounded-[inherit] lg:text-[17px]">
                            {aula.titulo_es}
                          </Link>
                        )}
                        {/* No celular, a aula em que a pessoa está diz «Sigue aquí» nesta linha; no computador, na etiqueta ao lado. */}
                        {atual ? (
                          <span className="text-[13px] font-bold text-verde lg:hidden">
                            {t.sigueAqui}
                            {duracao ? `, ${duracao}` : ''}
                          </span>
                        ) : null}
                        <span className={`text-[13px] text-apoio lg:text-sm ${atual ? 'hidden lg:inline' : ''}`}>
                          {t.clase} {aula.numero}
                          {duracao ? `, ${duracao}` : ''}
                        </span>
                      </span>
                      {atual ? (
                        <span className="hidden h-[30px] shrink-0 items-center rounded-full bg-verde px-3 text-sm font-bold text-white lg:inline-flex">{t.sigueAqui}</span>
                      ) : vista ? (
                        <span className="flex size-7 shrink-0 items-center justify-center gap-1.5 rounded-full bg-verde-suave text-sm font-bold text-verde lg:h-[30px] lg:w-auto lg:px-3">
                          <IconoHecho tamano={14} />
                          <span className="sr-only lg:not-sr-only">{t.vista}</span>
                        </span>
                      ) : fechada ? (
                        <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-apoio">
                          <IconoCandado />
                          <span className="sr-only lg:not-sr-only">{abre !== null ? `${t.seAbreElDia} ${abre}` : t.cerrada}</span>
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
    </Tarjeta>
  );

  const tarjetaDeMateriales = materiais.length > 0 ? (
    <Tarjeta id="materiales" rotulo="materiales-titulo" className="order-6 flex flex-col gap-3.5 lg:order-none lg:gap-4">
      <h2 id="materiales-titulo" className={TITULO_DE_TARJETA}>
        {t.materialesDelCurso}
      </h2>
      <ul className="flex flex-col gap-2.5">
        {materiais.map((material) => (
          <li key={material.id}>
            <Material titulo={material.titulo_es} descripcion={material.descricao_es} enlace={material.link} aviso={es.clase.enOtraPestana} />
          </li>
        ))}
      </ul>
    </Tarjeta>
  ) : null;

  const tarjetaDeOtrosCursos = outros.length > 0 ? (
    <Tarjeta rotulo="otros-cursos" className="order-7 flex flex-col gap-3.5 lg:order-none lg:gap-4">
      <h2 id="otros-cursos" className={TITULO_DE_TARJETA}>
        {t.otrosCursos}
      </h2>
      <ul className="flex flex-col gap-2.5">
        {outros.map((item) => (
          <li key={item.id}>
            <Link
              href={`/inicio?curso=${item.id}`}
              className="flex min-h-[52px] items-center justify-between gap-3 rounded-2xl border border-borda px-3.5 py-2 text-base font-bold text-texto no-underline transition-colors hover:border-verde"
            >
              <span className="min-w-0 break-words leading-snug">{item.titulo_es}</span>
              <IconoAdelante tamano={20} className="text-borda-campo" />
            </Link>
          </li>
        ))}
      </ul>
    </Tarjeta>
  ) : null;

  const temLateral = tarjetaDeHoy !== null || tarjetaDelPapo !== null || tarjetaDeMateriales !== null || tarjetaDeOtrosCursos !== null;

  return (
    <div className="flex flex-col gap-5 lg:gap-8">
      <Saludo nombre={primeiroNome} texto={saudacao} />
      {mensagem ? <Aviso tipo="error">{mensagem}</Aviso> : null}
      {equipe ? (
        <Aviso tipo="info">
          {t.vistaPrevia}{' '}
          <Link href="/admin" className="underline">
            {t.irAdmin}
          </Link>
        </Aviso>
      ) : null}

      <div className={temLateral ? COLUMNAS : COLUMNA}>
        <div className={COLUMNA}>
          {tarjetaDelCurso}
          {tarjetaEnVivo}
          {tarjetaDeClases}
        </div>
        {temLateral ? (
          <div className={COLUMNA}>
            {tarjetaDeHoy}
            {tarjetaDelPapo}
            {tarjetaDeMateriales}
            {tarjetaDeOtrosCursos}
          </div>
        ) : null}
      </div>
    </div>
  );
}
