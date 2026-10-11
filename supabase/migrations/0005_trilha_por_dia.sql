-- Trilha por dia: gravação e leitura de uma vez só.
-- A transação é aberta por quem aplica: a migração entra inteira ou não entra.

-- Cada aula, quiz ou tarefa entra na trilha no máximo uma vez.
create unique index itens_dia_aula_unica   on public.itens_dia (aula_id)   where aula_id   is not null;
create unique index itens_dia_quiz_unico   on public.itens_dia (quiz_id)   where quiz_id   is not null;
create unique index itens_dia_tarefa_unica on public.itens_dia (tarefa_id) where tarefa_id is not null;

-- Grava a trilha inteira de um curso em uma única transação.
-- p_dias é a lista de dias, na ordem; cada dia tem "itens", e cada item tem:
--   id (o do item que já existia, ou null para um item novo), tipo, alvo e obrigatorio.
-- Os itens que já existiam são MOVIDOS, não recriados: assim o que o aluno já marcou como feito
-- (itens_concluidos aponta para o item) continua valendo quando o professor reorganiza os dias.
-- Só o que saiu da trilha é apagado. Roda com as permissões de quem chama: só a equipe passa.
create function public.salvar_trilha(p_curso uuid, p_dias jsonb) returns integer
language plpgsql security invoker set search_path = public as $$
declare
  v_total    integer;
  v_mantidos uuid[];
  v_dia      uuid;
  v_tipo     text;
  v_alvo     uuid;
  v_do_curso boolean;
  r          record;
begin
  if not eh_equipe() then
    raise exception 'sem_permissao';
  end if;
  if p_dias is null or jsonb_typeof(p_dias) <> 'array' then
    raise exception 'dias_invalidos';
  end if;
  if not exists (select 1 from cursos where id = p_curso and arquivado_em is null) then
    raise exception 'curso_inexistente';
  end if;
  v_total := jsonb_array_length(p_dias);

  -- 1. Sai da trilha o que não veio na lista.
  select coalesce(array_agg((i.item ->> 'id')::uuid), '{}')
    into v_mantidos
  from jsonb_array_elements(p_dias) as d (dia)
  cross join lateral jsonb_array_elements(coalesce(d.dia -> 'itens', '[]'::jsonb)) as i (item)
  where i.item ->> 'id' is not null;

  delete from itens_dia
  where dia_id in (select id from dias_trilha where curso_id = p_curso)
    and id <> all (v_mantidos);

  -- 2. Existe um dia para cada número de 1 até o total.
  insert into dias_trilha (curso_id, numero)
  select p_curso, n from generate_series(1, v_total) as n
  on conflict (curso_id, numero) do nothing;

  -- 3. Cada item vai para o seu dia e a sua posição.
  for r in
    select d.posicao::integer as numero, i.posicao::integer as ordem, i.item
    from jsonb_array_elements(p_dias) with ordinality as d (dia, posicao)
    cross join lateral jsonb_array_elements(coalesce(d.dia -> 'itens', '[]'::jsonb)) with ordinality as i (item, posicao)
  loop
    select id into v_dia from dias_trilha where curso_id = p_curso and numero = r.numero;
    v_tipo := r.item ->> 'tipo';
    v_alvo := (r.item ->> 'alvo')::uuid;

    -- O item tem de ser deste curso e estar fora da lixeira.
    v_do_curso := case v_tipo
      when 'aula' then exists (
        select 1 from aulas a join modulos m on m.id = a.modulo_id
        where a.id = v_alvo and m.curso_id = p_curso and a.arquivado_em is null)
      when 'quiz' then exists (
        select 1 from quizzes q join aulas a on a.id = q.aula_id join modulos m on m.id = a.modulo_id
        where q.id = v_alvo and m.curso_id = p_curso and a.arquivado_em is null)
      when 'tarefa' then exists (
        select 1 from tarefas t where t.id = v_alvo and t.curso_id = p_curso and t.arquivado_em is null)
      else false
    end;
    if not v_do_curso then
      raise exception 'item_de_outro_curso';
    end if;

    if r.item ->> 'id' is not null then
      update itens_dia
         set dia_id = v_dia, ordem = r.ordem, obrigatorio = coalesce((r.item ->> 'obrigatorio')::boolean, true)
       where id = (r.item ->> 'id')::uuid
         and dia_id in (select id from dias_trilha where curso_id = p_curso)
         and tipo = v_tipo
         and coalesce(aula_id, quiz_id, tarefa_id) = v_alvo;
      if not found then
        raise exception 'item_inexistente';
      end if;
    else
      insert into itens_dia (dia_id, tipo, aula_id, quiz_id, tarefa_id, ordem, obrigatorio)
      values (
        v_dia, v_tipo,
        case when v_tipo = 'aula'   then v_alvo end,
        case when v_tipo = 'quiz'   then v_alvo end,
        case when v_tipo = 'tarefa' then v_alvo end,
        r.ordem, coalesce((r.item ->> 'obrigatorio')::boolean, true));
    end if;
  end loop;

  -- 4. Somem os dias que ficaram além do total.
  delete from dias_trilha where curso_id = p_curso and numero > v_total;
  return v_total;
end $$;

-- A trilha de um curso em uma resposta só (não depende do limite de linhas por consulta).
-- Vale para a equipe e, mais adiante, para o aluno: quem chama só recebe o que as regras de
-- acesso das tabelas deixam ver.
create function public.ler_trilha(p_curso uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('numero', d.numero, 'itens', coalesce(i.itens, '[]'::jsonb)) order by d.numero), '[]'::jsonb)
  from dias_trilha d
  left join lateral (
    select jsonb_agg(
             jsonb_build_object('id', it.id, 'tipo', it.tipo, 'alvo', coalesce(it.aula_id, it.quiz_id, it.tarefa_id), 'obrigatorio', it.obrigatorio)
             order by it.ordem, it.id) as itens
    from itens_dia it
    where it.dia_id = d.id
  ) i on true
  where d.curso_id = p_curso;
$$;

revoke execute on function public.salvar_trilha(uuid, jsonb) from public, anon;
grant execute on function public.salvar_trilha(uuid, jsonb) to authenticated, service_role;
revoke execute on function public.ler_trilha(uuid) from public, anon;
grant execute on function public.ler_trilha(uuid) to authenticated, service_role;
