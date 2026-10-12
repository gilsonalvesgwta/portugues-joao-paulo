import type { Metadata } from 'next';
import Link from 'next/link';
import { AvisoDaPagina, Botao, Cartao, Etiqueta, LinkBotao, NumeroDaAula, Pilula, Selecao, Entrada, TituloDaPagina } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { ativos, blocosPorAula, carregarConteudo, modulosPorCurso, quizzesPorAula } from '@/lib/admin/dados';
import { formatarDuracao, limpar } from '@/lib/conteudo';

export const metadata: Metadata = { title: 'Aulas' };

type Texto = string | string[] | undefined;
type Props = { searchParams: Promise<{ aviso?: Texto; modulo?: Texto; situacao?: Texto; busca?: Texto }> };

// "relative" prende à área que rola os textos só para leitor de tela (sr-only) da tabela;
// sem isso eles alargam a página inteira no celular.
// No computador, uma tabela; no celular, cada linha vira um cartão (as mesmas células, uma
// embaixo da outra), sem rolar de lado. "relative" prende à área os textos só para leitor de tela.
const classeDaTabela = 'relative md:overflow-x-auto md:rounded-3xl md:border md:border-borda md:bg-cartao md:shadow-cartao';

// Compara sem diferenciar maiúsculas nem acentos: "licao" acha "Lição".
function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default async function PaginaAulas({ searchParams }: Props) {
  const filtros = await searchParams;
  const moduloEscolhido = typeof filtros.modulo === 'string' ? filtros.modulo : '';
  const situacaoEscolhida = filtros.situacao === 'publicado' || filtros.situacao === 'rascunho' ? filtros.situacao : '';
  const busca = limpar(filtros.busca);

  const [conteudo, blocos, quizzes] = await Promise.all([carregarConteudo(), blocosPorAula(), quizzesPorAula()]);
  const grupos = modulosPorCurso(conteudo);
  const moduloPorId = new Map(grupos.flatMap((grupo) => grupo.modulos.map((modulo) => [modulo.id, { modulo, curso: grupo.curso }] as const)));
  const variosCursos = grupos.length > 1;

  const todas = ativos(conteudo.aulas).filter((aula) => moduloPorId.has(aula.modulo_id));
  const procurado = semAcento(busca);
  const aulas = todas
    .filter((aula) => moduloEscolhido === '' || aula.modulo_id === moduloEscolhido)
    .filter((aula) => situacaoEscolhida === '' || aula.situacao === situacaoEscolhida)
    .filter(
      (aula) =>
        procurado === '' ||
        String(aula.numero) === procurado ||
        semAcento(aula.titulo_pt).includes(procurado) ||
        semAcento(aula.titulo_es).includes(procurado),
    )
    .sort((a, b) => {
      const ma = moduloPorId.get(a.modulo_id);
      const mb = moduloPorId.get(b.modulo_id);
      return (
        (ma?.curso.ordem ?? 0) - (mb?.curso.ordem ?? 0) ||
        (ma?.curso.id ?? '').localeCompare(mb?.curso.id ?? '') ||
        a.numero - b.numero
      );
    });

  const temFiltro = moduloEscolhido !== '' || situacaoEscolhida !== '' || busca !== '';
  const semModulos = moduloPorId.size === 0;
  const novaAula = moduloEscolhido !== '' && moduloPorId.has(moduloEscolhido) ? `/admin/aulas/nova?modulo=${moduloEscolhido}` : '/admin/aulas/nova';

  return (
    <>
      <TituloDaPagina titulo="Aulas" texto="Aulas em rascunho não aparecem para o aluno.">
        {semModulos ? null : (
          <LinkBotao href={novaAula}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Nova aula</span>
          </LinkBotao>
        )}
      </TituloDaPagina>
      <AvisoDaPagina aviso={avisoDe(filtros.aviso)} />

      {semModulos ? (
        <Cartao>
          <p className="text-[15px] leading-normal text-apoio">
            Para criar aulas, primeiro crie um curso e pelo menos um módulo dentro dele.
          </p>
          <div className="mt-4">
            <LinkBotao href="/admin/cursos">Ir para cursos e módulos</LinkBotao>
          </div>
        </Cartao>
      ) : (
        <>
          <form method="get" className="flex flex-wrap items-end gap-3 rounded-[22px] border border-borda bg-cartao p-4 sm:rounded-3xl sm:px-5 sm:py-[18px]">
            <div className="min-w-0 flex-1 basis-56">
              <Selecao id="modulo" rotulo="Módulo" defaultValue={moduloEscolhido}>
                <option value="">Todos os módulos</option>
                {grupos.map((grupo) => (
                  <optgroup key={grupo.curso.id} label={grupo.curso.titulo_pt}>
                    {grupo.modulos.map((modulo) => (
                      <option key={modulo.id} value={modulo.id}>
                        {modulo.titulo_pt}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Selecao>
            </div>
            <div className="min-w-0 flex-1 basis-40">
              <Selecao id="situacao" rotulo="Situação" defaultValue={situacaoEscolhida}>
                <option value="">Todas</option>
                <option value="publicado">Publicadas</option>
                <option value="rascunho">Rascunhos</option>
              </Selecao>
            </div>
            <div className="min-w-0 flex-1 basis-52">
              <Entrada id="busca" rotulo="Buscar" type="search" placeholder="Número ou título da aula" defaultValue={busca} />
            </div>
            <Botao variante="secundario">Filtrar</Botao>
            {temFiltro ? (
              <LinkBotao href="/admin/aulas" variante="discreto">
                Limpar
              </LinkBotao>
            ) : null}
          </form>

          {aulas.length === 0 ? (
            <Cartao>
              <p className="text-[15px] leading-normal text-apoio">
                {temFiltro ? 'Nenhuma aula com esses filtros.' : 'Ainda não há nenhuma aula. Crie a primeira.'}
              </p>
            </Cartao>
          ) : (
            <div className={classeDaTabela}>
              <table className="block w-full border-collapse text-left text-[15px] md:table md:min-w-[820px]">
                <caption className="sr-only">Lista de aulas</caption>
                <thead className="hidden md:table-header-group">
                  <tr className="border-b border-borda bg-papel text-sm font-semibold text-apoio">
                    <th scope="col" className="py-3.5 pl-5 pr-4">Aula</th>
                    <th scope="col" className="px-4 py-3.5">Módulo</th>
                    <th scope="col" className="px-4 py-3.5">Conteúdo</th>
                    <th scope="col" className="px-4 py-3.5">Situação</th>
                    <th scope="col" className="py-3.5 pl-4 pr-5">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="flex flex-col gap-2.5 md:table-row-group">
                  {aulas.map((aula) => {
                    const dono = moduloPorId.get(aula.modulo_id);
                    const quantos = blocos.get(aula.id) ?? 0;
                    const quiz = quizzes.get(aula.id);
                    const publicada = aula.situacao === 'publicado';
                    return (
                      <tr
                        key={aula.id}
                        className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-2.5 rounded-[18px] border border-borda bg-cartao p-3.5 md:table-row md:rounded-none md:border-0 md:border-b md:bg-transparent md:p-0 md:last:border-b-0"
                      >
                        <td className="col-span-2 md:py-3.5 md:pl-5 md:pr-4">
                          <div className="flex items-center gap-3 md:gap-3.5">
                            <NumeroDaAula numero={aula.numero} publicada={publicada} />
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <span className="break-words font-bold leading-snug">{aula.titulo_pt}</span>
                              <span className="break-words text-sm text-apoio md:hidden">{dono?.modulo.titulo_pt}</span>
                              <span className="hidden break-words text-sm text-apoio md:block" lang="es">
                                {aula.titulo_es}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="hidden md:table-cell md:px-4 md:py-3.5">
                          <span className="block">{dono?.modulo.titulo_pt}</span>
                          {variosCursos ? <span className="block text-sm text-apoio">{dono?.curso.titulo_pt}</span> : null}
                        </td>
                        <td className="col-span-3 row-start-2 pl-14 md:table-cell md:px-4 md:py-3.5">
                          <div className="flex flex-wrap gap-1.5">
                            {aula.video_id ? <Pilula>{formatarDuracao(aula.duracao_seg) || 'Com vídeo'}</Pilula> : <Pilula alerta>Sem vídeo</Pilula>}
                            <Pilula>{quantos === 0 ? 'Sem anotações' : quantos === 1 ? '1 bloco' : `${quantos} blocos`}</Pilula>
                            {!quiz ? (
                              <Pilula>Sem quiz</Pilula>
                            ) : quiz.situacao === 'rascunho' ? (
                              <Pilula alerta>Quiz em rascunho, {quiz.perguntas === 1 ? '1 pergunta' : `${quiz.perguntas} perguntas`}</Pilula>
                            ) : (
                              <Pilula>Quiz, {quiz.perguntas === 1 ? '1 pergunta' : `${quiz.perguntas} perguntas`}</Pilula>
                            )}
                          </div>
                        </td>
                        <td className="col-start-3 row-start-1 self-start md:table-cell md:px-4 md:py-3.5">
                          <Etiqueta tom={publicada ? 'verde' : 'aviso'}>{publicada ? 'Publicada' : 'Rascunho'}</Etiqueta>
                        </td>
                        <td className="md:table-cell md:py-3.5 md:pl-4 md:pr-5 md:text-right">
                          {/* No celular, o cartão inteiro abre a aula (o link cobre o cartão); no computador, é o botão. */}
                          <Link
                            href={`/admin/aulas/${aula.id}`}
                            className="absolute inset-0 rounded-[18px] md:static md:inline-flex md:min-h-10 md:items-center md:rounded-xl md:border md:border-linha md:px-4 md:text-sm md:font-bold md:text-texto md:no-underline md:hover:bg-fundo"
                          >
                            <span className="sr-only md:not-sr-only">Editar</span>
                            <span className="sr-only"> a aula {aula.numero}</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-sm text-apoio">
            {aulas.length === todas.length
              ? `${todas.length} ${todas.length === 1 ? 'aula' : 'aulas'}`
              : `${aulas.length} de ${todas.length} aulas`}
          </p>
        </>
      )}
    </>
  );
}
