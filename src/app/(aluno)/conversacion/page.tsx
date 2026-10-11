import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cancelar, reservar, valorar } from '@/app/(aluno)/conversacion/acoes';
import { SugerenciaDeZona } from '@/components/aluno/SugerenciaDeZona';
import { IconoHecho } from '@/components/aluno/iconos';
import { Antetitulo, Aviso, Boton, CLASE_DEL_ENLACE, CLASE_DEL_ROTULO, Sello, Tarjeta, TEXTO_DE_PAGINA, TITULO_DE_PAGINA, TITULO_DE_TARJETA } from '@/components/aluno/ui';
import { es } from '@/i18n/es';
import { diasDaAgenda } from '@/lib/agenda';
import { carregarConversacion } from '@/lib/aluno/conversacion';
import { lerNivel, NIVEIS, NOMBRE_DEL_NIVEL } from '@/lib/conversacao';
import { fechaYHora, plazo } from '@/lib/emails';
import { ehEquipe } from '@/lib/papeis';
import { DIAS_CORTOS, ERRORES_DE_RESERVA, fechaLarga, podeCancelar, horaEn, reservasNaSemanaDoDia, rotuloDoFuso, separarReservas } from '@/lib/reservas';
import { pessoaLogada } from '@/lib/supabase/servidor';

export const metadata: Metadata = { title: es.conversacion.titulo };

type Texto = string | string[] | undefined;
type Props = { searchParams: Promise<{ dia?: Texto; nivel?: Texto; aviso?: Texto }> };

const t = es.conversacion;
const PERIODOS = [
  { chave: 'manha', rotulo: t.manana },
  { chave: 'tarde', rotulo: t.tarde },
  { chave: 'noite', rotulo: t.noche },
] as const;

const classeDaAba = (atual: boolean) =>
  atual
    ? 'inline-flex min-h-11 items-center rounded-full bg-verde px-4 text-[15px] font-bold text-white no-underline'
    : 'inline-flex min-h-11 items-center rounded-full border border-linha bg-cartao px-4 text-[15px] font-semibold text-texto no-underline transition-colors hover:bg-fundo';

function endereco(dia: string, nivel: string): string {
  const partes = new URLSearchParams();
  if (dia !== '') partes.set('dia', dia);
  if (nivel !== '') partes.set('nivel', nivel);
  const texto = partes.toString();
  return texto === '' ? '/conversacion' : `/conversacion?${texto}`;
}

