-- Aulas de conversação ao vivo: o que faltava no banco para as telas da equipe e do aluno.
-- A transação é aberta por quem aplica: a migração entra inteira ou não entra.

-- ---------------------------------------------------------------------------
-- 1. Links só https, e turma aberta sempre com o link da sala
-- ---------------------------------------------------------------------------

-- O link do Meet vai no e-mail de confirmação da reserva: turma sem link não pode ser reservada.
alter table public.turmas add constraint turmas_meet_https
  check (meet_url is null or meet_url ~ '^https://[^[:space:]]+$');
alter table public.turmas add constraint turmas_aberta_com_link
  check (situacao <> 'aberta' or meet_url is not null);
alter table public.temas_conversacao add constraint temas_material_https
  check (material is null or material ~ '^https://[^[:space:]]+$');

create index turmas_tema on public.turmas (tema_id);
create index reservas_turma on public.reservas (turma_id, situacao);

-- Cada lembrete (24 horas e 1 hora antes) sai uma vez só por reserva.
create unique index notificacoes_lembrete_unico on public.notificacoes (tipo, (dados ->> 'reserva_id'))
  where tipo in ('recordatorio_24h', 'recordatorio_1h');

-- ---------------------------------------------------------------------------
-- 2. O link da sala não é lido direto na tabela
-- ---------------------------------------------------------------------------

-- Qualquer aluno com direito a conversação lê a tabela de turmas (para a agenda). O link do Meet,
-- porém, é só de quem reservou: sai da leitura da tabela e passa a ser entregue pelas funções
-- abaixo (ao aluno, só nas reservas dele; à equipe, sempre).
revoke select on public.turmas from authenticated;
grant select (id, tema_id, inicio, duracao_min, vagas, situacao, criado_em) on public.turmas to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Equipe: lista de turmas, uma turma com os inscritos, e cancelar
-- ---------------------------------------------------------------------------

-- Uma página da lista, com o total. p_quando: 'proximas' (padrão; ainda não terminaram e não
-- foram canceladas, da mais próxima para a mais distante) ou 'passadas' (já terminaram ou
-- foram canceladas, da mais recente para a mais antiga).
create function public.lista_de_turmas(p_quando text, p_limite integer, p_pulo integer) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_passadas boolean := coalesce(p_quando, 'proximas') = 'passadas';
  v_limite   integer := least(greatest(coalesce(p_limite, 50), 1), 100);
  v_pulo     integer := greatest(coalesce(p_pulo, 0), 0);
  v_saida    jsonb;
begin
  if not eh_equipe() then
    raise exception 'sem_permissao';
  end if;

  with base as (
    select t.id, t.inicio, t.duracao_min, t.vagas, t.situacao, te.titulo_es, te.nivel,
           (select count(*) from reservas r where r.turma_id = t.id and r.situacao = 'confirmada') as reservas,
           case when v_passadas then -extract(epoch from t.inicio) else extract(epoch from t.inicio) end as ordem
    from turmas t
    join temas_conversacao te on te.id = t.tema_id
    where case
      when v_passadas then t.situacao = 'cancelada' or t.inicio + make_interval(mins => t.duracao_min) < now()
      else t.situacao <> 'cancelada' and t.inicio + make_interval(mins => t.duracao_min) >= now()
    end
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'turmas', coalesce(
      (select jsonb_agg(to_jsonb(b) - 'ordem' order by b.ordem, b.id)
       from (select * from base order by ordem, id limit v_limite offset v_pulo) b),
      '[]'::jsonb)
  ) into v_saida;
  return v_saida;
end $$;

