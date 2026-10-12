import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dispensar, reprocessarAviso } from '@/app/admin/pagamentos/acoes';
import { BotaoComConfirmacao } from '@/components/admin/BotaoComConfirmacao';
import { EnderecoSecreto } from '@/components/admin/EnderecoSecreto';
import { AvisoDaPagina, Botao, Cartao, Etiqueta, LinkBotao, TituloDaPagina } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { carregarConteudo } from '@/lib/admin/dados';
import { exigirAdmin } from '@/lib/admin/guarda';
import { AVISOS_POR_PAGINA, carregarAvisos, carregarOfertas, contarPendentes } from '@/lib/admin/pagamentos';
import { rotuloDoCurso } from '@/lib/admin/pessoas';
import { dataEHora, lerPagina } from '@/lib/alunos';
import { nomeDoAviso, situacaoDoAviso } from '@/lib/greenn';
import { prazoDaOferta } from '@/lib/ofertas';

export const metadata: Metadata = { title: 'Pagamentos' };

type Texto = string | string[] | undefined;
type Props = { searchParams: Promise<{ aviso?: Texto; ver?: Texto; pagina?: Texto }> };

// "relative" prende à área que rola os textos só para leitor de tela da tabela.
const classeDaTabela = 'relative overflow-x-auto rounded-3xl border border-borda bg-cartao shadow-cartao';
const SEGREDO_MIN = 24;

function endereco(todos: boolean, pagina: number): string {
  const partes = new URLSearchParams();
  if (todos) partes.set('ver', 'todos');
  if (pagina > 1) partes.set('pagina', String(pagina));
  const texto = partes.toString();
  return `/admin/pagamentos${texto === '' ? '' : `?${texto}`}#avisos`;
}

