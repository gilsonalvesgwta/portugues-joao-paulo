'use server';

import { redirect } from 'next/navigation';
import { acessoDaMatricula, lerPapel, novaSituacao, validarEmail, validarMatricula, validarNome, validarNovaPessoa } from '@/lib/alunos';
import { ehUuid } from '@/lib/conteudo';
import type { EstadoDoFormulario } from '@/lib/formulario';
import { enviarLinkDeSenha } from '@/lib/link-de-acesso';
import { exigirAdmin as exigirAdminLogado } from '@/lib/admin/guarda';
import { clienteDeServico } from '@/lib/supabase/servico';
import { clienteDoServidor } from '@/lib/supabase/servidor';

// Ações da tela de alunos. Só o administrador chega aqui: cada ação confere de novo (a tela já
// confere, mas uma ação pode ser chamada direto). As matrículas e o nome são gravados com a
// sessão do administrador, sob as regras do banco. Criar a conta e corrigir o e-mail passam pelo
// serviço de login, que só aceita a chave de serviço: por isso a conferência vem sempre antes.

async function exigirAdmin() {
  const pessoa = await exigirAdminLogado();
  return { pessoa, supabase: await clienteDoServidor() };
}

function valoresDe(dados: FormData, campos: readonly string[]): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const campo of campos) {
    const valor = dados.get(campo);
    valores[campo] = typeof valor === 'string' ? valor : '';
  }
  return valores;
}

function comErros(anterior: EstadoDoFormulario, erros: Record<string, string>, valores: Record<string, string>): EstadoDoFormulario {
  return { vez: anterior.vez + 1, erros, valores };
}

const FALHA = 'Não foi possível salvar. Tente de novo.';
const LISTA = '/admin/alunos';
const ficha = (id: string, aviso: string, ancora = '') => `/admin/alunos/${id}?aviso=${aviso}${ancora}`;

const CAMPOS_DA_MATRICULA = ['acesso_ate', 'inclui_conversacao', 'reservas_por_semana'] as const;

type Sessao = Awaited<ReturnType<typeof clienteDoServidor>>;

async function cursoExiste(supabase: Sessao, cursoId: string): Promise<boolean> {
  const { data } = await supabase.from('cursos').select('id').eq('id', cursoId).is('arquivado_em', null).maybeSingle();
  return Boolean(data);
}

// Depois de tentar mandar o link: qual aviso a ficha mostra.
async function avisoDoEnvio(email: string, prefixo: string): Promise<string> {
  const resposta = await enviarLinkDeSenha(email, 'convite');
  if (resposta.envio === 'enviado') return `${prefixo}_enviado`;
  if (resposta.envio === 'limite') return `${prefixo}_limite`;
  return `${prefixo}_falhou`;
}

// ---------------------------------------------------------------------------
// Novo aluno
// ---------------------------------------------------------------------------

