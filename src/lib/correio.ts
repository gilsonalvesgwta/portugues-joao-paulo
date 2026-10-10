import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Transporter } from 'nodemailer';
import type { Email } from './emails';
// Com a extensão, este arquivo também roda direto no Node, no teste de envio por SMTP.
import { configDoSmtp, ErroDeConfiguracao } from './smtp.ts';

// Envio de e-mail. O jeito de enviar é escolhido pela variável EMAIL_DRIVER:
// - "smtp": envia pela caixa de e-mail da hospedagem (SMTP_HOST, SMTP_PORT, SMTP_USER,
//   SMTP_PASS, EMAIL_REMETENTE). É o modo de produção.
// - "arquivo": grava cada e-mail como um arquivo na pasta EMAIL_PASTA, sem enviar nada.
//   Serve para o desenvolvimento e para os testes automáticos.
// Qualquer outro valor falha com uma mensagem clara, para que um e-mail nunca "suma" em silêncio.

let contador = 0;

// Um endereço só, sem espaços, vírgulas nem quebras de linha: quem chama nunca consegue
// acrescentar outro destinatário ou outro cabeçalho à mensagem.
const DESTINATARIO = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

let transporte: { chave: string; valor: Transporter } | null = null;

async function transporteSmtp(): Promise<{ envio: Transporter; de: { name: string; address: string } }> {
  const config = configDoSmtp();
  // A chave não inclui a senha; se host, porta ou usuário mudarem, o transporte é refeito.
  const chave = `${config.host}:${config.porta}:${config.usuario ?? ''}`;
  if (!transporte || transporte.chave !== chave) {
    const { createTransport } = await import('nodemailer');
    transporte = {
      chave,
      valor: createTransport({
        host: config.host,
        port: config.porta,
        secure: config.cifradaDesdeOInicio,
        requireTLS: config.exigirCifra && !config.cifradaDesdeOInicio,
        auth: config.usuario !== null && config.senha !== null ? { user: config.usuario, pass: config.senha } : undefined,
        // Sem estes limites, um servidor que não responde deixaria a pessoa esperando na tela.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      }),
    };
  }
  return { envio: transporte.valor, de: { name: config.nomeDoRemetente, address: config.remetente } };
}

export async function enviarEmail(para: string, email: Email): Promise<void> {
  if (!DESTINATARIO.test(para)) throw new ErroDeConfiguracao('Destinatário inválido.');
  const driver = process.env.EMAIL_DRIVER ?? '';

  if (driver === 'smtp') {
    const { envio, de } = await transporteSmtp();
    await envio.sendMail({ from: de, to: para, subject: email.asunto, text: email.texto, html: email.html });
    return;
  }

  if (driver === 'arquivo') {
    const pasta = process.env.EMAIL_PASTA;
    if (!pasta) throw new ErroDeConfiguracao('EMAIL_DRIVER=arquivo exige a variável EMAIL_PASTA.');
    await mkdir(pasta, { recursive: true });
    contador += 1;
    const nome = `${Date.now()}-${String(contador).padStart(4, '0')}.json`;
    await writeFile(join(pasta, nome), JSON.stringify({ para, ...email }, null, 2), 'utf8');
    return;
  }

  throw new ErroDeConfiguracao(`EMAIL_DRIVER="${driver}" não é um envio de e-mail conhecido. Use "smtp" ou "arquivo".`);
}
