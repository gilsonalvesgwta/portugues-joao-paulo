import type { Metadata } from 'next';
import { restaurar } from '@/app/admin/acoes';
import { AvisoDaPagina, Botao, Cartao, TituloDaPagina } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { carregarConteudo } from '@/lib/admin/dados';

export const metadata: Metadata = { title: 'Lixeira' };

type Props = { searchParams: Promise<{ aviso?: string | string[] }> };
type Item = { tipo: 'curso' | 'modulo' | 'aula'; id: string; titulo: string; detalhe: string; quando: string };

const NOME: Record<Item['tipo'], string> = { curso: 'Curso', modulo: 'Módulo', aula: 'Aula' };

function dataCurta(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
}

export default async function PaginaLixeira({ searchParams }: Props) {
  const { aviso } = await searchParams;
  const conteudo = await carregarConteudo();
  const cursoPorId = new Map(conteudo.cursos.map((curso) => [curso.id, curso]));
  const moduloPorId = new Map(conteudo.modulos.map((modulo) => [modulo.id, modulo]));

  const itens: Item[] = [];
  for (const curso of conteudo.cursos) {
    if (curso.arquivado_em) itens.push({ tipo: 'curso', id: curso.id, titulo: curso.titulo_pt, detalhe: '', quando: curso.arquivado_em });
  }
  for (const modulo of conteudo.modulos) {
    if (modulo.arquivado_em) {
      itens.push({
        tipo: 'modulo',
        id: modulo.id,
        titulo: modulo.titulo_pt,
        detalhe: `Curso: ${cursoPorId.get(modulo.curso_id)?.titulo_pt ?? '?'}`,
        quando: modulo.arquivado_em,
      });
    }
  }
  for (const aula of conteudo.aulas) {
    if (aula.arquivado_em) {
      itens.push({
        tipo: 'aula',
        id: aula.id,
        titulo: `${aula.numero}. ${aula.titulo_pt}`,
        detalhe: `Módulo: ${moduloPorId.get(aula.modulo_id)?.titulo_pt ?? '?'}`,
        quando: aula.arquivado_em,
      });
    }
  }
  itens.sort((a, b) => b.quando.localeCompare(a.quando));

  return (
    <>
      <TituloDaPagina titulo="Lixeira" texto="O que foi movido para cá não aparece para o aluno. Cursos e aulas voltam como rascunho." />
      <AvisoDaPagina aviso={avisoDe(aviso)} />
      {itens.length === 0 ? (
        <Cartao>
          <p className="text-[15px] leading-normal text-apoio">A lixeira está vazia.</p>
        </Cartao>
      ) : (
        <Cartao className="py-2 sm:py-2">
          <ul className="flex flex-col divide-y divide-linha">
            {itens.map((item) => (
              <li key={`${item.tipo}-${item.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="text-xs font-semibold tracking-[0.08em] text-apoio">{NOME[item.tipo].toUpperCase()}</span>
                  <span className="text-base font-semibold">{item.titulo}</span>
                  <span className="text-sm text-apoio">
                    {item.detalhe ? `${item.detalhe} · ` : ''}na lixeira desde {dataCurta(item.quando)}
                  </span>
                </div>
                <form action={restaurar}>
                  <input type="hidden" name="tipo" value={item.tipo} />
                  <input type="hidden" name="id" value={item.id} />
                  <Botao variante="secundario" aria-label={`Restaurar ${NOME[item.tipo].toLowerCase()} ${item.titulo}`}>
                    Restaurar
                  </Botao>
                </form>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </>
  );
}
