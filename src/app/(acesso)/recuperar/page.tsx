import type { Metadata } from 'next';
import { BotaoPrincipal, Cabecalho, CampoDeCorreo, LinkDeTexto } from '@/components/acesso/campos';
import { es } from '@/i18n/es';
import { pedirNovaSenha } from '../acoes';

export const metadata: Metadata = { title: es.recuperar.titulo };

export default function PaginaRecuperar() {
  return (
    <>
      <Cabecalho area={es.acesso.area} titulo={es.recuperar.titulo} texto={es.recuperar.texto} />
      <form action={pedirNovaSenha} className="flex flex-col gap-5">
        <CampoDeCorreo rotulo={es.entrar.correo} exemplo={es.entrar.correoEjemplo} />
        <BotaoPrincipal>{es.recuperar.boton}</BotaoPrincipal>
      </form>
      <div className="flex justify-center">
        <LinkDeTexto href="/entrar">{es.acesso.volver}</LinkDeTexto>
      </div>
    </>
  );
}
