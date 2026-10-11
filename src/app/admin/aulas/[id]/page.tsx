import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { moverParaLixeira } from '@/app/admin/acoes';
import { FormularioDaAula } from '@/components/admin/FormularioDaAula';
import { ListaDeMateriais } from '@/components/admin/ListaDeMateriais';
import { AvisoDaPagina, Botao, Cartao, Etiqueta, LinkBotao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { gruposParaAula } from '@/lib/admin/aulas';
import { avisoDe } from '@/lib/admin/avisos';
import {
  ativos, blocosPorAula, carregarConteudo, carregarMateriaisDaAula, carregarTarefas, cursoDaAula, quizzesPorAula,
} from '@/lib/admin/dados';
import { formatarDuracao, incorporarYoutube, lerVideoDoYoutube, linkDoYoutube } from '@/lib/conteudo';

export const metadata: Metadata = { title: 'Editar aula' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string | string[] }> };

export default async function PaginaEditarAula({ params, searchParams }: Props) {
  const { id } = await params;
  const { aviso } = await searchParams;
  const [conteudo, blocos] = await Promise.all([carregarConteudo(), blocosPorAula()]);
  const aula = ativos(conteudo.aulas).find((item) => item.id === id);
  if (!aula) redirect('/admin/aulas?aviso=nao_encontrado');
  // Só monta link e prévia se o que está salvo for mesmo um código do YouTube.
  const codigo = lerVideoDoYoutube(aula.video_id);
  const video = codigo !== null && codigo !== 'invalido' ? codigo : null;
  const quantos = blocos.get(aula.id) ?? 0;
  const quiz = (await quizzesPorAula()).get(aula.id) ?? null;
  const tarefas = ativos(await carregarTarefas()).filter((tarefa) => tarefa.aula_id === aula.id);
  const cursoId = cursoDaAula(conteudo, aula.id);
  const materiais = await carregarMateriaisDaAula(aula.id);

  return (
    <>
      <Trilha href="/admin/aulas" rotulo="Aulas" />
      <TituloDaPagina titulo={`Editar aula ${aula.numero}`} texto={aula.titulo_pt}>
        <Etiqueta tom={aula.situacao === 'publicado' ? 'verde' : 'aviso'}>
          {aula.situacao === 'publicado' ? 'Publicada' : 'Rascunho'}
        </Etiqueta>
      </TituloDaPagina>
      <AvisoDaPagina aviso={avisoDe(aviso)} />
      <Cartao>
        {/* A chave muda a cada gravação: o formulário recomeça com o que ficou salvo no banco. */}
        <FormularioDaAula
          key={aula.atualizado_em}
          grupos={gruposParaAula(conteudo)}
          previa={video ? incorporarYoutube(video) : null}
          aula={{
            id: aula.id,
            modulo_id: aula.modulo_id,
            numero: String(aula.numero),
            titulo_pt: aula.titulo_pt,
            titulo_es: aula.titulo_es,
            video_id: video ? linkDoYoutube(video) : (aula.video_id ?? ''),
            duracao: formatarDuracao(aula.duracao_seg),
          }}
        />
      </Cartao>
      <Cartao>
        <h2 className="text-lg font-bold">Anotações da aula</h2>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] leading-normal text-apoio">
            {quantos === 0
              ? 'Esta aula ainda não tem anotações. É o resumo que o aluno lê junto com o vídeo.'
              : `${quantos === 1 ? '1 bloco' : `${quantos} blocos`} de anotações.`}
          </p>
          <LinkBotao href={`/admin/aulas/${aula.id}/anotacoes`} variante="secundario">
            {quantos === 0 ? 'Criar anotações' : 'Editar anotações'}
          </LinkBotao>
        </div>
      </Cartao>
      <Cartao>
        <h2 className="text-lg font-bold">Quiz da aula</h2>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] leading-normal text-apoio">
            {quiz === null
              ? 'Esta aula ainda não tem quiz. São as perguntas que o aluno responde depois de assistir.'
              : `${quiz.perguntas === 1 ? '1 pergunta' : `${quiz.perguntas} perguntas`} · ${quiz.situacao === 'publicado' ? 'Publicado' : 'Rascunho'}`}
          </p>
          <LinkBotao href={`/admin/aulas/${aula.id}/quiz`} variante="secundario">
            {quiz === null ? 'Criar quiz' : 'Editar quiz'}
          </LinkBotao>
        </div>
      </Cartao>
      <Cartao>
        <ListaDeMateriais
          materiais={materiais}
          novo={`/admin/aulas/${aula.id}/materiais/novo`}
          vazio="Esta aula ainda não tem materiais. O arquivo fica no Google Drive (ou parecido) e aqui entra só o link."
        />
      </Cartao>
      <Cartao>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Tarefas da aula</h2>
          {cursoId ? (
            <LinkBotao href={`/admin/tarefas/nova?curso=${cursoId}&aula=${aula.id}`} variante="secundario">
              Nova tarefa
            </LinkBotao>
          ) : null}
        </div>
        {tarefas.length === 0 ? (
          <p className="mt-2 text-[15px] leading-normal text-apoio">
            Nenhuma tarefa ligada a esta aula. Tarefa é o que o aluno faz além do vídeo e do quiz.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-linha border-y border-linha">
            {tarefas.map((tarefa) => (
              <li key={tarefa.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0 text-base font-semibold" lang="es">
                  {tarefa.titulo_es}
                </span>
                <LinkBotao href={`/admin/tarefas/${tarefa.id}`} variante="secundario">
                  Editar<span className="sr-only"> a tarefa {tarefa.titulo_es}</span>
                </LinkBotao>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
      <Cartao>
        <h2 className="text-lg font-bold">Lixeira</h2>
        <form action={moverParaLixeira} className="mt-3 flex flex-col items-start gap-3">
          <p className="text-[15px] leading-normal text-apoio">
            A aula sai das listas e deixa de aparecer para o aluno. Dá para restaurar depois, e ela volta como rascunho.
          </p>
          <input type="hidden" name="tipo" value="aula" />
          <input type="hidden" name="id" value={aula.id} />
          <Botao variante="secundario">Mover a aula para a lixeira</Botao>
        </form>
      </Cartao>
    </>
  );
}
