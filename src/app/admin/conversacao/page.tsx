import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FormularioDasRegras } from '@/components/admin/FormulariosDaConversacao';
import { AvisoDaPagina, Cartao, Etiqueta, LinkBotao, TituloDaPagina } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { exigirEquipe } from '@/lib/admin/guarda';
import { carregarConfiguracoes, carregarTurmas, TURMAS_POR_PAGINA } from '@/lib/admin/conversacao';
import { lerPagina } from '@/lib/alunos';
import { estadoDaTurma, lerNivel, NOME_DO_ESTADO, NOME_DO_NIVEL, quandoEmBrasilia } from '@/lib/conversacao';

export const metadata: Metadata = { title: 'Conversação' };

type Texto = string | string[] | undefined;
type Props = { searchParams: Promise<{ aviso?: Texto; ver?: Texto; pagina?: Texto }> };

// "relative" prende à área que rola os textos só para leitor de tela da tabela.
const classeDaTabela = 'relative overflow-x-auto rounded-2xl border border-linha bg-cartao';

function endereco(passadas: boolean, pagina: number): string {
  const partes = new URLSearchParams();
  if (passadas) partes.set('ver', 'passadas');
  if (pagina > 1) partes.set('pagina', String(pagina));
  const texto = partes.toString();
  return `/admin/conversacao${texto === '' ? '' : `?${texto}`}`;
}

export default async function PaginaConversacao({ searchParams }: Props) {
  const pessoa = await exigirEquipe();
  const { aviso, ver, pagina: paginaPedida } = await searchParams;
  const passadas = ver === 'passadas';
  const pagina = lerPagina(paginaPedida);

  const [lista, regras] = await Promise.all([carregarTurmas(passadas ? 'passadas' : 'proximas', pagina), carregarConfiguracoes()]);
  if (lista.turmas.length === 0 && pagina > 1) redirect(endereco(passadas, 1));
  const paginas = Math.max(1, Math.ceil(lista.total / TURMAS_POR_PAGINA));
  const agora = new Date();

  return (
    <>
      <TituloDaPagina titulo="Conversação" texto="Aulas ao vivo em grupo. Os horários abaixo estão no horário de Brasília; cada aluno vê no fuso dele.">
        <LinkBotao href="/admin/conversacao/temas" variante="secundario">
          Temas
        </LinkBotao>
        <LinkBotao href="/admin/conversacao/turmas/nova">Nova turma</LinkBotao>
      </TituloDaPagina>
      <AvisoDaPagina aviso={avisoDe(aviso)} />

      <nav aria-label="Quais turmas mostrar" className="flex flex-wrap gap-2">
        {[
          { rotulo: 'Próximas turmas', valor: false },
          { rotulo: 'Turmas passadas', valor: true },
        ].map((aba) => (
          <Link
            key={aba.rotulo}
            href={endereco(aba.valor, 1)}
            aria-current={aba.valor === passadas ? 'page' : undefined}
            className={
              aba.valor === passadas
                ? 'inline-flex min-h-11 items-center rounded-full bg-verde px-4 text-[15px] font-bold text-white no-underline'
                : 'inline-flex min-h-11 items-center rounded-full border border-borda-campo bg-cartao px-4 text-[15px] font-semibold text-texto no-underline hover:bg-fundo'
            }
          >
            {aba.rotulo}
          </Link>
        ))}
      </nav>

      {lista.turmas.length === 0 ? (
        <Cartao>
          <p className="text-[15px] leading-normal text-apoio">
            {passadas
              ? 'Nenhuma turma aconteceu ou foi cancelada até agora.'
              : 'Não há turmas marcadas. Crie um tema e depois uma turma: ela aparece na agenda dos alunos na hora.'}
          </p>
        </Cartao>
      ) : (
        <div className={classeDaTabela}>
          <table className="w-full min-w-[720px] border-collapse text-left text-[15px]">
            <caption className="sr-only">{passadas ? 'Turmas passadas' : 'Próximas turmas'}</caption>
            <thead>
              <tr className="border-b border-linha text-xs font-semibold tracking-[0.08em] text-apoio">
                <th scope="col" className="px-4 py-3">QUANDO</th>
                <th scope="col" className="px-4 py-3">TEMA</th>
                <th scope="col" className="px-4 py-3">INSCRITOS</th>
                <th scope="col" className="px-4 py-3">SITUAÇÃO</th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.turmas.map((turma) => {
                const estado = estadoDaTurma(turma, agora);
                const nivel = lerNivel(turma.nivel);
                return (
                  <tr key={turma.id} className="border-b border-linha last:border-b-0">
                    <td className="px-4 py-3">
                      <span className="block font-semibold">{quandoEmBrasilia(turma.inicio)}</span>
                      <span className="block text-sm text-apoio">{turma.duracao_min} minutos</span>
                    </td>
                    <td className="px-4 py-3" lang="es">
                      <span className="block font-semibold">{turma.titulo_es}</span>
                      <span className="block text-sm text-apoio" lang="pt-BR">
                        {nivel ? NOME_DO_NIVEL[nivel] : turma.nivel}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {turma.reservas} de {turma.vagas}
                      {turma.reservas >= turma.vagas ? <span className="text-apoio"> · lotada</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <Etiqueta tom={estado === 'cancelada' ? 'aviso' : estado === 'realizada' ? 'neutro' : 'verde'}>{NOME_DO_ESTADO[estado]}</Etiqueta>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <LinkBotao href={`/admin/conversacao/turmas/${turma.id}`} variante="secundario">
                        Abrir<span className="sr-only"> a turma de {quandoEmBrasilia(turma.inicio)}</span>
                      </LinkBotao>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {paginas > 1 ? (
        <nav aria-label="Páginas" className="flex flex-wrap items-center gap-3">
          <span className="text-[15px] text-apoio">
            Página {pagina} de {paginas}
          </span>
          {pagina > 1 ? (
            <LinkBotao href={endereco(passadas, pagina - 1)} variante="secundario">
              Página anterior
            </LinkBotao>
          ) : null}
          {pagina < paginas ? (
            <LinkBotao href={endereco(passadas, pagina + 1)} variante="secundario">
              Próxima página
            </LinkBotao>
          ) : null}
        </nav>
      ) : null}

      <Cartao>
        <h2 className="text-lg font-bold">Regras de reserva</h2>
        {pessoa.papel === 'admin' ? (
          <div className="mt-4">
            <FormularioDasRegras key={JSON.stringify(regras)} regras={regras} />
          </div>
        ) : (
          <p className="mt-2 text-[15px] leading-normal text-apoio">
            O aluno vê as aulas dos próximos {regras.agenda_janela_dias} dias, reserva até {regras.reserva_fecha_min_antes} minutos antes e cancela
            até {regras.cancelamento_min_antes} minutos antes. Quantas aulas cada um reserva por semana vem da matrícula. Só o administrador
            muda estas regras.
          </p>
        )}
      </Cartao>
    </>
  );
}
