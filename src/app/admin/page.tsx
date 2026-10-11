import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { enviarEmailDeTeste, salvarLimiteDoPapo, testarPapo } from '@/app/admin/acoes';
import { AvisoDaPagina, Botao, Cartao, Entrada, Etiqueta, LinkBotao, TituloDaPagina } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { ativos, carregarConteudo } from '@/lib/admin/dados';
import { usoDoPapo } from '@/lib/admin/papo';
import { configDoPapo, NOME_DO_PROVEDOR } from '@/lib/papo';
import { pessoaLogada } from '@/lib/supabase/servidor';

export const metadata: Metadata = { title: 'Painel' };

const NOME_DO_PAPEL: Record<string, string> = { admin: 'Administrador', professor: 'Professor' };

type Props = { searchParams: Promise<{ aviso?: string | string[] }> };

function Numero({ valor, rotulo, href }: { valor: number; rotulo: string; href: string }) {
  return (
    <Link href={href} className="flex flex-col gap-1 rounded-2xl border border-linha bg-cartao p-5 text-texto no-underline hover:border-verde">
      <span className="font-titulo text-4xl font-bold leading-none">{valor}</span>
      <span className="text-[15px] text-apoio">{rotulo}</span>
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

  return (
    <>
      <TituloDaPagina titulo="Painel" texto={`Você entrou como ${NOME_DO_PAPEL[pessoa.papel] ?? pessoa.papel}.`}>
        <LinkBotao href="/admin/aulas/nova">Nova aula</LinkBotao>
      </TituloDaPagina>
      {/* A resposta do e-mail de teste aparece no quadro do e-mail, ao lado do botão. */}
      {doEmail || doTesteDoPapo ? null : <AvisoDaPagina aviso={avisoDe(aviso)} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Numero valor={cursos.length} rotulo={cursos.length === 1 ? 'curso' : 'cursos'} href="/admin/cursos" />
        <Numero valor={modulos.length} rotulo={modulos.length === 1 ? 'módulo' : 'módulos'} href="/admin/cursos" />
        <Numero valor={publicadas} rotulo={publicadas === 1 ? 'aula publicada' : 'aulas publicadas'} href="/admin/aulas?situacao=publicado" />
        <Numero
          valor={aulas.length - publicadas}
          rotulo={aulas.length - publicadas === 1 ? 'aula em rascunho' : 'aulas em rascunho'}
          href="/admin/aulas?situacao=rascunho"
        />
      </div>

      {cursos.length === 0 ? (
        <Cartao>
          <h2 className="text-lg font-bold">Por onde começar</h2>
          <p className="mt-2 text-[15px] leading-normal text-apoio">
            Crie o curso, depois os módulos dentro dele e, por fim, as aulas de cada módulo.
          </p>
          <div className="mt-4">
            <LinkBotao href="/admin/cursos/novo">Criar o primeiro curso</LinkBotao>
          </div>
        </Cartao>
      ) : null}

      <Cartao>
        <h2 className="text-lg font-bold">Ver como o aluno</h2>
        <p className="mt-2 text-[15px] leading-normal text-apoio">
          Abra a área do aluno para conferir os cursos publicados do jeito que ele vê: o dia de hoje, as aulas, os quizzes. O
          que você fizer por lá não fica gravado.
        </p>
        <div className="mt-4">
          <LinkBotao href="/inicio" variante="secundario">
            Abrir a área do aluno
          </LinkBotao>
        </div>
      </Cartao>

      <Cartao>
        <h2 id="email" className="scroll-mt-6 text-lg font-bold">
          Envio de e-mail
        </h2>
        {doEmail ? (
          <div className="mt-3">
            <AvisoDaPagina aviso={avisoDe(aviso)} />
          </div>
        ) : null}
        <form action={enviarEmailDeTeste} className="mt-2 flex flex-col items-start gap-3">
          <p className="text-[15px] leading-normal text-apoio">
            A plataforma envia o link de acesso e os avisos pela caixa de e-mail configurada na instalação. Para
            conferir se está funcionando, mande um e-mail de teste para {pessoa.email}.
          </p>
          <Botao variante="secundario">Enviar e-mail de teste</Botao>
        </form>
      </Cartao>

      <Cartao>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="papo" className="scroll-mt-6 text-lg font-bold">
            Papo, o tutor com inteligência artificial
          </h2>
          <Etiqueta tom={papoLigado ? 'verde' : 'aviso'}>{papoLigado ? 'Ligado' : 'Desligado'}</Etiqueta>
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
            <div className="w-full sm:w-64">
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
    </>
  );
}
