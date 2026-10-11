'use client';

import { useActionState } from 'react';
import { salvarTarefa } from '@/app/admin/acoes';
import { AreaDeTexto, Botao, Entrada, LinkBotao, Selecao } from '@/components/admin/ui';
import { ESTADO_INICIAL } from '@/lib/formulario';

export type TarefaNoFormulario = {
  id: string;
  curso_id: string;
  aula_id: string;
  titulo_es: string;
  instrucao_es: string;
  link: string;
};

type Props = { tarefa: TarefaNoFormulario; aulas: { id: string; rotulo: string }[] };

export function FormularioDaTarefa({ tarefa, aulas }: Props) {
  const [estado, acao, enviando] = useActionState(salvarTarefa, ESTADO_INICIAL);
  const valor = (campo: 'aula_id' | 'titulo_es' | 'instrucao_es' | 'link') => estado.valores[campo] ?? tarefa[campo];
  const erros = estado.erros;

  return (
    <form action={acao} noValidate data-vez={estado.vez} className="flex flex-col gap-5">
      {erros.geral ? (
        <p role="alert" className="rounded-xl border border-perigo bg-cartao px-4 py-3 text-[15px] font-semibold text-perigo">
          {erros.geral}
        </p>
      ) : null}
      <input type="hidden" name="id" value={tarefa.id} />
      <input type="hidden" name="curso_id" value={tarefa.curso_id} />
      <div key={estado.vez} className="flex flex-col gap-5">
        <Entrada
          id="titulo_es"
          rotulo="Título (em espanhol)"
          ajuda="É o que o aluno vê. Ex.: Escribe cinco frases con el verbo ser."
          defaultValue={valor('titulo_es')}
          erro={erros.titulo_es}
          maxLength={160}
          lang="es"
        />
        <AreaDeTexto
          id="instrucao_es"
          rotulo="O que o aluno deve fazer (em espanhol)"
          ajuda="Explique o passo a passo. Deixe uma linha em branco entre os parágrafos."
          defaultValue={valor('instrucao_es')}
          erro={erros.instrucao_es}
          maxLength={2000}
          lang="es"
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Selecao
            id="aula_id"
            rotulo="Aula ligada (opcional)"
            ajuda="Se a tarefa é sobre uma aula, escolha qual. Ela aparece junto dessa aula."
            defaultValue={valor('aula_id')}
            erro={erros.aula_id}
          >
            <option value="">Nenhuma: vale para o curso todo</option>
            {aulas.map((aula) => (
              <option key={aula.id} value={aula.id}>
                {aula.rotulo}
              </option>
            ))}
          </Selecao>
          <Entrada
            id="link"
            rotulo="Link (opcional)"
            ajuda="Um arquivo no Google Drive, um formulário ou um site que o aluno precisa abrir."
            placeholder="https://..."
            defaultValue={valor('link')}
            erro={erros.link}
            maxLength={500}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Botao disabled={enviando}>Salvar tarefa</Botao>
        <LinkBotao href={`/admin/tarefas?curso=${tarefa.curso_id}`} variante="secundario">
          Cancelar
        </LinkBotao>
      </div>
    </form>
  );
}
