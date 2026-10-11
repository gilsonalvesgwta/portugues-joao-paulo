import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AvisoDaPagina, Botao, Cartao, Entrada, Etiqueta, LinkBotao, TituloDaPagina } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { exigirAdmin } from '@/lib/admin/guarda';
import { carregarPessoas } from '@/lib/admin/pessoas';
import { dataPorExtenso, lerFiltro, lerPagina, lerPapel, NOME_DO_PAPEL, totalDePaginas, type Filtro } from '@/lib/alunos';
import { limpar } from '@/lib/conteudo';

export const metadata: Metadata = { title: 'Alunos' };

type Texto = string | string[] | undefined;
type Props = { searchParams: Promise<{ aviso?: Texto; q?: Texto; filtro?: Texto; pagina?: Texto }> };

const ABAS: { filtro: Filtro; rotulo: string }[] = [
  { filtro: 'alunos', rotulo: 'Todos os alunos' },
  { filtro: 'com_acesso', rotulo: 'Com acesso' },
  { filtro: 'sem_acesso', rotulo: 'Sem acesso' },
  { filtro: 'equipe', rotulo: 'Equipe' },
];

function endereco(filtro: Filtro, busca: string, pagina: number): string {
  const partes = new URLSearchParams();
  if (filtro !== 'alunos') partes.set('filtro', filtro);
  if (busca !== '') partes.set('q', busca);
  if (pagina > 1) partes.set('pagina', String(pagina));
  const texto = partes.toString();
  return texto === '' ? '/admin/alunos' : `/admin/alunos?${texto}`;
}

// "relative" prende à área que rola os textos só para leitor de tela da tabela.
const classeDaTabela = 'relative overflow-x-auto rounded-2xl border border-linha bg-cartao';

export default async function PaginaAlunos({ searchParams }: Props) {
  await exigirAdmin();
  const { aviso, q, filtro: filtroPedido, pagina: paginaPedida } = await searchParams;
  const filtro = lerFiltro(filtroPedido);
  const busca = limpar(q).slice(0, 100);
  const pagina = lerPagina(paginaPedida);

  const { total, pessoas } = await carregarPessoas(busca, filtro, pagina);
  const paginas = totalDePaginas(total);
  if (pagina > paginas) redirect(endereco(filtro, busca, paginas));

  return (
    <>
      <TituloDaPagina titulo="Alunos" texto="Quem tem conta na plataforma e a que cursos cada pessoa tem acesso.">
        <LinkBotao href="/admin/alunos/novo">Novo aluno</LinkBotao>
      </TituloDaPagina>
      <AvisoDaPagina aviso={avisoDe(aviso)} />

      <nav aria-label="Filtro da lista" className="flex flex-wrap gap-2">
        {ABAS.map((aba) => (
          <Link
            key={aba.filtro}
            href={endereco(aba.filtro, busca, 1)}
            aria-current={aba.filtro === filtro ? 'page' : undefined}
            className={
              aba.filtro === filtro
                ? 'inline-flex min-h-11 items-center rounded-full bg-verde px-4 text-[15px] font-bold text-white no-underline'
                : 'inline-flex min-h-11 items-center rounded-full border border-borda-campo bg-cartao px-4 text-[15px] font-semibold text-texto no-underline hover:bg-fundo'
            }
          >
            {aba.rotulo}
          </Link>
        ))}
      </nav>

      <form method="get" role="search" className="flex flex-wrap items-end gap-3">
        {filtro !== 'alunos' ? <input type="hidden" name="filtro" value={filtro} /> : null}
        <div className="w-full sm:w-96">
          <Entrada id="q" type="search" rotulo="Procurar por nome ou e-mail" defaultValue={busca} maxLength={100} autoComplete="off" />
        </div>
        <Botao variante="secundario">Procurar</Botao>
        {busca !== '' ? (
          <LinkBotao href={endereco(filtro, '', 1)} variante="discreto">
            Limpar a busca
          </LinkBotao>
        ) : null}
      </form>

      {pessoas.length === 0 ? (
        <Cartao>
          <p className="text-[15px] leading-normal text-apoio">
            {busca !== ''
              ? `Ninguém encontrado com “${busca}” nesta lista.`
              : filtro === 'alunos'
                ? 'Ainda não há alunos. Eles aparecem aqui depois da compra ou quando você cadastra um.'
                : 'Ninguém nesta lista.'}
          </p>
        </Cartao>
      ) : (
        <>
          <p className="text-[15px] text-apoio" aria-live="polite">
            {total === 1 ? '1 pessoa' : `${total} pessoas`}
            {paginas > 1 ? ` · página ${pagina} de ${paginas}` : ''}
          </p>
          <div className={classeDaTabela}>
            <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
              <caption className="sr-only">Pessoas cadastradas</caption>
              <thead>
                <tr className="border-b border-linha text-xs font-semibold tracking-[0.08em] text-apoio">
                  <th scope="col" className="px-4 py-3">PESSOA</th>
                  <th scope="col" className="px-4 py-3">ACESSO</th>
                  <th scope="col" className="px-4 py-3">DESDE</th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pessoas.map((pessoa) => {
                  const papel = lerPapel(pessoa.papel);
                  return (
                    <tr key={pessoa.id} className="border-b border-linha last:border-b-0">
                      <td className="px-4 py-3">
                        <span className="block font-semibold">{pessoa.nome || 'Sem nome'}</span>
                        <span className="block break-all text-sm text-apoio">{pessoa.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap gap-1.5">
                          {papel !== null && papel !== 'aluno' ? <Etiqueta tom="aviso">{NOME_DO_PAPEL[papel]}</Etiqueta> : null}
                          {pessoa.cursos_com_acesso.map((curso) => (
                            <Etiqueta key={curso} tom="verde">
                              {curso}
                            </Etiqueta>
                          ))}
                          {pessoa.cursos_com_acesso.length === 0 && (papel === null || papel === 'aluno') ? (
                            <Etiqueta>{pessoa.matriculas === 0 ? 'Sem matrícula' : 'Sem acesso'}</Etiqueta>
                          ) : null}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{dataPorExtenso(pessoa.criado_em)}</td>
                      <td className="px-4 py-3 text-right">
                        <LinkBotao href={`/admin/alunos/${pessoa.id}`} variante="secundario">
                          Abrir<span className="sr-only"> o cadastro de {pessoa.nome || pessoa.email}</span>
                        </LinkBotao>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {paginas > 1 ? (
            <nav aria-label="Páginas" className="flex flex-wrap items-center gap-3">
              {pagina > 1 ? (
                <LinkBotao href={endereco(filtro, busca, pagina - 1)} variante="secundario">
                  Página anterior
                </LinkBotao>
              ) : null}
              {pagina < paginas ? (
                <LinkBotao href={endereco(filtro, busca, pagina + 1)} variante="secundario">
                  Próxima página
                </LinkBotao>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
