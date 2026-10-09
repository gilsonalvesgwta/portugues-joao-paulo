// Fotografa as telas do aplicativo em tamanho de computador e de celular.
// Uso: com o aplicativo no ar (npm start), rodar `npm run capturas`.
// Falha se alguma tela não abrir ou se, no celular, o conteúdo passar da largura da tela.
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const rotas = ['entrar', 'primer-acceso', 'recuperar'];
const telas = [
  { nome: 'computador', width: 1280, height: 800 },
  { nome: 'celular', width: 390, height: 844 },
];

await mkdir('capturas', { recursive: true });
const navegador = await chromium.launch();
let falhas = 0;

for (const tela of telas) {
  const contexto = await navegador.newContext({ viewport: { width: tela.width, height: tela.height } });
  const pagina = await contexto.newPage();
  for (const rota of rotas) {
    const resposta = await pagina.goto(`${base}/${rota}`, { waitUntil: 'networkidle' });
    if (!resposta || !resposta.ok()) {
      falhas += 1;
      console.error(`FALHOU: /${rota} respondeu ${resposta ? resposta.status() : 'sem resposta'}`);
      continue;
    }
    await pagina.evaluate(() => document.fonts.ready);
    const sobra = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (sobra > 0) {
      falhas += 1;
      console.error(`FALHOU: /${rota} em ${tela.nome} passa ${sobra}px da largura da tela`);
    }
    await pagina.screenshot({ path: `capturas/${rota}-${tela.nome}.png`, fullPage: true });
    console.log(`ok - /${rota} em ${tela.nome}`);
  }
  await contexto.close();
}

await navegador.close();
if (falhas > 0) process.exit(1);
