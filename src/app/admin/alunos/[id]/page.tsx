import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { enviarAcesso, mudarAcesso, mudarPapel } from '@/app/admin/alunos/acoes';
import {
  FormularioDaMatricula,
  FormularioDoEmail,
  FormularioDoNome,
  FormularioNovaMatricula,
} from '@/components/admin/FormulariosDoAluno';
import { AvisoDaPagina, Botao, Cartao, Etiqueta, Selecao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { ativos, carregarConteudo } from '@/lib/admin/dados';
import { exigirAdmin } from '@/lib/admin/guarda';
import { carregarFicha, rotuloDoCurso } from '@/lib/admin/pessoas';
import {
  acessoDaMatricula,
  dataEHora,
  dataPorExtenso,
  diaEmBrasilia,
  lerPapel,
  NOME_DO_ACESSO,
  NOME_DO_PAPEL,
  PAPEIS,
  type Acesso,
} from '@/lib/alunos';
import { ehUuid } from '@/lib/conteudo';

export const metadata: Metadata = { title: 'Cadastro da pessoa' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string | string[] }> };

const TOM_DO_ACESSO: Record<Acesso, 'verde' | 'neutro' | 'aviso'> = {
  ativa: 'verde',
  vencida: 'aviso',
  suspensa: 'aviso',
  encerrada: 'neutro',
};

const MOTIVO_DA_FALHA: Record<string, string> = {
  configuracao: 'o envio de e-mail não está configurado',
  senha: 'o servidor de e-mail recusou o usuário ou a senha',
  conexao: 'não houve conexão com o servidor de e-mail',
  recusado: 'o servidor de e-mail recusou a mensagem',
};

