'use server';

import { redirect } from 'next/navigation';
import { ehUuid, mover, validarAula, validarCurso, validarMaterial, validarModulo } from '@/lib/conteudo';
import { enviarEmail } from '@/lib/correio';
import { emailDeConferencia } from '@/lib/emails';
import { motivoDaFalha } from '@/lib/smtp';
import { validarAnotacoes } from '@/lib/anotacoes';
import type { EstadoDasAnotacoes, EstadoDoFormulario } from '@/lib/formulario';
import { ehEquipe } from '@/lib/papeis';
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

// Grava as anotações da aula (a lista de blocos montada no editor). Confere tudo de novo no
// servidor: o que o navegador manda nunca é gravado sem passar pela mesma conferência.
export async function salvarAnotacoes(anterior: EstadoDasAnotacoes, dados: FormData): Promise<EstadoDasAnotacoes> {
  const supabase = await exigirEquipe();
  const falha = (erros: Record<string, string>): EstadoDasAnotacoes => ({
    vez: anterior.vez + 1,
    situacao: 'erro',
    erros,
    blocos: null,
  });

  const { aula_id: aulaId, anotacoes: texto } = valoresDe(dados, ['aula_id', 'anotacoes']);
  if (!ehUuid(aulaId)) return falha({ geral: 'Não encontrei esta aula.' });
  if (typeof texto !== 'string' || texto.length > 400_000) {
    return falha({ geral: 'As anotações ficaram grandes demais para salvar de uma vez.' });
  }
  let lido: unknown;
  try {
    lido = JSON.parse(texto);
  } catch {
    return falha({ geral: 'As anotações chegaram em um formato inesperado.' });
  }
  const conferido = validarAnotacoes(lido);
  if (!conferido.ok) return falha(conferido.erros);

  const { data, error } = await supabase
    .from('aulas')
    .update({ anotacoes: conferido.blocos })
    .eq('id', aulaId)
    .is('arquivado_em', null)
    .select('id');
  if (error) return falha({ geral: FALHA });
  if ((data ?? []).length === 0) return falha({ geral: 'Não encontrei esta aula. Ela pode ter ido para a lixeira.' });
  return { vez: anterior.vez + 1, situacao: 'salvo', erros: {}, blocos: conferido.blocos };
}

// ---------------------------------------------------------------------------
// Materiais de apoio (por link)
// ---------------------------------------------------------------------------

function telaDaAula(aulaId: string, aviso: string): string {
  return `/admin/aulas/${aulaId}?aviso=${aviso}#materiais`;
}

