'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { corrigirEmail, criarPessoa, matricular, salvarMatricula, salvarNome } from '@/app/admin/alunos/acoes';
import { Botao, Caixa, Entrada, LinkBotao, Selecao } from '@/components/admin/ui';
import { ESTADO_INICIAL, type EstadoDoFormulario } from '@/lib/formulario';

// Formulários da tela de alunos: novo aluno, nome, e-mail e matrícula. Todos devolvem os erros
// campo a campo, sem perder o que foi digitado.

export type CursoDaLista = { id: string; rotulo: string };
export type MatriculaNoFormulario = { acesso_ate: string; inclui_conversacao: boolean; reservas_por_semana: string };

const MATRICULA_PADRAO: MatriculaNoFormulario = { acesso_ate: '', inclui_conversacao: true, reservas_por_semana: '2' };

function ErroGeral({ texto }: { texto?: string }) {
  return texto ? (
    <p role="alert" className="rounded-xl border border-perigo bg-cartao px-4 py-3 text-[15px] font-semibold text-perigo">
      {texto}
    </p>
  ) : null;
}

// Validade e conversação: os mesmos três campos ao matricular e ao editar. "prefixo" deixa os
// ids diferentes quando a tela tem mais de uma matrícula.
function CamposDaMatricula({ prefixo, estado, inicial }: { prefixo: string; estado: EstadoDoFormulario; inicial: MatriculaNoFormulario }) {
  const enviado = estado.vez > 0;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Entrada
        id={`${prefixo}acesso_ate`}
        nome="acesso_ate"
        type="date"
        rotulo="Acesso até (opcional)"
        ajuda="Em branco, o acesso não tem prazo. O dia escolhido ainda vale inteiro."
        defaultValue={enviado ? (estado.valores.acesso_ate ?? '') : inicial.acesso_ate}
        erro={estado.erros.acesso_ate}
      />
      <Entrada
        id={`${prefixo}reservas_por_semana`}
        nome="reservas_por_semana"
        rotulo="Reservas de conversação por semana"
        ajuda="Quantas aulas ao vivo a pessoa pode reservar em cada semana."
        defaultValue={enviado ? (estado.valores.reservas_por_semana ?? '') : inicial.reservas_por_semana}
        erro={estado.erros.reservas_por_semana}
        inputMode="numeric"
        maxLength={2}
      />
      <div className="sm:col-span-2">
        <Caixa
          id={`${prefixo}inclui_conversacao`}
          nome="inclui_conversacao"
          rotulo="Inclui as aulas de conversação ao vivo"
          ajuda="Desmarcada, a pessoa vê o curso, mas não reserva aulas ao vivo."
          defaultChecked={enviado ? estado.valores.inclui_conversacao === 'on' : inicial.inclui_conversacao}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Novo aluno
// ---------------------------------------------------------------------------

export function FormularioNovoAluno({ cursos }: { cursos: CursoDaLista[] }) {
  const [estado, acao, enviando] = useActionState(criarPessoa, ESTADO_INICIAL);
  // O curso é controlado pela tela para mostrar ou esconder os campos da matrícula.
  const [curso, setCurso] = useState(cursos[0]?.id ?? '');
  const erros = estado.erros;

  return (
    <form action={acao} noValidate data-vez={estado.vez} className="flex flex-col gap-5">
      <ErroGeral texto={erros.geral} />
      <div key={estado.vez} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Entrada id="nome" rotulo="Nome" defaultValue={estado.valores.nome ?? ''} erro={erros.nome} maxLength={120} autoComplete="off" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <Entrada
              id="email"
              type="email"
              rotulo="E-mail"
              ajuda="É com esse e-mail que a pessoa entra na plataforma."
              defaultValue={estado.valores.email ?? ''}
              erro={erros.email}
              maxLength={254}
              autoComplete="off"
              spellCheck={false}
            />
            {estado.valores.existente ? (
              <Link href={`/admin/alunos/${estado.valores.existente}`} className="text-[15px] font-semibold text-verde-link underline hover:text-verde">
                Abrir o cadastro dessa pessoa
              </Link>
            ) : null}
          </div>
        </div>
        <Selecao
          id="curso_id"
          rotulo="Matricular no curso"
          ajuda="O primeiro dia da trilha da pessoa começa a contar hoje."
          value={curso}
          onChange={(evento) => setCurso(evento.target.value)}
          erro={erros.curso_id}
        >
          <option value="">Não matricular agora (só cadastrar)</option>
          {cursos.map((item) => (
            <option key={item.id} value={item.id}>
              {item.rotulo}
            </option>
          ))}
        </Selecao>
        {curso !== '' ? <CamposDaMatricula prefixo="" estado={estado} inicial={MATRICULA_PADRAO} /> : null}
        <Caixa
          id="enviar_email"
          rotulo="Enviar agora o e-mail com o link para criar a senha"
          ajuda="O e-mail vai em espanhol. Sem ele, a pessoa pede o link sozinha na tela de entrada, em “¿Primer acceso?”."
          defaultChecked={estado.vez > 0 ? estado.valores.enviar_email === 'on' : true}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Botao disabled={enviando}>Cadastrar</Botao>
        <LinkBotao href="/admin/alunos" variante="secundario">
          Cancelar
        </LinkBotao>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Cadastro: nome e e-mail
// ---------------------------------------------------------------------------

export function FormularioDoNome({ id, nome }: { id: string; nome: string }) {
  const [estado, acao, enviando] = useActionState(salvarNome, ESTADO_INICIAL);
  return (
    <form action={acao} noValidate data-vez={estado.vez} className="flex flex-col gap-4">
      <ErroGeral texto={estado.erros.geral} />
      <input type="hidden" name="id" value={id} />
      <div key={estado.vez}>
        <Entrada id="nome" rotulo="Nome" defaultValue={estado.valores.nome ?? nome} erro={estado.erros.nome} maxLength={120} autoComplete="off" />
      </div>
      <div>
        <Botao variante="secundario" disabled={enviando}>
          Salvar nome
        </Botao>
      </div>
    </form>
  );
}

export function FormularioDoEmail({ id, email }: { id: string; email: string }) {
  const [estado, acao, enviando] = useActionState(corrigirEmail, ESTADO_INICIAL);
  return (
    <form action={acao} noValidate data-vez={estado.vez} className="flex flex-col gap-4">
      <ErroGeral texto={estado.erros.geral} />
      <input type="hidden" name="id" value={id} />
      <div key={estado.vez}>
        <Entrada
          id="email"
          type="email"
          rotulo="E-mail"
          ajuda="Ao trocar, a pessoa passa a entrar com o e-mail novo. A senha continua a mesma."
          defaultValue={estado.valores.email ?? email}
          erro={estado.erros.email}
          maxLength={254}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div>
        <Botao variante="secundario" disabled={enviando}>
          Trocar e-mail
        </Botao>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Matrícula
// ---------------------------------------------------------------------------

export function FormularioNovaMatricula({ alunoId, cursos }: { alunoId: string; cursos: CursoDaLista[] }) {
  const [estado, acao, enviando] = useActionState(matricular, ESTADO_INICIAL);
  return (
    <form action={acao} noValidate data-vez={estado.vez} className="flex flex-col gap-5">
      <ErroGeral texto={estado.erros.geral} />
      <input type="hidden" name="aluno_id" value={alunoId} />
      <div key={estado.vez} className="flex flex-col gap-5">
        <Selecao
          id="nova-curso_id"
          nome="curso_id"
          rotulo="Curso"
          ajuda="O primeiro dia da trilha da pessoa começa a contar hoje."
          defaultValue={estado.valores.curso_id ?? cursos[0]?.id ?? ''}
          erro={estado.erros.curso_id}
        >
          {cursos.map((item) => (
            <option key={item.id} value={item.id}>
              {item.rotulo}
            </option>
          ))}
        </Selecao>
        <CamposDaMatricula prefixo="nova-" estado={estado} inicial={MATRICULA_PADRAO} />
      </div>
      <div>
        <Botao disabled={enviando}>Matricular</Botao>
      </div>
    </form>
  );
}

export function FormularioDaMatricula({ id, curso, inicial }: { id: string; curso: string; inicial: MatriculaNoFormulario }) {
  const [estado, acao, enviando] = useActionState(salvarMatricula, ESTADO_INICIAL);
  return (
    <form action={acao} noValidate data-vez={estado.vez} aria-label={`Matrícula em ${curso}`} className="flex flex-col gap-5">
      <ErroGeral texto={estado.erros.geral} />
      <input type="hidden" name="id" value={id} />
      <div key={estado.vez}>
        <CamposDaMatricula prefixo={`m-${id}-`} estado={estado} inicial={inicial} />
      </div>
      <div>
        <Botao variante="secundario" disabled={enviando}>
          Salvar matrícula
        </Botao>
      </div>
    </form>
  );
}
