import { clienteDoServidor } from '@/lib/supabase/servidor';

// Para o painel: o limite diário do Papo e quanto ele foi usado nos últimos 7 dias.
// Com a sessão da equipe (as regras do banco deixam a equipe ler o uso de todos).
export async function usoDoPapo(): Promise<{ limite: number; mensagens: number; pessoas: number }> {
  const supabase = await clienteDoServidor();
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [limite, uso] = await Promise.all([
    supabase.rpc('config_int', { p_chave: 'papo_mensagens_por_dia', p_padrao: 40 }),
    supabase.from('uso_diario').select('aluno_id, mensagens').gte('dia', desde).gt('mensagens', 0),
  ]);
  const linhas = (uso.data ?? []) as unknown as { aluno_id: string; mensagens: number }[];
  return {
    limite: typeof limite.data === 'number' ? Math.max(limite.data, 0) : 40,
    mensagens: linhas.reduce((soma, linha) => soma + Number(linha.mensagens), 0),
    pessoas: new Set(linhas.map((linha) => linha.aluno_id)).size,
  };
}
