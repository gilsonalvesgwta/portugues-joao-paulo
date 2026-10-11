import { PESSOAS_POR_PAGINA, type Filtro } from '@/lib/alunos';
import { clienteDeServico } from '@/lib/supabase/servico';
import { clienteDoServidor } from '@/lib/supabase/servidor';

// Leitura das pessoas e das matrículas para as telas de alunos. Usa a sessão de quem está
// logado: as regras do banco só entregam matrículas ao administrador.

export type PessoaDaLista = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  criado_em: string;
  matriculas: number;
  cursos_com_acesso: string[];
};

export async function carregarPessoas(busca: string, filtro: Filtro, pagina: number): Promise<{ total: number; pessoas: PessoaDaLista[] }> {
  const supabase = await clienteDoServidor();
  const { data, error } = await supabase.rpc('lista_de_pessoas', {
    p_busca: busca,
    p_filtro: filtro,
    p_limite: PESSOAS_POR_PAGINA,
    p_pulo: (pagina - 1) * PESSOAS_POR_PAGINA,
  });
  if (error) throw new Error(`Não foi possível ler a lista de pessoas: ${error.message}`);
  const lido = (data ?? {}) as { total?: number; pessoas?: PessoaDaLista[] };
  return { total: Number(lido.total ?? 0), pessoas: lido.pessoas ?? [] };
}

export type Perfil = { id: string; nome: string; email: string; papel: string; criado_em: string; atualizado_em: string };

export type Matricula = {
  id: string;
  curso_id: string;
  situacao: string;
  inicio: string;
  expira_em: string | null;
  origem: string;
  inclui_conversacao: boolean;
  reservas_por_semana: number;
  atualizado_em: string;
};

export type EnvioDeAcesso = { id: string; agendada_para: string; enviada_em: string | null; erro: string | null };

export type Ficha = {
  perfil: Perfil;
  matriculas: Matricula[];
  // null: nunca entrou (ainda não criou a senha). undefined: não foi possível consultar.
  ultimoAcesso: string | null | undefined;
  envios: EnvioDeAcesso[];
};

// Tudo o que a ficha da pessoa mostra. null quando a pessoa não existe.
export async function carregarFicha(id: string): Promise<Ficha | null> {
  const supabase = await clienteDoServidor();
  const { data: perfil, error } = await supabase.from('perfis').select('id, nome, email, papel, criado_em, atualizado_em').eq('id', id).maybeSingle();
  if (error) throw new Error(`Não foi possível ler a pessoa: ${error.message}`);
  if (!perfil) return null;

  const [matriculas, envios, conta] = await Promise.all([
    supabase
      .from('matriculas')
      .select('id, curso_id, situacao, inicio, expira_em, origem, inclui_conversacao, reservas_por_semana, atualizado_em')
      .eq('aluno_id', id)
      .order('inicio'),
    supabase
      .from('notificacoes')
      .select('id, agendada_para, enviada_em, erro')
      .eq('tipo', 'enlace_acceso')
      .eq('aluno_id', id)
      .order('agendada_para', { ascending: false })
      .limit(3),
    // A data do último acesso fica no serviço de login, fora das tabelas que a sessão lê.
    clienteDeServico().auth.admin.getUserById(id),
  ]);
  if (matriculas.error) throw new Error(`Não foi possível ler as matrículas: ${matriculas.error.message}`);

  return {
    perfil: perfil as unknown as Perfil,
    matriculas: (matriculas.data ?? []) as unknown as Matricula[],
    ultimoAcesso: conta.error || !conta.data.user ? undefined : (conta.data.user.last_sign_in_at ?? null),
    envios: (envios.data ?? []) as unknown as EnvioDeAcesso[],
  };
}

// Como o curso aparece nas listas de matrícula: o rascunho e a lixeira ficam avisados, porque
// matrícula em curso que não está publicado não dá acesso a nada.
export function rotuloDoCurso(curso: { titulo_pt: string; situacao: string; arquivado_em: string | null }): string {
  if (curso.arquivado_em !== null) return `${curso.titulo_pt} (na lixeira)`;
  return curso.situacao === 'publicado' ? curso.titulo_pt : `${curso.titulo_pt} (rascunho)`;
}
