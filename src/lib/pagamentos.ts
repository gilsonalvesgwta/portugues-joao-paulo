import { enviarEmail } from '@/lib/correio';
import { emailAccesoActivo } from '@/lib/emails';
import { acaoDoEvento, lerEventoGreenn, semDadosSensiveis } from '@/lib/greenn';
import { enviarLinkDeSenha } from '@/lib/link-de-acesso';
import { motivoDaFalha } from '@/lib/smtp';
import { clienteDeServico } from '@/lib/supabase/servico';

// Avisos de pagamento da Greenn: guardar, decidir o que fazer e aplicar. Só no servidor, com a
// chave de serviço (quem compra ainda não tem sessão). PROVISÓRIO: segue a documentação pública
// do webhook; será conferido com uma compra de teste antes de ir para produção.
//
// Cada aviso é guardado uma vez (o banco reconhece o repetido). O que não pôde ser aplicado fica
// pendente, com o motivo, e a administração manda processar de novo depois de corrigir a causa.

export type Desfecho =
  | 'acesso_liberado'
  | 'acesso_encerrado'
  | 'acesso_ate_fim_do_periodo'
  | 'ignorado'
  | 'ja_processado'
  | 'oferta_desconhecida'
  | 'aluno_desconhecido'
  | 'conta_nao_criada'
  | 'falha_ao_aplicar'
  | 'invalido';

type Servico = ReturnType<typeof clienteDeServico>;

// Guarda o aviso (sem documento, endereço e telefone do comprador) e processa.
// null quando nem guardar foi possível: quem chamou responde com erro para a Greenn tentar de novo.
export async function receberAviso(corpo: unknown): Promise<{ eventoId: number; desfecho: Desfecho } | null> {
  const servico = clienteDeServico();
  const { data, error } = await servico.rpc('registrar_evento_pagamento', { p_payload: semDadosSensiveis(corpo) });
  const linha = (Array.isArray(data) ? data[0] : data) as { evento_id?: number } | null | undefined;
  if (error || typeof linha?.evento_id !== 'number') {
    console.error('Não foi possível guardar o aviso de pagamento:', error?.message ?? 'resposta inesperada');
    return null;
  }
  return { eventoId: linha.evento_id, desfecho: await processarAviso(linha.evento_id, servico) };
}

async function acharPessoa(servico: Servico, email: string): Promise<string | null> {
  const { data } = await servico.from('perfis').select('id').eq('email', email).maybeSingle();
  return typeof data?.id === 'string' ? data.id : null;
}

// Depois de liberar o acesso: quem nunca entrou recebe o link para criar a senha; quem já tem
// senha recebe só o aviso com o botão de entrar. Falha no e-mail não desfaz a matrícula.
async function avisarDoAcesso(servico: Servico, alunoId: string, email: string): Promise<void> {
  const { data: conta } = await servico.auth.admin.getUserById(alunoId);
  if (!conta?.user?.last_sign_in_at) {
    await enviarLinkDeSenha(email, 'compra');
    return;
  }

  const site = process.env.SITE_URL;
  if (!site) throw new Error('Falta SITE_URL. Veja o arquivo .env.example.');
  const { data: perfil } = await servico.from('perfis').select('nome').eq('id', alunoId).maybeSingle();
  let falha: string | null = null;
  try {
    await enviarEmail(email, emailAccesoActivo({ nombre: typeof perfil?.nome === 'string' ? perfil.nome : '', enlace: `${site}/entrar` }));
  } catch (erro) {
    falha = motivoDaFalha(erro);
    console.error(`Falha ao enviar o aviso de acesso ativo (${falha}):`, erro instanceof Error ? erro.message : erro);
  }
  await servico.from('notificacoes').insert({
    tipo: 'compra_confirmada',
    canal: 'email',
    aluno_id: alunoId,
    destinatario: email,
    enviada_em: falha === null ? new Date().toISOString() : null,
    erro: falha,
  });
}

