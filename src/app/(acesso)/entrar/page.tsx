import type { Metadata } from 'next';
import Link from 'next/link';
import { BotaoPrincipal, Cabecalho, CampoDeCorreo, LinkDeTexto } from '@/components/acesso/campos';
import { CampoSenha } from '@/components/acesso/CampoSenha';
import { es } from '@/i18n/es';
import { entrar } from '../acoes';

export const metadata: Metadata = { title: es.entrar.titulo };

export default function PaginaEntrar() {
  return (
    <>
      <Cabecalho area={es.acesso.area} titulo={es.entrar.titulo} />
      <form action={entrar} className="flex flex-col gap-5">
        <CampoDeCorreo rotulo={es.entrar.correo} exemplo={es.entrar.correoEjemplo} />
        <CampoSenha
          rotulo={es.entrar.clave}
          exemplo={es.entrar.claveEjemplo}
          mostrar={es.entrar.mostrarClave}
          ocultar={es.entrar.ocultarClave}
        />
        <BotaoPrincipal>{es.entrar.boton}</BotaoPrincipal>
        <Link
          href="/primer-acceso"
          className="flex min-h-[52px] items-center justify-center gap-2.5 rounded-[14px] border border-verde bg-cartao px-4 py-2 text-center text-[15px] font-semibold text-verde hover:bg-verde-suave"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="8" cy="15" r="4" />
            <path d="M11 12l9-9" />
            <path d="M16 7l3 3" />
          </svg>
          <span>{es.entrar.primerAcceso}</span>
        </Link>
      </form>
      <div className="flex justify-center">
        <LinkDeTexto href="/recuperar">{es.entrar.olvide}</LinkDeTexto>
      </div>
    </>
  );
}
