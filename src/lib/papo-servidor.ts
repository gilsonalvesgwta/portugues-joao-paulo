import { configDoPapo, corpoDoPedido, lerMensagem, lerResposta, type MensagemDoPapo } from './papo';
import { clienteDeServico } from './supabase/servico';
import { clienteDoServidor } from './supabase/servidor';

// O lado do servidor do Papo: confere o acesso e o limite do dia, fala com o modelo e guarda a
// conversa. O aluno só lê as próprias mensagens; quem grava é o servidor, com a chave de serviço,
// sempre depois de conferir quem está pedindo. A chave da Anthropic nunca sai do servidor.

const ESPERA_MAX_MS = 40_000;
const MENSAGENS_NA_TELA = 200;

export type SituacaoDoPapo = { ligado: boolean; liberado: boolean; limite: number; usadas: number };
export type MensagemNaTela = MensagemDoPapo & { id: number };
export type ResultadoDoEnvio = 'ok' | 'apagado' | 'sin_acceso' | 'limite' | 'vacia' | 'larga' | 'fallo';

// Com a sessão de quem está logado: a pessoa só recebe a própria situação.
export async function situacaoDoPapo(): Promise<SituacaoDoPapo> {
  const ligado = configDoPapo() !== null;
  const supabase = await clienteDoServidor();
  const { data } = await supabase.rpc('meu_papo');
  const lido = (data ?? {}) as { liberado?: unknown; limite?: unknown; usadas?: unknown };
  return {
    ligado,
    liberado: lido.liberado === true,
    limite: typeof lido.limite === 'number' ? lido.limite : 0,
    usadas: typeof lido.usadas === 'number' ? lido.usadas : 0,
  };
}

// A conversa atual da pessoa (a mais recente), com as mensagens na ordem. As regras do banco só
// entregam as conversas de quem está logado.
export async function conversaAtual(pessoaId: string): Promise<{ id: string | null; mensagens: MensagemNaTela[] }> {
  const supabase = await clienteDoServidor();
  const { data: conversa } = await supabase
    .from('conversas_papo')
    .select('id')
    .eq('aluno_id', pessoaId)
    .order('iniciada_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (typeof conversa?.id !== 'string') return { id: null, mensagens: [] };
  const { data } = await supabase
    .from('mensagens_papo')
    .select('id, autor, texto')
    .eq('conversa_id', conversa.id)
    .order('id', { ascending: false })
    .limit(MENSAGENS_NA_TELA);
  const mensagens = ((data ?? []) as unknown as MensagemNaTela[]).reverse();
  return { id: conversa.id, mensagens };
}

async function perguntarAoModelo(nome: string, mensagens: MensagemDoPapo[]) {
  const config = configDoPapo();
  if (config === null) return null;
  const resposta = await fetch(config.endereco, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': config.chave, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(corpoDoPedido(config, nome, mensagens)),
    signal: AbortSignal.timeout(ESPERA_MAX_MS),
    cache: 'no-store',
  });
  if (!resposta.ok) {
    // Só o código e o tipo do erro vão para o registro: nem a chave nem a conversa.
    let tipo = '';
    try {
      const corpo = (await resposta.json()) as { error?: { type?: unknown } };
      tipo = typeof corpo.error?.type === 'string' ? corpo.error.type : '';
    } catch {
      // Resposta sem JSON: fica só o código.
    }
    throw new Error(`o modelo respondeu ${resposta.status}${tipo ? ` (${tipo})` : ''}`);
  }
  return lerResposta(await resposta.json());
}

// Recebe a mensagem do aluno, conta no limite do dia, pede a resposta ao modelo e guarda as duas.
// Se o modelo não responder, nada é guardado e a mensagem contada volta para o aluno.
export async function enviarAoPapo(pessoa: { id: string; nome: string }, escrito: unknown): Promise<ResultadoDoEnvio> {
  if (configDoPapo() === null) return 'apagado';
  const lida = lerMensagem(escrito);
  if (!lida.ok) return lida.erro;

  const servico = clienteDeServico();
  const { data: uso, error: erroDoUso } = await servico.rpc('papo_usar', { p_pessoa: pessoa.id });
  if (erroDoUso) {
    console.error('Papo: não consegui conferir o limite do dia:', erroDoUso.message);
    return 'fallo';
  }
  const resultado = (uso as { resultado?: unknown } | null)?.resultado;
  if (resultado === 'sem_acesso') return 'sin_acceso';
  if (resultado === 'limite') return 'limite';
  if (resultado !== 'ok') return 'fallo';

  const devolver = async (): Promise<'fallo'> => {
    const { error } = await servico.rpc('papo_devolver', { p_pessoa: pessoa.id });
    if (error) console.error('Papo: não consegui devolver a mensagem contada:', error.message);
    return 'fallo';
  };

  try {
    const { data: atual } = await servico
      .from('conversas_papo')
      .select('id')
      .eq('aluno_id', pessoa.id)
      .order('iniciada_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    let conversaId = typeof atual?.id === 'string' ? atual.id : null;
    if (conversaId === null) {
      const { data: nova, error } = await servico.from('conversas_papo').insert({ aluno_id: pessoa.id }).select('id').single();
      if (error || typeof nova?.id !== 'string') throw new Error(`não consegui abrir a conversa: ${error?.message ?? 'sem resposta'}`);
      conversaId = nova.id;
    }

    const { data: anteriores } = await servico
      .from('mensagens_papo')
      .select('autor, texto')
      .eq('conversa_id', conversaId)
      .order('id', { ascending: false })
      .limit(40);
    const historico = [...((anteriores ?? []) as unknown as MensagemDoPapo[]).reverse(), { autor: 'aluno' as const, texto: lida.texto }];

    const resposta = await perguntarAoModelo(pessoa.nome, historico);
    if (resposta === null) throw new Error('o modelo não devolveu texto');

    const { error: erroAoGuardar } = await servico.from('mensagens_papo').insert([
      { conversa_id: conversaId, autor: 'aluno', texto: lida.texto },
      { conversa_id: conversaId, autor: 'papo', texto: resposta.texto, tokens_entrada: resposta.tokensEntrada, tokens_saida: resposta.tokensSaida },
    ]);
    if (erroAoGuardar) throw new Error(`não consegui guardar a conversa: ${erroAoGuardar.message}`);
    return 'ok';
  } catch (erro) {
    console.error('Papo:', erro instanceof Error ? erro.message : erro);
    return devolver();
  }
}

// Começa uma conversa nova: as anteriores ficam guardadas, e o tutor deixa de levar em conta o
// que foi dito nelas.
export async function novaConversa(pessoaId: string): Promise<boolean> {
  const servico = clienteDeServico();
  const { data: liberado } = await servico.rpc('papo_liberado', { p_pessoa: pessoaId });
  if (liberado !== true) return false;
  const { error } = await servico.from('conversas_papo').insert({ aluno_id: pessoaId });
  if (error) console.error('Papo: não consegui abrir a conversa nova:', error.message);
  return !error;
}
