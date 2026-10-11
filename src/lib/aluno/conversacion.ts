import { lerAprendizados } from '@/lib/conversacao';
import type { ReservaDoAluno } from '@/lib/reservas';
import { clienteDoServidor } from '@/lib/supabase/servidor';

// Leitura para a tela de conversação do aluno. Tudo com a sessão de quem está logado: a agenda
// vem de uma função do banco que conta as vagas sem mostrar as reservas dos colegas, e o link da
// sala só vem nas reservas da própria pessoa.

export type TurmaDaTela = {
  turmaId: string;
  temaId: string;
  titulo: string;
  nivel: string;
  inicio: string;
  duracaoMin: number;
  vagas: number;
  vagasRestantes: number;
  jaReservada: boolean;
};

export type TemaDaTela = { descricao: string | null; aprendizados: string[] };

export type Conversacion = {
  nome: string;
  fuso: string;
  // Quantas aulas por semana a matrícula dá direito a reservar; 0 = sem conversação.
  limite: number;
  agenda: TurmaDaTela[];
  temas: Map<string, TemaDaTela>;
  reservas: ReservaDoAluno[];
  janelaDias: number;
  cancelarAteMin: number;
};

type LinhaDaAgenda = {
  turma_id: string; tema_id: string; titulo_es: string; nivel: string; inicio: string;
  duracao_min: number; vagas: number; vagas_restantes: number; ja_reservada: boolean;
};

export async function carregarConversacion(pessoaId: string, nivel: string | null): Promise<Conversacion> {
  const supabase = await clienteDoServidor();
  const [perfil, matriculas, agenda, reservas, temas, janela, cancelar] = await Promise.all([
    supabase.from('perfis').select('nome, fuso').eq('id', pessoaId).maybeSingle(),
    supabase.from('matriculas').select('situacao, expira_em, inclui_conversacao, reservas_por_semana').eq('aluno_id', pessoaId),
    supabase.rpc('agenda_turmas', { p_nivel: nivel }),
    supabase.rpc('minhas_reservas'),
    supabase.from('temas_conversacao').select('id, descricao_es, aprendizados'),
    supabase.rpc('config_int', { p_chave: 'agenda_janela_dias', p_padrao: 7 }),
    supabase.rpc('config_int', { p_chave: 'cancelamento_min_antes', p_padrao: 120 }),
  ]);
  if (agenda.error) throw new Error(`No se pudo leer la agenda: ${agenda.error.message}`);

  const agora = Date.now();
  const comDireito = ((matriculas.data ?? []) as unknown as { situacao: string; expira_em: string | null; inclui_conversacao: boolean; reservas_por_semana: number }[])
    .filter((m) => m.situacao === 'ativa' && m.inclui_conversacao && (m.expira_em === null || Date.parse(m.expira_em) > agora));

  return {
    nome: typeof perfil.data?.nome === 'string' ? perfil.data.nome : '',
    fuso: typeof perfil.data?.fuso === 'string' ? perfil.data.fuso : 'Europe/Madrid',
    limite: comDireito.reduce((maior, m) => Math.max(maior, m.reservas_por_semana), 0),
    agenda: ((agenda.data ?? []) as unknown as LinhaDaAgenda[]).map((linha) => ({
      turmaId: linha.turma_id,
      temaId: linha.tema_id,
      titulo: linha.titulo_es,
      nivel: linha.nivel,
      inicio: linha.inicio,
      duracaoMin: linha.duracao_min,
      vagas: linha.vagas,
      vagasRestantes: linha.vagas_restantes,
      jaReservada: linha.ja_reservada,
    })),
    temas: new Map(
      ((temas.data ?? []) as unknown as { id: string; descricao_es: string | null; aprendizados: unknown }[]).map((tema) => [
        tema.id,
        { descricao: tema.descricao_es, aprendizados: lerAprendizados(tema.aprendizados) },
      ]),
    ),
    reservas: (reservas.data ?? []) as unknown as ReservaDoAluno[],
    janelaDias: typeof janela.data === 'number' ? janela.data : 7,
    cancelarAteMin: typeof cancelar.data === 'number' ? cancelar.data : 120,
  };
}
