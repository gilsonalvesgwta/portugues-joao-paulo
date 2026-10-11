import { NextResponse } from 'next/server';
import { segredoConfere } from '@/lib/greenn';
import { receberAviso } from '@/lib/pagamentos';

// Endereço que a Greenn chama a cada mudança de uma venda ou de uma assinatura.
// PROVISÓRIO: a documentação pública da Greenn não descreve assinatura nem senha no aviso, então
// a proteção é um segredo longo no próprio endereço (GREENN_WEBHOOK_SEGREDO). Sem o segredo
// certo, a resposta é a de uma página que não existe.
//
// Respostas: 200 quando o aviso foi guardado (mesmo que tenha ficado pendente: a administração
// resolve pela tela de pagamentos); 400 quando não é um aviso; 500 quando nem guardar foi
// possível, para a Greenn tentar de novo.

export const dynamic = 'force-dynamic';

const TAMANHO_MAX = 200_000;
const SEGREDO_MIN = 24;

export async function POST(pedido: Request, contexto: { params: Promise<{ segredo: string }> }): Promise<Response> {
  const { segredo } = await contexto.params;
  const esperado = process.env.GREENN_WEBHOOK_SEGREDO ?? '';
  if (esperado.length < SEGREDO_MIN || !segredoConfere(segredo, esperado)) {
    return new NextResponse(null, { status: 404 });
  }

  const texto = await pedido.text();
  if (texto.length > TAMANHO_MAX) return NextResponse.json({ ok: false, motivo: 'grande_demais' }, { status: 413 });
  let corpo: unknown;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return NextResponse.json({ ok: false, motivo: 'formato' }, { status: 400 });
  }
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) {
    return NextResponse.json({ ok: false, motivo: 'formato' }, { status: 400 });
  }
  // Carrinho abandonado traz os dados de quem não comprou. A plataforma não usa: nem guarda.
  if ((corpo as { type?: unknown }).type === 'lead') return NextResponse.json({ ok: true, resultado: 'ignorado' });

  try {
    const recebido = await receberAviso(corpo);
    if (recebido === null) return NextResponse.json({ ok: false, motivo: 'tente_de_novo' }, { status: 500 });
    return NextResponse.json({ ok: true, resultado: recebido.desfecho });
  } catch (erro) {
    console.error('Falha ao receber o aviso de pagamento:', erro instanceof Error ? erro.message : erro);
    return NextResponse.json({ ok: false, motivo: 'tente_de_novo' }, { status: 500 });
  }
}