export async function processarAviso(eventoId: number, servico: Servico = clienteDeServico()): Promise<Desfecho> {
  const { data: guardado } = await servico.from('eventos_pagamento').select('payload, processado_em').eq('id', eventoId).maybeSingle();
  if (!guardado) return 'invalido';
  if (guardado.processado_em !== null) return 'ja_processado';

  const pendente = async (motivo: Desfecho | string): Promise<void> => {
    await servico.from('eventos_pagamento').update({ erro: motivo }).eq('id', eventoId).is('processado_em', null);
  };
  const concluir = async (observacao: string | null): Promise<void> => {
    await servico
      .from('eventos_pagamento')
      .update({ processado_em: new Date().toISOString(), erro: observacao })
      .eq('id', eventoId)
      .is('processado_em', null);
  };

  const leitura = lerEventoGreenn(guardado.payload);
  if (!leitura.ok) {
    await pendente(leitura.motivo);
    return 'invalido';
  }
  const evento = leitura.evento;
  const acao = acaoDoEvento(evento);
  // Pagamento pendente, recusado e afins: fica guardado para consulta, sem mexer em matrícula.
  if (acao === 'nenhuma' || evento.cliente === null || evento.produtoId === null) {
    await concluir(null);
    return 'ignorado';
  }

  // Produto sem oferta cadastrada: nada de criar conta para quem comprou outra coisa.
  const { data: oferta } = await servico
    .from('ofertas')
    .select('curso_id')
    .eq('greenn_product_id', evento.produtoId)
    .eq('ativa', true)
    .maybeSingle();
  if (typeof oferta?.curso_id !== 'string') {
    await pendente('oferta_desconhecida');
    return 'oferta_desconhecida';
  }

  const email = evento.cliente.email;
  let alunoId = await acharPessoa(servico, email);
  if (alunoId === null) {
    // Reembolso ou cancelamento de quem não tem conta: não há o que encerrar.
    if (acao !== 'liberar') {
      await concluir('aluno_desconhecido');
      return 'aluno_desconhecido';
    }
    const { data: criada, error } = await servico.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { nome: evento.cliente.nome },
    });
    // Dois avisos da mesma compra podem chegar juntos: se o outro criou a conta, ela é usada.
    alunoId = criada?.user?.id ?? (await acharPessoa(servico, email));
    if (alunoId === null) {
      console.error('Não foi possível criar a conta de quem comprou:', error?.message ?? 'sem resposta');
      await pendente('conta_nao_criada');
      return 'conta_nao_criada';
    }
  }

  const { data: antes } = await servico
    .from('matriculas')
    .select('situacao, expira_em')
    .eq('aluno_id', alunoId)
    .eq('curso_id', oferta.curso_id)
    .maybeSingle();
  const tinhaAcesso =
    antes?.situacao === 'ativa' && (antes.expira_em === null || new Date(String(antes.expira_em)).getTime() > Date.now());

  const { data: resultado, error } = await servico.rpc('aplicar_evento_pagamento', { p_evento: eventoId, p_aluno: alunoId });
  if (error || typeof resultado !== 'string') {
    console.error('Não foi possível aplicar o aviso de pagamento:', error?.message ?? 'resposta inesperada');
    await pendente('falha_ao_aplicar');
    return 'falha_ao_aplicar';
  }

  // A renovação de quem já estava com acesso não manda e-mail: não mudou nada para a pessoa.
  if (resultado === 'acesso_liberado' && !tinhaAcesso) {
    try {
      await avisarDoAcesso(servico, alunoId, email);
    } catch (erro) {
      console.error('Acesso liberado, mas o e-mail não saiu:', erro instanceof Error ? erro.message : erro);
    }
  }
  return resultado as Desfecho;
}

// A administração decide que um aviso pendente não precisa de nada (compra de outro produto,
// por exemplo): ele sai da lista de pendentes e continua guardado.
export async function dispensarAviso(eventoId: number): Promise<boolean> {
  const { data, error } = await clienteDeServico()
    .from('eventos_pagamento')
    .update({ processado_em: new Date().toISOString(), erro: 'dispensado' })
    .eq('id', eventoId)
    .is('processado_em', null)
    .select('id');
  return !error && (data ?? []).length > 0;
}
