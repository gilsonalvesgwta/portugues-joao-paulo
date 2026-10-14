import { caminhoDaCopia, lerCopia } from '@/lib/admin/copias';
import { pessoaLogada } from '@/lib/supabase/servidor';

// Baixar uma cópia de segurança: só o administrador. A cópia tem os dados de todos os alunos.

export const dynamic = 'force-dynamic';

export async function GET(_pedido: Request, contexto: { params: Promise<{ nome: string }> }): Promise<Response> {
  const pessoa = await pessoaLogada();
  if (!pessoa || pessoa.papel !== 'admin') return new Response(null, { status: 404 });
  const { nome } = await contexto.params;
  const achada = await caminhoDaCopia(nome);
  if (achada === null) return new Response(null, { status: 404 });
  return new Response(lerCopia(achada.caminho), {
    headers: {
      'content-type': 'application/gzip',
      'content-length': String(achada.bytes),
      'content-disposition': `attachment; filename="${nome}"`,
      'cache-control': 'no-store',
    },
  });
}