export async function salvarMaterial(anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> {
  const supabase = await exigirEquipe();
  const valores = valoresDe(dados, ['id', 'aula_id', 'titulo_pt', 'titulo_es', 'descricao_es', 'link']);
  const conferido = validarMaterial(valores);
  if (!conferido.ok) return comErros(anterior, conferido.erros, valores);

  if (valores.id) {
    if (!ehUuid(valores.id)) redirect('/admin/aulas?aviso=nao_encontrado');
    const { data, error } = await supabase.from('materiais').update(conferido.valor).eq('id', valores.id).select('aula_id');
    if (error) return comErros(anterior, { geral: FALHA }, valores);
    const aulaId = ((data ?? []) as unknown as { aula_id: string | null }[])[0]?.aula_id;
    if (typeof aulaId !== 'string') redirect('/admin/aulas?aviso=nao_encontrado');
    redirect(telaDaAula(aulaId, 'material_salvo'));
  }

  if (!ehUuid(valores.aula_id)) redirect('/admin/aulas?aviso=nao_encontrado');
  const { data: aula } = await supabase.from('aulas').select('id').eq('id', valores.aula_id).is('arquivado_em', null).maybeSingle();
  if (!aula) redirect('/admin/aulas?aviso=nao_encontrado');
  const { data: ultimo } = await supabase
    .from('materiais')
    .select('ordem')
    .eq('aula_id', valores.aula_id)
    .order('ordem', { ascending: false })
    .limit(1);
  const ordem = Number((ultimo ?? [])[0]?.ordem ?? 0) + 1;
  const { error } = await supabase.from('materiais').insert({ ...conferido.valor, aula_id: valores.aula_id, ordem });
  if (error) return comErros(anterior, { geral: FALHA }, valores);
  redirect(telaDaAula(valores.aula_id, 'material_salvo'));
}

// Aula a que o material pertence, ou null se o material não existe.
async function aulaDoMaterial(supabase: Cliente, id: string): Promise<string | null> {
  const { data } = await supabase.from('materiais').select('aula_id').eq('id', id).maybeSingle();
  return typeof data?.aula_id === 'string' ? data.aula_id : null;
}

export async function moverMaterial(dados: FormData): Promise<void> {
  const supabase = await exigirEquipe();
  const { id, direcao } = valoresDe(dados, ['id', 'direcao']);
  if (!ehUuid(id) || (direcao !== 'subir' && direcao !== 'descer')) redirect('/admin/aulas?aviso=nao_encontrado');
  const aulaId = await aulaDoMaterial(supabase, id);
  if (aulaId === null) redirect('/admin/aulas?aviso=nao_encontrado');

  const { data: lista, error } = await supabase.from('materiais').select('id, ordem').eq('aula_id', aulaId).order('ordem').order('id');
  if (error) redirect(telaDaAula(aulaId, 'falhou'));
  const atuais = (lista ?? []) as unknown as { id: string; ordem: number }[];
  const novaOrdem = mover(atuais, atuais.findIndex((m) => m.id === id), direcao);
  for (const [indice, item] of novaOrdem.entries()) {
    if (item.ordem === indice + 1) continue;
    const { error: erroDaOrdem } = await supabase.from('materiais').update({ ordem: indice + 1 }).eq('id', item.id);
    if (erroDaOrdem) redirect(telaDaAula(aulaId, 'falhou'));
  }
  redirect(`/admin/aulas/${aulaId}#materiais`);
}

// Material não tem lixeira: é só um título e um link, fácil de cadastrar de novo.
// A tela pede confirmação antes de chamar esta ação.
export async function apagarMaterial(dados: FormData): Promise<void> {
  const supabase = await exigirEquipe();
  const { id } = valoresDe(dados, ['id']);
  if (!ehUuid(id)) redirect('/admin/aulas?aviso=nao_encontrado');
  const aulaId = await aulaDoMaterial(supabase, id);
  if (aulaId === null) redirect('/admin/aulas?aviso=nao_encontrado');
  const { error } = await supabase.from('materiais').delete().eq('id', id);
  if (error) redirect(telaDaAula(aulaId, 'falhou'));
  redirect(telaDaAula(aulaId, 'material_apagado'));
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

// ---------------------------------------------------------------------------
// E-mail
// ---------------------------------------------------------------------------

// Manda um e-mail de teste para quem está logado, para conferir a caixa de envio depois da
// instalação. O detalhe técnico da falha vai para o registro do servidor; a tela mostra o motivo
// em palavras simples.
export async function enviarEmailDeTeste(): Promise<void> {
  await exigirEquipe();
  const pessoa = await pessoaLogada();
  if (!pessoa || pessoa.email === '') redirect('/admin?aviso=email_falhou');

  const quando = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date());
  let motivo: string | null = null;
  try {
    await enviarEmail(pessoa.email, emailDeConferencia(quando));
  } catch (erro) {
    motivo = motivoDaFalha(erro);
    console.error(`Falha no e-mail de teste (${motivo}):`, erro instanceof Error ? erro.message : erro);
  }
  if (motivo === null) redirect('/admin?aviso=email_enviado');
  redirect(`/admin?aviso=email_${motivo === 'outro' ? 'falhou' : motivo}`);
}
