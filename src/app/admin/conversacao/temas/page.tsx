import type { Metadata } from 'next';
import { AvisoDaPagina, Cartao, Etiqueta, LinkBotao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { exigirEquipe } from '@/lib/admin/guarda';
import { carregarTemas } from '@/lib/admin/conversacao';
import { lerNivel, NOME_DO_NIVEL } from '@/lib/conversacao';

export const metadata: Metadata = { title: 'Temas de conversação' };

type Props = { searchParams: Promise<{ aviso?: string | string[] }> };

export default async function PaginaTemas({ searchParams }: Props) {
  const { aviso } = await searchParams;
  await exigirEquipe();
  const temas = await carregarTemas();
  const ativos = temas.filter((tema) => tema.arquivado_em === null);
  const arquivados = temas.filter((tema) => tema.arquivado_em !== null);

  return (
    <>
      <Trilha href="/admin/conversacao" rotulo="Conversação" />
      <TituloDaPagina titulo="Temas de conversação" texto="O assunto de cada aula ao vivo. Um tema serve para quantas turmas você quiser.">
        <LinkBotao href="/admin/conversacao/temas/novo">Novo tema</LinkBotao>
      </TituloDaPagina>
      <AvisoDaPagina aviso={avisoDe(aviso)} />

      {temas.length === 0 ? (
        <Cartao>
          <p className="text-[15px] leading-normal text-apoio">Ainda não há temas. Crie o primeiro para poder marcar turmas.</p>
        </Cartao>
      ) : (
        <ul className="flex flex-col gap-3">
          {[...ativos, ...arquivados].map((tema) => {
            const nivel = lerNivel(tema.nivel);
            return (
              <li key={tema.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-borda bg-cartao p-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span lang="es" className="font-bold">
                      {tema.titulo_es}
                    </span>
                    <Etiqueta>{nivel ? NOME_DO_NIVEL[nivel] : tema.nivel}</Etiqueta>
                    {tema.arquivado_em !== null ? <Etiqueta tom="aviso">Arquivado</Etiqueta> : null}
                  </span>
                  {tema.descricao_es ? (
                    <span lang="es" className="line-clamp-2 text-sm leading-normal text-apoio">
                      {tema.descricao_es}
                    </span>
                  ) : null}
                </div>
                <LinkBotao href={`/admin/conversacao/temas/${tema.id}`} variante="secundario">
                  Editar<span className="sr-only"> o tema {tema.titulo_es}</span>
                </LinkBotao>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
