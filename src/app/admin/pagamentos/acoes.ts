'use server';

import { redirect } from 'next/navigation';
import { exigirAdmin } from '@/lib/admin/guarda';
import { ehUuid } from '@/lib/conteudo';
import type { EstadoDoFormulario } from '@/lib/formulario';
import { validarOferta } from '@/lib/ofertas';
import { dispensarAviso, processarAviso } from '@/lib/pagamentos';
import { clienteDoServidor } from '@/lib/supabase/servidor';

// Ações da tela de pagamentos, só para o administrador. As ofertas são gravadas com a sessão
// dele, sob as regras do banco. Processar de novo um aviso usa o mesmo caminho do aviso que
// chega da Greenn (chave de serviço), por isso a conferência de quem pede vem antes.

const TELA = '/admin/pagamentos';
const FALHA = 'Não foi possível salvar. Tente de novo.';
const CAMPOS = ['id', 'nome', 'greenn_product_id', 'curso_id', 'dias_de_acesso', 'inclui_conversacao', 'reservas_por_semana', 'ativa'] as const;

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

export async function salvarOferta(anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> {
  await exigirAdmin();
  const supabase = await clienteDoServidor();
  const valores = valoresDe(dados, CAMPOS);
  const id = valores.id ? valores.id : null;
  if (id !== null && !ehUuid(id)) redirect(`${TELA}?aviso=nao_encontrado`);
  const conferido = validarOferta(valores);
  if (!conferido.ok) return comErros(anterior, conferido.erros, valores);

  const { data: curso } = await supabase.from('cursos').select('id').eq('id', conferido.valor.curso_id).is('arquivado_em', null).maybeSingle();
  if (!curso) return comErros(anterior, { curso_id: 'Esse curso não existe mais. Escolha outro.' }, valores);

  const gravacao =
    id === null
      ? await supabase.from('ofertas').insert(conferido.valor).select('id')
      : await supabase.from('ofertas').update(conferido.valor).eq('id', id).select('id');
  if (gravacao.error) {
    // O mesmo produto da Greenn não pode apontar para duas ofertas.
    if (gravacao.error.code === '23505') {
      return comErros(anterior, { greenn_product_id: 'Já existe uma oferta com esse código de produto.' }, valores);
    }
    return comErros(anterior, { geral: FALHA }, valores);
  }
  if ((gravacao.data ?? []).length === 0) redirect(`${TELA}?aviso=nao_encontrado`);
  redirect(`${TELA}?aviso=oferta_salva`);
}

function numeroDoAviso(dados: FormData): number | null {
  const escrito = dados.get('id');
  return typeof escrito === 'string' && /^\d{1,15}$/.test(escrito) ? Number(escrito) : null;
}

const AVISO_DO_DESFECHO: Record<string, string> = {
  acesso_liberado: 'aviso_liberou',
  acesso_encerrado: 'aviso_processado',
  acesso_ate_fim_do_periodo: 'aviso_processado',
  ignorado: 'aviso_processado',
  aluno_desconhecido: 'aviso_processado',
  ja_processado: 'aviso_ja_processado',
  oferta_desconhecida: 'aviso_sem_oferta',
};

// Processa de novo um aviso que ficou pendente (por exemplo, depois de cadastrar a oferta).
export async function reprocessarAviso(dados: FormData): Promise<void> {
  await exigirAdmin();
  const id = numeroDoAviso(dados);
  if (id === null) redirect(`${TELA}?aviso=nao_encontrado`);
  const desfecho = await processarAviso(id);
  redirect(`${TELA}?aviso=${AVISO_DO_DESFECHO[desfecho] ?? 'aviso_falhou'}#avisos`);
}

export async function dispensar(dados: FormData): Promise<void> {
  await exigirAdmin();
  const id = numeroDoAviso(dados);
  if (id === null) redirect(`${TELA}?aviso=nao_encontrado`);
  redirect(`${TELA}?aviso=${(await dispensarAviso(id)) ? 'aviso_dispensado' : 'nao_encontrado'}#avisos`);
}

// O endereço completo do webhook da Greenn, com o trecho secreto. Só o administrador recebe, e só
// quando pede (botões "Mostrar" e "Copiar o endereço"): ele não vem escrito na página.
export async function enderecoDoWebhook(): Promise<string | null> {
  await exigirAdmin();
  const segredo = process.env.GREENN_WEBHOOK_SEGREDO ?? '';
  if (segredo.length < 24) return null;
  return `${(process.env.SITE_URL ?? '').replace(/\/+$/, '')}/api/greenn/${segredo}`;
}
