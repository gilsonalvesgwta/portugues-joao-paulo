// Leitura das variáveis de envio de e-mail por SMTP (a caixa de e-mail da hospedagem).
// Sem dependências, para ser testada sozinha. A senha só existe em variável de ambiente:
// nunca no repositório, em registro ou em mensagem de erro.

export type ConfigDoSmtp = {
  host: string;
  porta: number;
  // true = conexão já cifrada (porta 465). false = começa aberta e sobe para cifrada (porta 587).
  cifradaDesdeOInicio: boolean;
  // Exige cifrar antes de mandar usuário e senha. Só é dispensado no próprio computador (testes).
  exigirCifra: boolean;
  usuario: string | null;
  senha: string | null;
  remetente: string;
  nomeDoRemetente: string;
};

type Ambiente = Record<string, string | undefined>;

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const LOCAL = new Set(['127.0.0.1', 'localhost', '::1']);

export class ErroDeConfiguracao extends Error {}

function ler(ambiente: Ambiente, chave: string): string {
  return (ambiente[chave] ?? '').trim();
}

export function configDoSmtp(ambiente: Ambiente = process.env): ConfigDoSmtp {
  const host = ler(ambiente, 'SMTP_HOST');
  if (host === '') throw new ErroDeConfiguracao('Falta SMTP_HOST (o servidor de envio, por exemplo smtp.hostinger.com).');

  const portaEscrita = ler(ambiente, 'SMTP_PORT') || '465';
  const porta = /^\d{1,5}$/.test(portaEscrita) ? Number(portaEscrita) : 0;
  if (porta < 1 || porta > 65535) throw new ErroDeConfiguracao('SMTP_PORT precisa ser um número de porta, como 465 ou 587.');

  const usuario = ler(ambiente, 'SMTP_USER');
  // A senha não passa por trim: espaço nas pontas pode fazer parte dela.
  const senha = ambiente.SMTP_PASS ?? '';
  const local = LOCAL.has(host.toLowerCase());
  if ((usuario === '') !== (senha === '')) {
    throw new ErroDeConfiguracao('SMTP_USER e SMTP_PASS andam juntos: preencha os dois.');
  }
  if (usuario === '' && !local) {
    throw new ErroDeConfiguracao('Faltam SMTP_USER e SMTP_PASS (o endereço e a senha da caixa de e-mail).');
  }

  const remetente = ler(ambiente, 'EMAIL_REMETENTE') || usuario;
  if (!EMAIL.test(remetente)) {
    throw new ErroDeConfiguracao('EMAIL_REMETENTE precisa ser um endereço de e-mail (em geral, o mesmo de SMTP_USER).');
  }

  return {
    host,
    porta,
    cifradaDesdeOInicio: porta === 465,
    exigirCifra: !local,
    usuario: usuario === '' ? null : usuario,
    senha: usuario === '' ? null : senha,
    remetente,
    nomeDoRemetente: ler(ambiente, 'EMAIL_NOME_REMETENTE') || 'Português com João Paulo',
  };
}

// Motivo da falha de envio em palavras simples, a partir do código de erro do envio.
export type MotivoDaFalha = 'configuracao' | 'senha' | 'conexao' | 'recusado' | 'outro';

export function motivoDaFalha(erro: unknown): MotivoDaFalha {
  if (erro instanceof ErroDeConfiguracao) return 'configuracao';
  const codigo = typeof erro === 'object' && erro !== null && 'code' in erro ? String((erro as { code: unknown }).code) : '';
  if (codigo === 'EAUTH') return 'senha';
  if (['ECONNECTION', 'ECONNREFUSED', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ENOTFOUND', 'ETLS', 'ECONNRESET'].includes(codigo)) return 'conexao';
  if (codigo === 'EENVELOPE' || codigo === 'EMESSAGE') return 'recusado';
  return 'outro';
}
