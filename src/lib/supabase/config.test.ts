import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { assinarChave } from './chaves.ts';
import { configDeServico, configDoSupabase } from './config.ts';
import { reescrever } from './rotas.ts';

const SEGREDO = 'um-segredo-de-teste-com-mais-de-32-letras';
const ROTAS = { auth: 'http://login:9999', rest: 'http://dados:3000' };
const BASE = 'http://plataforma.interna';

function abrir(chave: string): { cabecalho: Record<string, unknown>; corpo: Record<string, unknown>; assinaturaConfere: boolean } {
  const [c, p, a] = chave.split('.');
  assert.ok(c && p && a, 'a chave tem três partes');
  const ler = (parte: string) => JSON.parse(Buffer.from(parte, 'base64url').toString('utf8')) as Record<string, unknown>;
  return {
    cabecalho: ler(c),
    corpo: ler(p),
    assinaturaConfere: createHmac('sha256', SEGREDO).update(`${c}.${p}`).digest('base64url') === a,
  };
}

test('a chave assinada tem o papel, vale dez anos e confere com o segredo', () => {
  const agora = 1_800_000_000;
  const { cabecalho, corpo, assinaturaConfere } = abrir(assinarChave(SEGREDO, 'service_role', agora));
  assert.deepEqual(cabecalho, { alg: 'HS256', typ: 'JWT' });
  assert.deepEqual(corpo, { role: 'service_role', iss: 'supabase', iat: agora, exp: agora + 315_360_000 });
  assert.equal(assinaturaConfere, true);
});

test('segredo curto é recusado', () => {
  assert.throws(() => assinarChave('curto', 'anon'), /pelo menos 32/);
});

test('reescrever troca o endereço de fachada pelo serviço certo', () => {
  assert.equal(reescrever(`${BASE}/auth/v1/token?grant_type=password`, BASE, ROTAS), 'http://login:9999/token?grant_type=password');
  assert.equal(reescrever(`${BASE}/auth/v1/admin/users`, BASE, ROTAS), 'http://login:9999/admin/users');
  assert.equal(reescrever(`${BASE}/rest/v1/perfis?select=nome&id=eq.1`, BASE, ROTAS), 'http://dados:3000/perfis?select=nome&id=eq.1');
  assert.equal(reescrever(`${BASE}/rest/v1/rpc/reservar_turma`, BASE, ROTAS), 'http://dados:3000/rpc/reservar_turma');
  assert.equal(reescrever(`${BASE}/rest/v1/`, BASE, ROTAS), 'http://dados:3000/');
  assert.equal(reescrever('https://outro.site/auth/v1/token', BASE, ROTAS), 'https://outro.site/auth/v1/token');
});

test('serviço que não faz parte da instalação enxuta vira erro claro', () => {
  assert.throws(() => reescrever(`${BASE}/storage/v1/object/x`, BASE, ROTAS), /não está instalado: \/storage\/v1\/object\/x/);
  assert.throws(() => reescrever(`${BASE}/auth/v10/x`, BASE, ROTAS), /não está instalado/);
});

test('banco próprio: endereço de fachada, busca trocada e chaves assinadas com o segredo', () => {
  const ambiente = { SUPABASE_AUTH_URL: 'http://login:9999/', SUPABASE_REST_URL: 'http://dados:3000', SUPABASE_JWT_SECRET: SEGREDO };
  const publica = configDoSupabase(ambiente);
  assert.equal(publica.url, BASE);
  assert.equal(typeof publica.opcoes.global?.fetch, 'function');
  assert.equal(abrir(publica.chavePublica).corpo.role, 'anon');
  assert.equal(abrir(publica.chavePublica).assinaturaConfere, true);
  assert.equal(configDoSupabase(ambiente).chavePublica, publica.chavePublica, 'a mesma chave a cada chamada');

  const servico = configDeServico(ambiente);
  assert.equal(abrir(servico.chaveDeServico).corpo.role, 'service_role');
  assert.notEqual(servico.chaveDeServico, publica.chavePublica);
});

test('Supabase completo: usa o endereço e as chaves informadas, sem trocar a busca', () => {
  const ambiente = { SUPABASE_URL: 'http://127.0.0.1:54321/', SUPABASE_ANON_KEY: 'publica', SUPABASE_SERVICE_ROLE_KEY: 'servico' };
  assert.deepEqual(configDoSupabase(ambiente), { url: 'http://127.0.0.1:54321', opcoes: {}, chavePublica: 'publica' });
  assert.equal(configDeServico(ambiente).chaveDeServico, 'servico');
});

test('o que falta vira erro com o nome da variável', () => {
  assert.throws(() => configDoSupabase({}), /Falta SUPABASE_URL/);
  assert.throws(() => configDoSupabase({ SUPABASE_URL: 'http://x' }), /Falta SUPABASE_ANON_KEY/);
  assert.throws(() => configDeServico({ SUPABASE_URL: 'http://x', SUPABASE_ANON_KEY: 'a' }), /Falta SUPABASE_SERVICE_ROLE_KEY/);
  assert.throws(() => configDoSupabase({ SUPABASE_AUTH_URL: 'http://login:9999', SUPABASE_JWT_SECRET: SEGREDO }), /andam juntos/);
});

test('as mensagens de erro não trazem o segredo', () => {
  try {
    configDoSupabase({ SUPABASE_AUTH_URL: 'http://login:9999', SUPABASE_REST_URL: 'http://dados:3000', SUPABASE_JWT_SECRET: 'curto-demais-xyz' });
    assert.fail('deveria falhar');
  } catch (erro) {
    assert.equal(String((erro as Error).message).includes('curto-demais-xyz'), false);
  }
});
