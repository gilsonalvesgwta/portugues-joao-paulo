// Teste de levar a plataforma para outra VPS, pela tela "Cópias de segurança". Roda só no GitHub,
// em duas partes, com a stack apagada e instalada do zero entre elas:
//
//   node e2e/so-na-stack/levar-para-outra-vps.mjs exportar <arquivo>
//     na instalação antiga: faz uma cópia na hora e baixa o arquivo, como o administrador faria;
//   node e2e/so-na-stack/levar-para-outra-vps.mjs importar <arquivo>
//     na instalação nova, entrando com o primeiro administrador dela: envia o arquivo, restaura e
//     espera a plataforma dizer que terminou.
//
// Quem chama confere, pelo banco, que os dados da nova ficaram iguais aos da antiga.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { chromium } from 'playwright';
import { base, entrar, novaPagina } from '../apoio.mjs';

const [modo, arquivo] = process.argv.slice(2);
assert.ok((modo === 'exportar' || modo === 'importar') && arquivo, 'uso: levar-para-outra-vps.mjs exportar|importar <arquivo>');
const email = process.env.ADMIN_EMAIL;
const senhaInicial = process.env.ADMIN_SENHA_INICIAL;
assert.ok(email && senhaInicial, 'faltam ADMIN_EMAIL e ADMIN_SENHA_INICIAL');

const navegador = await chromium.launch();
try {
  const pagina = await novaPagina(navegador);
  await entrar(pagina, email, senhaInicial);
  await pagina.waitForURL('**/admin');
  await pagina.goto(`${base}/admin/copias`);
  const linhas = () => pagina.getByRole('list', { name: 'Cópias guardadas' }).getByRole('listitem');

  if (modo === 'exportar') {
    await pagina.getByRole('button', { name: 'Fazer uma cópia agora' }).click();
    await pagina.waitForURL('**/admin/copias?aviso=copia_pedida');
    const nova = linhas().filter({ hasText: 'Feita na hora' }).first();
    await nova.waitFor({ timeout: 60_000 });
    // A mais nova fica no topo da lista.
    const [baixado] = await Promise.all([pagina.waitForEvent('download'), linhas().first().getByRole('link', { name: /^Baixar/ }).click()]);
    assert.match(baixado.suggestedFilename(), /-manual\.sql\.gz$/);
    await baixado.saveAs(arquivo);
    const texto = gunzipSync(await readFile(arquivo)).toString('utf8');
    assert.ok(texto.includes('-- PostgreSQL database dump complete'), 'a cópia baixada está completa');
    console.log(`cópia baixada: ${baixado.suggestedFilename()} (${(await readFile(arquivo)).length} bytes)`);
  } else {
    // A instalação nova ainda não tem cópia enviada nem restauração.
    assert.equal(await linhas().filter({ hasText: 'Enviada' }).count(), 0);
    await pagina.locator('#arquivo_da_copia').setInputFiles(arquivo);
    await pagina.getByRole('button', { name: 'Enviar cópia' }).click();
    await pagina.waitForURL('**/admin/copias?aviso=copia_enviada');
    await linhas().filter({ hasText: 'Enviada' }).getByRole('link', { name: /^Restaurar a cópia de/ }).click();
    await pagina.waitForURL('**/admin/copias/restaurar?arquivo=*');
    await pagina.getByLabel('Para confirmar, escreva RESTAURAR').fill('RESTAURAR');
    await pagina.getByRole('button', { name: 'Restaurar esta cópia' }).click();
    await pagina.waitForURL('**/admin/copias?aviso=restauracao_pedida*');
    // A tela se atualiza sozinha até o fim. Depois da troca, a sessão de quem pediu pode não
    // existir mais na cópia: se a tela mandar entrar de novo, o teste lê o resultado entrando de novo.
    let feito = false;
    for (let i = 0; i < 40 && !feito; i++) {
      await pagina.waitForTimeout(3000);
      if (!pagina.url().includes('/admin/copias')) {
        await entrar(pagina, email, senhaInicial);
        await pagina.waitForURL('**/admin');
        await pagina.goto(`${base}/admin/copias`);
      }
      const historico = await pagina.locator('main').innerText();
      if (historico.includes('Restauração não feita')) assert.fail(`a restauração falhou:\n${historico}`);
      feito = historico.includes('Restauração feita');
    }
    assert.ok(feito, 'a restauração não terminou em 2 minutos');
    await pagina.getByText('Antes de restaurar', { exact: true }).first().waitFor();
    await pagina.screenshot({ path: 'capturas/admin-copias-restaurada.png', fullPage: true });
    console.log('restauração feita pela tela, na instalação nova');
  }
} finally {
  await navegador.close();
}
