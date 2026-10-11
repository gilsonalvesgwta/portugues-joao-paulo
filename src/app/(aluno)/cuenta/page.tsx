import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cambiarClave, guardarCuenta } from '@/app/(aluno)/cuenta/acoes';
import { sair } from '@/app/(acesso)/acoes';
import { Aviso, Boton, CLASE_DEL_CAMPO, CLASE_DEL_ROTULO, Tarjeta, TITULO_DE_PAGINA, TITULO_DE_TARJETA } from '@/components/aluno/ui';
import { es } from '@/i18n/es';
import { rotuloDoFuso, zonaValida, ZONAS_COMUNES } from '@/lib/reservas';
import { clienteDoServidor, pessoaLogada } from '@/lib/supabase/servidor';

export const metadata: Metadata = { title: es.cuenta.titulo };

type Texto = string | string[] | undefined;
type Props = { searchParams: Promise<{ aviso?: Texto; error?: Texto }> };

const t = es.cuenta;
const classeDoCampo = CLASE_DEL_CAMPO;

// Todos os fusos que o servidor conhece, fora os da lista de mais frequentes.
function outrasZonas(): string[] {
  const comuns = new Set<string>(ZONAS_COMUNES);
  try {
    return Intl.supportedValuesOf('timeZone').filter((zona) => !comuns.has(zona));
  } catch {
    return [];
  }
}

// "Mi cuenta": o nome, o fuso (que decide em que hora as aulas ao vivo aparecem) e a senha.
export default async function PaginaDaCuenta({ searchParams }: Props) {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  const { aviso, error } = await searchParams;
  const supabase = await clienteDoServidor();
  const { data: perfil } = await supabase.from('perfis').select('nome, fuso').eq('id', pessoa.id).maybeSingle();
  const guardado: unknown = perfil?.fuso;
  const fuso = zonaValida(guardado) ? guardado : 'Europe/Madrid';
  const agora = new Date();
  const outras = outrasZonas();
  // O fuso do cadastro aparece na lista mesmo que o servidor não o conheça pelo nome.
  const fora = !(ZONAS_COMUNES as readonly string[]).includes(fuso) && !outras.includes(fuso);

  const bom = typeof aviso === 'string' && aviso in t.avisos ? t.avisos[aviso as keyof typeof t.avisos] : null;
  const ruim = typeof error === 'string' && error in t.errores ? t.errores[error as keyof typeof t.errores] : null;

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-5 lg:gap-6">
      <h1 className={TITULO_DE_PAGINA}>{t.titulo}</h1>
      {bom ? <Aviso tipo="info">{bom}</Aviso> : null}
      {ruim ? <Aviso tipo="error">{ruim}</Aviso> : null}

      <Tarjeta>
        <h2 className={TITULO_DE_TARJETA}>{t.datos}</h2>
        <form action={guardarCuenta} className="mt-4 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nombre" className={CLASE_DEL_ROTULO}>
              {t.nombre}
            </label>
            <input id="nombre" name="nombre" type="text" defaultValue={typeof perfil?.nome === 'string' ? perfil.nome : ''} maxLength={120} autoComplete="name" className={classeDoCampo} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={CLASE_DEL_ROTULO}>{t.correo}</span>
            <p className="break-all text-base">{pessoa.email}</p>
            <p className="text-sm leading-normal text-apoio">{t.correoAyuda}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fuso" className={CLASE_DEL_ROTULO}>
              {t.zona}
            </label>
            <select id="fuso" name="fuso" defaultValue={fuso} aria-describedby="fuso-ayuda" className={classeDoCampo}>
              {fora ? <option value={fuso}>{rotuloDoFuso(fuso, agora)}</option> : null}
              <optgroup label={t.frecuentes}>
                {ZONAS_COMUNES.map((zona) => (
                  <option key={zona} value={zona}>
                    {rotuloDoFuso(zona, agora)}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t.otras}>
                {outras.map((zona) => (
                  <option key={zona} value={zona}>
                    {zona.replace(/_/g, ' ')}
                  </option>
                ))}
              </optgroup>
            </select>
            <p id="fuso-ayuda" className="text-sm leading-normal text-apoio">
              {t.zonaAyuda}
            </p>
          </div>
          <div>
            <Boton>{t.guardar}</Boton>
          </div>
        </form>
      </Tarjeta>

      <Tarjeta id="clave">
        <h2 className={TITULO_DE_TARJETA}>{t.clave}</h2>
        <form action={cambiarClave} className="mt-4 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nueva" className={CLASE_DEL_ROTULO}>
              {t.nueva}
            </label>
            <input id="nueva" name="nueva" type="password" minLength={8} autoComplete="new-password" className={classeDoCampo} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="repetida" className={CLASE_DEL_ROTULO}>
              {t.repetir}
            </label>
            <input id="repetida" name="repetida" type="password" minLength={8} autoComplete="new-password" className={classeDoCampo} />
          </div>
          <div>
            <Boton variante="secundario">{t.guardarClave}</Boton>
          </div>
        </form>
      </Tarjeta>

      {/* No celular e no tablet o «Salir» não cabe na faixa do topo: fica aqui. */}
      <form action={sair} className="lg:hidden">
        <Boton variante="secundario" className="w-full">
          {es.comum.salir}
        </Boton>
      </form>
    </div>
  );
}
