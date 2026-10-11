import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ElegirZona } from '@/components/aluno/ElegirZona';
import { Aviso, Tarjeta } from '@/components/aluno/ui';
import { CabecalhoInterno } from '@/components/Cabecalho';
import { es } from '@/i18n/es';
import { rotuloDoFuso, zonaValida, ZONAS_COMUNES } from '@/lib/reservas';
import { clienteDoServidor, pessoaLogada } from '@/lib/supabase/servidor';

export const metadata: Metadata = { title: es.zonaHoraria.titulo };

type Props = { searchParams: Promise<{ error?: string | string[] }> };

const t = es.zonaHoraria;

// Todos os fusos que o servidor conhece, fora os da lista de mais frequentes.
function outrasZonas(): string[] {
  const comuns = new Set<string>(ZONAS_COMUNES);
  try {
    return Intl.supportedValuesOf('timeZone').filter((zona) => !comuns.has(zona));
  } catch {
    return [];
  }
}

// A primeira tela de quem entra na área do aluno: confirmar o fuso horário. Enquanto a pessoa não
// confirma, as outras telas da área trazem para cá (a checagem fica no layout da área). Fica fora
// da área justamente para não cair nessa checagem.
export default async function PaginaDaZonaHoraria({ searchParams }: Props) {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  const { error } = await searchParams;

  const supabase = await clienteDoServidor();
  const { data: perfil } = await supabase.from('perfis').select('fuso, fuso_confirmado_em').eq('id', pessoa.id).maybeSingle();
  // Quem já confirmou troca o fuso em "Mi cuenta".
  if (typeof perfil?.fuso_confirmado_em === 'string') redirect('/inicio');
  const guardado: unknown = perfil?.fuso;
  const fuso = zonaValida(guardado) ? guardado : 'Europe/Madrid';
  const agora = new Date();
  const ruim = typeof error === 'string' && error in t.errores ? t.errores[error as keyof typeof t.errores] : null;

  return (
    <div className="min-h-dvh">
      <CabecalhoInterno inicio="/zona-horaria" nome={pessoa.nome || pessoa.email} rotuloSair={es.comum.salir} />
      <main className="mx-auto flex max-w-[640px] flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex flex-col gap-2">
          <h1 className="font-titulo text-4xl font-bold leading-tight">{t.titulo}</h1>
          <p className="text-base leading-normal text-apoio">{t.texto}</p>
        </header>
        {ruim ? <Aviso tipo="error">{ruim}</Aviso> : null}
        <Tarjeta>
          <ElegirZona
            guardada={fuso}
            comunes={ZONAS_COMUNES.map((zona) => ({ zona, rotulo: rotuloDoFuso(zona, agora) }))}
            otras={outrasZonas()}
          />
        </Tarjeta>
      </main>
    </div>
  );
}
