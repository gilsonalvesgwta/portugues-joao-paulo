// Endereço e chave pública do Supabase. Faltando qualquer um, o aplicativo para com
// uma mensagem clara em vez de falhar de forma confusa mais adiante.

export function configDoSupabase(): { url: string; chavePublica: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chavePublica = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chavePublica) {
    throw new Error(
      'Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY. Veja o arquivo .env.example.',
    );
  }
  return { url, chavePublica };
}

export type Papel = 'aluno' | 'professor' | 'admin';

export function ehEquipe(papel: string | null | undefined): boolean {
  return papel === 'professor' || papel === 'admin';
}
