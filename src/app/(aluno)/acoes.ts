'use server';

import { redirect } from 'next/navigation';
import { lerPosicao, montarPainel, videoConcluido } from '@/lib/aluno';
import { carregarAulaNoCurso, carregarQuiz } from '@/lib/aluno/dados';
import { ehUuid } from '@/lib/conteudo';
import { ehEquipe } from '@/lib/papeis';
import { corrigirEntrega, lerRespostas, respostaParaGuardar, type EstadoDaResposta, type LinhaDePergunta } from '@/lib/quiz-aluno';
import { clienteDeServico } from '@/lib/supabase/servico';
import { clienteDoServidor, pessoaLogada } from '@/lib/supabase/servidor';

// Ações da área do aluno. O progresso (aula vista, ponto do vídeo, tarefa feita) é gravado com a
// sessão do aluno, sob as regras do banco: ele só grava o que é dele, em aula que pode ver.
// A nota do quiz é a exceção: quem corrige e grava é o servidor, porque o aluno não lê o gabarito
// nem pode escrever a própria nota.

function texto(dados: FormData, campo: string): string {
  const valor = dados.get(campo);
  return typeof valor === 'string' ? valor : '';
}

async function exigirPessoa() {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  return pessoa;
}

// Para onde voltar depois de marcar uma tarefa: só a tela de início ou a de uma aula.
function voltaSegura(pedida: string): string {
  return /^\/(inicio|clase\/[0-9a-f-]{36})(\?curso=[0-9a-f-]{36})?$/.test(pedida) ? pedida : '/inicio';
}

function comAviso(caminho: string, aviso: string): string {
  return `${caminho}${caminho.includes('?') ? '&' : '?'}aviso=${aviso}`;
}

// ---------------------------------------------------------------------------
// Aula
// ---------------------------------------------------------------------------

// O aluno marca (ou desmarca) a aula como vista. Aula fechada (curso em sequência) não é marcada.
export async function marcarClase(dados: FormData): Promise<void> {
  const pessoa = await exigirPessoa();
  const aulaId = texto(dados, 'aula_id');
  const vista = texto(dados, 'vista') === '1';
  const contexto = await carregarAulaNoCurso(aulaId);
  if (!contexto) redirect('/inicio?aviso=no_encontrada');
  if (montarPainel(contexto.curso, contexto.progresso).fechados.has(aulaId)) {
    redirect(`/inicio?curso=${contexto.curso.curso.id}&aviso=bloqueada`);
  }

  const supabase = await clienteDoServidor();
  const { error } = await supabase
    .from('progresso_aulas')
    .upsert({ aluno_id: pessoa.id, aula_id: aulaId, concluida_em: vista ? new Date().toISOString() : null }, { onConflict: 'aluno_id,aula_id' });
  redirect(error ? `/clase/${aulaId}?aviso=no_guardado` : `/clase/${aulaId}`);
}

// Chamada pelo reprodutor de vídeo enquanto o aluno assiste: guarda onde ele está e, quando o
// vídeo chega perto do fim, marca a aula como vista. Devolve se a aula ficou vista agora.
export async function registrarVideo(aulaId: string, posicao: number, duracao: number): Promise<{ vista: boolean }> {
  const pessoa = await pessoaLogada();
  const segundos = lerPosicao(posicao);
  if (!pessoa || ehEquipe(pessoa.papel) || !ehUuid(aulaId) || segundos === null) return { vista: false };

  const supabase = await clienteDoServidor();
  const { error } = await supabase
    .from('progresso_aulas')
    .upsert({ aluno_id: pessoa.id, aula_id: aulaId, posicao_seg: segundos }, { onConflict: 'aluno_id,aula_id' });
  if (error || !videoConcluido(segundos, duracao)) return { vista: false };

  // Só marca quem ainda não estava marcado: a data da primeira vez fica.
  const { data } = await supabase
    .from('progresso_aulas')
    .update({ concluida_em: new Date().toISOString() })
    .eq('aluno_id', pessoa.id)
    .eq('aula_id', aulaId)
    .is('concluida_em', null)
    .select('aula_id');
  return { vista: (data ?? []).length > 0 };
}

// ---------------------------------------------------------------------------
// Tarefa
// ---------------------------------------------------------------------------

// A tarefa é marcada pelo item dela na trilha. As regras do banco só deixam marcar item de
// curso em que o aluno está matriculado.
export async function marcarTarea(dados: FormData): Promise<void> {
  const pessoa = await exigirPessoa();
  const itemId = texto(dados, 'item_id');
  const hecha = texto(dados, 'hecha') === '1';
  const volta = voltaSegura(texto(dados, 'volver'));
  if (!ehUuid(itemId)) redirect(volta);

  const supabase = await clienteDoServidor();
  const { error } = hecha
    ? await supabase
        .from('itens_concluidos')
        .upsert({ aluno_id: pessoa.id, item_dia_id: itemId }, { onConflict: 'aluno_id,item_dia_id', ignoreDuplicates: true })
    : await supabase.from('itens_concluidos').delete().eq('aluno_id', pessoa.id).eq('item_dia_id', itemId);
  redirect(error ? comAviso(volta, 'no_guardado') : volta);
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

// Recebe as respostas, corrige com o gabarito (que só o servidor lê), grava a tentativa e devolve
// a correção. Na visão da equipe, corrige sem gravar.
export async function responderQuiz(anterior: EstadoDaResposta, dados: FormData): Promise<EstadoDaResposta> {
  const pessoa = await exigirPessoa();
  const falha = (error: NonNullable<EstadoDaResposta['error']>): EstadoDaResposta => ({
    vez: anterior.vez + 1,
    situacao: 'error',
    error,
    correcao: null,
    guardado: false,
  });

  const quiz = await carregarQuiz(texto(dados, 'quiz_id'));
  const contexto = quiz ? await carregarAulaNoCurso(quiz.aula_id) : null;
  if (!quiz || !contexto) return falha('no_encontrado');
  const previa = ehEquipe(pessoa.papel);
  if (montarPainel(contexto.curso, contexto.progresso, previa).fechados.has(quiz.id)) return falha('bloqueado');

  const escrito = texto(dados, 'respuestas');
  if (escrito.length > 100_000) return falha('formato');
  let recebido: unknown;
  try {
    recebido = JSON.parse(escrito);
  } catch {
    return falha('formato');
  }
  const respostas = lerRespostas(recebido);

  const servico = clienteDeServico();
  const { data: linhas, error } = await servico.from('perguntas').select('id, tipo, conteudo').eq('quiz_id', quiz.id).order('ordem').order('id');
  if (error) return falha('no_encontrado');
  const correcao = corrigirEntrega((linhas ?? []) as unknown as LinhaDePergunta[], respostas, quiz.nota_minima);
  if (correcao.total === 0) return falha('no_encontrado');

  if (!previa) {
    const { error: erroDaTentativa } = await servico.from('tentativas_quiz').insert({
      aluno_id: pessoa.id,
      quiz_id: quiz.id,
      respostas: correcao.conferencia.map((item) => ({
        pergunta_id: item.id,
        resposta: respostaParaGuardar(respostas.get(item.id)),
        correta: item.correta,
      })),
      acertos: correcao.acertos,
      total: correcao.total,
      concluida_em: new Date().toISOString(),
    });
    if (erroDaTentativa) {
      console.error('Não foi possível gravar a tentativa de quiz:', erroDaTentativa.message);
      return falha('no_guardado');
    }
  }
  return { vez: anterior.vez + 1, situacao: 'corregido', error: null, correcao, guardado: !previa };
}
