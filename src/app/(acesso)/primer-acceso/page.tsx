import type { Metadata } from 'next';
import { Aviso, BotaoPrincipal, Cabecalho, CampoDeCorreo, LinkDeTexto } from '@/components/acesso/campos';
import { es } from '@/i18n/es';
import { pedirPrimeiroAcesso } from '../acoes';

export const metadata: Metadata = { title: es.primerAcceso.titulo };

type Props = { searchParams: Promise<{ error?: string | string[]; enviado?: string | string[] }> };

export default async function PaginaPrimeiroAcesso({ searchParams }: Props) {
  const { error, enviado } = await searchParams;

  return (
    <>
      <Cabecalho area={es.acesso.area} titulo={es.primerAcceso.titulo} texto={es.primerAcceso.texto} />
      <form action={pedirPrimeiroAcesso} className="flex flex-col gap-5">
        {enviado ? <Aviso tipo="ok">{es.enlace.enviado}</Aviso> : null}
        {error === 'correo' ? <Aviso tipo="erro">{es.enlace.correoInvalido}</Aviso> : null}
        <CampoDeCorreo rotulo={es.entrar.correo} exemplo={es.entrar.correoEjemplo} />
        <BotaoPrincipal>{es.primerAcceso.boton}</BotaoPrincipal>
      </form>
      <div className="flex justify-center">
        <LinkDeTexto href="/entrar">{es.acesso.volver}</LinkDeTexto>
      </div>
    </>
  );
}
