import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { restaurarCopia } from '@/app/admin/copias/acoes';
import { AvisoDaPagina, Cartao, Entrada, TITULO_DO_CARTAO, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { carregarCopias } from '@/lib/admin/copias';
import { exigirAdmin } from '@/lib/admin/guarda';
import { quandoEmPalavras, ROTULO_DO_TIPO, tamanhoEmPalavras } from '@/lib/copias';

export const metadata: Metadata = { title: 'Restaurar uma cópia' };

type Props = { searchParams: Promise<{ arquivo?: string | string[]; aviso?: string | string[] }> };

// Confirmação antes de restaurar: diz o que acontece e pede para escrever RESTAURAR.
export default async function PaginaRestaurar({ searchParams }: Props) {
  await exigirAdmin();
  const { arquivo, aviso } = await searchParams;
  const situacao = await carregarCopias();
  const copia = situacao.copias.find((item) => item.nome === arquivo);
  if (!copia) redirect('/admin/copias?aviso=copia_nao_encontrada');
  const agora = new Date();
  const quando = quandoEmPalavras(copia.quando, agora);

  return (
    <>
      <Trilha href="/admin/copias" rotulo="Cópias de segurança" />
      <TituloDaPagina titulo="Restaurar uma cópia" />
      <AvisoDaPagina aviso={avisoDe(aviso)} />
      <Cartao className="max-w-[680px]">
        <h2 className={TITULO_DO_CARTAO}>
          Cópia de {quando}
        </h2>
        <p className="mt-1.5 text-[15px] text-apoio">
          {ROTULO_DO_TIPO[copia.tipo]}, {tamanhoEmPalavras(copia.bytes)}
        </p>
        <ul className="mt-5 flex list-disc flex-col gap-2.5 pl-5 text-[15px] leading-normal">
          <li>
            <strong>Todos os dados atuais da plataforma são trocados pelos desta cópia:</strong> contas e senhas, alunos,
            matrículas, progresso, reservas, cursos e aulas. O que foi feito depois da cópia se perde.
          </li>
          <li>
            Antes de trocar, a plataforma guarda uma cópia do que existe agora. Ela aparece na lista como “Antes de
            restaurar”, para dar para voltar atrás.
          </li>
          <li>Leva poucos segundos. Quem estiver usando a plataforma pode precisar entrar de novo, inclusive você.</li>
        </ul>
        <form action={restaurarCopia} className="mt-6 flex flex-col gap-4 border-t border-borda pt-6">
          <input type="hidden" name="arquivo" value={copia.nome} />
          <Entrada id="confirmacao" rotulo="Para confirmar, escreva RESTAURAR" autoComplete="off" spellCheck={false} />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-perigo bg-perigo px-[18px] text-[15px] font-bold text-white hover:opacity-90"
            >
              Restaurar esta cópia
            </button>
            <Link href="/admin/copias" className="inline-flex min-h-12 items-center px-2 text-[15px] font-bold text-verde-link">
              Cancelar
            </Link>
          </div>
        </form>
      </Cartao>
    </>
  );
}
