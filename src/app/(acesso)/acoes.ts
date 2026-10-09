'use server';

// Ações dos formulários de acesso.
// AINDA SEM EFEITO: nesta etapa as telas são só visuais. A ligação com o login do
// Supabase (entrar, enviar o link de primeiro acesso e de nova senha) entra na
// próxima etapa. Os formulários já enviam por aqui para que a senha nunca apareça
// no endereço da página.

export async function entrar(_dados: FormData): Promise<void> {}

export async function pedirPrimeiroAcesso(_dados: FormData): Promise<void> {}

export async function pedirNovaSenha(_dados: FormData): Promise<void> {}
