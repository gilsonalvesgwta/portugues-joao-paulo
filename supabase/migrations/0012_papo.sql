-- Papo: o tutor com inteligência artificial do aluno.
-- A transação é aberta por quem aplica: a migração entra inteira ou não entra.
--
-- As tabelas já existem (conversas_papo, mensagens_papo, uso_diario). O aluno só lê as próprias
-- conversas; quem grava é o servidor do aplicativo, depois de conferir o acesso e o limite do dia
-- pelas funções abaixo. O dia do limite é contado no fuso do aluno.

create index conversas_papo_aluno on public.conversas_papo (aluno_id, iniciada_em desc);

-- Quem pode usar o Papo: a equipe (para testar) e o aluno com alguma matrícula ativa e em dia.
create function public.papo_liberado(p_pessoa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfis p
    where p.id = p_pessoa
      and (p.papel in ('professor', 'admin')
           or exists (select 1 from matriculas m
                      where m.aluno_id = p.id and m.situacao = 'ativa' and (m.expira_em is null or m.expira_em > now())))
  );
$$;

-- Conta uma mensagem do dia para a pessoa, se ela ainda tiver direito. Uma operação só: dois
-- pedidos ao mesmo tempo não passam do limite. Devolve o que aconteceu:
--   {"resultado": "ok", "usadas": n, "limite": n} | {"resultado": "limite", ...} | {"resultado": "sem_acesso"}
create function public.papo_usar(p_pessoa uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_fuso   text;
  v_limite integer := greatest(config_int('papo_mensagens_por_dia', 40), 0);
  v_usadas integer;
begin
  select fuso into v_fuso from perfis where id = p_pessoa;
  if not found or not papo_liberado(p_pessoa) then
    return jsonb_build_object('resultado', 'sem_acesso');
  end if;
  if v_limite = 0 then
    return jsonb_build_object('resultado', 'limite', 'usadas', 0, 'limite', 0);
  end if;

  insert into uso_diario (aluno_id, dia, mensagens)
  values (p_pessoa, (now() at time zone v_fuso)::date, 1)
  on conflict (aluno_id, dia) do update set mensagens = uso_diario.mensagens + 1
    where uso_diario.mensagens < v_limite
  returning mensagens into v_usadas;

  if v_usadas is null then
    return jsonb_build_object('resultado', 'limite', 'usadas', v_limite, 'limite', v_limite);
  end if;
  return jsonb_build_object('resultado', 'ok', 'usadas', v_usadas, 'limite', v_limite);
end $$;

-- Quando o tutor não consegue responder, a mensagem contada volta para o aluno.
create function public.papo_devolver(p_pessoa uuid) returns void
language sql security definer set search_path = public as $$
  update uso_diario u
  set mensagens = greatest(u.mensagens - 1, 0)
  from perfis p
  where p.id = p_pessoa and u.aluno_id = p.id and u.dia = (now() at time zone p.fuso)::date;
$$;

-- Para a tela do aluno: se ele pode usar o Papo e quantas mensagens ainda tem hoje.
create function public.meu_papo() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'liberado', papo_liberado(auth.uid()),
    'limite', greatest(config_int('papo_mensagens_por_dia', 40), 0),
    'usadas', coalesce((
      select u.mensagens from uso_diario u
      join perfis p on p.id = u.aluno_id
      where u.aluno_id = auth.uid() and u.dia = (now() at time zone p.fuso)::date), 0)
  );
$$;

-- O limite do dia nunca é negativo.
alter table public.uso_diario add constraint uso_diario_mensagens_nao_negativas check (mensagens >= 0);

-- Só o servidor do aplicativo conta e devolve mensagens; quem está logado só consulta a própria situação.
revoke execute on function public.papo_liberado(uuid) from public, anon, authenticated;
revoke execute on function public.papo_usar(uuid) from public, anon, authenticated;
revoke execute on function public.papo_devolver(uuid) from public, anon, authenticated;
revoke execute on function public.meu_papo() from public, anon;
grant execute on function public.papo_liberado(uuid) to service_role;
grant execute on function public.papo_usar(uuid) to service_role;
grant execute on function public.papo_devolver(uuid) to service_role;
grant execute on function public.meu_papo() to authenticated, service_role;