export default async function PaginaPagamentos({ searchParams }: Props) {
  await exigirAdmin();
  const { aviso, ver, pagina: paginaPedida } = await searchParams;
  const todos = ver === 'todos';
  const pagina = lerPagina(paginaPedida);

  const [ofertas, conteudo, lista, pendentes] = await Promise.all([
    carregarOfertas(),
    carregarConteudo(),
    carregarAvisos(!todos, pagina),
    contarPendentes(),
  ]);
  if (lista.avisos.length === 0 && pagina > 1) redirect(endereco(todos, 1));
  const paginas = Math.max(1, Math.ceil(lista.total / AVISOS_POR_PAGINA));
  const cursoPorId = new Map(conteudo.cursos.map((curso) => [curso.id, curso]));

  const site = (process.env.SITE_URL ?? '').replace(/\/+$/, '');
  const configurado = (process.env.GREENN_WEBHOOK_SEGREDO ?? '').length >= SEGREDO_MIN;

  return (
    <>
      <TituloDaPagina titulo="Pagamentos" texto="A compra na Greenn cria a conta, faz a matrícula e manda o e-mail de acesso, sem ninguém precisar mexer." />
      <AvisoDaPagina aviso={avisoDe(aviso)} />

      <Cartao>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-[21px] font-bold leading-tight">Ligação com a Greenn</h2>
          <Etiqueta tom={configurado ? 'verde' : 'aviso'}>{configurado ? 'Pronta para receber' : 'Falta configurar'}</Etiqueta>
        </div>
        {configurado ? (
          <div className="mt-2 flex flex-col gap-2 text-[15px] leading-normal text-apoio">
            <p>
              Este é o endereço de webhook da plataforma. Na Greenn, no produto, cadastre-o como webhook dos eventos de venda
              (e de assinatura, se houver):
            </p>
            {/* O trecho secreto não vem na página: só chega quando o administrador pede para ver ou copiar. */}
            <EnderecoSecreto rotulo="Endereço de webhook para a Greenn" escondido={`${site}/api/greenn/${'•'.repeat(12)}`} />
            <p>
              Esse endereço funciona como uma senha: quem o tem consegue liberar acesso. Só o administrador o vê, e ele deve
              ser colado apenas na Greenn. O trecho final é o valor da variável SEGREDO_DA_GREENN, definido na instalação.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-[15px] leading-normal text-apoio">
            A plataforma ainda não aceita avisos da Greenn: falta definir, na instalação, a variável SEGREDO_DA_GREENN com pelo
            menos {SEGREDO_MIN} letras e números. Até lá, as matrículas são feitas pela tela de alunos.
          </p>
        )}
      </Cartao>

      <Cartao>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-[21px] font-bold leading-tight">Ofertas</h2>
            <p className="text-[15px] leading-normal text-apoio">Cada produto vendido na Greenn aponta para um curso.</p>
          </div>
          <LinkBotao href="/admin/pagamentos/ofertas/nova">Nova oferta</LinkBotao>
        </div>
        {ofertas.length === 0 ? (
          <p className="mt-4 text-[15px] leading-normal text-apoio">
            Ainda não há ofertas. Sem oferta, a compra chega, fica pendente e não libera acesso.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {ofertas.map((oferta) => {
              const curso = cursoPorId.get(oferta.curso_id);
              return (
                <li key={oferta.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borda p-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{oferta.nome}</span>
                      {oferta.ativa ? null : <Etiqueta tom="aviso">Desativada</Etiqueta>}
                    </span>
                    <span className="text-sm leading-normal text-apoio">
                      Produto {oferta.greenn_product_id} · {curso ? rotuloDoCurso(curso) : 'curso não encontrado'} ·{' '}
                      {prazoDaOferta(oferta.dias_de_acesso)} ·{' '}
                      {oferta.inclui_conversacao ? `conversação: ${oferta.reservas_por_semana} por semana` : 'sem conversação'}
                    </span>
                  </div>
                  <LinkBotao href={`/admin/pagamentos/ofertas/${oferta.id}`} variante="secundario">
                    Editar<span className="sr-only"> a oferta {oferta.nome}</span>
                  </LinkBotao>
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>

      <section aria-labelledby="avisos" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="avisos" className="text-[21px] font-bold leading-tight">
            Avisos recebidos da Greenn
          </h2>
          <p className="text-[15px] leading-normal text-apoio">
            {pendentes === 0
              ? 'Nenhum aviso pendente.'
              : pendentes === 1
                ? '1 aviso pendente: precisa da sua atenção.'
                : `${pendentes} avisos pendentes: precisam da sua atenção.`}
          </p>
        </div>
        <nav aria-label="Quais avisos mostrar" className="flex flex-wrap gap-2">
          {[
            { rotulo: 'Pendentes', valor: false },
            { rotulo: 'Todos', valor: true },
          ].map((aba) => (
            <Link
              key={aba.rotulo}
              href={endereco(aba.valor, 1)}
              aria-current={aba.valor === todos ? 'page' : undefined}
              className={
                aba.valor === todos
                  ? 'inline-flex min-h-11 items-center rounded-full bg-verde px-4 text-[15px] font-bold text-white no-underline'
                  : 'inline-flex min-h-11 items-center rounded-full border border-borda-campo bg-cartao px-4 text-[15px] font-semibold text-texto no-underline hover:bg-fundo'
              }
            >
              {aba.rotulo}
            </Link>
          ))}
        </nav>

        {lista.avisos.length === 0 ? (
          <Cartao>
            <p className="text-[15px] leading-normal text-apoio">
              {todos ? 'Nenhum aviso chegou até agora.' : 'Nada pendente. Para ver tudo o que já chegou, escolha “Todos”.'}
            </p>
          </Cartao>
        ) : (
          <div className={classeDaTabela}>
            <table className="w-full min-w-[720px] border-collapse text-left text-[15px]">
              <caption className="sr-only">Avisos de pagamento</caption>
              <thead>
                <tr className="border-b border-borda bg-papel text-sm font-semibold text-apoio">
                  <th scope="col" className="px-4 py-3">Quando</th>
                  <th scope="col" className="px-4 py-3">Aviso</th>
                  <th scope="col" className="px-4 py-3">Quem comprou</th>
                  <th scope="col" className="px-4 py-3">Situação</th>
                </tr>
              </thead>
              <tbody>
                {lista.avisos.map((item) => {
                  const situacao = situacaoDoAviso(item);
                  return (
                    <tr key={item.id} className="border-b border-borda align-top last:border-b-0">
                      <td className="whitespace-nowrap px-4 py-3">{dataEHora(item.recebido_em)}</td>
                      <td className="px-4 py-3">
                        <span className="block font-semibold">{nomeDoAviso(item.tipo, item.status_atual)}</span>
                        <span className="block text-sm text-apoio">
                          {item.produto ?? 'Produto'} {item.produto_id ? `(${item.produto_id})` : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {item.aluno_id ? (
                          <Link href={`/admin/alunos/${item.aluno_id}`} className="font-semibold text-verde-link underline hover:text-verde">
                            {item.nome || item.email || 'Abrir o cadastro'}
                          </Link>
                        ) : (
                          <span className="block font-semibold">{item.nome || 'Sem nome'}</span>
                        )}
                        <span className="block break-all text-sm text-apoio">{item.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-2">
                          <span className={situacao.pendente ? 'font-semibold text-aviso' : ''}>{situacao.texto}</span>
                          {situacao.pendente ? (
                            <div className="flex flex-wrap gap-2">
                              <form action={reprocessarAviso}>
                                <input type="hidden" name="id" value={item.id} />
                                <Botao variante="secundario" aria-label={`Processar de novo o aviso de ${item.email ?? 'comprador sem e-mail'}`}>
                                  Processar de novo
                                </Botao>
                              </form>
                              <BotaoComConfirmacao
                                acao={dispensar}
                                campos={{ id: String(item.id) }}
                                pergunta="Dispensar este aviso? Ele sai da lista de pendentes e não libera acesso."
                                rotulo={`Dispensar o aviso de ${item.email ?? 'comprador sem e-mail'}`}
                              >
                                Dispensar
                              </BotaoComConfirmacao>
                            </div>
                          ) : null}
                        </div>
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
              <LinkBotao href={endereco(todos, pagina - 1)} variante="secundario">
                Página anterior
              </LinkBotao>
            ) : null}
            {pagina < paginas ? (
              <LinkBotao href={endereco(todos, pagina + 1)} variante="secundario">
                Próxima página
              </LinkBotao>
            ) : null}
          </nav>
        ) : null}
      </section>
    </>
  );
}
