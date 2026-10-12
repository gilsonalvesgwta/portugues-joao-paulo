import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { enviarEmailDeTeste, salvarLimiteDoPapo, testarPapo } from '@/app/admin/acoes';
import { AvisoDaPagina, Botao, Cartao, Entrada, Etiqueta, LinkBotao, NumeroDaAula, TituloDaPagina, TITULO_DO_CARTAO } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { ativos, carregarConteudo, quizzesPorAula } from '@/lib/admin/dados';
import { formatarDuracao } from '@/lib/conteudo';
import { usoDoPapo } from '@/lib/admin/papo';
import { configDoPapo, NOME_DO_PROVEDOR } from '@/lib/papo';
import { pessoaLogada } from '@/lib/supabase/servidor';

export const metadata: Metadata = { title: 'Painel' };

const NOME_DO_PAPEL: Record<string, string> = { admin: 'Administrador', professor: 'Professor' };

type Props = { searchParams: Promise<{ aviso?: string | string[] }> };

function Numero({ valor, rotulo, href, alerta = false, primeiro = false }: { valor: number; rotulo: string; href: string; alerta?: boolean; primeiro?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex flex-col gap-1 p-[18px] text-texto no-underline transition-colors hover:bg-papel lg:gap-1.5 lg:px-[26px] lg:py-6 ${primeiro ? '' : 'border-borda'}`}
    >
      <span className={`font-titulo text-[32px] font-bold leading-none lg:text-[40px] ${alerta && valor > 0 ? 'text-aviso' : ''}`}>{valor}</span>
      <span className="text-sm text-apoio lg:text-[15px]">{rotulo}</span>
    </Link>
  );
}

export default async function PaginaPainel({ searchParams }: Props) {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  const { aviso } = await searchParams;
  const doEmail = typeof aviso === 'string' && aviso.startsWith('email_');
  const doTesteDoPapo = typeof aviso === 'string' && aviso.startsWith('papoteste_');

  const conteudo = await carregarConteudo();
  const cursos = ativos(conteudo.cursos);
  const modulos = ativos(conteudo.modulos);
  const aulas = ativos(conteudo.aulas);
  const publicadas = aulas.filter((aula) => aula.situacao === 'publicado').length;
  const configDoTutor = configDoPapo();
  const papoLigado = configDoTutor !== null;
  const papo = await usoDoPapo();

  const rascunhos = aulas
    .filter((aula) => aula.situacao === 'rascunho')
    .sort((a, b) => a.numero - b.numero)
    .slice(0, 5);
  const quizzes = rascunhos.length > 0 ? await quizzesPorAula() : new Map();
  const moduloPorId = new Map(modulos.map((modulo) => [modulo.id, modulo]));
  const primeiroNome = (pessoa.nome.trim().split(/\s+/)[0] ?? '') || 'equipe';
  const papel = (NOME_DO_PAPEL[pessoa.papel] ?? pessoa.papel).toLocaleLowerCase('pt-BR');

  // O que falta numa aula em rascunho, em poucas palavras.
  const situacaoDoRascunho = (aula: (typeof aulas)[number]) => {
    const quiz = quizzes.get(aula.id);
    const video = aula.video_id ? formatarDuracao(aula.duracao_seg) || 'com vídeo' : '';
    const doQuiz = quiz ? `quiz com ${quiz.perguntas === 1 ? '1 pergunta' : `${quiz.perguntas} perguntas`}` : '';
    if (!video && !doQuiz) return 'Sem vídeo e sem quiz';
    if (!video) return `Sem vídeo, ${doQuiz}`;
    return doQuiz ? `${video}, ${doQuiz}` : `${video}, sem quiz`;
  };

  return (
    <>
      <TituloDaPagina titulo={`Olá, ${primeiroNome}`} texto={`Você entrou como ${papel}. Aqui fica o resumo da plataforma.`}>
        <LinkBotao href="/inicio" variante="secundario">
          Ver como o aluno
        </LinkBotao>
        <LinkBotao href="/admin/aulas/nova">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Nova aula</span>
        </LinkBotao>
      </TituloDaPagina>
      {/* A resposta do e-mail de teste aparece no quadro do e-mail, ao lado do botão. */}
      {doEmail || doTesteDoPapo ? null : <AvisoDaPagina aviso={avisoDe(aviso)} />}

      <section
        aria-label="Números da plataforma"
        className="grid grid-cols-2 overflow-hidden rounded-[22px] border border-borda bg-cartao sm:rounded-3xl sm:shadow-cartao lg:grid-cols-4 [&>*:nth-child(2)]:border-l [&>*:nth-child(3)]:border-t [&>*:nth-child(4)]:border-l [&>*:nth-child(4)]:border-t lg:[&>*:nth-child(3)]:border-l lg:[&>*:nth-child(3)]:border-t-0 lg:[&>*:nth-child(4)]:border-t-0"
      >
        <Numero primeiro valor={cursos.length} rotulo={cursos.length === 1 ? 'curso' : 'cursos'} href="/admin/cursos" />
        <Numero valor={modulos.length} rotulo={modulos.length === 1 ? 'módulo' : 'módulos'} href="/admin/cursos" />
        <Numero valor={publicadas} rotulo={publicadas === 1 ? 'aula publicada' : 'aulas publicadas'} href="/admin/aulas?situacao=publicado" />
        <Numero
          alerta
          valor={aulas.length - publicadas}
          rotulo={aulas.length - publicadas === 1 ? 'aula em rascunho' : 'aulas em rascunho'}
          href="/admin/aulas?situacao=rascunho"
        />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          {cursos.length === 0 ? (
            <Cartao className="flex flex-col gap-3">
              <h2 className={TITULO_DO_CARTAO}>Por onde começar</h2>
              <p className="text-[15px] leading-normal text-apoio">
                Crie o curso, depois os módulos dentro dele e, por fim, as aulas de cada módulo.
              </p>
              <div>
                <LinkBotao href="/admin/cursos/novo">Criar o primeiro curso</LinkBotao>
              </div>
            </Cartao>
          ) : (
            <Cartao className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className={TITULO_DO_CARTAO}>Aulas em rascunho</h2>
                {rascunhos.length > 0 ? (
                  <Link href="/admin/aulas?situacao=rascunho" className="-my-3 inline-flex min-h-11 shrink-0 items-center text-[15px] font-semibold text-verde-link underline underline-offset-2 hover:text-verde">
                    Ver todas
                  </Link>
                ) : null}
              </div>
              <p className="text-[15px] leading-normal text-apoio">
                {rascunhos.length > 0
                  ? 'O aluno ainda não vê estas aulas. Publique quando estiverem prontas.'
                  : 'Nenhuma aula em rascunho: tudo o que foi criado já está publicado.'}
              </p>
              {rascunhos.length > 0 ? (
                <ul className="flex flex-col gap-2.5">
                  {rascunhos.map((aula) => (
                    <li key={aula.id}>
                      <Link
                        href={`/admin/aulas/${aula.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-borda p-2.5 text-texto no-underline transition-colors hover:border-verde sm:gap-3.5 sm:px-3"
                      >
                        <NumeroDaAula numero={aula.numero} publicada={false} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="break-words text-base font-bold leading-snug">{aula.titulo_pt}</span>
                          <span className="text-sm leading-snug text-apoio">
                            <span className="hidden sm:inline">{moduloPorId.get(aula.modulo_id)?.titulo_pt}. </span>
                            {situacaoDoRascunho(aula)}
                          </span>
                        </span>
                        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-borda-campo">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Cartao>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
      <Cartao className="flex flex-col gap-3">
        <h2 id="email" className={`scroll-mt-6 ${TITULO_DO_CARTAO}`}>
          Envio de e-mail
        </h2>
        {doEmail ? (
          <div className="mt-3">
            <AvisoDaPagina aviso={avisoDe(aviso)} />
          </div>
        ) : null}
        <form action={enviarEmailDeTeste} className="flex flex-col items-stretch gap-3 sm:items-start">
          <p className="text-[15px] leading-normal text-apoio">
            Link de acesso, reservas e lembretes saem pela caixa de e-mail configurada na instalação. Mande um teste para{' '}
            <span className="break-all">{pessoa.email}</span>.
          </p>
          <Botao variante="secundario">Enviar e-mail de teste</Botao>
        </form>
      </Cartao>

      <Cartao className="bg-papel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="papo" className={`scroll-mt-6 ${TITULO_DO_CARTAO}`}>
            Papo, o tutor
          </h2>
          <Etiqueta tom={papoLigado ? 'verde' : 'aviso'}>
            <span aria-hidden="true" className={`size-2 rounded-full ${papoLigado ? 'bg-verde' : 'bg-aviso'}`} />
            {papoLigado ? 'Ligado' : 'Desligado'}
          </Etiqueta>
        </div>
        {doTesteDoPapo ? (
          <div className="mt-3">
            <AvisoDaPagina aviso={avisoDe(aviso)} />
          </div>
        ) : null}
        <p className="mt-2 text-[15px] leading-normal text-apoio">
          {configDoTutor
            ? `O aluno com curso ativo conversa por escrito com o tutor, em “Papo”. Quem responde é um serviço de inteligência artificial, não uma pessoa: hoje, a ${NOME_DO_PROVEDOR[configDoTutor.provedor]} (modelo ${configDoTutor.modelo}). Cada mensagem tem um custo na conta de vocês lá.`
            : 'O Papo aparece para o aluno quando a instalação tem a chave de API da OpenAI (variável CHAVE_DA_OPENAI, na stack). Sem a chave, o resto da plataforma funciona normalmente.'}
        </p>
        {papoLigado && pessoa.papel === 'admin' ? (
          <form action={testarPapo} className="mt-3 flex flex-col items-start gap-2">
            <Botao variante="secundario">Testar o Papo</Botao>
            <p className="text-sm leading-normal text-apoio">
              Manda uma mensagem curta ao serviço e mostra aqui se ele respondeu. Não conta no limite de nenhum aluno.
            </p>
          </form>
        ) : null}
        <p className="mt-2 text-[15px] leading-normal text-apoio">
          Nos últimos 7 dias: {papo.mensagens === 1 ? '1 mensagem' : `${papo.mensagens} mensagens`}, de{' '}
          {papo.pessoas === 1 ? '1 pessoa' : `${papo.pessoas} pessoas`}.
        </p>
        {pessoa.papel === 'admin' ? (
          <form action={salvarLimiteDoPapo} className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 basis-48">
              <Entrada
                key={papo.limite}
                id="papo_mensagens_por_dia"
                rotulo="Mensagens por pessoa, por dia"
                ajuda="De 0 a 500. Com 0, ninguém envia."
                defaultValue={String(papo.limite)}
                inputMode="numeric"
                maxLength={3}
              />
            </div>
            <Botao variante="secundario">Salvar limite</Botao>
          </form>
        ) : (
          <p className="mt-2 text-[15px] leading-normal text-apoio">Limite: {papo.limite} mensagens por pessoa, por dia.</p>
        )}
      </Cartao>
        </div>
      </div>
    </>
  );
}
