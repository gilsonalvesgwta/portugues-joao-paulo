'use client';

import { useActionState } from 'react';
import { salvarAula } from '@/app/admin/acoes';
import { Botao, Entrada, LinkBotao, Selecao } from '@/components/admin/ui';
import { ESTADO_INICIAL } from '@/lib/formulario';

export type AulaNoFormulario = {
  id: string;
  modulo_id: string;
  numero: string;
  titulo_pt: string;
  titulo_es: string;
  video_id: string;
  duracao: string;
};

export type GrupoDeModulos = { curso: string; modulos: { id: string; titulo: string }[] };

export function FormularioDaAula({ aula, grupos }: { aula: AulaNoFormulario; grupos: GrupoDeModulos[] }) {
  const [estado, acao, enviando] = useActionState(salvarAula, ESTADO_INICIAL);
  const valor = (campo: keyof AulaNoFormulario) => estado.valores[campo] ?? aula[campo];
  const erros = estado.erros;

  return (
    <form action={acao} noValidate className="flex flex-col gap-6">
      {erros.geral || erros.situacao ? (
        <p role="alert" className="rounded-xl border border-perigo bg-cartao px-4 py-3 text-[15px] font-semibold text-perigo">
          {erros.geral ?? erros.situacao}
        </p>
      ) : null}
      <input type="hidden" name="id" value={aula.id} />
      <div key={estado.vez} className="flex flex-col gap-6">
        <section className="flex flex-col gap-5">
          <h2 className="text-lg font-bold">Dados da aula</h2>
          <div className="grid gap-5 sm:grid-cols-[140px_1fr]">
            <Entrada
              id="numero"
              rotulo="Número"
              inputMode="numeric"
              defaultValue={valor('numero')}
              erro={erros.numero}
              maxLength={4}
            />
            <Selecao id="modulo_id" rotulo="Módulo" defaultValue={valor('modulo_id')} erro={erros.modulo_id}>
              {grupos.map((grupo) => (
                <optgroup key={grupo.curso} label={grupo.curso}>
                  {grupo.modulos.map((modulo) => (
                    <option key={modulo.id} value={modulo.id}>
                      {modulo.titulo}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Selecao>
          </div>
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
        </section>

        <section className="flex flex-col gap-5 border-t border-linha pt-6">
          <h2 className="text-lg font-bold">Vídeo</h2>
          <div className="grid gap-5 sm:grid-cols-[1fr_180px]">
            <Entrada
              id="video_id"
              rotulo="Código do vídeo"
              ajuda="Por enquanto, cole aqui o código do vídeo no serviço de vídeo. O envio do arquivo por esta tela entra em uma próxima etapa."
              defaultValue={valor('video_id')}
              erro={erros.video_id}
              maxLength={100}
              autoComplete="off"
              spellCheck={false}
            />
            <Entrada
              id="duracao"
              rotulo="Duração"
              ajuda="Minutos:segundos. Ex.: 12:30"
              defaultValue={valor('duracao')}
              erro={erros.duracao}
              maxLength={9}
              autoComplete="off"
            />
          </div>
        </section>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-linha pt-6">
        <Botao name="situacao" value="rascunho" variante="secundario" disabled={enviando}>
          Salvar como rascunho
        </Botao>
        <Botao name="situacao" value="publicado" disabled={enviando}>
          Salvar e publicar
        </Botao>
        <LinkBotao href="/admin/aulas" variante="discreto">
          Voltar sem salvar
        </LinkBotao>
      </div>
    </form>
  );
}
