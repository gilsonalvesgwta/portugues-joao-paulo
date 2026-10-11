'use client';

import { useActionState } from 'react';
import { salvarConfiguracoes, salvarTema, salvarTurma } from '@/app/admin/conversacao/acoes';
import { AreaDeTexto, Botao, Entrada, LinkBotao, Selecao } from '@/components/admin/ui';
import { NIVEIS, NOME_DO_NIVEL, type Configuracoes } from '@/lib/conversacao';
import { ESTADO_INICIAL } from '@/lib/formulario';

// Formulários da conversação: tema, turma e regras de reserva. Todos devolvem os erros campo a
// campo, sem perder o que foi digitado.

function ErroGeral({ texto }: { texto?: string }) {
  return texto ? (
    <p role="alert" className="rounded-xl border border-perigo bg-cartao px-4 py-3 text-[15px] font-semibold text-perigo">
      {texto}
    </p>
  ) : null;
}

// ---------------------------------------------------------------------------
// Tema
// ---------------------------------------------------------------------------

export type TemaNoFormulario = { id: string; titulo_es: string; nivel: string; descricao_es: string; aprendizados: string; material: string };

export function FormularioDoTema({ tema }: { tema: TemaNoFormulario }) {
  const [estado, acao, enviando] = useActionState(salvarTema, ESTADO_INICIAL);
  const valor = (campo: 'titulo_es' | 'nivel' | 'descricao_es' | 'aprendizados' | 'material') => estado.valores[campo] ?? tema[campo];
  const erros = estado.erros;

  return (
    <form action={acao} noValidate data-vez={estado.vez} className="flex flex-col gap-5">
      <ErroGeral texto={erros.geral} />
      <input type="hidden" name="id" value={tema.id} />
      <div key={estado.vez} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <Entrada
            id="titulo_es"
            rotulo="Título do tema (em espanhol)"
            ajuda="É o que o aluno vê na agenda. Ex.: En el restaurante."
            defaultValue={valor('titulo_es')}
            erro={erros.titulo_es}
            maxLength={120}
            lang="es"
          />
          <Selecao id="nivel" rotulo="Nível" defaultValue={valor('nivel')} erro={erros.nivel}>
            {NIVEIS.map((nivel) => (
              <option key={nivel} value={nivel}>
                {NOME_DO_NIVEL[nivel]}
              </option>
            ))}
          </Selecao>
        </div>
        <AreaDeTexto
          id="descricao_es"
          rotulo="Descrição (em espanhol, opcional)"
          ajuda="Uma ou duas frases sobre a aula."
          defaultValue={valor('descricao_es')}
          erro={erros.descricao_es}
          maxLength={600}
          lang="es"
        />
        <AreaDeTexto
          id="aprendizados"
          rotulo="O que o aluno vai aprender (em espanhol, opcional)"
          ajuda="Um item por linha, até 8. Ex.: Vocabulario práctico."
          defaultValue={valor('aprendizados')}
          erro={erros.aprendizados}
          lang="es"
        />
        <Entrada
          id="material"
          rotulo="Material da aula (link, opcional)"
          ajuda="Um PDF no Google Drive ou parecido. O aluno recebe o link ao reservar."
          placeholder="https://..."
          defaultValue={valor('material')}
          erro={erros.material}
          maxLength={500}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Botao disabled={enviando}>Salvar tema</Botao>
        <LinkBotao href="/admin/conversacao/temas" variante="secundario">
          Cancelar
        </LinkBotao>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Turma
// ---------------------------------------------------------------------------

export type TurmaNoFormulario = { id: string; tema_id: string; data: string; hora: string; duracao_min: string; vagas: string; meet_url: string };

type PropsDaTurma = {
  turma: TurmaNoFormulario;
  temas: { id: string; rotulo: string }[];
  // Com gente inscrita, o tema, a data e a hora não mudam mais.
  travada: boolean;
};

export function FormularioDaTurma({ turma, temas, travada }: PropsDaTurma) {
  const [estado, acao, enviando] = useActionState(salvarTurma, ESTADO_INICIAL);
  const valor = (campo: 'tema_id' | 'data' | 'hora' | 'duracao_min' | 'vagas' | 'meet_url') => estado.valores[campo] ?? turma[campo];
  const erros = estado.erros;

  return (
    <form action={acao} noValidate data-vez={estado.vez} className="flex flex-col gap-5">
      <ErroGeral texto={erros.geral} />
      <input type="hidden" name="id" value={turma.id} />
      {travada ? <input type="hidden" name="tema_id" value={turma.tema_id} /> : null}
      <div key={estado.vez} className="flex flex-col gap-5">
        {travada ? null : (
          <>
            <Selecao id="tema_id" rotulo="Tema" defaultValue={valor('tema_id')} erro={erros.tema_id}>
              {temas.map((tema) => (
                <option key={tema.id} value={tema.id}>
                  {tema.rotulo}
                </option>
              ))}
            </Selecao>
            <div className="grid gap-5 sm:grid-cols-2">
              <Entrada id="data" type="date" rotulo="Data" defaultValue={valor('data')} erro={erros.data} />
              <Entrada id="hora" type="time" rotulo="Hora (horário de Brasília)" defaultValue={valor('hora')} />
            </div>
          </>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Entrada
            id="duracao_min"
            rotulo="Duração em minutos"
            defaultValue={valor('duracao_min')}
            erro={erros.duracao_min}
            inputMode="numeric"
            maxLength={3}
          />
          <Entrada id="vagas" rotulo="Vagas" defaultValue={valor('vagas')} erro={erros.vagas} inputMode="numeric" maxLength={3} />
        </div>
        <Entrada
          id="meet_url"
          rotulo="Link da sala (Google Meet)"
          ajuda="Crie a reunião no Google Meet e cole o link aqui. É o mesmo para todos da turma e só chega a quem reservar."
          placeholder="https://meet.google.com/..."
          defaultValue={valor('meet_url')}
          erro={erros.meet_url}
          maxLength={500}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Botao disabled={enviando}>{turma.id ? 'Salvar turma' : 'Criar turma'}</Botao>
        <LinkBotao href="/admin/conversacao" variante="secundario">
          {turma.id ? 'Voltar' : 'Cancelar'}
        </LinkBotao>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Regras de reserva (só o administrador)
// ---------------------------------------------------------------------------

export function FormularioDasRegras({ regras }: { regras: Configuracoes }) {
  const [estado, acao, enviando] = useActionState(salvarConfiguracoes, ESTADO_INICIAL);
  const valor = (campo: keyof Configuracoes) => estado.valores[campo] ?? String(regras[campo]);
  const erros = estado.erros;

  return (
    <form action={acao} noValidate data-vez={estado.vez} className="flex flex-col gap-5">
      <ErroGeral texto={erros.geral} />
      <div key={estado.vez} className="grid gap-5 lg:grid-cols-3">
        <Entrada
          id="agenda_janela_dias"
          rotulo="Dias de agenda que o aluno vê"
          ajuda="O aluno reserva aulas dos próximos dias, até este limite."
          defaultValue={valor('agenda_janela_dias')}
          erro={erros.agenda_janela_dias}
          inputMode="numeric"
          maxLength={2}
        />
        <Entrada
          id="reserva_fecha_min_antes"
          rotulo="Reserva fecha (minutos antes)"
          ajuda="Faltando menos que isso para a aula, não dá mais para reservar."
          defaultValue={valor('reserva_fecha_min_antes')}
          erro={erros.reserva_fecha_min_antes}
          inputMode="numeric"
          maxLength={4}
        />
        <Entrada
          id="cancelamento_min_antes"
          rotulo="Cancelamento até (minutos antes)"
          ajuda="Depois disso o aluno não cancela mais, e a reserva conta na semana."
          defaultValue={valor('cancelamento_min_antes')}
          erro={erros.cancelamento_min_antes}
          inputMode="numeric"
          maxLength={5}
        />
      </div>
      <div>
        <Botao variante="secundario" disabled={enviando}>
          Salvar regras
        </Botao>
      </div>
    </form>
  );
}
