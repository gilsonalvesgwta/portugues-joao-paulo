import type { Metadata } from 'next';
import Link from 'next/link';
import { moverModulo, moverParaLixeira } from '@/app/admin/acoes';
import { AvisoDaPagina, Botao, Cartao, Etiqueta, LinkBotao, TituloDaPagina } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { ativos, carregarConteudo, modulosPorCurso } from '@/lib/admin/dados';

export const metadata: Metadata = { title: 'Cursos e módulos' };

type Props = { searchParams: Promise<{ aviso?: string | string[] }> };

const NOME_DO_TIPO = { principal: 'Principal', complementar: 'Complementar' };
const NOME_DO_MODO = { livre: 'Avanço livre', sequencial: 'Em sequência' };

export default async function PaginaCursos({ searchParams }: Props) {
  const { aviso } = await searchParams;
  const conteudo = await carregarConteudo();
  const grupos = modulosPorCurso(conteudo);
  const aulas = ativos(conteudo.aulas);

  return (
    <>
      <TituloDaPagina titulo="Cursos e módulos" texto="Cada curso é dividido em módulos, e cada módulo reúne as aulas.">
        <LinkBotao href="/admin/cursos/novo">Novo curso</LinkBotao>
      </TituloDaPagina>
      <AvisoDaPagina aviso={avisoDe(aviso)} />

      {grupos.length === 0 ? (
        <Cartao>
          <p className="text-[15px] leading-normal text-apoio">Ainda não há nenhum curso. Comece criando o primeiro.</p>
        </Cartao>
      ) : null}

      {grupos.map(({ curso, modulos }) => (
        <Cartao key={curso.id} className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-2">
              <h2 className="font-titulo text-2xl font-bold leading-tight">{curso.titulo_pt}</h2>
              <p className="text-[15px] text-apoio" lang="es">
                {curso.titulo_es}
              </p>
              <div className="flex flex-wrap gap-2">
                <Etiqueta tom={curso.situacao === 'publicado' ? 'verde' : 'aviso'}>
                  {curso.situacao === 'publicado' ? 'Publicado' : 'Rascunho'}
                </Etiqueta>
                <Etiqueta>{NOME_DO_TIPO[curso.tipo]}</Etiqueta>
                <Etiqueta>{NOME_DO_MODO[curso.modo]}</Etiqueta>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <LinkBotao href={`/admin/cursos/${curso.id}`} variante="secundario">
                Editar curso
              </LinkBotao>
              <LinkBotao href={`/admin/modulos/novo?curso=${curso.id}`}>Novo módulo</LinkBotao>
            </div>
          </div>

          {modulos.length === 0 ? (
            <p className="rounded-xl bg-fundo px-4 py-3 text-[15px] text-apoio">Este curso ainda não tem módulos.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-linha border-y border-linha">
              {modulos.map((modulo, indice) => {
                const quantas = aulas.filter((aula) => aula.modulo_id === modulo.id).length;
                return (
                  <li key={modulo.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-baseline gap-3">
                      <span className="w-6 shrink-0 text-right text-[15px] font-bold text-apoio">{indice + 1}</span>
                      <div className="flex min-w-0 flex-col">
                        <span className="text-base font-semibold">{modulo.titulo_pt}</span>
                        <span className="text-sm text-apoio" lang="es">
                          {modulo.titulo_es}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/aulas?modulo=${modulo.id}`} className="px-2 text-[15px] text-verde-link underline hover:text-verde">
                        {quantas === 1 ? '1 aula' : `${quantas} aulas`}
                      </Link>
                      <form action={moverModulo} className="flex gap-1">
                        <input type="hidden" name="id" value={modulo.id} />
                        <Botao
                          name="direcao"
                          value="subir"
                          variante="secundario"
                          disabled={indice === 0}
                          aria-label={`Subir o módulo ${modulo.titulo_pt}`}
                          quadrado
                        >
                          ↑
                        </Botao>
                        <Botao
                          name="direcao"
                          value="descer"
                          variante="secundario"
                          disabled={indice === modulos.length - 1}
                          aria-label={`Descer o módulo ${modulo.titulo_pt}`}
                          quadrado
                        >
                          ↓
                        </Botao>
                      </form>
                      <LinkBotao href={`/admin/modulos/${modulo.id}`} variante="secundario">
                        Editar
                      </LinkBotao>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {modulos.length === 0 ? (
            <form action={moverParaLixeira} className="self-start">
              <input type="hidden" name="tipo" value="curso" />
              <input type="hidden" name="id" value={curso.id} />
              <Botao variante="discreto">
                Mover o curso para a lixeira
              </Botao>
            </form>
          ) : null}
        </Cartao>
      ))}
    </>
  );
}
