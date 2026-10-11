-- Área do aluno: o curso e o progresso em uma resposta só.
-- A transação é aberta por quem aplica: a migração entra inteira ou não entra.
--
-- As duas funções rodam com as permissões de quem chama: o aluno só recebe o curso em que está
-- matriculado, e a equipe recebe qualquer curso (para ver a plataforma como o aluno vê).
-- Só entra o que o aluno pode ver: curso, aula e quiz publicados e fora da lixeira. Rascunho
-- não aparece nem para a equipe, porque esta é a visão do aluno.

create function public.curso_do_aluno(p_curso uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'curso', to_jsonb(c),
    'modulos', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'ordem', m.ordem, 'titulo_pt', m.titulo_pt, 'titulo_es', m.titulo_es) order by m.ordem, m.id)
      from modulos m
      where m.curso_id = c.id and m.arquivado_em is null), '[]'::jsonb),
    'aulas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'modulo_id', a.modulo_id, 'numero', a.numero, 'titulo_pt', a.titulo_pt, 'titulo_es', a.titulo_es,
               'duracao_seg', a.duracao_seg) order by a.numero, a.id)
      from aulas a
      join modulos m on m.id = a.modulo_id
      where m.curso_id = c.id and m.arquivado_em is null and a.situacao = 'publicado' and a.arquivado_em is null), '[]'::jsonb),
    'quizzes', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'aula_id', q.aula_id, 'nota_minima', q.nota_minima))
      from quizzes q
      join aulas a on a.id = q.aula_id
      join modulos m on m.id = a.modulo_id
      where m.curso_id = c.id and m.arquivado_em is null and q.situacao = 'publicado'
        and a.situacao = 'publicado' and a.arquivado_em is null), '[]'::jsonb),
    'tarefas', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'aula_id', t.aula_id, 'titulo_es', t.titulo_es, 'instrucao_es', t.instrucao_es, 'link', t.link))
      from tarefas t
      where t.curso_id = c.id and t.arquivado_em is null), '[]'::jsonb),
    'trilha', ler_trilha(c.id)
  )
  from (
    select id, titulo_pt, titulo_es, tipo, modo
    from cursos
    where id = p_curso and situacao = 'publicado' and arquivado_em is null
  ) c;
$$;

-- O que a pessoa logada já fez em um curso: aulas vistas (e onde parou em cada vídeo), quizzes
-- respondidos (quantas tentativas e a melhor nota, de 0 a 100) e itens da trilha marcados.
-- É sempre o progresso de quem chama, mesmo para a equipe.
create function public.meu_progresso(p_curso uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'aulas', coalesce((
      select jsonb_agg(jsonb_build_object('aula_id', p.aula_id, 'posicao_seg', p.posicao_seg, 'concluida', p.concluida_em is not null))
      from progresso_aulas p
      join aulas a on a.id = p.aula_id
      join modulos m on m.id = a.modulo_id
      where p.aluno_id = auth.uid() and m.curso_id = p_curso), '[]'::jsonb),
    'quizzes', coalesce((
      select jsonb_agg(jsonb_build_object('quiz_id', t.quiz_id, 'tentativas', t.tentativas, 'melhor', t.melhor))
      from (
        select tq.quiz_id, count(*) as tentativas,
               max(case when tq.total > 0 then round(100.0 * tq.acertos / tq.total)::integer else 0 end) as melhor
        from tentativas_quiz tq
        join quizzes q on q.id = tq.quiz_id
        join aulas a on a.id = q.aula_id
        join modulos m on m.id = a.modulo_id
        where tq.aluno_id = auth.uid() and tq.concluida_em is not null and m.curso_id = p_curso
        group by tq.quiz_id
      ) t), '[]'::jsonb),
    'itens', coalesce((
      select jsonb_agg(ic.item_dia_id)
      from itens_concluidos ic
      join itens_dia i on i.id = ic.item_dia_id
      join dias_trilha d on d.id = i.dia_id
      where ic.aluno_id = auth.uid() and d.curso_id = p_curso), '[]'::jsonb)
  );
$$;

-- Função nova não nasce liberada: sai de "todos" e de visitante, e entra pelo nome para quem está logado.
revoke execute on function public.curso_do_aluno(uuid) from public, anon;
revoke execute on function public.meu_progresso(uuid) from public, anon;
grant execute on function public.curso_do_aluno(uuid) to authenticated, service_role;
grant execute on function public.meu_progresso(uuid) to authenticated, service_role;
