import { NextResponse } from 'next/server';
import { receberCopia } from '@/lib/admin/copias';
import { pessoaLogada } from '@/lib/supabase/servidor';

// Enviar uma cópia de segurança (a de outra instalação, ou uma baixada antes): só o administrador.
// O arquivo vem inteiro no corpo do pedido, sem formulário. Este endereço fica fora do proxy
// (src/proxy.ts), que guardaria o arquivo inteiro na memória antes de passar adiante.
//
// Contra pedido forjado por outro site: o cabeçalho "x-copia-de-seguranca" só é enviado pela
// própria tela da administração (um outro site não consegue pôr esse cabeçalho sem a permissão
// do servidor, que não existe), e a origem, quando vem, tem de ser a da plataforma.

export const dynamic = 'force-dynamic';

function mesmaOrigem(pedido: Request): boolean {
  const origem = pedido.headers.get('origin');
  if (origem === null) return true;
  let host: string;
  try {
    host = new URL(origem).host;
  } catch {
    return false;
  }
  const aceitos = [pedido.headers.get('x-forwarded-host'), pedido.headers.get('host')];
  const site = (process.env.SITE_URL ?? '').trim();
  try {
    if (site !== '') aceitos.push(new URL(site).host);
  } catch {
    // SITE_URL mal escrito: valem os cabeçalhos do pedido.
  }
  return aceitos.some((aceito) => aceito !== null && aceito !== '' && aceito === host);
}

export async function POST(pedido: Request): Promise<Response> {
  if (pedido.headers.get('x-copia-de-seguranca') !== '1' || !mesmaOrigem(pedido)) {
    return NextResponse.json({ ok: false, motivo: 'recusado' }, { status: 403 });
  }
  const pessoa = await pessoaLogada();
  if (!pessoa || pessoa.papel !== 'admin') return NextResponse.json({ ok: false, motivo: 'recusado' }, { status: 403 });
  if (pedido.body === null) return NextResponse.json({ ok: false, motivo: 'nao_e_copia' }, { status: 400 });

  const resultado = await receberCopia(pedido.body);
  if (resultado.ok) return NextResponse.json(resultado);
  const status = resultado.motivo === 'grande_demais' ? 413 : resultado.motivo === 'nao_e_copia' ? 400 : 500;
  return NextResponse.json(resultado, { status });
}
