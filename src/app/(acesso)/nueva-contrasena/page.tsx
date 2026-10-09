import type { Metadata } from 'next';
import { Aviso, BotaoPrincipal, Cabecalho } from '@/components/acesso/campos';
import { CampoSenha } from '@/components/acesso/CampoSenha';
import { es } from '@/i18n/es';
import { definirSenha } from '../acoes';

export const metadata: Metadata = { title: es.nuevaClave.titulo };

type Props = { searchParams: Promise<{ error?: string | string[] }> };

function mensagemDeErro(codigo: string | string[] | undefined): string | null {
  if (codigo === 'corta') return es.nuevaClave.errores.corta;
  if (codigo === 'distintas') return es.nuevaClave.errores.distintas;
  if (codigo === 'fallo') return es.nuevaClave.errores.fallo;
  return null;
}

// Só abre para quem acabou de confirmar o link do e-mail ou já está logado (o proxy garante).
export default async function PaginaNovaSenha({ searchParams }: Props) {
  const erro = mensagemDeErro((await searchParams).error);

  return (
    <>
      <Cabecalho area={es.acesso.area} titulo={es.nuevaClave.titulo} texto={es.nuevaClave.texto} />
      <form action={definirSenha} className="flex flex-col gap-5">
        {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
        <CampoSenha
          id="nueva"
          autoCompletar="new-password"
          rotulo={es.nuevaClave.nueva}
          exemplo={es.entrar.claveEjemplo}
          mostrar={es.entrar.mostrarClave}
          ocultar={es.entrar.ocultarClave}
        />
        <CampoSenha
          id="repetida"
          autoCompletar="new-password"
          rotulo={es.nuevaClave.repetir}
          exemplo={es.entrar.claveEjemplo}
          mostrar={es.entrar.mostrarClave}
          ocultar={es.entrar.ocultarClave}
        />
        <BotaoPrincipal>{es.nuevaClave.boton}</BotaoPrincipal>
      </form>
    </>
  );
}
