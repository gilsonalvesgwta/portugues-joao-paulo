'use server';

import { redirect } from 'next/navigation';
import { ehUuid, mover, validarAula, validarCurso, validarModulo } from '@/lib/conteudo';
import type { EstadoDoFormulario } from '@/lib/formulario';
import { ehEquipe } from '@/lib/supabase/config';
import { clienteDoServidor, pessoaLogada } from '@/lib/supabase/servidor';

// Ações da administração de conteúdo. Cada uma confere de novo se quem pede é da equipe
// (a tela já confere, mas uma ação pode ser chamada direto) e grava com a sessão da pessoa,
// então as regras de acesso do banco continuam valendo por baixo.
//
// "Apagar" aqui é mover para a lixeira (arquivado_em): some para o aluno e das listas,
// mas pode ser restaurado. Nada é destruído, porque o progresso dos alunos aponta para as aulas.

async function exigirEquipe() {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  if (!ehEquipe(pessoa.papel)) redirect('/inicio');
  return clienteDoServidor();
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

// ---------------------------------------------------------------------------
// Cursos
// ---------------------------------------------------------------------------

export async function salvarCurso(anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> {
  const supabase = await exigirEquipe();
  const valores = valoresDe(dados, ['id', 'titulo_pt', 'titulo_es', 'tipo', 'modo', 'situacao']);
  const conferido = validarCurso(valores);
  if (!conferido.ok) return comErros(anterior, conferido.erros, valores);

  if (valores.id) {
    if (!ehUuid(valores.id)) redirect('/admin/cursos?aviso=nao_encontrado');
    const { data, error } = await supabase.from('cursos').update(conferido.valor).eq('id', valores.id).select('id');
    if (error) return comErros(anterior, { geral: FALHA }, valores);
    if ((data ?? []).length === 0) redirect('/admin/cursos?aviso=nao_encontrado');
  } else {
    const { data: ultimo } = await supabase.from('cursos').select('ordem').order('ordem', { ascending: false }).limit(1);
    const ordem = Number((ultimo ?? [])[0]?.ordem ?? 0) + 1;
    const { error } = await supabase.from('cursos').insert({ ...conferido.valor, ordem });
    if (error) return comErros(anterior, { geral: FALHA }, valores);
  }
  redirect('/admin/cursos?aviso=curso_salvo');
}

// ---------------------------------------------------------------------------
// Módulos
// ---------------------------------------------------------------------------

export async function salvarModulo(anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> {
  const supabase = await exigirEquipe();
  const valores = valoresDe(dados, ['id', 'curso_id', 'titulo_pt', 'titulo_es']);
  const conferido = validarModulo(valores);
  if (!conferido.ok) return comErros(anterior, conferido.erros, valores);

  if (valores.id) {
    if (!ehUuid(valores.id)) redirect('/admin/cursos?aviso=nao_encontrado');
    const { data, error } = await supabase.from('modulos').update(conferido.valor).eq('id', valores.id).select('id');
    if (error) return comErros(anterior, { geral: FALHA }, valores);
    if ((data ?? []).length === 0) redirect('/admin/cursos?aviso=nao_encontrado');
  } else {
    if (!ehUuid(valores.curso_id)) redirect('/admin/cursos?aviso=nao_encontrado');
    const { data: curso } = await supabase
      .from('cursos')
      .select('id')
      .eq('id', valores.curso_id)
      .is('arquivado_em', null)
      .maybeSingle();
    if (!curso) redirect('/admin/cursos?aviso=nao_encontrado');
    const { data: ultimo } = await supabase
      .from('modulos')
      .select('ordem')
      .eq('curso_id', valores.curso_id)
      .order('ordem', { ascending: false })
      .limit(1);
    const ordem = Number((ultimo ?? [])[0]?.ordem ?? 0) + 1;
    const { error } = await supabase.from('modulos').insert({ ...conferido.valor, curso_id: valores.curso_id, ordem });
    if (error) return comErros(anterior, { geral: FALHA }, valores);
  }
  redirect('/admin/cursos?aviso=modulo_salvo');
}

// Sobe ou desce um módulo dentro do curso e renumera a ordem de todos (1, 2, 3...).
export async function moverModulo(dados: FormData): Promise<void> {
  const supabase = await exigirEquipe();
  const { id, direcao } = valoresDe(dados, ['id', 'direcao']);
  if (!ehUuid(id) || (direcao !== 'subir' && direcao !== 'descer')) redirect('/admin/cursos?aviso=nao_encontrado');

  const { data: modulo } = await supabase.from('modulos').select('curso_id').eq('id', id).maybeSingle();
  const cursoId = modulo?.curso_id;
  if (typeof cursoId !== 'string') redirect('/admin/cursos?aviso=nao_encontrado');

  const { data: lista, error } = await supabase
    .from('modulos')
    .select('id, ordem')
    .eq('curso_id', cursoId)
    .is('arquivado_em', null)
    .order('ordem');
  if (error) redirect('/admin/cursos?aviso=falhou');
  const atuais = (lista ?? []) as unknown as { id: string; ordem: number }[];
  const novaOrdem = mover(atuais, atuais.findIndex((m) => m.id === id), direcao);

  for (const [indice, item] of novaOrdem.entries()) {
    if (item.ordem === indice + 1) continue;
    const { error: erroDaOrdem } = await supabase.from('modulos').update({ ordem: indice + 1 }).eq('id', item.id);
    if (erroDaOrdem) redirect('/admin/cursos?aviso=falhou');
  }
  redirect('/admin/cursos');
}

// ---------------------------------------------------------------------------
// Aulas
// ---------------------------------------------------------------------------

type Cliente = Awaited<ReturnType<typeof clienteDoServidor>>;

// Números das aulas (fora da lixeira) do curso a que o módulo pertence, sem contar a própria aula.
// null quando o módulo não existe ou está na lixeira.
async function numerosDoCurso(supabase: Cliente, moduloId: string, menosAula: string | null): Promise<number[] | null> {
  const { data: modulo } = await supabase
    .from('modulos')
    .select('curso_id')
    .eq('id', moduloId)
    .is('arquivado_em', null)
    .maybeSingle();
  const cursoId = modulo?.curso_id;
  if (typeof cursoId !== 'string') return null;

  const { data: modulos } = await supabase.from('modulos').select('id').eq('curso_id', cursoId);
  const ids = ((modulos ?? []) as unknown as { id: string }[]).map((m) => m.id);
  const { data: aulas } = await supabase.from('aulas').select('id, numero').in('modulo_id', ids).is('arquivado_em', null);
  return ((aulas ?? []) as unknown as { id: string; numero: number }[])
    .filter((aula) => aula.id !== menosAula)
    .map((aula) => aula.numero);
}

export async function salvarAula(anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> {
  const supabase = await exigirEquipe();
  const valores = valoresDe(dados, ['id', 'modulo_id', 'numero', 'titulo_pt', 'titulo_es', 'video_id', 'duracao', 'situacao']);
  const id = valores.id ? valores.id : null;
  if (id !== null && !ehUuid(id)) redirect('/admin/aulas?aviso=nao_encontrado');

  let emUso: number[] = [];
  if (ehUuid(valores.modulo_id)) {
    const numeros = await numerosDoCurso(supabase, valores.modulo_id, id);
    if (numeros === null) {
      return comErros(anterior, { modulo_id: 'Esse módulo não existe mais. Escolha outro.' }, valores);
    }
    emUso = numeros;
  }

  const conferido = validarAula(valores, emUso);
  if (!conferido.ok) return comErros(anterior, conferido.erros, valores);

  let idSalvo = id;
  if (id !== null) {
    const { data, error } = await supabase.from('aulas').update(conferido.valor).eq('id', id).select('id');
    if (error) return comErros(anterior, { geral: FALHA }, valores);
    if ((data ?? []).length === 0) redirect('/admin/aulas?aviso=nao_encontrado');
  } else {
    const { data, error } = await supabase.from('aulas').insert(conferido.valor).select('id').single();
    if (error || typeof data?.id !== 'string') return comErros(anterior, { geral: FALHA }, valores);
    idSalvo = data.id;
  }
  redirect(`/admin/aulas/${idSalvo}?aviso=${conferido.valor.situacao === 'publicado' ? 'aula_publicada' : 'aula_salva'}`);
}

// ---------------------------------------------------------------------------
// Lixeira
// ---------------------------------------------------------------------------

const TABELA = { curso: 'cursos', modulo: 'modulos', aula: 'aulas' } as const;
type Tipo = keyof typeof TABELA;
const VOLTA: Record<Tipo, string> = { curso: '/admin/cursos', modulo: '/admin/cursos', aula: '/admin/aulas' };

function tipoDe(valor: string | undefined): Tipo | null {
  return valor === 'curso' || valor === 'modulo' || valor === 'aula' ? valor : null;
}

export async function moverParaLixeira(dados: FormData): Promise<void> {
  const supabase = await exigirEquipe();
  const { tipo: tipoEscrito, id } = valoresDe(dados, ['tipo', 'id']);
  const tipo = tipoDe(tipoEscrito);
  if (!tipo || !ehUuid(id)) redirect('/admin?aviso=nao_encontrado');
  const volta = VOLTA[tipo];

  if (tipo === 'curso') {
    const { count } = await supabase
      .from('modulos')
      .select('id', { count: 'exact', head: true })
      .eq('curso_id', id)
      .is('arquivado_em', null);
    if ((count ?? 0) > 0) redirect(`${volta}?aviso=curso_com_modulos`);
  }
  if (tipo === 'modulo') {
    const { count } = await supabase
      .from('aulas')
      .select('id', { count: 'exact', head: true })
      .eq('modulo_id', id)
      .is('arquivado_em', null);
    if ((count ?? 0) > 0) redirect(`${volta}?aviso=modulo_com_aulas`);
  }

  // Curso e aula saem da lixeira como rascunho: restaurar nunca publica nada sozinho.
  const mudanca: Record<string, string> = { arquivado_em: new Date().toISOString() };
  if (tipo !== 'modulo') mudanca.situacao = 'rascunho';
  const { data, error } = await supabase.from(TABELA[tipo]).update(mudanca).eq('id', id).is('arquivado_em', null).select('id');
  if (error) redirect(`${volta}?aviso=falhou`);
  if ((data ?? []).length === 0) redirect(`${volta}?aviso=nao_encontrado`);
  redirect(`${volta}?aviso=na_lixeira`);
}

export async function restaurar(dados: FormData): Promise<void> {
  const supabase = await exigirEquipe();
  const { tipo: tipoEscrito, id } = valoresDe(dados, ['tipo', 'id']);
  const tipo = tipoDe(tipoEscrito);
  const volta = '/admin/lixeira';
  if (!tipo || !ehUuid(id)) redirect(`${volta}?aviso=nao_encontrado`);

  if (tipo === 'modulo') {
    const { data: modulo } = await supabase.from('modulos').select('curso_id').eq('id', id).maybeSingle();
    if (typeof modulo?.curso_id !== 'string') redirect(`${volta}?aviso=nao_encontrado`);
    const { data: curso } = await supabase.from('cursos').select('arquivado_em').eq('id', modulo.curso_id).maybeSingle();
    if (!curso || curso.arquivado_em !== null) redirect(`${volta}?aviso=restaurar_curso_antes`);
  }
  if (tipo === 'aula') {
    const { data: aula } = await supabase.from('aulas').select('modulo_id, numero').eq('id', id).maybeSingle();
    if (typeof aula?.modulo_id !== 'string') redirect(`${volta}?aviso=nao_encontrado`);
    const numeros = await numerosDoCurso(supabase, aula.modulo_id, id);
    if (numeros === null) redirect(`${volta}?aviso=restaurar_modulo_antes`);
    if (numeros.includes(Number(aula.numero))) redirect(`${volta}?aviso=numero_ocupado`);
  }

  const { data, error } = await supabase
    .from(TABELA[tipo])
    .update({ arquivado_em: null })
    .eq('id', id)
    .not('arquivado_em', 'is', null)
    .select('id');
  if (error) redirect(`${volta}?aviso=falhou`);
  if ((data ?? []).length === 0) redirect(`${volta}?aviso=nao_encontrado`);
  redirect(`${volta}?aviso=${tipo === 'modulo' ? 'modulo_restaurado' : 'restaurado'}`);
}
