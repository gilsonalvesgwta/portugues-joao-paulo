import type { Metadata } from 'next';
import { AvisoDaPagina, Botao, Cartao, Etiqueta, LinkBotao, Selecao, Entrada, TituloDaPagina } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { ativos, carregarConteudo, modulosPorCurso } from '@/lib/admin/dados';
import { formatarDuracao, limpar } from '@/lib/conteudo';

export const metadata: Metadata = { title: 'Aulas' };

type Texto = string | string[] | undefined;
type Props = { searchParams: Promise<{ aviso?: Texto; modulo?: Texto; situacao?: Texto; busca?: Texto }> };

// Compara sem diferenciar maiúsculas nem acentos: "licao" acha "Lição".
function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default async function PaginaAulas({ searchParams }: Props) {
  const filtros = await searchParams;
  const moduloEscolhido = typeof filtros.modulo === 'string' ? filtros.modulo : '';
  const situacaoEscolhida = filtros.situacao === 'publicado' || filtros.situacao === 'rascunho' ? filtros.situacao : '';
  const busca = limpar(filtros.busca);

  const conteudo = await carregarConteudo();
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
        {semModulos ? null : <LinkBotao href={novaAula}>Nova aula</LinkBotao>}
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
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-64">
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
            <div className="w-full sm:w-44">
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
            <div className="overflow-x-auto rounded-2xl border border-linha bg-cartao">
              <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
                <caption className="sr-only">Lista de aulas</caption>
                <thead>
                  <tr className="border-b border-linha text-xs font-semibold tracking-[0.08em] text-apoio">
                    <th scope="col" className="w-14 px-4 py-3">Nº</th>
                    <th scope="col" className="px-4 py-3">AULA</th>
                    <th scope="col" className="px-4 py-3">MÓDULO</th>
                    <th scope="col" className="px-4 py-3">VÍDEO</th>
                    <th scope="col" className="px-4 py-3">SITUAÇÃO</th>
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {aulas.map((aula) => {
                    const dono = moduloPorId.get(aula.modulo_id);
                    return (
                      <tr key={aula.id} className="border-b border-linha last:border-b-0">
                        <td className="px-4 py-3 font-bold">{aula.numero}</td>
                        <td className="px-4 py-3">
                          <span className="block font-semibold">{aula.titulo_pt}</span>
                          <span className="block text-sm text-apoio" lang="es">
                            {aula.titulo_es}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block">{dono?.modulo.titulo_pt}</span>
                          {variosCursos ? <span className="block text-sm text-apoio">{dono?.curso.titulo_pt}</span> : null}
                        </td>
                        <td className="px-4 py-3">
                          {aula.video_id ? (
                            <span>{formatarDuracao(aula.duracao_seg) || 'Com vídeo'}</span>
                          ) : (
                            <span className="font-semibold text-aviso">Sem vídeo</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Etiqueta tom={aula.situacao === 'publicado' ? 'verde' : 'aviso'}>
                            {aula.situacao === 'publicado' ? 'Publicada' : 'Rascunho'}
                          </Etiqueta>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <LinkBotao href={`/admin/aulas/${aula.id}`} variante="secundario">
                            Editar<span className="sr-only"> a aula {aula.numero}</span>
                          </LinkBotao>
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
