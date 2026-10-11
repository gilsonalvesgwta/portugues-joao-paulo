import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enderecoPublico } from './endereco.ts';

const interno = new URL('http://0.0.0.0:3000/inicio?curso=abc#hoy');

test('o redirecionamento usa o endereço público da plataforma, não o endereço interno do pedido', () => {
  assert.equal(enderecoPublico('/entrar', interno, { SITE_URL: 'https://aulas.exemplo.com' }).href, 'https://aulas.exemplo.com/entrar');
  assert.equal(enderecoPublico('/inicio', interno, { SITE_URL: ' https://aulas.exemplo.com/ ' }).href, 'https://aulas.exemplo.com/inicio');
  assert.equal(enderecoPublico('/entrar', interno, { SITE_URL: 'http://127.0.0.1:3200' }).href, 'http://127.0.0.1:3200/entrar');
});

test('só a origem do endereço público é usada: caminho e sobras ficam de fora', () => {
  assert.equal(enderecoPublico('/entrar', interno, { SITE_URL: 'https://aulas.exemplo.com/alguma/pasta?x=1' }).href, 'https://aulas.exemplo.com/entrar');
});

test('sem endereço público (ou com ele mal escrito), vale o do pedido, sem a busca nem a âncora', () => {
  assert.equal(enderecoPublico('/entrar', interno, {}).href, 'http://0.0.0.0:3000/entrar');
  assert.equal(enderecoPublico('/entrar', interno, { SITE_URL: 'aulas.exemplo.com' }).href, 'http://0.0.0.0:3000/entrar');
  assert.equal(enderecoPublico('/entrar', interno, { SITE_URL: 'javascript:alert(1)' }).href, 'http://0.0.0.0:3000/entrar');
  assert.equal(enderecoPublico('/entrar', interno, { SITE_URL: 'https://' }).href, 'http://0.0.0.0:3000/entrar');
});