// Cadastra a pessoa (a conta nasce sem senha), matricula no curso escolhido e manda o e-mail
// com o link para ela criar a senha.
export async function criarPessoa(anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> {
  const { supabase } = await exigirAdmin();
  const valores = valoresDe(dados, ['nome', 'email', 'curso_id', ...CAMPOS_DA_MATRICULA, 'enviar_email']);
  const conferido = validarNovaPessoa(valores, new Date());
  if (!conferido.ok) return comErros(anterior, conferido.erros, valores);
  const { nome, email, curso_id: cursoId, matricula, enviar_email: enviar } = conferido.valor;

  if (cursoId !== null && !(await cursoExiste(supabase, cursoId))) {
    return comErros(anterior, { curso_id: 'Esse curso não existe mais. Escolha outro.' }, valores);
  }

  const { data: existente } = await supabase.from('perfis').select('id').eq('email', email).maybeSingle();
  if (typeof existente?.id === 'string') {
    return comErros(anterior, { email: 'Já existe uma pessoa com esse e-mail.' }, { ...valores, existente: existente.id });
  }

  const { data: criada, error } = await clienteDeServico().auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (error || !criada.user) {
    console.error('Não foi possível criar a conta do aluno:', error?.message ?? 'sem resposta');
    return comErros(anterior, { geral: 'Não foi possível criar a conta. Confira o e-mail e tente de novo.' }, valores);
  }
  const id = criada.user.id;

  if (cursoId !== null && matricula !== null) {
    const { error: erroDaMatricula } = await supabase.from('matriculas').insert({ aluno_id: id, curso_id: cursoId, origem: 'manual', ...matricula });
    if (erroDaMatricula) {
      console.error('Conta criada, mas a matrícula não foi gravada:', erroDaMatricula.message);
      redirect(ficha(id, 'criada_sem_matricula'));
    }
  }

  if (!enviar) redirect(ficha(id, 'pessoa_criada'));
  redirect(ficha(id, await avisoDoEnvio(email, 'criada_link')));
}

// ---------------------------------------------------------------------------
// Cadastro: nome, e-mail e papel
// ---------------------------------------------------------------------------

export async function salvarNome(anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> {
  const { supabase } = await exigirAdmin();
  const valores = valoresDe(dados, ['id', 'nome']);
  if (!ehUuid(valores.id)) redirect(`${LISTA}?aviso=nao_encontrado`);
  const conferido = validarNome(valores);
  if (!conferido.ok) return comErros(anterior, conferido.erros, valores);

  const { data, error } = await supabase.from('perfis').update(conferido.valor).eq('id', valores.id).select('id');
  if (error) return comErros(anterior, { geral: FALHA }, valores);
  if ((data ?? []).length === 0) redirect(`${LISTA}?aviso=nao_encontrado`);
  redirect(ficha(valores.id, 'nome_salvo'));
}

// Corrige o e-mail de uma conta (erro de digitação na compra, por exemplo). A pessoa passa a
// entrar com o e-mail novo; a senha continua a mesma.
export async function corrigirEmail(anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> {
  const { pessoa, supabase } = await exigirAdmin();
  const valores = valoresDe(dados, ['id', 'email']);
  if (!ehUuid(valores.id)) redirect(`${LISTA}?aviso=nao_encontrado`);
  const conferido = validarEmail(valores);
  if (!conferido.ok) return comErros(anterior, conferido.erros, valores);
  const { email } = conferido.valor;

  const { data: atual } = await supabase.from('perfis').select('email').eq('id', valores.id).maybeSingle();
  if (typeof atual?.email !== 'string') redirect(`${LISTA}?aviso=nao_encontrado`);
  if (atual.email === email) return comErros(anterior, { email: 'Esse já é o e-mail desta pessoa.' }, valores);

  const { data: outra } = await supabase.from('perfis').select('id').eq('email', email).maybeSingle();
  if (outra) return comErros(anterior, { email: 'Já existe outra pessoa com esse e-mail.' }, valores);

  const servico = clienteDeServico();
  const { error } = await servico.auth.admin.updateUserById(valores.id, { email, email_confirm: true });
  if (error) {
    console.error('Não foi possível corrigir o e-mail:', error.message);
    return comErros(anterior, { geral: 'Não foi possível trocar o e-mail. Confira o endereço e tente de novo.' }, valores);
  }
  // O perfil acompanha sozinho (gatilho no banco). Fica no histórico quem trocou.
  const { error: erroDoRegistro } = await servico.from('registro_alteracoes').insert({
    pessoa_id: pessoa.id,
    tabela: 'perfis',
    registro: valores.id,
    antes: { email: atual.email },
    depois: { email },
  });
  if (erroDoRegistro) console.error('E-mail trocado, mas a troca não entrou no histórico:', erroDoRegistro.message);
  redirect(ficha(valores.id, 'email_corrigido'));
}

export async function mudarPapel(dados: FormData): Promise<void> {
  const { supabase } = await exigirAdmin();
  const { id, papel: escrito } = valoresDe(dados, ['id', 'papel']);
  const papel = lerPapel(escrito);
  if (!ehUuid(id) || papel === null) redirect(`${LISTA}?aviso=nao_encontrado`);

  const { error } = await supabase.rpc('definir_papel', { p_pessoa: id, p_papel: papel });
  if (error) {
    if (error.message.includes('proprio_papel')) redirect(ficha(id, 'proprio_papel'));
    if (error.message.includes('pessoa_inexistente')) redirect(`${LISTA}?aviso=nao_encontrado`);
    redirect(ficha(id, 'falhou'));
  }
  redirect(ficha(id, 'papel_salvo'));
}

// ---------------------------------------------------------------------------
// Matrículas
// ---------------------------------------------------------------------------

export async function matricular(anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> {
  const { supabase } = await exigirAdmin();
  const valores = valoresDe(dados, ['aluno_id', 'curso_id', ...CAMPOS_DA_MATRICULA]);
  if (!ehUuid(valores.aluno_id)) redirect(`${LISTA}?aviso=nao_encontrado`);
  if (!ehUuid(valores.curso_id)) return comErros(anterior, { curso_id: 'Escolha um curso da lista.' }, valores);
  const conferido = validarMatricula(valores, new Date(), true);
  if (!conferido.ok) return comErros(anterior, conferido.erros, valores);
  if (!(await cursoExiste(supabase, valores.curso_id))) {
    return comErros(anterior, { curso_id: 'Esse curso não existe mais. Escolha outro.' }, valores);
  }

  const { error } = await supabase
    .from('matriculas')
    .insert({ aluno_id: valores.aluno_id, curso_id: valores.curso_id, origem: 'manual', ...conferido.valor });
  if (error) {
    if (error.code === '23505') return comErros(anterior, { curso_id: 'Esta pessoa já tem matrícula nesse curso.' }, valores);
    if (error.code === '23503') redirect(`${LISTA}?aviso=nao_encontrado`);
    return comErros(anterior, { geral: FALHA }, valores);
  }
  redirect(ficha(valores.aluno_id, 'matricula_criada', '#matriculas'));
}

type MatriculaLida = { aluno_id: string; situacao: string; expira_em: string | null };

async function lerMatricula(supabase: Sessao, id: string): Promise<MatriculaLida | null> {
  const { data } = await supabase.from('matriculas').select('aluno_id, situacao, expira_em').eq('id', id).maybeSingle();
  return data ? (data as unknown as MatriculaLida) : null;
}

// Muda a validade e a conversação de uma matrícula que já existe. A origem (Greenn ou manual)
// continua a mesma: ela conta como a matrícula nasceu.
export async function salvarMatricula(anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> {
  const { supabase } = await exigirAdmin();
  const valores = valoresDe(dados, ['id', ...CAMPOS_DA_MATRICULA]);
  if (!ehUuid(valores.id)) redirect(`${LISTA}?aviso=nao_encontrado`);
  const conferido = validarMatricula(valores, new Date(), false);
  if (!conferido.ok) return comErros(anterior, conferido.erros, valores);

  const { data, error } = await supabase.from('matriculas').update(conferido.valor).eq('id', valores.id).select('aluno_id');
  if (error) return comErros(anterior, { geral: FALHA }, valores);
  const alunoId = ((data ?? []) as unknown as { aluno_id: string }[])[0]?.aluno_id;
  if (typeof alunoId !== 'string') redirect(`${LISTA}?aviso=nao_encontrado`);
  redirect(ficha(alunoId, 'matricula_salva', '#matriculas'));
}

// Bloqueia ou libera o acesso sem mexer na validade.
export async function mudarAcesso(dados: FormData): Promise<void> {
  const { supabase } = await exigirAdmin();
  const { id, mudanca } = valoresDe(dados, ['id', 'mudanca']);
  if (!ehUuid(id)) redirect(`${LISTA}?aviso=nao_encontrado`);
  const atual = await lerMatricula(supabase, id);
  if (!atual) redirect(`${LISTA}?aviso=nao_encontrado`);
  const situacao = novaSituacao(atual.situacao, mudanca);
  if (situacao === null) redirect(ficha(atual.aluno_id, 'nao_encontrado', '#matriculas'));

  const { data, error } = await supabase.from('matriculas').update({ situacao }).eq('id', id).eq('situacao', atual.situacao).select('id');
  if (error) redirect(ficha(atual.aluno_id, 'falhou', '#matriculas'));
  if ((data ?? []).length === 0) redirect(ficha(atual.aluno_id, 'nao_encontrado', '#matriculas'));

  if (situacao === 'suspensa') redirect(ficha(atual.aluno_id, 'acesso_bloqueado', '#matriculas'));
  const vencida = acessoDaMatricula({ situacao, expira_em: atual.expira_em }, new Date()) === 'vencida';
  redirect(ficha(atual.aluno_id, vencida ? 'acesso_liberado_vencido' : 'acesso_liberado', '#matriculas'));
}

// ---------------------------------------------------------------------------
// Link de acesso
// ---------------------------------------------------------------------------

export async function enviarAcesso(dados: FormData): Promise<void> {
  const { supabase } = await exigirAdmin();
  const { id } = valoresDe(dados, ['id']);
  if (!ehUuid(id)) redirect(`${LISTA}?aviso=nao_encontrado`);
  const { data: perfil } = await supabase.from('perfis').select('email').eq('id', id).maybeSingle();
  if (typeof perfil?.email !== 'string') redirect(`${LISTA}?aviso=nao_encontrado`);
  redirect(ficha(id, await avisoDoEnvio(perfil.email, 'link')));
}
