import { createClient } from '@supabase/supabase-js';
import { configDoSupabase } from './config';

// Cliente com a chave de serviço: ignora as regras de acesso do banco.
// SÓ no servidor, e só onde o usuário ainda não tem sessão (pagamento, envio do link
// de acesso). Nunca importar em componente que roda no navegador.
export function clienteDeServico() {
  const { url } = configDoSupabase();
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY. Veja o arquivo .env.example.');
  }
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}
