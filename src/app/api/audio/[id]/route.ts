import { bytesDoBanco, pedacoPedido } from '@/lib/audios';
import { ehUuid } from '@/lib/conteudo';
import { clienteDeServico } from '@/lib/supabase/servico';
import { pessoaLogada } from '@/lib/supabase/servidor';

// O som de uma palavra do jogo de pares, para quem está logado. O endereço leva só o
// identificador da gravação, nunca a palavra. Atende pedidos de pedaço (Range): sem isso o
// Safari não toca o áudio.

export const dynamic = 'force-dynamic';

export async function GET(pedido: Request, contexto: { params: Promise<{ id: string }> }): Promise<Response> {
  const pessoa = await pessoaLogada();
  if (!pessoa) return new Response(null, { status: 404 });
  const { id } = await contexto.params;
  if (!ehUuid(id)) return new Response(null, { status: 404 });

  const { data } = await clienteDeServico().from('audios').select('tipo, dados').eq('id', id).maybeSingle();
  const bytes = bytesDoBanco(data?.dados);
  if (!data || bytes === null || typeof data.tipo !== 'string') return new Response(null, { status: 404 });

  const cabecalhos = {
    'content-type': data.tipo,
    'accept-ranges': 'bytes',
    // A gravação nunca muda (uma nova ganha outro identificador): o navegador pode guardar.
    'cache-control': 'private, max-age=31536000, immutable',
  };
  const pedaco = pedacoPedido(pedido.headers.get('range'), bytes.length);
  if (pedaco === 'fora') {
    return new Response(null, { status: 416, headers: { ...cabecalhos, 'content-range': `bytes */${bytes.length}` } });
  }
  if (pedaco === null) {
    return new Response(bytes, { headers: { ...cabecalhos, 'content-length': String(bytes.length) } });
  }
  const parte = bytes.subarray(pedaco.inicio, pedaco.fim + 1);
  return new Response(parte, {
    status: 206,
    headers: { ...cabecalhos, 'content-length': String(parte.length), 'content-range': `bytes ${pedaco.inicio}-${pedaco.fim}/${bytes.length}` },
  });
}
