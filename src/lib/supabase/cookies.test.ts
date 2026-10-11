import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cookieDaSessao } from './cookies.ts';

test('o cookie da sessão nunca fica ao alcance dos programas da página', () => {
  const cookie = cookieDaSessao({ path: '/', maxAge: 100, httpOnly: false }, { SITE_URL: 'https://aulas.exemplo.com' });
  assert.deepEqual(cookie, { path: '/', maxAge: 100, httpOnly: true, sameSite: 'lax', secure: true });
});

test('só em endereço https o cookie exige cifra (no teste local, por http, ele continua funcionando)', () => {
  assert.equal(cookieDaSessao({}, { SITE_URL: 'http://127.0.0.1:3000' }).secure, false);
  assert.equal(cookieDaSessao({}, {}).secure, false);
  assert.equal(cookieDaSessao({}, { SITE_URL: ' HTTPS://Aulas.exemplo.com ' }).secure, true);
  assert.equal(cookieDaSessao({ maxAge: 0 }, {}).maxAge, 0, 'apagar o cookie continua funcionando');
});
