import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cancelarTurma, marcarPresenca } from '@/app/admin/conversacao/acoes';
import { BotaoComConfirmacao } from '@/components/admin/BotaoComConfirmacao';
import { FormularioDaTurma } from '@/components/admin/FormulariosDaConversacao';
import { AvisoDaPagina, Botao, Cartao, Etiqueta, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { exigirEquipe } from '@/lib/admin/guarda';
import { carregarTemas, carregarTurma } from '@/lib/admin/conversacao';
import { ehUuid } from '@/lib/conteudo';
import {
  dataEmBrasilia, estadoDaTurma, horaEmBrasilia, horarioNasCidades, lerNivel, NOME_DO_ESTADO, NOME_DO_NIVEL, quandoEmBrasilia,
} from '@/lib/conversacao';

export const metadata: Metadata = { title: 'Turma' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string | string[] }> };

export default async function PaginaDaTurma({ params, searchParams }: Props) {
  const pessoa = await exigirEquipe();
  const { id } = await params;
  const { aviso } = await searchParams;
  if (!ehUuid(id)) redirect('/admin/conversacao?aviso=nao_encontrado');
  const [completa, todos] = await Promise.all([carregarTurma(id), carregarTemas()]);
  if (!completa) redirect('/admin/conversacao?aviso=nao_encontrado');

  const { turma, tema, reservas } = completa;
  const agora = new Date();
  const estado = estadoDaTurma(turma, agora);
  const nivel = lerNivel(tema.nivel);
  const comecou = estado === 'acontecendo' || estado === 'realizada';
  const notas = reservas.filter((reserva) => reserva.nota !== null);
  // O tema desta turma aparece na lista mesmo se foi arquivado depois.
  const temas = todos.filter((item) => item.arquivado_em === null || item.id === turma.tema_id);

  return (
    <>
      <Trilha href="/admin/conversacao" rotulo="Conversação" />
      <TituloDaPagina titulo={tema.titulo_es} texto={`${nivel ? NOME_DO_NIVEL[nivel] : tema.nivel} · ${quandoEmBrasilia(turma.inicio)} (Brasília) · ${turma.duracao_min} minutos`}>
        <Etiqueta tom={estado === 'cancelada' ? 'aviso' : estado === 'realizada' ? 'neutro' : 'verde'}>{NOME_DO_ESTADO[estado]}</Etiqueta>
      </TituloDaPagina>
      <AvisoDaPagina aviso={avisoDe(aviso)} />

      <Cartao>
        <h2 className="text-lg font-bold">Como o aluno vê este horário</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {horarioNasCidades(turma.inicio).map((cidade) => (
            <div key={cidade.cidade} className="rounded-xl bg-fundo px-3.5 py-3">
              <dt className="text-sm text-apoio">{cidade.cidade}</dt>
              <dd className="text-base font-bold">{cidade.hora}</dd>
            </div>
          ))}
        </dl>
      </Cartao>

      {estado === 'cancelada' ? null : (
        <Cartao>
          <h2 className="text-lg font-bold">Dados da turma</h2>
          {reservas.length > 0 ? (
            <p className="mt-2 text-[15px] leading-normal text-apoio">
              Já há gente inscrita: o tema, a data e a hora não mudam mais. Para mudar o horário, cancele esta turma e crie outra.
            </p>
          ) : null}
          <div className="mt-4">
            <FormularioDaTurma
              travada={reservas.length > 0}
              temas={temas.map((item) => {
                const doTema = lerNivel(item.nivel);
                return { id: item.id, rotulo: `${item.titulo_es} · ${doTema ? NOME_DO_NIVEL[doTema] : item.nivel}` };
              })}
              turma={{
                id: turma.id,
                tema_id: turma.tema_id,
                data: dataEmBrasilia(turma.inicio),
                hora: horaEmBrasilia(turma.inicio),
                duracao_min: String(turma.duracao_min),
                vagas: String(turma.vagas),
                meet_url: turma.meet_url ?? '',
              }}
            />
          </div>
        </Cartao>
      )}

      <Cartao>
        <h2 id="inscritos" className="text-lg font-bold">
          Inscritos: {reservas.length} de {turma.vagas}
        </h2>
        {reservas.length === 0 ? (
          <p className="mt-2 text-[15px] leading-normal text-apoio">
            {estado === 'cancelada' ? 'As reservas desta turma foram canceladas junto com ela.' : 'Ninguém reservou esta turma ainda.'}
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {reservas.map((reserva) => (
              <li key={reserva.reserva_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-linha p-3.5">
                <div className="flex min-w-0 flex-col gap-0.5">
                  {pessoa.papel === 'admin' ? (
                    <Link href={`/admin/alunos/${reserva.aluno_id}`} className="font-semibold text-verde-link underline hover:text-verde">
                      {reserva.nome || reserva.email}
                    </Link>
                  ) : (
                    <span className="font-semibold">{reserva.nome || reserva.email}</span>
                  )}
                  <span className="break-all text-sm text-apoio">{reserva.email}</span>
                  {reserva.nota !== null ? (
                    <span className="text-sm">
                      Avaliação: <span className="font-semibold">{reserva.nota} de 5</span>
                      {reserva.comentario ? <span lang="es"> — “{reserva.comentario}”</span> : null}
                    </span>
                  ) : null}
                </div>
                {comecou ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {reserva.presente === true ? <Etiqueta tom="verde">Presente</Etiqueta> : null}
                    {reserva.presente === false ? <Etiqueta tom="aviso">Faltou</Etiqueta> : null}
                    {[
                      { valor: '1', rotulo: 'Presente', mostra: reserva.presente !== true },
                      { valor: '0', rotulo: 'Faltou', mostra: reserva.presente !== false },
                    ]
                      .filter((opcao) => opcao.mostra)
                      .map((opcao) => (
                        <form key={opcao.valor} action={marcarPresenca}>
                          <input type="hidden" name="reserva_id" value={reserva.reserva_id} />
                          <input type="hidden" name="turma_id" value={turma.id} />
                          <input type="hidden" name="presente" value={opcao.valor} />
                          <Botao variante="secundario" aria-label={`Marcar ${reserva.nome || reserva.email} como ${opcao.rotulo.toLowerCase()}`}>
                            {opcao.rotulo}
                          </Botao>
                        </form>
                      ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {notas.length > 0 ? (
          <p className="mt-4 text-[15px] text-apoio">
            Média das avaliações: {(notas.reduce((soma, reserva) => soma + (reserva.nota ?? 0), 0) / notas.length).toFixed(1).replace('.', ',')} de 5 (
            {notas.length} {notas.length === 1 ? 'avaliação' : 'avaliações'}).
          </p>
        ) : null}
        {comecou ? null : reservas.length > 0 ? (
          <p className="mt-4 text-[13px] leading-normal text-apoio">A presença pode ser marcada a partir do início da aula.</p>
        ) : null}
      </Cartao>

      {estado === 'aberta' || estado === 'acontecendo' ? (
        <Cartao>
          <h2 className="text-lg font-bold">Cancelar a turma</h2>
          <p className="mb-3 mt-2 text-[15px] leading-normal text-apoio">
            Quem está inscrito recebe um e-mail avisando e ganha a reserva de volta para escolher outra aula. Não dá para desfazer.
          </p>
          <BotaoComConfirmacao
            acao={cancelarTurma}
            campos={{ id: turma.id }}
            pergunta={
              reservas.length > 0
                ? `Cancelar esta turma? ${reservas.length === 1 ? 'A pessoa inscrita será avisada' : `As ${reservas.length} pessoas inscritas serão avisadas`} por e-mail.`
                : 'Cancelar esta turma? Ela sai da agenda dos alunos.'
            }
          >
            Cancelar a turma
          </BotaoComConfirmacao>
        </Cartao>
      ) : null}
    </>
  );
}
