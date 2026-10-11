'use server';

import { redirect } from 'next/navigation';
import { ehUuid } from '@/lib/conteudo';
import { enviarEmail } from '@/lib/correio';
import { emailReservaCancelada, emailReservaConfirmada, type Email } from '@/lib/emails';
import { codigoDoErro, COMENTARIO_MAX, lerNota, zonaValida, type ReservaDoAluno } from '@/lib/reservas';
import { motivoDaFalha } from '@/lib/smtp';
import { clienteDeServico } from '@/lib/supabase/servico';
import { clienteDoServidor, pessoaLogada } from '@/lib/supabase/servidor';

// Ações da tela de conversação do aluno. Reservar, cancelar e avaliar passam pelas funções do
// banco, com a sessão do aluno: são elas que conferem vagas, limite da semana e prazos, uma
// reserva de cada vez. A chave de serviço só entra para registrar no histórico o e-mail enviado.

const TELA = '/conversacion';

function texto(dados: FormData, campo: string): string {
  const valor = dados.get(campo);
  return typeof valor === 'string' ? valor : '';
}

async function exigirPessoa() {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  return { pessoa, supabase: await clienteDoServidor() };
}

// Volta para o dia e o nível em que a pessoa estava.
function volta(dados: FormData, aviso: string): string {
  const partes = new URLSearchParams();
  const dia = texto(dados, 'dia');
  const nivel = texto(dados, 'nivel');
  if (/^\d{4}-\d{2}-\d{2}$/.test(dia)) partes.set('dia', dia);
  if (/^[a-z]{1,20}$/.test(nivel)) partes.set('nivel', nivel);
  partes.set('aviso', aviso);
  return `${TELA}?${partes.toString()}`;
}

type Sessao = Awaited<ReturnType<typeof clienteDoServidor>>;

async function minhaReserva(supabase: Sessao, achar: (reserva: ReservaDoAluno) => boolean): Promise<ReservaDoAluno | null> {
  const { data } = await supabase.rpc('minhas_reservas');
  return ((data ?? []) as unknown as ReservaDoAluno[]).find(achar) ?? null;
}

// Manda o e-mail e registra o envio. Devolve se saiu. O que já foi gravado (reserva ou
// cancelamento) não é desfeito por causa do e-mail.
async function avisar(pessoaId: string, destino: string, tipo: string, reservaId: string, montar: () => Email): Promise<boolean> {
  let falha: string | null = null;
  try {
    await enviarEmail(destino, montar());
  } catch (erro) {
    falha = motivoDaFalha(erro);
    console.error(`Falha ao enviar o e-mail de ${tipo} (${falha}):`, erro instanceof Error ? erro.message : erro);
  }
  const { error } = await clienteDeServico().from('notificacoes').insert({
    tipo,
    canal: 'email',
    aluno_id: pessoaId,
    destinatario: destino,
    dados: { reserva_id: reservaId },
    enviada_em: falha === null ? new Date().toISOString() : null,
    erro: falha,
  });
  if (error) console.error('Não foi possível registrar o e-mail da reserva:', error.message);
  return falha === null;
}

async function dadosDoPerfil(supabase: Sessao, pessoaId: string): Promise<{ nome: string; fuso: string }> {
  const { data } = await supabase.from('perfis').select('nome, fuso').eq('id', pessoaId).maybeSingle();
  return { nome: typeof data?.nome === 'string' ? data.nome : '', fuso: typeof data?.fuso === 'string' ? data.fuso : 'Europe/Madrid' };
}

export async function reservar(dados: FormData): Promise<void> {
  const { pessoa, supabase } = await exigirPessoa();
  const turmaId = texto(dados, 'turma_id');
  if (!ehUuid(turmaId)) redirect(volta(dados, 'turma_inexistente'));

  const { error } = await supabase.rpc('reservar_turma', { p_turma: turmaId });
  if (error) redirect(volta(dados, codigoDoErro(error.message)));

  const [reserva, perfil, prazo] = await Promise.all([
    minhaReserva(supabase, (item) => item.turma_id === turmaId),
    dadosDoPerfil(supabase, pessoa.id),
    supabase.rpc('config_int', { p_chave: 'cancelamento_min_antes', p_padrao: 120 }),
  ]);
  if (!reserva || !reserva.meet_url) redirect(volta(dados, 'reservada_sin_correo'));
  const enviado = await avisar(pessoa.id, pessoa.email, 'reserva_confirmada', reserva.reserva_id, () =>
    emailReservaConfirmada({
      nombre: perfil.nome,
      tema: reserva.titulo_es,
      inicio: reserva.inicio,
      fuso: perfil.fuso,
      meetUrl: reserva.meet_url ?? '',
      duracionMin: reserva.duracao_min,
      cancelarHastaMin: typeof prazo.data === 'number' ? prazo.data : 120,
      ...(reserva.material ? { material: reserva.material } : {}),
    }),
  );
  redirect(volta(dados, enviado ? 'reservada' : 'reservada_sin_correo'));
}

export async function cancelar(dados: FormData): Promise<void> {
  const { pessoa, supabase } = await exigirPessoa();
  const reservaId = texto(dados, 'reserva_id');
  if (!ehUuid(reservaId)) redirect(volta(dados, 'reserva_inexistente'));

  // Os dados da aula são lidos antes: depois de cancelada, a reserva some da lista do aluno.
  const [reserva, perfil] = await Promise.all([minhaReserva(supabase, (item) => item.reserva_id === reservaId), dadosDoPerfil(supabase, pessoa.id)]);
  const { error } = await supabase.rpc('cancelar_reserva', { p_reserva: reservaId });
  if (error) redirect(volta(dados, codigoDoErro(error.message)));
  if (reserva) {
    await avisar(pessoa.id, pessoa.email, 'reserva_cancelada', reservaId, () =>
      emailReservaCancelada({ nombre: perfil.nome, tema: reserva.titulo_es, inicio: reserva.inicio, fuso: perfil.fuso }),
    );
  }
  redirect(volta(dados, 'cancelada'));
}

export async function valorar(dados: FormData): Promise<void> {
  const { supabase } = await exigirPessoa();
  const reservaId = texto(dados, 'reserva_id');
  const nota = lerNota(texto(dados, 'nota'));
  if (!ehUuid(reservaId)) redirect(volta(dados, 'reserva_inexistente'));
  if (nota === null) redirect(volta(dados, 'nota'));
  const comentario = texto(dados, 'comentario').trim().slice(0, COMENTARIO_MAX);

  const { error } = await supabase.rpc('avaliar_aula', { p_reserva: reservaId, p_nota: nota, p_comentario: comentario === '' ? null : comentario });
  redirect(volta(dados, error ? codigoDoErro(error.message) : 'valorada'));
}

// O aluno aceita a sugestão de usar o fuso do aparelho dele.
export async function usarZona(dados: FormData): Promise<void> {
  const { pessoa, supabase } = await exigirPessoa();
  const fuso = texto(dados, 'fuso');
  if (!zonaValida(fuso)) redirect(volta(dados, 'fallo'));
  const { error } = await supabase.from('perfis').update({ fuso, fuso_confirmado_em: new Date().toISOString() }).eq('id', pessoa.id);
  redirect(volta(dados, error ? 'fallo' : 'zona'));
}
