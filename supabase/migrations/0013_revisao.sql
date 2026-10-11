-- Ajustes da revisão geral.
-- A transação é aberta por quem aplica: a migração entra inteira ou não entra.

-- ---------------------------------------------------------------------------
-- 1. Quem perde o direito à conversação perde as reservas que ainda não aconteceram
-- ---------------------------------------------------------------------------

-- Reembolso, bloqueio pelo administrador, conversação tirada da matrícula ou validade encurtada
-- para uma data que já passou: se a pessoa fica sem nenhuma matrícula ativa com conversação, as
-- reservas dela em aulas que ainda não começaram são canceladas e as vagas voltam para a turma.
-- (A validade que simplesmente chega ao fim com o passar dos dias não cancela nada: a aula já
-- reservada continua valendo.)
create function public.soltar_reservas_sem_direito() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_aluno uuid := coalesce(new.aluno_id, old.aluno_id);
begin
  if exists (
    select 1 from matriculas m
    where m.aluno_id = v_aluno
      and m.situacao = 'ativa'
      and (m.expira_em is null or m.expira_em > now())
      and m.inclui_conversacao
  ) then
    return null;
  end if;

  update reservas r
  set situacao = 'cancelada', cancelada_em = now()
  from turmas t
  where t.id = r.turma_id
    and r.aluno_id = v_aluno
    and r.situacao = 'confirmada'
    and t.inicio > now();
  return null;
end $$;

create trigger matriculas_soltam_reservas
  after update of situacao, expira_em, inclui_conversacao on public.matriculas
  for each row execute function public.soltar_reservas_sem_direito();

revoke execute on function public.soltar_reservas_sem_direito() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tamanho do comentário da avaliação
-- ---------------------------------------------------------------------------

-- A tela já limita; o banco é a segunda tranca.
alter table public.avaliacoes add constraint avaliacoes_comentario_curto
  check (comentario is null or char_length(comentario) <= 1000);