-- A turma, o tema e quem reservou (com presença e avaliação). null se a turma não existe.
create function public.turma_da_equipe(p_turma uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_saida jsonb;
begin
  if not eh_equipe() then
    raise exception 'sem_permissao';
  end if;
  select jsonb_build_object(
    'turma', jsonb_build_object('id', t.id, 'tema_id', t.tema_id, 'inicio', t.inicio, 'duracao_min', t.duracao_min,
                                'vagas', t.vagas, 'situacao', t.situacao, 'meet_url', t.meet_url),
    'tema', jsonb_build_object('titulo_es', te.titulo_es, 'nivel', te.nivel),
    'reservas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'reserva_id', r.id, 'aluno_id', r.aluno_id, 'nome', p.nome, 'email', p.email, 'situacao', r.situacao,
               'criada_em', r.criada_em, 'presente', r.presente, 'nota', a.nota, 'comentario', a.comentario)
             order by r.criada_em, r.id)
      from reservas r
      join perfis p on p.id = r.aluno_id
      left join avaliacoes a on a.reserva_id = r.id
      where r.turma_id = t.id and r.situacao = 'confirmada'), '[]'::jsonb)
  ) into v_saida
  from turmas t
  join temas_conversacao te on te.id = t.tema_id
  where t.id = p_turma;
  return v_saida;
end $$;

-- Cancela a turma e as reservas dela (o crédito da semana volta para cada aluno). Devolve quem
-- estava inscrito, para o servidor avisar por e-mail. Cancelar de novo não faz nada.
create function public.cancelar_turma(p_turma uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_turma  turmas;
  v_saida  jsonb;
begin
  if not eh_equipe() then
    raise exception 'sem_permissao';
  end if;
  select * into v_turma from turmas where id = p_turma for update;
  if not found then
    raise exception 'turma_inexistente';
  end if;
  if v_turma.situacao = 'cancelada' then
    return '[]'::jsonb;
  end if;
  if v_turma.inicio + make_interval(mins => v_turma.duracao_min) < now() then
    raise exception 'turma_ja_aconteceu';
  end if;

  update turmas set situacao = 'cancelada' where id = p_turma;
  with canceladas as (
    update reservas set situacao = 'cancelada', cancelada_em = now()
    where turma_id = p_turma and situacao = 'confirmada'
    returning aluno_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('aluno_id', p.id, 'nome', p.nome, 'email', p.email, 'fuso', p.fuso)), '[]'::jsonb)
    into v_saida
  from canceladas c
  join perfis p on p.id = c.aluno_id;
  return v_saida;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Aluno: as reservas dele, com o link da sala
-- ---------------------------------------------------------------------------

-- Reservas confirmadas de quem chama, das aulas que ainda vão acontecer e das dos últimos 30 dias
-- (para avaliar). É o único caminho pelo qual o aluno recebe o link do Meet.
create function public.minhas_reservas() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'reserva_id', r.id, 'turma_id', t.id, 'tema_id', te.id, 'titulo_es', te.titulo_es, 'nivel', te.nivel,
           'inicio', t.inicio, 'duracao_min', t.duracao_min, 'meet_url', t.meet_url, 'material', te.material,
           'nota', a.nota, 'comentario', a.comentario)
         order by t.inicio, r.id), '[]'::jsonb)
  from reservas r
  join turmas t on t.id = r.turma_id
  join temas_conversacao te on te.id = t.tema_id
  left join avaliacoes a on a.reserva_id = r.id
  where r.aluno_id = auth.uid()
    and r.situacao = 'confirmada'
    and t.situacao <> 'cancelada'
    and t.inicio > now() - interval '30 days';
$$;

-- Função nova não nasce liberada: sai de "todos" e de visitante, e entra pelo nome para quem está logado.
revoke execute on function public.lista_de_turmas(text, integer, integer) from public, anon;
revoke execute on function public.turma_da_equipe(uuid) from public, anon;
revoke execute on function public.cancelar_turma(uuid) from public, anon;
revoke execute on function public.minhas_reservas() from public, anon;
grant execute on function public.lista_de_turmas(text, integer, integer) to authenticated, service_role;
grant execute on function public.turma_da_equipe(uuid) to authenticated, service_role;
grant execute on function public.cancelar_turma(uuid) to authenticated, service_role;
grant execute on function public.minhas_reservas() to authenticated, service_role;
