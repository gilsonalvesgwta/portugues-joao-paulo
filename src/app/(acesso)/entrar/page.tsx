import type { Metadata } from 'next';
import Link from 'next/link';
import { Aviso, BotaoPrincipal, Cabecalho, CampoDeCorreo, classeDoLink } from '@/components/acesso/campos';
import { CampoSenha } from '@/components/acesso/CampoSenha';
import { IconoLlave } from '@/components/aluno/iconos';
import { es } from '@/i18n/es';
import { entrar } from '../acoes';

export const metadata: Metadata = { title: es.entrar.titulo };

type Props = { searchParams: Promise<{ error?: string | string[] }> };

function mensagemDeErro(codigo: string | string[] | undefined): string | null {
  if (codigo === 'credenciales') return es.entrar.errores.credenciales;
  if (codigo === 'datos') return es.entrar.errores.datos;
  if (codigo === 'intentos') return es.entrar.errores.intentos;
  return null;
}

export default async function PaginaEntrar({ searchParams }: Props) {
  const erro = mensagemDeErro((await searchParams).error);

  return (
    <>
      <Cabecalho area={es.acesso.area} titulo={es.entrar.titulo} texto={es.entrar.texto} tituloOculto soNoComputador />
      <form action={entrar} className="flex flex-col gap-4 lg:gap-[18px]">
        {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
        <CampoDeCorreo rotulo={es.entrar.correoCorto} exemplo={es.entrar.correoEjemplo} />
        <CampoSenha
          rotulo={es.entrar.clave}
          exemplo={es.entrar.claveEjemplo}
          mostrar={es.entrar.mostrarClave}
          ocultar={es.entrar.ocultarClave}
          enlace={
            <Link href="/recuperar" className={`${classeDoLink} -my-3`}>
              <span className="lg:hidden">{es.entrar.olvideCorto}</span>
              <span className="hidden lg:inline">{es.entrar.olvide}</span>
            </Link>
          }
        />
        <BotaoPrincipal>{es.entrar.boton}</BotaoPrincipal>
      </form>
      <Link
        href="/primer-acceso"
        className="flex items-center gap-3.5 rounded-2xl border border-borda bg-papel px-4 py-3.5 text-texto no-underline transition-colors hover:border-verde lg:gap-4 lg:px-5 lg:py-[18px]"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-verde-suave text-verde">
          <IconoLlave />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-bold lg:text-base">{es.entrar.primeraVez}</span>
          <span className="text-[15px] font-semibold text-verde-link underline underline-offset-2 lg:text-base">{es.entrar.crearClave}</span>
        </span>
      </Link>
    </>
  );
}
