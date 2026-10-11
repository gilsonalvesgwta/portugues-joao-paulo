import { enviarEmail } from '@/lib/correio';
import { emailBienvenida, emailRestablecer } from '@/lib/emails';
import { motivoDaFalha } from '@/lib/smtp';
import { clienteDeServico } from '@/lib/supabase/servico';

// Envio do link de uso único para criar ou trocar a senha. Só no servidor.
// Usado pelas telas de acesso (a própria pessoa pede), pela administração (ao cadastrar um
// aluno ou reenviar o acesso) e pelo pagamento (logo depois da compra).

export type MotivoDoLink = 'primeiro_acesso' | 'nova_senha' | 'convite' | 'compra';

// 'enviado': o e-mail saiu. 'limite': já saíram links demais para esse endereço há pouco.
// 'sem_conta': não existe conta com esse e-mail. 'falhou': o envio deu erro (o motivo vai junto).
export type EnvioDoLink = { envio: 'enviado' | 'limite' | 'sem_conta' } | { envio: 'falhou'; motivo: string };

export const LIMITE_DE_LINKS = 3; // por e-mail
export const JANELA_DE_LINKS_MIN = 10;

// O limite vale para todo mundo, inclusive para a administração: ninguém usa o envio para
// encher a caixa de outra pessoa. Quem recebe a resposta decide o que mostrar: as telas de
// acesso respondem sempre igual, para não revelar quem tem conta.
export async function enviarLinkDeSenha(correo: string, motivo: MotivoDoLink): Promise<EnvioDoLink> {
  const servico = clienteDeServico();

  const desde = new Date(Date.now() - JANELA_DE_LINKS_MIN * 60_000).toISOString();
  const { count } = await servico
    .from('notificacoes')
    .select('id', { count: 'exact', head: true })
    .eq('tipo', 'enlace_acceso')
    .eq('destinatario', correo)
    .gte('agendada_para', desde);
  if ((count ?? 0) >= LIMITE_DE_LINKS) return { envio: 'limite' };

  // Só gera link para quem já tem conta (criada pela compra ou pela administração).
  const { data, error } = await servico.auth.admin.generateLink({ type: 'recovery', email: correo });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !data?.user || !tokenHash) return { envio: 'sem_conta' };

  const site = process.env.SITE_URL;
  if (!site) throw new Error('Falta SITE_URL. Veja o arquivo .env.example.');
  const enlace = `${site}/auth/confirmar?token_hash=${encodeURIComponent(tokenHash)}`;

  const { data: perfil } = await servico.from('perfis').select('nome').eq('id', data.user.id).maybeSingle();
  const nombre = typeof perfil?.nome === 'string' ? perfil.nome : '';
  const email =
    motivo === 'nova_senha' ? emailRestablecer({ nombre, enlace }) : emailBienvenida({ nombre, enlace, compra: motivo === 'compra' });

  // A falha fica no registro do servidor e no histórico, onde a administração enxerga.
  let falha: string | null = null;
  try {
    await enviarEmail(correo, email);
  } catch (erro) {
    falha = motivoDaFalha(erro);
    console.error(`Falha ao enviar o link de acesso (${falha}):`, erro instanceof Error ? erro.message : erro);
  }
  // Registro do envio, sem o link: serve ao limite acima e ao histórico da administração.
  const { error: erroDoRegistro } = await servico.from('notificacoes').insert({
    tipo: 'enlace_acceso',
    canal: 'email',
    aluno_id: data.user.id,
    destinatario: correo,
    dados: { motivo },
    enviada_em: falha === null ? new Date().toISOString() : null,
    erro: falha,
  });
  // Sem o registro o limite de envios deixa de contar: precisa aparecer no registro do servidor.
  if (erroDoRegistro) console.error('Não foi possível registrar o envio do link de acesso:', erroDoRegistro.message);

  return falha === null ? { envio: 'enviado' } : { envio: 'falhou', motivo: falha };
}
