import { NextResponse } from 'next/server';
import { AUDIO_MAX_BYTES, paraOBanco, tipoDoAudio } from '@/lib/audios';
import { ehUuid } from '@/lib/conteudo';
import { ehEquipe } from '@/lib/papeis';
import { clienteDoServidor, pessoaLogada } from '@/lib/supabase/servidor';

// Guardar a gravação de uma palavra do jogo de pares (gravada na tela do quiz ou enviada como
// arquivo): só a equipe. O som vem inteiro no corpo do pedido; a aula vai no endereço (?aula=).
// O formato é reconhecido pelo conteúdo. Contra pedido forjado por outro site, o cabeçalho
// "x-audio-do-quiz" só é enviado pela própria tela (outro site não consegue pôr esse cabeçalho).

export const dynamic = 'force-dynamic';

export async function POST(pedido: Request): Promise<Response> {
  if (pedido.headers.get('x-audio-do-quiz') !== '1') return NextResponse.json({ ok: false, motivo: 'recusado' }, { status: 403 });
  const pessoa = await pessoaLogada();
  if (!pessoa || !ehEquipe(pessoa.papel)) return NextResponse.json({ ok: false, motivo: 'recusado' }, { status: 403 });
  const aula = new URL(pedido.url).searchParams.get('aula') ?? '';
  if (!ehUuid(aula)) return NextResponse.json({ ok: false, motivo: 'aula' }, { status: 400 });

  const declarado = Number(pedido.headers.get('content-length') ?? '0');
  if (declarado > AUDIO_MAX_BYTES) return NextResponse.json({ ok: false, motivo: 'grande_demais' }, { status: 413 });
  const bytes = new Uint8Array(await pedido.arrayBuffer());
  if (bytes.length > AUDIO_MAX_BYTES) return NextResponse.json({ ok: false, motivo: 'grande_demais' }, { status: 413 });
  const tipo = tipoDoAudio(bytes);
  if (tipo === null) return NextResponse.json({ ok: false, motivo: 'formato' }, { status: 400 });

  // Grava com a sessão de quem pediu: as regras do banco só deixam a equipe gravar.
  const supabase = await clienteDoServidor();
  const { data, error } = await supabase.from('audios').insert({ aula_id: aula, tipo, dados: paraOBanco(bytes) }).select('id').single();
  if (error || typeof data?.id !== 'string') {
    return NextResponse.json({ ok: false, motivo: error?.code === '23503' ? 'aula' : 'falhou' }, { status: error?.code === '23503' ? 400 : 500 });
  }
  return NextResponse.json({ ok: true, id: data.id, tipo });
}
