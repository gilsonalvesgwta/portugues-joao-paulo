import { assinarChave } from './chaves.ts';
import { buscaComRotas, type Rotas } from './rotas.ts';

// Como o aplicativo encontra o login e os dados. Há dois jeitos de instalar:
//
// 1. Banco próprio (produção na VPS): SUPABASE_AUTH_URL, SUPABASE_REST_URL e SUPABASE_JWT_SECRET.
//    O aplicativo fala direto com o serviço de login e com o de dados, por endereços internos,
//    e assina as próprias chaves a partir do segredo.
// 2. Supabase completo (desenvolvimento e testes): SUPABASE_URL, SUPABASE_ANON_KEY e
//    SUPABASE_SERVICE_ROLE_KEY.
//
// Nenhum nome começa com NEXT_PUBLIC_: tudo é lido quando o aplicativo sobe, nada é gravado na
// imagem, e só o servidor fala com o banco (o navegador nunca recebe estas variáveis).
// Faltando algo, o aplicativo para com uma mensagem clara em vez de falhar de forma confusa.

type Ambiente = Record<string, string | undefined>;
type Opcoes = { global?: { fetch: typeof fetch } };

export type ConfigDoSupabase = { url: string; chavePublica: string; opcoes: Opcoes };

// Endereço de fachada do modo "banco próprio". Nunca é chamado: toda chamada é trocada pelo
// endereço real do serviço. Também dá nome fixo ao cookie da sessão.
const BASE_INTERNA = 'http://plataforma.interna';

function ler(ambiente: Ambiente, chave: string): string {
  return (ambiente[chave] ?? '').trim();
}

function semBarraNoFim(endereco: string): string {
  return endereco.replace(/\/+$/, '');
}

function rotasDe(ambiente: Ambiente): Rotas | null {
  const auth = ler(ambiente, 'SUPABASE_AUTH_URL');
  const rest = ler(ambiente, 'SUPABASE_REST_URL');
  if (auth === '' && rest === '') return null;
  if (auth === '' || rest === '') {
    throw new Error('SUPABASE_AUTH_URL e SUPABASE_REST_URL andam juntos: preencha os dois.');
  }
  return { auth: semBarraNoFim(auth), rest: semBarraNoFim(rest) };
}

// As chaves assinadas valem por anos; guardar evita assinar de novo a cada pedido.
const assinadas = new Map<string, string>();

function chave(ambiente: Ambiente, papel: 'anon' | 'service_role'): string {
  const pronta = ler(ambiente, papel === 'anon' ? 'SUPABASE_ANON_KEY' : 'SUPABASE_SERVICE_ROLE_KEY');
  if (pronta !== '') return pronta;
  const segredo = ler(ambiente, 'SUPABASE_JWT_SECRET');
  if (segredo === '') {
    throw new Error(
      papel === 'anon'
        ? 'Falta SUPABASE_ANON_KEY (ou SUPABASE_JWT_SECRET). Veja o arquivo .env.example.'
        : 'Falta SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_JWT_SECRET). Veja o arquivo .env.example.',
    );
  }
  const guardada = assinadas.get(`${papel}:${segredo}`);
  if (guardada) return guardada;
  const nova = assinarChave(segredo, papel);
  assinadas.set(`${papel}:${segredo}`, nova);
  return nova;
}

function enderecoEOpcoes(ambiente: Ambiente): { url: string; opcoes: Opcoes } {
  const rotas = rotasDe(ambiente);
  if (rotas) return { url: BASE_INTERNA, opcoes: { global: { fetch: buscaComRotas(BASE_INTERNA, rotas) } } };
  const url = semBarraNoFim(ler(ambiente, 'SUPABASE_URL'));
  if (url === '') {
    throw new Error('Falta SUPABASE_URL (ou SUPABASE_AUTH_URL e SUPABASE_REST_URL). Veja o arquivo .env.example.');
  }
  return { url, opcoes: {} };
}

export function configDoSupabase(ambiente: Ambiente = process.env): ConfigDoSupabase {
  return { ...enderecoEOpcoes(ambiente), chavePublica: chave(ambiente, 'anon') };
}

// A chave de serviço ignora as regras de acesso do banco. Só no servidor.
export function configDeServico(ambiente: Ambiente = process.env): { url: string; chaveDeServico: string; opcoes: Opcoes } {
  return { ...enderecoEOpcoes(ambiente), chaveDeServico: chave(ambiente, 'service_role') };
}
