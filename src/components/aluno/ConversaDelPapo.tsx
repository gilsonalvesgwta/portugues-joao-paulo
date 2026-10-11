'use client';

import { useActionState, useEffect, useRef } from 'react';
import { enviar } from '@/app/(aluno)/papo/acoes';
import { es } from '@/i18n/es';
import { ESTADO_INICIAL_DO_PAPO, lerMensagem, MENSAGEM_MAX, type Autor } from '@/lib/papo';

const t = es.papo;

type Mensagem = { id: number; autor: Autor; texto: string };

// A conversa com o Papo: as mensagens, o campo para escrever e o botão de enviar. Enquanto o
// tutor responde, o que a pessoa enviou já aparece na tela e o botão fica parado.
export function ConversaDelPapo({ mensagens, puedeEscribir }: { mensagens: Mensagem[]; puedeEscribir: boolean }) {
  const [estado, acao, enviando] = useActionState(enviar, ESTADO_INICIAL_DO_PAPO);
  const fim = useRef<HTMLDivElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const enviado = useRef('');

  // A cada mensagem nova (ou enquanto o tutor escreve), a tela desce até o fim da conversa.
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'nearest' });
  }, [mensagens.length, enviando]);

  const erro = estado.erro !== null ? (t.errores[estado.erro as keyof typeof t.errores] ?? t.errores.fallo) : null;

  return (
    <div className="flex flex-col gap-4">
      <ol aria-label={t.conversacion} className="flex flex-col gap-3">
        {mensagens.length === 0 && !enviando ? (
          <li className="rounded-2xl bg-fundo px-4 py-3 text-base leading-normal text-apoio">{t.vacia}</li>
        ) : null}
        {mensagens.map((mensagem) => (
          <Burbuja key={mensagem.id} autor={mensagem.autor} texto={mensagem.texto} />
        ))}
        {enviando ? (
          <>
            {enviado.current !== '' ? <Burbuja autor="aluno" texto={enviado.current} /> : null}
            <li role="status" className="self-start rounded-2xl bg-fundo px-4 py-3 text-base text-apoio">
              {t.escribiendo}
            </li>
          </>
        ) : null}
      </ol>
      <div ref={fim} />

      {erro ? (
        <p role="alert" className="rounded-xl border border-perigo bg-cartao px-4 py-3 text-[15px] font-semibold text-perigo">
          {erro}
        </p>
      ) : null}

      {puedeEscribir ? (
        <form
          ref={formulario}
          action={acao}
          data-vez={estado.vez}
          onSubmit={() => {
            // O que a pessoa enviou aparece na conversa enquanto o tutor responde, já arrumado
            // do jeito que será guardado.
            const lida = lerMensagem(campo.current?.value);
            enviado.current = lida.ok ? lida.texto : '';
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mensaje" className="text-sm font-semibold">
              {t.tuMensaje}
            </label>
            <textarea
              key={estado.vez}
              ref={campo}
              id="mensaje"
              name="mensaje"
              required
              maxLength={MENSAGEM_MAX}
              rows={3}
              defaultValue={estado.texto}
              placeholder={t.ejemplo}
              aria-describedby="mensaje-ayuda"
              onKeyDown={(evento) => {
                // Ctrl+Enter (ou ⌘+Enter) envia; Enter sozinho só muda de linha.
                if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) {
                  evento.preventDefault();
                  formulario.current?.requestSubmit();
                }
              }}
              className="box-border min-h-24 w-full rounded-xl border border-borda-campo bg-cartao px-3.5 py-3 text-base leading-normal text-texto placeholder:text-apoio"
            />
            <p id="mensaje-ayuda" className="text-sm leading-normal text-apoio">
              {t.ayuda}
            </p>
          </div>
          <div>
            <button
              type="submit"
              disabled={enviando}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-verde bg-verde px-5 text-base font-bold text-white hover:bg-verde-link disabled:cursor-default disabled:opacity-50"
            >
              {enviando ? t.enviando : t.enviar}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Burbuja({ autor, texto }: { autor: Autor; texto: string }) {
  const delAlumno = autor === 'aluno';
  return (
    <li
      data-autor={autor}
      className={`flex max-w-[92%] flex-col gap-1 rounded-2xl px-4 py-3 sm:max-w-[80%] ${
        delAlumno ? 'self-end bg-verde text-white' : 'self-start border border-linha bg-cartao text-texto'
      }`}
    >
      <span className={`text-xs font-bold tracking-[0.1em] ${delAlumno ? 'text-white' : 'text-dourado-texto'}`}>
        {delAlumno ? t.tu.toUpperCase() : 'PAPO'}
      </span>
      {/* O texto do tutor é sempre texto: nunca vira HTML. As quebras de linha são mantidas. */}
      <span className="whitespace-pre-wrap break-words text-base leading-normal" lang={delAlumno ? undefined : 'pt-BR'}>
        {texto}
      </span>
    </li>
  );
}