// A tela de conversação do aluno: as reservas dele, a agenda dos próximos dias no fuso dele e a
// avaliação das aulas que já aconteceram.
export default async function PaginaConversacion({ searchParams }: Props) {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  const { dia: diaPedido, nivel: nivelPedido, aviso } = await searchParams;
  const equipe = ehEquipe(pessoa.papel);
  const nivel = lerNivel(nivelPedido);

  const dados = await carregarConversacion(pessoa.id, nivel);
  if (dados.limite === 0 && !equipe) {
    return (
      <div className="flex flex-col gap-5 lg:gap-6">
        <h1 className={TITULO_DE_PAGINA}>{t.titulo}</h1>
        <Tarjeta>
          <h2 className={TITULO_DE_TARJETA}>{t.sinDerecho}</h2>
          <p className="mt-2 text-base leading-normal text-apoio">{t.sinDerechoTexto}</p>
        </Tarjeta>
      </div>
    );
  }

  const agora = new Date();
  const dias = diasDaAgenda(dados.agenda, dados.fuso, agora, dados.janelaDias);
  // O dia aberto: o pedido no endereço, ou o primeiro com vaga, ou hoje.
  const escolhido =
    dias.find((dia) => dia.data === diaPedido) ?? dias.find((dia) => dia.turmasComVaga > 0) ?? dias.find((dia) => dia.manha.length + dia.tarde.length + dia.noite.length > 0) ?? dias[0];
  const { proximas, passadas } = separarReservas(dados.reservas, agora);
  const usadas = escolhido ? reservasNaSemanaDoDia(dados.reservas, dados.fuso, escolhido.data) : 0;
  const restam = Math.max(dados.limite - usadas, 0);
  const diaAtual = escolhido?.data ?? '';
  const nivelAtual = nivel ?? '';

  const codigo = typeof aviso === 'string' ? aviso : '';
  const bom = codigo in t.avisos ? t.avisos[codigo as keyof typeof t.avisos] : null;
  const ruim = bom === null && codigo in ERRORES_DE_RESERVA ? ERRORES_DE_RESERVA[codigo] : null;

  const camposDeVolta = (
    <>
      <input type="hidden" name="dia" value={diaAtual} />
      <input type="hidden" name="nivel" value={nivelAtual} />
    </>
  );

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <header className="flex flex-col gap-1.5 lg:gap-2.5">
        <h1 className={TITULO_DE_PAGINA}>{t.titulo}</h1>
        <p className={TEXTO_DE_PAGINA}>{t.texto}</p>
      </header>
      {bom ? <Aviso tipo="info">{bom}</Aviso> : null}
      {ruim ? <Aviso tipo="error">{ruim}</Aviso> : null}
      {equipe ? <Aviso tipo="info">{t.vistaPrevia}</Aviso> : <SugerenciaDeZona atual={dados.fuso} dia={diaAtual} nivel={nivelAtual} />}

      {equipe ? null : (
        <Tarjeta id="mis-reservas" className="flex flex-col gap-4">
          <h2 className={TITULO_DE_TARJETA}>{t.misReservas}</h2>
          {proximas.length === 0 ? (
            <p className="text-base text-apoio">{t.sinMisReservas}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {proximas.map((reserva) => {
                const doNivel = lerNivel(reserva.nivel);
                return (
                  <li key={reserva.reserva_id} className="flex flex-col gap-3 rounded-2xl border border-borda p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-col gap-1">
                        <h3 className="text-lg font-bold">{reserva.titulo_es}</h3>
                        <p className="text-[15px] text-apoio">
                          {fechaYHora(reserva.inicio, dados.fuso)}, {reserva.duracao_min} {t.minutos}
                        </p>
                      </div>
                      {doNivel ? <Sello>{NOMBRE_DEL_NIVEL[doNivel]}</Sello> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {reserva.meet_url ? (
                        <a
                          href={reserva.meet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-12 items-center justify-center rounded-[14px] border border-verde bg-verde px-5 text-base font-bold text-white no-underline transition-colors hover:bg-verde-link"
                        >
                          {t.entrar}
                        </a>
                      ) : null}
                      {reserva.material ? (
                        <a href={reserva.material} target="_blank" rel="noopener noreferrer" className={CLASE_DEL_ENLACE}>
                          {t.material}
                        </a>
                      ) : null}
                      {podeCancelar(reserva.inicio, agora, dados.cancelarAteMin) ? (
                        <form action={cancelar}>
                          <input type="hidden" name="reserva_id" value={reserva.reserva_id} />
                          {camposDeVolta}
                          <Boton variante="secundario" aria-label={`${t.cancelar}: ${reserva.titulo_es}`}>
                            {t.cancelar}
                          </Boton>
                        </form>
                      ) : (
                        <span className="text-[15px] text-apoio">{t.yaNoSeCancela}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-6">
        <Tarjeta className="flex flex-col gap-3">
          <h2 className={TITULO_DE_TARJETA}>{t.antes}</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-normal text-apoio">
            <li>{t.reglaGrupo}</li>
            <li>{t.reglaEnlace}</li>
            <li>
              {t.reglaCancelar} {plazo(dados.cancelarAteMin)} {t.reglaCancelarFin}
            </li>
          </ul>
          {equipe ? null : (
            <p className="rounded-2xl bg-fundo px-4 py-3 text-[15px] leading-normal">
              {t.semana}: {t.teQuedan} <span className="font-bold">{restam}</span> {t.reservasDe} {dados.limite} {t.reservas}.
            </p>
          )}
        </Tarjeta>

        <Tarjeta id="agenda" className="flex min-w-0 flex-col gap-5">
          {/* Em que hora a agenda está: o lugar do fuso do aluno e que horas são lá agora, para ele
              conferir com o próprio relógio. */}
          <p className="rounded-2xl bg-fundo px-4 py-3 text-[15px] leading-normal">
            {t.zona}: <span className="font-bold">{rotuloDoFuso(dados.fuso, agora)}</span>. {t.ahoraSon}{' '}
            <span className="font-bold">{horaEn(agora, dados.fuso)}</span>.{' '}
            <Link href="/cuenta" className="font-semibold text-verde-link underline hover:text-verde">
              {t.cambiarZona}
            </Link>
          </p>
          <nav aria-label={t.niveles} className="flex flex-wrap gap-2">
            <Link href={endereco(diaAtual, '')} aria-current={nivel === null ? 'page' : undefined} className={classeDaAba(nivel === null)}>
              {t.todos}
            </Link>
            {NIVEIS.map((item) => (
              <Link key={item} href={endereco(diaAtual, item)} aria-current={nivel === item ? 'page' : undefined} className={classeDaAba(nivel === item)}>
                {NOMBRE_DEL_NIVEL[item]}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-2">
            <Antetitulo>{t.eligeDia}</Antetitulo>
            <nav aria-label={t.eligeDia} className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {dias.map((dia) => {
                const atual = dia.data === diaAtual;
                const total = dia.manha.length + dia.tarde.length + dia.noite.length;
                return (
                  <Link
                    key={dia.data}
                    href={endereco(dia.data, nivelAtual)}
                    aria-current={atual ? 'page' : undefined}
                    aria-label={`${fechaLarga(dia.data)}: ${total === 0 ? t.sinClases : `${dia.turmasComVaga} ${t.conPlazas}`}`}
                    className={`flex min-h-[88px] flex-col items-center justify-center gap-0.5 rounded-[14px] border px-1 py-2 text-center no-underline transition-colors ${
                      atual ? 'border-verde bg-verde-suave text-verde' : 'border-borda bg-cartao text-texto hover:bg-fundo'
                    }`}
                  >
                    <span className="text-[13px] font-bold">{(dia.ehHoje ? t.hoy : DIAS_CORTOS[dia.diaDaSemana]).toLocaleLowerCase('es')}</span>
                    <span className="font-titulo text-2xl font-bold leading-none">{dia.diaDoMes}</span>
                    <span className="text-xs leading-tight text-apoio">{total === 0 ? t.sinClases : `${dia.turmasComVaga} ${t.conPlazas}`}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {escolhido ? (
            <div className="flex flex-col gap-4">
              <h2 className={TITULO_DE_TARJETA}>
                {t.horariosDe} {fechaLarga(escolhido.data)}
              </h2>
              {escolhido.manha.length + escolhido.tarde.length + escolhido.noite.length === 0 ? (
                <p className="text-base text-apoio">{t.sinClasesEseDia}</p>
              ) : null}
              {PERIODOS.map((periodo) => {
                const horarios = escolhido[periodo.chave];
                if (horarios.length === 0) return null;
                return (
                  <section key={periodo.chave} aria-labelledby={`periodo-${periodo.chave}`} className="flex flex-col gap-2">
                    <h3 id={`periodo-${periodo.chave}`} className="text-[15px] font-semibold text-dourado-texto">
                      {periodo.rotulo}
                    </h3>
                    <ul className="flex flex-col gap-3">
                      {horarios.map((horario) => {
                        const doNivel = lerNivel(horario.nivel);
                        const tema = dados.temas.get(horario.temaId);
                        return (
                          <li key={horario.turmaId} className="flex flex-col gap-3 rounded-2xl border border-borda p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex min-w-0 items-start gap-4">
                                <span className="font-titulo text-3xl font-bold leading-none">{horario.hora}</span>
                                <div className="flex min-w-0 flex-col gap-1">
                                  <h4 className="text-lg font-bold leading-tight">{horario.titulo}</h4>
                                  <p className="text-[15px] text-apoio">
                                    {doNivel ? `${NOMBRE_DEL_NIVEL[doNivel]}, ` : ''}
                                    {horario.duracaoMin} {t.minutos}
                                  </p>
                                </div>
                              </div>
                              {horario.jaReservada ? (
                                <Sello tom="verde">
                                  <IconoHecho tamano={14} />
                                  {t.reservada}
                                </Sello>
                              ) : horario.lotada ? (
                                <Sello tom="aviso">{t.completo}</Sello>
                              ) : (
                                <Sello>
                                  {horario.vagasRestantes} {horario.vagasRestantes === 1 ? t.plaza : t.plazas}
                                </Sello>
                              )}
                            </div>
                            {tema?.descricao ? <p className="text-[15px] leading-normal text-apoio">{tema.descricao}</p> : null}
                            {tema && tema.aprendizados.length > 0 ? (
                              <details className="text-[15px]">
                                <summary className="cursor-pointer py-3 font-semibold text-verde-link">{t.aprenderas}</summary>
                                <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-apoio">
                                  {tema.aprendizados.map((linha) => (
                                    <li key={linha}>{linha}</li>
                                  ))}
                                </ul>
                              </details>
                            ) : null}
                            {equipe || horario.jaReservada || horario.lotada ? null : restam === 0 ? (
                              <p className="text-[15px] font-semibold text-aviso">{t.sinReservas}</p>
                            ) : (
                              <form action={reservar}>
                                <input type="hidden" name="turma_id" value={horario.turmaId} />
                                {camposDeVolta}
                                <Boton aria-label={`${t.reservar}: ${horario.titulo}, ${horario.hora}`}>
                                  {t.reservar} · {horario.hora}
                                </Boton>
                              </form>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : null}
        </Tarjeta>
      </div>

      {equipe || passadas.length === 0 ? null : (
        <Tarjeta id="anteriores" className="flex flex-col gap-4">
          <h2 className={TITULO_DE_TARJETA}>{t.anteriores}</h2>
          <ul className="flex flex-col gap-3">
            {passadas.map((reserva) => (
              <li key={reserva.reserva_id} className="flex flex-col gap-3 rounded-2xl border border-borda p-4">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-bold">{reserva.titulo_es}</h3>
                  <p className="text-[15px] text-apoio">{fechaYHora(reserva.inicio, dados.fuso)}</p>
                </div>
                {reserva.nota !== null ? (
                  <p className="text-[15px]">
                    {t.tuValoracion}: <span className="font-bold">{reserva.nota} {t.reservasDe} 5</span>
                    {reserva.comentario ? <span className="text-apoio"> — “{reserva.comentario}”</span> : null}
                  </p>
                ) : (
                  <form action={valorar} aria-label={`${t.valorar}: ${reserva.titulo_es}`} className="flex flex-col gap-3">
                    <input type="hidden" name="reserva_id" value={reserva.reserva_id} />
                    {camposDeVolta}
                    <fieldset className="flex flex-col gap-2">
                      <legend className={CLASE_DEL_ROTULO}>{t.nota}</legend>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map((nota) => (
                          <label
                            key={nota}
                            className="flex size-12 cursor-pointer items-center justify-center rounded-[14px] border border-borda-campo bg-cartao text-base font-bold has-[:checked]:border-verde has-[:checked]:bg-verde-suave has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-verde-link"
                          >
                            <input type="radio" name="nota" value={nota} className="sr-only" />
                            {nota}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`comentario-${reserva.reserva_id}`} className={CLASE_DEL_ROTULO}>
                        {t.comentario}
                      </label>
                      <textarea
                        id={`comentario-${reserva.reserva_id}`}
                        name="comentario"
                        maxLength={500}
                        className="box-border min-h-24 w-full rounded-[14px] border border-borda-campo bg-cartao px-4 py-3 text-[17px] text-texto"
                      />
                    </div>
                    <div>
                      <Boton variante="secundario">{t.enviarValoracion}</Boton>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}
