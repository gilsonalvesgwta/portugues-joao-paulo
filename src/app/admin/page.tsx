import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { enviarEmailDeTeste } from '@/app/admin/acoes';
import { AvisoDaPagina, Botao, Cartao, LinkBotao, TituloDaPagina } from '@/components/admin/ui';
import { avisoDe } from '@/lib/admin/avisos';
import { ativos, carregarConteudo } from '@/lib/admin/dados';
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

  const conteudo = await carregarConteudo();
  const cursos = ativos(conteudo.cursos);
  const modulos = ativos(conteudo.modulos);
  const aulas = ativos(conteudo.aulas);
  const publicadas = aulas.filter((aula) => aula.situacao === 'publicado').length;

  return (
    <>
      <TituloDaPagina titulo="Painel" texto={`Você entrou como ${NOME_DO_PAPEL[pessoa.papel] ?? pessoa.papel}.`}>
        <LinkBotao href="/admin/aulas/nova">Nova aula</LinkBotao>
      </TituloDaPagina>
      <AvisoDaPagina aviso={avisoDe(aviso)} />

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
        <h2 className="text-lg font-bold">Envio de e-mail</h2>
        <form action={enviarEmailDeTeste} className="mt-2 flex flex-col items-start gap-3">
          <p className="text-[15px] leading-normal text-apoio">
            A plataforma envia o link de acesso e os avisos pela caixa de e-mail configurada na instalação. Para
            conferir se está funcionando, mande um e-mail de teste para {pessoa.email}.
          </p>
          <Botao variante="secundario">Enviar e-mail de teste</Botao>
        </form>
      </Cartao>

      <Cartao>
        <h2 className="text-lg font-bold">Ainda em construção</h2>
        <p className="mt-2 text-[15px] leading-normal text-apoio">
          Quizzes, tarefas, trilha por dia,
          conversação, alunos, pagamentos e configurações entram nas próximas etapas.
        </p>
      </Cartao>
    </>
  );
}
