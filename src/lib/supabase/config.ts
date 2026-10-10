// Endereço e chave pública do Supabase. Faltando qualquer um, o aplicativo para com
// uma mensagem clara em vez de falhar de forma confusa mais adiante.
//
// Os nomes não começam com NEXT_PUBLIC_ de propósito: assim são lidos quando o aplicativo
// sobe, e não gravados dentro da imagem na hora de compilar. A mesma imagem serve a qualquer
// instalação, e só o servidor fala com o Supabase (o navegador nunca recebe estas variáveis).

export function configDoSupabase(): { url: string; chavePublica: string } {
  const url = process.env.SUPABASE_URL;
  const chavePublica = process.env.SUPABASE_ANON_KEY;
  if (!url || !chavePublica) {
    throw new Error(
      'Faltam SUPABASE_URL e SUPABASE_ANON_KEY. Veja o arquivo .env.example.',
    );
  }
  return { url, chavePublica };
}

export type Papel = 'aluno' | 'professor' | 'admin';

export function ehEquipe(papel: string | null | undefined): boolean {
  return papel === 'professor' || papel === 'admin';
}
