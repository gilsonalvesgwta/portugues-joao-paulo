'use client';

import { useActionState } from 'react';
import { salvarCurso } from '@/app/admin/acoes';
import { Botao, Entrada, LinkBotao, Selecao } from '@/components/admin/ui';
import { ESTADO_INICIAL } from '@/lib/formulario';

export type CursoNoFormulario = {
  id: string;
  titulo_pt: string;
  titulo_es: string;
  tipo: string;
  modo: string;
  situacao: string;
};

export function FormularioDoCurso({ curso }: { curso: CursoNoFormulario }) {
  const [estado, acao, enviando] = useActionState(salvarCurso, ESTADO_INICIAL);
  const valor = (campo: keyof CursoNoFormulario) => estado.valores[campo] ?? curso[campo];
  const erros = estado.erros;

  return (
    <form action={acao} noValidate className="flex flex-col gap-5">
      {erros.geral ? (
        <p role="alert" className="rounded-xl border border-perigo bg-cartao px-4 py-3 text-[15px] font-semibold text-perigo">
          {erros.geral}
        </p>
      ) : null}
      <input type="hidden" name="id" value={curso.id} />
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
        <div className="grid gap-5 sm:grid-cols-3">
          <Selecao
            id="tipo"
            rotulo="Tipo"
            ajuda="Principal: o curso que a compra libera. Complementar: extra, aberto a todo aluno com matrícula ativa."
            defaultValue={valor('tipo')}
            erro={erros.tipo}
          >
            <option value="principal">Principal</option>
            <option value="complementar">Complementar</option>
          </Selecao>
          <Selecao
            id="modo"
            rotulo="Como o aluno avança"
            ajuda="Livre: abre qualquer aula. Em sequência: uma aula de cada vez."
            defaultValue={valor('modo')}
            erro={erros.modo}
          >
            <option value="livre">Livre</option>
            <option value="sequencial">Em sequência</option>
          </Selecao>
          <Selecao
            id="situacao"
            rotulo="Situação"
            ajuda="Em rascunho, nenhum aluno vê o curso."
            defaultValue={valor('situacao')}
            erro={erros.situacao}
          >
            <option value="rascunho">Rascunho</option>
            <option value="publicado">Publicado</option>
          </Selecao>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Botao disabled={enviando}>Salvar curso</Botao>
        <LinkBotao href="/admin/cursos" variante="secundario">
          Cancelar
        </LinkBotao>
      </div>
    </form>
  );
}
