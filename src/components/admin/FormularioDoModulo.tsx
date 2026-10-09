'use client';

import { useActionState } from 'react';
import { salvarModulo } from '@/app/admin/acoes';
import { Botao, Entrada, LinkBotao } from '@/components/admin/ui';
import { ESTADO_INICIAL } from '@/lib/formulario';

export type ModuloNoFormulario = { id: string; curso_id: string; titulo_pt: string; titulo_es: string };

export function FormularioDoModulo({ modulo }: { modulo: ModuloNoFormulario }) {
  const [estado, acao, enviando] = useActionState(salvarModulo, ESTADO_INICIAL);
  const valor = (campo: 'titulo_pt' | 'titulo_es') => estado.valores[campo] ?? modulo[campo];
  const erros = estado.erros;

  return (
    <form action={acao} noValidate className="flex flex-col gap-5">
      {erros.geral ? (
        <p role="alert" className="rounded-xl border border-perigo bg-cartao px-4 py-3 text-[15px] font-semibold text-perigo">
          {erros.geral}
        </p>
      ) : null}
      <input type="hidden" name="id" value={modulo.id} />
      <input type="hidden" name="curso_id" value={modulo.curso_id} />
      <div key={estado.vez} className="grid gap-5 sm:grid-cols-2">
        <Entrada id="titulo_pt" rotulo="Título em português" defaultValue={valor('titulo_pt')} erro={erros.titulo_pt} maxLength={160} />
        <Entrada
          id="titulo_es"
          rotulo="Título em espanhol"
          ajuda="É o que o aluno vê."
          defaultValue={valor('titulo_es')}
          erro={erros.titulo_es}
          maxLength={160}
          lang="es"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Botao disabled={enviando}>Salvar módulo</Botao>
        <LinkBotao href="/admin/cursos" variante="secundario">
          Cancelar
        </LinkBotao>
      </div>
    </form>
  );
}
