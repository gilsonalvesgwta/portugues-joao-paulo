import type { Metadata } from 'next';
import { BotaoPrincipal, Cabecalho, CampoDeCorreo, LinkDeTexto } from '@/components/acesso/campos';
import { es } from '@/i18n/es';
import { pedirPrimeiroAcesso } from '../acoes';

export const metadata: Metadata = { title: es.primerAcceso.titulo };

export default function PaginaPrimeiroAcesso() {
  return (
    <>
      <Cabecalho area={es.acesso.area} titulo={es.primerAcceso.titulo} texto={es.primerAcceso.texto} />
      <form action={pedirPrimeiroAcesso} className="flex flex-col gap-5">
        <CampoDeCorreo rotulo={es.entrar.correo} exemplo={es.entrar.correoEjemplo} />
        <BotaoPrincipal>{es.primerAcceso.boton}</BotaoPrincipal>
      </form>
      <div className="flex justify-center">
        <LinkDeTexto href="/entrar">{es.acesso.volver}</LinkDeTexto>
      </div>
    </>
  );
}
