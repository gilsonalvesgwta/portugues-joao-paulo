import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { empezarDeNuevo } from '@/app/(aluno)/papo/acoes';
import { ConversaDelPapo } from '@/components/aluno/ConversaDelPapo';
import { Aviso, Boton, Tarjeta } from '@/components/aluno/ui';
import { es } from '@/i18n/es';
import { conversaAtual, situacaoDoPapo } from '@/lib/papo-servidor';
import { pessoaLogada } from '@/lib/supabase/servidor';

export const metadata: Metadata = { title: es.papo.titulo };

type Texto = string | string[] | undefined;
type Props = { searchParams: Promise<{ aviso?: Texto }> };

const t = es.papo;

// "Papo": o tutor com inteligência artificial. O aluno pratica português por escrito e recebe as
// correções explicadas em espanhol.
export default async function PaginaDelPapo({ searchParams }: Props) {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  const { aviso } = await searchParams;
  const situacao = await situacaoDoPapo();

  const cabecalho = (
    <header className="flex flex-col gap-1.5">
      <h1 className="font-titulo text-4xl font-bold leading-tight">{t.titulo}</h1>
      <p className="text-base leading-normal text-apoio">{t.texto}</p>
    </header>
  );

  if (!situacao.ligado || !situacao.liberado) {
    return (
      <div className="mx-auto flex max-w-[820px] flex-col gap-6">
        {cabecalho}
        <Tarjeta>
          <h2 className="text-xl font-bold">{situacao.ligado ? t.sinAcceso : t.apagado}</h2>
          <p className="mt-2 text-base leading-normal text-apoio">{situacao.ligado ? t.sinAccesoTexto : t.apagadoTexto}</p>
        </Tarjeta>
      </div>
    );
  }

  const conversa = await conversaAtual(pessoa.id);
  const restam = Math.max(situacao.limite - situacao.usadas, 0);

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-6">
      {cabecalho}
      {aviso === 'nueva' ? <Aviso tipo="info">{t.avisos.nueva}</Aviso> : null}
      {aviso === 'fallo' ? <Aviso tipo="error">{t.errores.fallo}</Aviso> : null}

      <Tarjeta className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p id="restantes" className="text-[15px] leading-normal text-apoio">
            {restam === 0 ? t.sinMensajes : restam === 1 ? t.teQuedaUno : `${t.teQuedan} ${restam} ${t.mensajesHoy}`}
          </p>
          {conversa.mensagens.length > 0 ? (
            <form action={empezarDeNuevo}>
              <Boton variante="secundario">{t.nueva}</Boton>
            </form>
          ) : null}
        </div>
        <ConversaDelPapo mensagens={conversa.mensagens} puedeEscribir={restam > 0} />
      </Tarjeta>

      <p className="text-sm leading-normal text-apoio">{t.nota}</p>
    </div>
  );
}
