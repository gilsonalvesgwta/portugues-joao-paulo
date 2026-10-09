import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Email } from './emails';

// Envio de e-mail. O jeito de enviar é escolhido pela variável EMAIL_DRIVER:
// - "arquivo": grava cada e-mail como um arquivo na pasta EMAIL_PASTA, sem enviar nada.
//   Serve para o desenvolvimento e para os testes automáticos.
// O serviço de envio real (Resend, Amazon SES ou outro) ainda não foi escolhido.
// Até lá, qualquer outro valor falha com uma mensagem clara, para que um e-mail
// nunca "suma" em silêncio.

let contador = 0;

export async function enviarEmail(para: string, email: Email): Promise<void> {
  const driver = process.env.EMAIL_DRIVER ?? '';

  if (driver === 'arquivo') {
    const pasta = process.env.EMAIL_PASTA;
    if (!pasta) throw new Error('EMAIL_DRIVER=arquivo exige a variável EMAIL_PASTA.');
    await mkdir(pasta, { recursive: true });
    contador += 1;
    const nome = `${Date.now()}-${String(contador).padStart(4, '0')}.json`;
    await writeFile(join(pasta, nome), JSON.stringify({ para, ...email }, null, 2), 'utf8');
    return;
  }

  throw new Error(
    `EMAIL_DRIVER="${driver}" não é um envio de e-mail configurado. O serviço de envio real ainda não foi definido.`,
  );
}
