-- Lembretes das aulas ao vivo: um e-mail 24 horas antes e outro 1 hora antes.
-- A transação é aberta por quem aplica: a migração entra inteira ou não entra.
--
-- O servidor do aplicativo chama separar_lembretes() de tempos em tempos. A função escolhe as
-- reservas que estão na hora do lembrete, registra cada uma na tabela de notificações (é o
-- registro que impede o mesmo lembrete de sair duas vezes, mesmo com dois pedidos ao mesmo
-- tempo) e devolve o que o aplicativo precisa para escrever o e-mail. Depois de enviar, o
-- aplicativo chama concluir_lembrete() com o resultado.
--
-- Quem recebe:
--   * lembrete de 24 horas: faltam entre 12 e 24 horas, e a reserva foi feita mais de 25 horas antes da aula;
--   * lembrete de 1 hora: faltam entre 5 e 60 minutos, e a reserva foi feita mais de 2 horas antes da aula.
-- Quem reserva em cima da hora não recebe o lembrete: acabou de receber a confirmação com o link.
-- Se o envio falhar, a função devolve o mesmo lembrete de novo depois de 10 minutos, até 5
-- tentativas, enquanto ele ainda fizer sentido.

create function public.separar_lembretes(p_limite integer default 50) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 200);
  v_saida  jsonb;
begin
  with na_hora as (
    select c.reserva_id, c.aluno_id, c.email, c.tipo
    from (
      select r.id as reserva_id, r.aluno_id, p.email, t.inicio,
             case when t.inicio <= now() + interval '60 minutes' then 'recordatorio_1h' else 'recordatorio_24h' end as tipo
      from reservas r
      join turmas t on t.id = r.turma_id
      join perfis p on p.id = r.aluno_id
      where r.situacao = 'confirmada'
        and t.situacao = 'aberta'
        and t.meet_url is not null
        and p.email is not null
        and (
          (t.inicio > now() + interval '5 minutes' and t.inicio <= now() + interval '60 minutes'
            and r.criada_em < t.inicio - interval '2 hours')
          or
          (t.inicio > now() + interval '12 hours' and t.inicio <= now() + interval '24 hours'
            and r.criada_em < t.inicio - interval '25 hours')
        )
    ) c
    -- Os que já têm o lembrete registrado ficam de fora antes do limite, para não tomarem o lugar dos novos.
    where not exists (select 1 from notificacoes n where n.tipo = c.tipo and n.dados ->> 'reserva_id' = c.reserva_id::text)
    order by c.inicio, c.reserva_id
    limit v_limite
  ),
  novos as (
    insert into notificacoes (tipo, canal, aluno_id, destinatario, dados)
    select n.tipo, 'email', n.aluno_id, n.email, jsonb_build_object('reserva_id', n.reserva_id, 'tentativas', 1)
    from na_hora n
    on conflict do nothing
    returning id, tipo, (dados ->> 'reserva_id')::uuid as reserva_id
  ),
  de_novo as (
    update notificacoes n
    set agendada_para = now(),
        dados = n.dados || jsonb_build_object('tentativas', coalesce((n.dados ->> 'tentativas')::integer, 1) + 1)
    from reservas r
    join turmas t on t.id = r.turma_id
    where n.tipo in ('recordatorio_24h', 'recordatorio_1h')
      and n.enviada_em is null
      and n.agendada_para < now() - interval '10 minutes'
      and coalesce((n.dados ->> 'tentativas')::integer, 1) < 5
      and r.id::text = n.dados ->> 'reserva_id'
      and r.situacao = 'confirmada'
      and t.situacao = 'aberta'
      and t.meet_url is not null
      and t.inicio > now() + case when n.tipo = 'recordatorio_1h' then interval '5 minutes' else interval '12 hours' end
    returning n.id, n.tipo, r.id as reserva_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'tipo', s.tipo, 'reserva_id', s.reserva_id,
           'email', p.email, 'nome', p.nome, 'fuso', p.fuso,
           'tema', te.titulo_es, 'inicio', t.inicio, 'meet_url', t.meet_url) order by t.inicio, s.id), '[]'::jsonb)
  into v_saida
  from (select * from novos union all select * from de_novo) s
  join reservas r on r.id = s.reserva_id
  join turmas t on t.id = r.turma_id
  join temas_conversacao te on te.id = t.tema_id
  join perfis p on p.id = r.aluno_id;

  return v_saida;
end $$;

-- O resultado do envio: sem erro, o lembrete fica marcado como enviado; com erro, fica o motivo
-- (e a função acima tenta de novo mais tarde).
create function public.concluir_lembrete(p_id uuid, p_erro text default null) returns void
language sql security definer set search_path = public as $$
  update notificacoes
  set enviada_em = case when p_erro is null then now() else null end,
      erro = left(p_erro, 500)
  where id = p_id and tipo in ('recordatorio_24h', 'recordatorio_1h');
$$;

-- Só o servidor do aplicativo chama estas funções: elas devolvem o link da sala e o e-mail dos alunos.
revoke execute on function public.separar_lembretes(integer) from public, anon, authenticated;
revoke execute on function public.concluir_lembrete(uuid, text) from public, anon, authenticated;
grant execute on function public.separar_lembretes(integer) to service_role;
grant execute on function public.concluir_lembrete(uuid, text) to service_role;
