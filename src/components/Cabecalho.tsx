import Link from 'next/link';
import { sair } from '@/app/(acesso)/acoes';

type Props = {
  inicio: string;
  rotuloDaArea?: string;
  nome: string;
  rotuloSair: string;
};

// Faixa do topo das áreas internas: marca, nome de quem está logado e botão de sair.
export function CabecalhoInterno({ inicio, rotuloDaArea, nome, rotuloSair }: Props) {
  return (
    <header className="border-b border-linha bg-cartao px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <Link href={inicio} className="flex items-center gap-2.5 text-texto no-underline">
          <img src="/marca/icone.png" alt="" width={40} height={40} className="block size-10 rounded-[10px]" />
          <span className="flex flex-col">
            <span className="font-titulo text-[19px] font-bold leading-tight">
              Português <span className="text-[15px] font-semibold">com João Paulo</span>
            </span>
            {rotuloDaArea ? (
              <span className="text-xs font-semibold tracking-[0.1em] text-apoio">{rotuloDaArea}</span>
            ) : null}
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[15px] text-apoio">{nome}</span>
          <form action={sair}>
            <button
              type="submit"
              className="min-h-11 cursor-pointer rounded-xl border border-borda-campo bg-cartao px-4 text-[15px] font-semibold text-texto hover:bg-fundo"
            >
              {rotuloSair}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
