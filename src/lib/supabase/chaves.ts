import { createHmac } from 'node:crypto';

// As duas chaves que o aplicativo usa para falar com o login e com os dados são "crachás"
// assinados com o segredo da instalação: um de visitante (anon) e um de serviço (service_role).
// Na instalação com banco próprio, o aplicativo assina os dois sozinho a partir do segredo.
// Assim, quem instala só precisa inventar o segredo, sem montar chave nenhuma à mão.

export type PapelDaChave = 'anon' | 'service_role';

const DEZ_ANOS = 10 * 365 * 24 * 60 * 60;
export const TAMANHO_MINIMO_DO_SEGREDO = 32;

function base64url(texto: string): string {
  return Buffer.from(texto, 'utf8').toString('base64url');
}

export function assinarChave(segredo: string, papel: PapelDaChave, agoraSeg: number = Math.floor(Date.now() / 1000)): string {
  if (segredo.length < TAMANHO_MINIMO_DO_SEGREDO) {
    throw new Error(`SUPABASE_JWT_SECRET precisa ter pelo menos ${TAMANHO_MINIMO_DO_SEGREDO} letras ou números.`);
  }
  const cabecalho = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const corpo = base64url(JSON.stringify({ role: papel, iss: 'supabase', iat: agoraSeg, exp: agoraSeg + DEZ_ANOS }));
  const assinatura = createHmac('sha256', segredo).update(`${cabecalho}.${corpo}`).digest('base64url');
  return `${cabecalho}.${corpo}.${assinatura}`;
}