export default async function PaginaDaPessoa({ params, searchParams }: Props) {
  const eu = await exigirAdmin();
  const { id } = await params;
  const { aviso } = await searchParams;
  if (!ehUuid(id)) redirect('/admin/alunos?aviso=nao_encontrado');

  const [ficha, conteudo] = await Promise.all([carregarFicha(id), carregarConteudo()]);
  if (!ficha) redirect('/admin/alunos?aviso=nao_encontrado');
  const { perfil, matriculas, ultimoAcesso, envios } = ficha;
  const papel = lerPapel(perfil.papel) ?? 'aluno';

  const agora = new Date();
  const cursoPorId = new Map(conteudo.cursos.map((curso) => [curso.id, curso]));
  const matriculados = new Set(matriculas.map((matricula) => matricula.curso_id));
  const cursosLivres = ativos(conteudo.cursos)
    .filter((curso) => !matriculados.has(curso.id))
    .map((curso) => ({ id: curso.id, rotulo: rotuloDoCurso(curso) }));

  return (
    <>
      <Trilha href="/admin/alunos" rotulo="Alunos" />
      <TituloDaPagina titulo={perfil.nome || 'Sem nome'} texto={`${perfil.email} · cadastro feito em ${dataPorExtenso(perfil.criado_em)}`}>
        {papel !== 'aluno' ? <Etiqueta tom="aviso">{NOME_DO_PAPEL[papel]}</Etiqueta> : null}
      </TituloDaPagina>
      <AvisoDaPagina aviso={avisoDe(aviso)} />

      <Cartao>
        <h2 className="text-lg font-bold">Entrada na plataforma</h2>
        <p className="mt-2 text-[15px] leading-normal text-apoio">
          {ultimoAcesso === undefined
            ? 'Não foi possível consultar quando esta pessoa entrou pela última vez.'
            : ultimoAcesso === null
              ? 'Esta pessoa ainda não entrou na plataforma: falta criar a senha pelo link do e-mail.'
              : `Entrou pela última vez em ${dataEHora(ultimoAcesso)} (horário de Brasília).`}
        </p>
        <form action={enviarAcesso} className="mt-4 flex flex-col items-start gap-3">
          <input type="hidden" name="id" value={perfil.id} />
          <Botao variante="secundario">Enviar link de acesso por e-mail</Botao>
          <p className="text-[13px] leading-normal text-apoio">
            O link serve para criar a senha no primeiro acesso e para trocar uma senha esquecida. Vale uma vez só.
          </p>
        </form>
        {envios.length > 0 ? (
          <div className="mt-4 border-t border-linha pt-4">
            <h3 className="text-sm font-semibold">Últimos e-mails de acesso</h3>
            <ul className="mt-2 flex flex-col gap-1 text-[15px]">
              {envios.map((envio) => (
                <li key={envio.id}>
                  {dataEHora(envio.agendada_para)} —{' '}
                  {envio.enviada_em !== null ? (
                    'enviado'
                  ) : (
                    <span className="font-semibold text-perigo">
                      não saiu{envio.erro && MOTIVO_DA_FALHA[envio.erro] ? `: ${MOTIVO_DA_FALHA[envio.erro]}` : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Cartao>

      <Cartao>
        <h2 id="matriculas" className="text-lg font-bold">
          Matrículas
        </h2>
        {matriculas.length === 0 ? (
          <p className="mt-2 text-[15px] leading-normal text-apoio">Esta pessoa ainda não tem matrícula: não vê nenhum curso.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-5">
            {matriculas.map((matricula) => {
              const curso = cursoPorId.get(matricula.curso_id);
              const titulo = curso ? rotuloDoCurso(curso) : 'Curso não encontrado';
              const acesso = acessoDaMatricula(matricula, agora);
              return (
                <li key={matricula.id} className="flex flex-col gap-4 rounded-xl border border-linha p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <h3 className="text-base font-bold">{titulo}</h3>
                      <p className="text-sm leading-normal text-apoio">
                        {matricula.origem === 'greenn' ? 'Veio da compra na Greenn' : 'Feita pela administração'} · começou em{' '}
                        {dataPorExtenso(matricula.inicio)} ·{' '}
                        {matricula.expira_em === null ? 'sem prazo' : `acesso até ${dataPorExtenso(matricula.expira_em)}`}
                      </p>
                    </div>
                    <Etiqueta tom={TOM_DO_ACESSO[acesso]}>{NOME_DO_ACESSO[acesso]}</Etiqueta>
                  </div>
                  <FormularioDaMatricula
                    key={matricula.atualizado_em}
                    id={matricula.id}
                    curso={titulo}
                    inicial={{
                      acesso_ate: matricula.expira_em === null ? '' : diaEmBrasilia(matricula.expira_em),
                      inclui_conversacao: matricula.inclui_conversacao,
                      reservas_por_semana: String(matricula.reservas_por_semana),
                    }}
                  />
                  <form action={mudarAcesso} className="border-t border-linha pt-4">
                    <input type="hidden" name="id" value={matricula.id} />
                    <input type="hidden" name="mudanca" value={matricula.situacao === 'ativa' ? 'bloquear' : 'liberar'} />
                    <Botao variante="secundario" aria-label={`${matricula.situacao === 'ativa' ? 'Bloquear' : 'Liberar'} o acesso a ${titulo}`}>
                      {matricula.situacao === 'ativa' ? 'Bloquear o acesso' : 'Liberar o acesso'}
                    </Botao>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        {cursosLivres.length > 0 ? (
          <div className="mt-6 border-t border-linha pt-5">
            <h3 className="text-base font-bold">Matricular em um curso</h3>
            <div className="mt-4">
              <FormularioNovaMatricula key={matriculas.length} alunoId={perfil.id} cursos={cursosLivres} />
            </div>
          </div>
        ) : null}
      </Cartao>

      <Cartao>
        <h2 className="text-lg font-bold">Cadastro</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <FormularioDoNome key={`nome-${perfil.atualizado_em}`} id={perfil.id} nome={perfil.nome} />
          <FormularioDoEmail key={`email-${perfil.atualizado_em}`} id={perfil.id} email={perfil.email} />
        </div>
      </Cartao>

      <Cartao>
        <h2 className="text-lg font-bold">Papel</h2>
        {perfil.id === eu.id ? (
          <p className="mt-2 text-[15px] leading-normal text-apoio">
            Você é {NOME_DO_PAPEL[papel].toLowerCase()}. Ninguém muda o próprio papel: assim a plataforma nunca fica sem
            administrador.
          </p>
        ) : (
          <form action={mudarPapel} className="mt-3 flex flex-col gap-4">
            <input type="hidden" name="id" value={perfil.id} />
            <div className="w-full sm:w-80">
              <Selecao
                key={papel}
                id="papel"
                rotulo="O que esta pessoa pode fazer"
                ajuda="Aluno: assiste às aulas. Professor: edita o conteúdo. Administrador: além do conteúdo, cuida de alunos e pagamentos."
                defaultValue={papel}
              >
                {PAPEIS.map((item) => (
                  <option key={item} value={item}>
                    {NOME_DO_PAPEL[item]}
                  </option>
                ))}
              </Selecao>
            </div>
            <div>
              <Botao variante="secundario">Salvar papel</Botao>
            </div>
          </form>
        )}
      </Cartao>
    </>
  );
}
