import { createClient } from '@supabase/supabase-js';
import { configDeServico } from './config';

// Cliente com a chave de serviço: ignora as regras de acesso do banco.
// SÓ no servidor, e só onde o usuário ainda não tem sessão (pagamento, envio do link
// de acesso). Nunca importar em componente que roda no navegador.
export function clienteDeServico() {
  const { url, chaveDeServico, opcoes } = configDeServico();
  return createClient(url, chaveDeServico, { ...opcoes, auth: { persistSession: false, autoRefreshToken: false } });
}
