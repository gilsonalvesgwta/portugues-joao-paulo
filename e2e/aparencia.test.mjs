// Teste de ponta a ponta da aparência dos botões: o botão principal precisa ter fundo verde e
// letra branca, e o secundário, fundo claro e letra escura. Sem isso o texto some no fundo da
// página. Confere a cor que o navegador de fato pinta, na tela de acesso e na administração.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { admin, base, criarPessoa, emailDeTeste, entrar, novaPagina, senha } from './apoio.mjs';

const sufixo = randomBytes(3).toString('hex');
const professor = { email: emailDeTeste('professor-cores'), nome: 'Professor Cores', papel: 'professor' };
const VERDE = 'rgb(7, 94, 84)';
const BRANCO = 'rgb(255, 255, 255)';
const TEXTO = 'rgb(23, 33, 31)';

let navegador;
let pagina;

// As cores que o navegador pinta em um elemento, já resolvidas.
async function cores(elemento) {
  await elemento.waitFor();
  return elemento.evaluate((el) => {
    const estilo = getComputedStyle(el);
    return { fundo: estilo.backgroundColor, letra: estilo.color };
  });
}

// Quanto a letra se destaca do fundo, pela regra WCAG (de 1 a 21). Letra da cor do fundo dá 1;
// abaixo de 3 um botão já é difícil de ler.
function contraste(a, b) {
  const luz = (cor) => {
    const [r, g, bl] = cor.match(/[\d.]+/g).slice(0, 3).map((v) => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [clara, escura] = [luz(a), luz(b)].sort((x, y) => y - x);
  return (clara + 0.05) / (escura + 0.05);
}

before(async () => {
  navegador = await chromium.launch();
  await criarPessoa(professor);
  const { error } = await admin.from('cursos').insert({ titulo_pt: `Curso das cores ${sufixo}`, titulo_es: `Curso de colores ${sufixo}` });
  assert.equal(error, null, error?.message);
  pagina = await novaPagina(navegador);
});

after(async () => {
  await navegador?.close();
});

test('o botão de entrar tem fundo verde e letra branca', async () => {
  await pagina.goto(`${base}/entrar`);
  const botao = await cores(pagina.getByRole('button', { name: 'Acceder a mis clases' }));
  assert.deepEqual(botao, { fundo: VERDE, letra: BRANCO });
});

test('na administração, o botão principal é verde com letra branca e o secundário é claro com letra escura', async () => {
  await entrar(pagina, professor.email, senha);
  await pagina.waitForURL('**/admin');
  await pagina.goto(`${base}/admin/cursos`);

  const novoCurso = await cores(pagina.getByRole('link', { name: 'Novo curso', exact: true }));
  assert.deepEqual(novoCurso, { fundo: VERDE, letra: BRANCO }, 'Novo curso');

  await pagina.getByRole('heading', { name: `Curso das cores ${sufixo}` }).waitFor();
  const novoModulo = await cores(pagina.getByRole('link', { name: 'Novo módulo', exact: true }).first());
  assert.deepEqual(novoModulo, { fundo: VERDE, letra: BRANCO }, 'Novo módulo');

  const editar = await cores(pagina.getByRole('link', { name: 'Editar curso', exact: true }).first());
  assert.deepEqual(editar, { fundo: BRANCO, letra: TEXTO }, 'Editar curso');
});

test('em cada tela da administração, nenhum botão ou link em forma de botão fica com letra apagada', async () => {
  const telas = ['/admin', '/admin/cursos', '/admin/cursos/novo', '/admin/aulas', '/admin/conversacao', '/admin/lixeira', '/cuenta'];
  for (const tela of telas) {
    await pagina.goto(`${base}${tela}`);
    await pagina.locator('h1').first().waitFor();
    const achados = await pagina.evaluate(() => {
      // O fundo que aparece atrás do elemento: o dele ou o do primeiro ancestral que tem cor.
      const fundoDe = (el) => {
        for (let no = el; no; no = no.parentElement) {
          const cor = getComputedStyle(no).backgroundColor;
          if (cor && cor !== 'rgba(0, 0, 0, 0)' && cor !== 'transparent') return cor;
        }
        return 'rgb(255, 255, 255)';
      };
      return [...document.querySelectorAll('button, a')]
        .filter((el) => el.offsetParent !== null && el.textContent.trim() !== '')
        .map((el) => ({ texto: el.textContent.trim().slice(0, 40), letra: getComputedStyle(el).color, fundo: fundoDe(el) }));
    });
    assert.ok(achados.length > 0, `${tela}: nenhum botão encontrado`);
    for (const item of achados) {
      assert.ok(contraste(item.letra, item.fundo) >= 3, `${tela}: "${item.texto}" com letra ${item.letra} sobre fundo ${item.fundo}`);
    }
  }
});
