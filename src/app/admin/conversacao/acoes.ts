'use server';

import { redirect } from 'next/navigation';
import { ehUuid } from '@/lib/conteudo';
import { validarConfiguracoes, validarTema, validarTurma } from '@/lib/conversacao';
import { enviarEmail } from '@/lib/correio';
import { emailClaseCancelada } from '@/lib/emails';
import type { EstadoDoFormulario } from '@/lib/formulario';
import { ehEquipe } from '@/lib/papeis';
import { motivoDaFalha } from '@/lib/smtp';
import { clienteDeServico } from '@/lib/supabase/servico';
import { clienteDoServidor, pessoaLogada } from '@/lib/supabase/servidor';

// Ações das telas de conversação da equipe (professor e administrador). Tudo é gravado com a
// sessão de quem pede, sob as regras do banco. As configurações são só do administrador.
// A chave de serviço entra em um ponto só: registrar no histórico os e-mails de aviso de turma
// cancelada, depois de a turma já ter sido cancelada com a sessão da pessoa.

const TELA = '/admin/conversacao';
const TEMAS = '/admin/conversacao/temas';
const FALHA = 'Não foi possível salvar. Tente de novo.';

async function exigirEquipe() {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  if (!ehEquipe(pessoa.papel)) redirect('/inicio');
  return { pessoa, supabase: await clienteDoServidor() };
}

function valoresDe(dados: FormData, campos: readonly string[]): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const campo of campos) {
    const valor = dados.get(campo);
    valores[campo] = typeof valor === 'string' ? valor : '';
  }
  return valores;
}

function comErros(anterior: EstadoDoFormulario, erros: Record<string, string>, valores: Record<string, string>): EstadoDoFormulario {
  return { vez: anterior.vez + 1, erros, valores };
}

// ---------------------------------------------------------------------------
// Temas
// ---------------------------------------------------------------------------

