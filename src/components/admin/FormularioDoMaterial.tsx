'use client';

import { useActionState } from 'react';
import { salvarMaterial } from '@/app/admin/acoes';
import { Botao, Entrada, LinkBotao } from '@/components/admin/ui';
import { ESTADO_INICIAL } from '@/lib/formulario';

export type MaterialNoFormulario = {
  id: string;
  aula_id: string;
  titulo_pt: string;
  titulo_es: string;
  descricao_es: string;
  link: string;
};

export function FormularioDoMaterial({ material }: { material: MaterialNoFormulario }) {
  const [estado, acao, enviando] = useActionState(salvarMaterial, ESTADO_INICIAL);
  const valor = (campo: 'titulo_pt' | 'titulo_es' | 'descricao_es' | 'link') => estado.valores[campo] ?? material[campo];
  const erros = estado.erros;

  return (
    <form action={acao} noValidate data-vez={estado.vez} className="flex flex-col gap-5">
      {erros.geral ? (
        <p role="alert" className="rounded-xl border border-perigo bg-cartao px-4 py-3 text-[15px] font-semibold text-perigo">
          {erros.geral}
        </p>
      ) : null}
      <input type="hidden" name="id" value={material.id} />
      <input type="hidden" name="aula_id" value={material.aula_id} />
      <div key={estado.vez} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
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
        <Entrada
          id="link"
          rotulo="Link do material"
          ajuda="Guarde o arquivo no Google Drive (ou parecido), deixe o compartilhamento como “Qualquer pessoa com o link” e cole o link aqui."
          placeholder="https://drive.google.com/..."
          defaultValue={valor('link')}
          erro={erros.link}
          maxLength={500}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
        />
        <Entrada
          id="descricao_es"
          rotulo="Descrição em espanhol (opcional)"
          ajuda="Uma linha dizendo o que é o material. Ex.: Lista de verbos para imprimir."
          defaultValue={valor('descricao_es')}
          erro={erros.descricao_es}
          maxLength={300}
          lang="es"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Botao disabled={enviando}>Salvar material</Botao>
        <LinkBotao href={`/admin/aulas/${material.aula_id}#materiais`} variante="secundario">
          Cancelar
        </LinkBotao>
      </div>
    </form>
  );
}
