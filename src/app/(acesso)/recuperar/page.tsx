import type { Metadata } from 'next';
import { Aviso, BotaoPrincipal, Cabecalho, CampoDeCorreo, LinkDeTexto } from '@/components/acesso/campos';
import { es } from '@/i18n/es';
import { pedirNovaSenha } from '../acoes';

export const metadata: Metadata = { title: es.recuperar.titulo };

type Props = { searchParams: Promise<{ error?: string | string[]; enviado?: string | string[] }> };

export default async function PaginaRecuperar({ searchParams }: Props) {
  const { error, enviado } = await searchParams;

  return (
    <>
      <Cabecalho area={es.acesso.area} titulo={es.recuperar.titulo} texto={es.recuperar.texto} />
      <form action={pedirNovaSenha} className="flex flex-col gap-5">
        {enviado ? <Aviso tipo="ok">{es.enlace.enviado}</Aviso> : null}
        {error === 'correo' ? <Aviso tipo="erro">{es.enlace.correoInvalido}</Aviso> : null}
        {error === 'enlace' ? <Aviso tipo="erro">{es.enlace.invalido}</Aviso> : null}
        <CampoDeCorreo rotulo={es.entrar.correo} exemplo={es.entrar.correoEjemplo} />
        <BotaoPrincipal>{es.recuperar.boton}</BotaoPrincipal>
      </form>
      <div className="flex justify-center">
        <LinkDeTexto href="/entrar">{es.acesso.volver}</LinkDeTexto>
      </div>
    </>
  );
}