export async function salvarTema(anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> {
  const { supabase } = await exigirEquipe();
  const valores = valoresDe(dados, ['id', 'titulo_es', 'nivel', 'descricao_es', 'aprendizados', 'material']);
  const id = valores.id ? valores.id : null;
  if (id !== null && !ehUuid(id)) redirect(`${TEMAS}?aviso=nao_encontrado`);
  const conferido = validarTema(valores);
  if (!conferido.ok) return comErros(anterior, conferido.erros, valores);

  if (id === null) {
    const { error } = await supabase.from('temas_conversacao').insert(conferido.valor);
    if (error) return comErros(anterior, { geral: FALHA }, valores);
  } else {
    const { data, error } = await supabase.from('temas_conversacao').update(conferido.valor).eq('id', id).select('id');
    if (error) return comErros(anterior, { geral: FALHA }, valores);
    if ((data ?? []).length === 0) redirect(`${TEMAS}?aviso=nao_encontrado`);
  }
  redirect(`${TEMAS}?aviso=tema_salvo`);
}

// Arquivar tira o tema das listas de escolha e da tela do aluno; as turmas que já existem
// continuam. Tema com turma ainda por acontecer não é arquivado.
export async function arquivarTema(dados: FormData): Promise<void> {
  const { supabase } = await exigirEquipe();
  const { id, arquivar } = valoresDe(dados, ['id', 'arquivar']);
  if (!ehUuid(id)) redirect(`${TEMAS}?aviso=nao_encontrado`);

  if (arquivar === '1') {
    const { count } = await supabase
      .from('turmas')
      .select('id', { count: 'exact', head: true })
      .eq('tema_id', id)
      .eq('situacao', 'aberta')
      .gt('inicio', new Date().toISOString());
    if ((count ?? 0) > 0) redirect(`${TEMAS}/${id}?aviso=tema_com_turmas`);
  }
  const { data, error } = await supabase
    .from('temas_conversacao')
    .update({ arquivado_em: arquivar === '1' ? new Date().toISOString() : null })
    .eq('id', id)
    .select('id');
  if (error) redirect(`${TEMAS}?aviso=falhou`);
  if ((data ?? []).length === 0) redirect(`${TEMAS}?aviso=nao_encontrado`);
  redirect(`${TEMAS}?aviso=${arquivar === '1' ? 'tema_arquivado' : 'tema_restaurado'}`);
}

// ---------------------------------------------------------------------------
// Turmas
// ---------------------------------------------------------------------------

export async function salvarTurma(anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> {
  const { supabase } = await exigirEquipe();
  const valores = valoresDe(dados, ['id', 'tema_id', 'data', 'hora', 'duracao_min', 'vagas', 'meet_url']);
  const id = valores.id ? valores.id : null;
  if (id !== null && !ehUuid(id)) redirect(`${TELA}?aviso=nao_encontrado`);

  // Na edição, quantas pessoas já reservaram decide o que ainda pode mudar.
  let reservas = 0;
  if (id !== null) {
    const { data: atual } = await supabase.rpc('turma_da_equipe', { p_turma: id });
    const lida = atual as { turma?: { situacao?: string }; reservas?: unknown[] } | null;
    if (!lida?.turma) redirect(`${TELA}?aviso=nao_encontrado`);
    if (lida.turma.situacao === 'cancelada') redirect(`${TELA}/turmas/${id}?aviso=turma_cancelada_nao_muda`);
    reservas = (lida.reservas ?? []).length;
  }

  const conferido = validarTurma(valores, new Date(), reservas);
  if (!conferido.ok) return comErros(anterior, conferido.erros, valores);
  const { data: tema } = await supabase.from('temas_conversacao').select('id').eq('id', conferido.valor.tema_id).is('arquivado_em', null).maybeSingle();
  if (!tema) return comErros(anterior, { tema_id: 'Esse tema não existe mais. Escolha outro.' }, valores);

  if (id === null) {
    const { data, error } = await supabase.from('turmas').insert(conferido.valor).select('id').single();
    if (error || typeof data?.id !== 'string') return comErros(anterior, { geral: FALHA }, valores);
    redirect(`${TELA}?aviso=turma_criada`);
  }
  // Com gente inscrita, o tema, a data e a hora ficam como estavam: quem reservou conta com eles.
  const { inicio, tema_id: temaId, ...resto } = conferido.valor;
  const mudanca = reservas > 0 ? resto : { ...resto, tema_id: temaId, inicio };
  const { data, error } = await supabase.from('turmas').update(mudanca).eq('id', id).select('id');
  if (error) return comErros(anterior, { geral: FALHA }, valores);
  if ((data ?? []).length === 0) redirect(`${TELA}?aviso=nao_encontrado`);
  // Volta para a lista: assim o formulário abre limpo da próxima vez.
  redirect(`${TELA}?aviso=turma_salva`);
}

type Avisado = { aluno_id: string; nome: string; email: string; fuso: string };

// Cancela a turma (as reservas são canceladas junto e o crédito da semana volta) e avisa por
// e-mail cada pessoa que estava inscrita.
export async function cancelarTurma(dados: FormData): Promise<void> {
  const { supabase } = await exigirEquipe();
  const { id } = valoresDe(dados, ['id']);
  if (!ehUuid(id)) redirect(`${TELA}?aviso=nao_encontrado`);

  const { data: antes } = await supabase.rpc('turma_da_equipe', { p_turma: id });
  const turma = antes as { turma?: { inicio?: string }; tema?: { titulo_es?: string } } | null;
  if (!turma?.turma) redirect(`${TELA}?aviso=nao_encontrado`);

  const { data: avisar, error } = await supabase.rpc('cancelar_turma', { p_turma: id });
  if (error) {
    redirect(`${TELA}/turmas/${id}?aviso=${error.message.includes('turma_ja_aconteceu') ? 'turma_ja_aconteceu' : 'falhou'}`);
  }

  const site = process.env.SITE_URL ?? '';
  const servico = clienteDeServico();
  let falhas = 0;
  for (const pessoa of (avisar ?? []) as unknown as Avisado[]) {
    let falha: string | null = null;
    try {
      await enviarEmail(
        pessoa.email,
        emailClaseCancelada({
          nombre: pessoa.nome,
          tema: turma.tema?.titulo_es ?? '',
          inicio: turma.turma.inicio ?? '',
          fuso: pessoa.fuso,
          agenda: `${site}/conversacion`,
        }),
      );
    } catch (erro) {
      falha = motivoDaFalha(erro);
      falhas += 1;
      console.error(`Falha ao avisar do cancelamento da turma (${falha}):`, erro instanceof Error ? erro.message : erro);
    }
    await servico.from('notificacoes').insert({
      tipo: 'clase_cancelada',
      canal: 'email',
      aluno_id: pessoa.aluno_id,
      destinatario: pessoa.email,
      dados: { turma_id: id },
      enviada_em: falha === null ? new Date().toISOString() : null,
      erro: falha,
    });
  }
  redirect(`${TELA}/turmas/${id}?aviso=${falhas > 0 ? 'turma_cancelada_sem_aviso' : 'turma_cancelada'}`);
}

// Presença de quem reservou: "1" veio, "0" faltou, vazio volta a ficar sem marca.
export async function marcarPresenca(dados: FormData): Promise<void> {
  const { supabase } = await exigirEquipe();
  const { reserva_id: reservaId, turma_id: turmaId, presente } = valoresDe(dados, ['reserva_id', 'turma_id', 'presente']);
  if (!ehUuid(reservaId) || !ehUuid(turmaId)) redirect(`${TELA}?aviso=nao_encontrado`);
  const valor = presente === '1' ? true : presente === '0' ? false : null;
  const { data, error } = await supabase.from('reservas').update({ presente: valor }).eq('id', reservaId).eq('turma_id', turmaId).select('id');
  if (error || (data ?? []).length === 0) redirect(`${TELA}/turmas/${turmaId}?aviso=falhou`);
  redirect(`${TELA}/turmas/${turmaId}?aviso=presenca_salva`);
}

// ---------------------------------------------------------------------------
// Configurações (só o administrador)
// ---------------------------------------------------------------------------

export async function salvarConfiguracoes(anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> {
  const { pessoa, supabase } = await exigirEquipe();
  if (pessoa.papel !== 'admin') redirect('/admin?aviso=so_administrador');
  const valores = valoresDe(dados, ['agenda_janela_dias', 'reserva_fecha_min_antes', 'cancelamento_min_antes']);
  const conferido = validarConfiguracoes(valores);
  if (!conferido.ok) return comErros(anterior, conferido.erros, valores);

  const linhas = Object.entries(conferido.valor).map(([chave, valor]) => ({ chave, valor, atualizado_em: new Date().toISOString() }));
  const { error } = await supabase.from('configuracoes').upsert(linhas, { onConflict: 'chave' });
  if (error) return comErros(anterior, { geral: FALHA }, valores);
  redirect(`${TELA}?aviso=configuracoes_salvas`);
}
