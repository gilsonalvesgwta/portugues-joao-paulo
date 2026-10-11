-- Gravação do quiz da aula de uma vez só.
-- O editor manda o quiz inteiro (configuração e perguntas). Esta função troca tudo dentro de uma
-- única transação: ou o quiz novo entra completo, ou o antigo continua como estava. Nunca fica
-- um quiz pela metade se algo falhar no meio.
-- Roda com as permissões de quem chama: só a equipe (professor e administrador) passa pelas
-- regras de acesso das tabelas quizzes e perguntas.
-- A transação é aberta por quem aplica: a migração entra inteira ou não entra.

create function public.salvar_quiz(
  p_aula         uuid,
  p_dificuldade  text,
  p_nota_minima  integer,
  p_situacao     text,
  p_perguntas    jsonb
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_quiz uuid;
begin
  if not eh_equipe() then
    raise exception 'sem_permissao';
  end if;
  if p_perguntas is null or jsonb_typeof(p_perguntas) <> 'array' then
    raise exception 'perguntas_invalidas';
  end if;
  if not exists (select 1 from aulas where id = p_aula and arquivado_em is null) then
    raise exception 'aula_inexistente';
  end if;

  insert into quizzes (aula_id, dificuldade, nota_minima, situacao)
  values (p_aula, p_dificuldade, p_nota_minima, p_situacao)
  on conflict (aula_id) do update
    set dificuldade = excluded.dificuldade,
        nota_minima = excluded.nota_minima,
        situacao    = excluded.situacao
  returning id into v_quiz;

  delete from perguntas where quiz_id = v_quiz;

  -- Cada item traz "tipo" e o restante é o conteúdo da pergunta (com o gabarito).
  insert into perguntas (quiz_id, tipo, ordem, conteudo)
  select v_quiz, item ->> 'tipo', posicao, item - 'tipo'
  from jsonb_array_elements(p_perguntas) with ordinality as lista (item, posicao);

  return v_quiz;
end $$;

revoke execute on function public.salvar_quiz(uuid, text, integer, text, jsonb) from public, anon;
grant execute on function public.salvar_quiz(uuid, text, integer, text, jsonb) to authenticated, service_role;

-- Quantas perguntas tem o quiz de cada aula, para as listas da administração.
-- A contagem é feita no banco: assim não depende do limite de linhas por consulta.
create function public.resumo_dos_quizzes()
returns table (aula_id uuid, situacao text, perguntas bigint)
language sql stable security invoker set search_path = public as $$
  select q.aula_id, q.situacao, count(p.id)
  from quizzes q
  left join perguntas p on p.quiz_id = q.id
  where eh_equipe()
  group by q.id;
$$;

revoke execute on function public.resumo_dos_quizzes() from public, anon;
grant execute on function public.resumo_dos_quizzes() to authenticated, service_role;
