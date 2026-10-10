'use server';

import { redirect } from 'next/navigation';
import { enviarEmail } from '@/lib/correio';
import { emailBienvenida, emailRestablecer } from '@/lib/emails';
import { motivoDaFalha } from '@/lib/smtp';
import { ehEquipe } from '@/lib/papeis';
import { clienteDeServico } from '@/lib/supabase/servico';
import { clienteDoServidor } from '@/lib/supabase/servidor';

// Ações dos formulários de acesso. Os formulários enviam por aqui (POST), então a
// senha nunca aparece no endereço da página. Erros voltam como ?error=codigo e a
// tela mostra a mensagem correspondente em espanhol.

const LIMITE_DE_LINKS = 3; // por e-mail
const JANELA_DE_LINKS_MIN = 10;

function texto(dados: FormData, campo: string): string {
  const valor = dados.get(campo);
  return typeof valor === 'string' ? valor : '';
}

function destinoPorPapel(papel: unknown): string {
  return ehEquipe(typeof papel === 'string' ? papel : null) ? '/admin' : '/inicio';
}

export async function entrar(dados: FormData): Promise<void> {
  const correo = texto(dados, 'correo').trim().toLowerCase();
  const clave = texto(dados, 'clave');
  if (correo === '' || clave.length < 8) redirect('/entrar?error=datos');

  const supabase = await clienteDoServidor();
  const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
  // Mesma mensagem para e-mail desconhecido e senha errada: não revela quem tem conta.
  if (error || !data.user) redirect('/entrar?error=credenciales');

  // O mesmo cliente já está com a sessão nova: consulta o papel para decidir o destino.
  const { data: perfil } = await supabase.from('perfis').select('papel').eq('id', data.user.id).maybeSingle();
  redirect(destinoPorPapel(perfil?.papel));
}

export async function sair(): Promise<void> {
  const supabase = await clienteDoServidor();
  await supabase.auth.signOut();
  redirect('/entrar');
}

// Envia o link de uso único para criar a senha. A resposta na tela é sempre a mesma,
// exista ou não uma conta com aquele e-mail, e há um limite de envios por e-mail para
// que ninguém use o formulário para encher a caixa de outra pessoa.
async function enviarLinkDeSenha(correo: string, motivo: 'primeiro_acesso' | 'nova_senha'): Promise<void> {
  const servico = clienteDeServico();

  const desde = new Date(Date.now() - JANELA_DE_LINKS_MIN * 60_000).toISOString();
  const { count } = await servico
    .from('notificacoes')
    .select('id', { count: 'exact', head: true })
    .eq('tipo', 'enlace_acceso')
    .eq('destinatario', correo)
    .gte('agendada_para', desde);
  if ((count ?? 0) >= LIMITE_DE_LINKS) return;

  // Só gera link para quem já tem conta (criada pela compra ou pela administração).
  const { data, error } = await servico.auth.admin.generateLink({ type: 'recovery', email: correo });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !data?.user || !tokenHash) return;

  const site = process.env.SITE_URL;
  if (!site) throw new Error('Falta SITE_URL. Veja o arquivo .env.example.');
  const enlace = `${site}/auth/confirmar?token_hash=${encodeURIComponent(tokenHash)}`;

  const { data: perfil } = await servico.from('perfis').select('nome').eq('id', data.user.id).maybeSingle();
  const nombre = typeof perfil?.nome === 'string' ? perfil.nome : '';
  const email = motivo === 'primeiro_acesso' ? emailBienvenida({ nombre, enlace }) : emailRestablecer({ nombre, enlace });

  // Se o envio falhar, a tela responde igual (para não revelar que a conta existe) e a falha
  // fica no registro do servidor e no histórico, onde a administração enxerga.
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
}

function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

export async function pedirPrimeiroAcesso(dados: FormData): Promise<void> {
  const correo = texto(dados, 'correo').trim().toLowerCase();
  if (!correoValido(correo)) redirect('/primer-acceso?error=correo');
  await enviarLinkDeSenha(correo, 'primeiro_acesso');
  redirect('/primer-acceso?enviado=1');
}

export async function pedirNovaSenha(dados: FormData): Promise<void> {
  const correo = texto(dados, 'correo').trim().toLowerCase();
  if (!correoValido(correo)) redirect('/recuperar?error=correo');
  await enviarLinkDeSenha(correo, 'nova_senha');
  redirect('/recuperar?enviado=1');
}

// O link do e-mail abre uma tela com um botão, e só o clique no botão gasta o link.
// Assim, programas de e-mail que "visitam" os links para conferir não o invalidam.
export async function confirmarEnlace(dados: FormData): Promise<void> {
  const tokenHash = texto(dados, 'token_hash');
  if (tokenHash === '') redirect('/recuperar?error=enlace');

  const supabase = await clienteDoServidor();
  const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
  if (error) redirect('/recuperar?error=enlace');
  redirect('/nueva-contrasena');
}

export async function definirSenha(dados: FormData): Promise<void> {
  const nueva = texto(dados, 'nueva');
  const repetida = texto(dados, 'repetida');
  if (nueva.length < 8) redirect('/nueva-contrasena?error=corta');
  if (nueva !== repetida) redirect('/nueva-contrasena?error=distintas');

  const supabase = await clienteDoServidor();
  const { data: sessao } = await supabase.auth.getUser();
  if (!sessao.user) redirect('/entrar');

  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) redirect('/nueva-contrasena?error=fallo');

  const { data: perfil } = await supabase.from('perfis').select('papel').eq('id', sessao.user.id).maybeSingle();
  redirect(destinoPorPapel(perfil?.papel));
}
