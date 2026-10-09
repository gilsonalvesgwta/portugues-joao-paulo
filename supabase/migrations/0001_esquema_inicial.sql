-- Português com João Paulo — esquema inicial
-- 29 tabelas, regras de acesso por linha e funções de reserva e de pagamento.
-- Destino: Postgres do Supabase auto-hospedado (usa auth.users e auth.uid()).
-- Convenções: datas em UTC (timestamptz); textos do aluno com versão _pt e _es;
-- conteúdo com progresso é arquivado (arquivado_em), nunca apagado.

begin;

-- ---------------------------------------------------------------------------
-- 1. Acesso e pagamento
-- ---------------------------------------------------------------------------

create table public.perfis (
  id                  uuid primary key references auth.users (id) on delete cascade,
  nome                text not null default '',
  email               text not null,
  papel               text not null default 'aluno' check (papel in ('aluno', 'professor', 'admin')),
  fuso                text not null default 'Europe/Madrid',
  idioma              text not null default 'es' check (idioma in ('es', 'pt')),
  whatsapp            text,
  whatsapp_autorizado boolean not null default false,
  aceite_termos_em    timestamptz,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create unique index perfis_email_unico on public.perfis (lower(email));

create table public.cursos (
  id            uuid primary key default gen_random_uuid(),
  titulo_pt     text not null,
  titulo_es     text not null,
  tipo          text not null default 'principal' check (tipo in ('principal', 'complementar')),
  situacao      text not null default 'rascunho' check (situacao in ('rascunho', 'publicado')),
  modo          text not null default 'livre' check (modo in ('livre', 'sequencial')),
  ordem         integer not null default 0,
  arquivado_em  timestamptz,
  criado_em     timestamptz not null default now()
);

create table public.ofertas (
  id                  uuid primary key default gen_random_uuid(),
  greenn_product_id   bigint not null unique,
  curso_id            uuid not null references public.cursos (id),
  nome                text not null,
  dias_de_acesso      integer check (dias_de_acesso is null or dias_de_acesso > 0), -- null = sem prazo
  inclui_conversacao  boolean not null default true,
  reservas_por_semana integer not null default 2 check (reservas_por_semana >= 0),
  ativa               boolean not null default true,
  criado_em           timestamptz not null default now()
);

create table public.matriculas (
  id                  uuid primary key default gen_random_uuid(),
  aluno_id            uuid not null references public.perfis (id) on delete cascade,
  curso_id            uuid not null references public.cursos (id),
  oferta_id           uuid references public.ofertas (id),
  situacao            text not null default 'ativa' check (situacao in ('ativa', 'suspensa', 'encerrada')),
  inicio              timestamptz not null default now(),  -- o dia 1 da trilha conta a partir daqui
  expira_em           timestamptz,
  origem              text not null default 'greenn' check (origem in ('greenn', 'manual')),
  inclui_conversacao  boolean not null default true,
  reservas_por_semana integer not null default 2 check (reservas_por_semana >= 0),
  greenn_sale_id      bigint,
  greenn_contract_id  bigint,
  atualizado_em       timestamptz not null default now(),
  unique (aluno_id, curso_id)
);

create table public.eventos_pagamento (
  id                  bigint generated always as identity primary key,
  recebido_em         timestamptz not null default now(),
  tipo                text not null,          -- sale | contract | lead
  evento              text,
  status_atual        text,
  chave_idempotencia  text not null unique,
  payload             jsonb not null,         -- evento bruto, sem alteração
  aluno_id            uuid references public.perfis (id) on delete set null,
  processado_em       timestamptz,
  erro                text
);

-- ---------------------------------------------------------------------------
-- 2. Conteúdo
-- ---------------------------------------------------------------------------

create table public.modulos (
  id            uuid primary key default gen_random_uuid(),
  curso_id      uuid not null references public.cursos (id),
  ordem         integer not null,
  titulo_pt     text not null,
  titulo_es     text not null,
  arquivado_em  timestamptz
);
create index modulos_curso on public.modulos (curso_id, ordem);

create table public.aulas (
  id            uuid primary key default gen_random_uuid(),
  modulo_id     uuid not null references public.modulos (id),
  numero        integer not null check (numero > 0),
  titulo_pt     text not null,
  titulo_es     text not null,
  video_id      text,
  duracao_seg   integer check (duracao_seg is null or duracao_seg >= 0),
  anotacoes     jsonb not null default '[]'::jsonb,   -- blocos do editor de anotações
  situacao      text not null default 'rascunho' check (situacao in ('rascunho', 'publicado')),
  arquivado_em  timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index aulas_modulo on public.aulas (modulo_id, numero);

create table public.legendas (
  id       uuid primary key default gen_random_uuid(),
  aula_id  uuid not null references public.aulas (id) on delete cascade,
  idioma   text not null check (idioma in ('pt', 'es')),
  arquivo  text not null,
  unique (aula_id, idioma)
);

create table public.frases_pronuncia (
  id           uuid primary key default gen_random_uuid(),
  aula_id      uuid not null references public.aulas (id) on delete cascade,
  ordem        integer not null default 0,
  texto_pt     text not null,
  traducao_es  text not null,
  audio        text
);
create index frases_pronuncia_aula on public.frases_pronuncia (aula_id, ordem);

create table public.materiais (
  id             uuid primary key default gen_random_uuid(),
  curso_id       uuid references public.cursos (id),
  aula_id        uuid references public.aulas (id),
  titulo_pt      text not null,
  titulo_es      text not null,
  descricao_es   text,
  arquivo        text not null,
  tamanho_bytes  bigint,
  ordem          integer not null default 0,
  check (curso_id is not null or aula_id is not null)
);

create table public.quizzes (
  id           uuid primary key default gen_random_uuid(),
  aula_id      uuid not null unique references public.aulas (id),
  dificuldade  text not null default 'facil' check (dificuldade in ('facil', 'medio', 'dificil')),
  nota_minima  integer not null default 70 check (nota_minima between 0 and 100),
  situacao     text not null default 'rascunho' check (situacao in ('rascunho', 'publicado'))
);

create table public.perguntas (
  id        uuid primary key default gen_random_uuid(),
  quiz_id   uuid not null references public.quizzes (id) on delete cascade,
  tipo      text not null check (tipo in ('parear_audio', 'multipla_escolha', 'completar', 'ordenar', 'ouvir_escrever')),
  ordem     integer not null default 0,
  conteudo  jsonb not null,   -- inclui o gabarito: o aluno nunca lê esta tabela direto
  audio     text
);
create index perguntas_quiz on public.perguntas (quiz_id, ordem);

create table public.tarefas (
  id            uuid primary key default gen_random_uuid(),
  curso_id      uuid not null references public.cursos (id),
  aula_id       uuid references public.aulas (id),
  titulo_es     text not null,
  instrucao_es  text not null,
  link          text,
  arquivo       text,
  arquivado_em  timestamptz
);

create table public.dias_trilha (
  id        uuid primary key default gen_random_uuid(),
  curso_id  uuid not null references public.cursos (id),
  numero    integer not null check (numero > 0),
  unique (curso_id, numero)
);

create table public.itens_dia (
  id           uuid primary key default gen_random_uuid(),
  dia_id       uuid not null references public.dias_trilha (id) on delete cascade,
  tipo         text not null check (tipo in ('aula', 'quiz', 'tarefa')),
  aula_id      uuid references public.aulas (id),
  quiz_id      uuid references public.quizzes (id),
  tarefa_id    uuid references public.tarefas (id),
  ordem        integer not null default 0,
  obrigatorio  boolean not null default true,
  check (
    (tipo = 'aula'   and aula_id   is not null and quiz_id is null and tarefa_id is null) or
    (tipo = 'quiz'   and quiz_id   is not null and aula_id is null and tarefa_id is null) or
    (tipo = 'tarefa' and tarefa_id is not null and aula_id is null and quiz_id   is null)
  )
);
create index itens_dia_dia on public.itens_dia (dia_id, ordem);

-- ---------------------------------------------------------------------------
-- 3. Progresso
-- ---------------------------------------------------------------------------

create table public.progresso_aulas (
  aluno_id       uuid not null references public.perfis (id) on delete cascade,
  aula_id        uuid not null references public.aulas (id),
  posicao_seg    integer not null default 0 check (posicao_seg >= 0),
  concluida_em   timestamptz,
  atualizado_em  timestamptz not null default now(),
  primary key (aluno_id, aula_id)
);

create table public.tentativas_quiz (
  id            uuid primary key default gen_random_uuid(),
  aluno_id      uuid not null references public.perfis (id) on delete cascade,
  quiz_id       uuid not null references public.quizzes (id),
  respostas     jsonb not null default '[]'::jsonb,
  acertos       integer not null default 0,
  total         integer not null default 0,
  concluida_em  timestamptz
);
create index tentativas_quiz_aluno on public.tentativas_quiz (aluno_id, quiz_id);

create table public.itens_concluidos (
  aluno_id      uuid not null references public.perfis (id) on delete cascade,
  item_dia_id   uuid not null references public.itens_dia (id) on delete cascade,
  concluido_em  timestamptz not null default now(),
  primary key (aluno_id, item_dia_id)
);

-- ---------------------------------------------------------------------------
-- 4. Conversação
-- ---------------------------------------------------------------------------

create table public.temas_conversacao (
  id            uuid primary key default gen_random_uuid(),
  titulo_es     text not null,
  nivel         text not null check (nivel in ('basico', 'intermediario', 'avancado')),
  descricao_es  text,
  aprendizados  jsonb not null default '[]'::jsonb,
  material      text,
  arquivado_em  timestamptz
);

create table public.turmas (
  id               uuid primary key default gen_random_uuid(),
  tema_id          uuid not null references public.temas_conversacao (id),
  inicio           timestamptz not null,
  duracao_min      integer not null default 60 check (duracao_min > 0),
  vagas            integer not null default 10 check (vagas > 0),
  meet_url         text,
  google_event_id  text,
  situacao         text not null default 'aberta' check (situacao in ('aberta', 'cancelada', 'realizada')),
  criado_em        timestamptz not null default now()
);
create index turmas_inicio on public.turmas (inicio);

create table public.reservas (
  id            uuid primary key default gen_random_uuid(),
  turma_id      uuid not null references public.turmas (id),
  aluno_id      uuid not null references public.perfis (id) on delete cascade,
  situacao      text not null default 'confirmada' check (situacao in ('confirmada', 'cancelada')),
  criada_em     timestamptz not null default now(),
  cancelada_em  timestamptz,
  presente      boolean,
  unique (turma_id, aluno_id)
);
create index reservas_aluno on public.reservas (aluno_id, situacao);

create table public.avaliacoes (
  id          uuid primary key default gen_random_uuid(),
  reserva_id  uuid not null unique references public.reservas (id) on delete cascade,
  nota        integer not null check (nota between 1 and 5),
  comentario  text,
  criada_em   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. IA e pronúncia
-- ---------------------------------------------------------------------------

create table public.conversas_papo (
  id           uuid primary key default gen_random_uuid(),
  aluno_id     uuid not null references public.perfis (id) on delete cascade,
  aula_id      uuid references public.aulas (id),
  iniciada_em  timestamptz not null default now()
);

create table public.mensagens_papo (
  id              bigint generated always as identity primary key,
  conversa_id     uuid not null references public.conversas_papo (id) on delete cascade,
  autor           text not null check (autor in ('aluno', 'papo')),
  texto           text not null,
  tokens_entrada  integer,
  tokens_saida    integer,
  criada_em       timestamptz not null default now()
);
create index mensagens_papo_conversa on public.mensagens_papo (conversa_id, id);

create table public.praticas_pronuncia (
  id          uuid primary key default gen_random_uuid(),
  aluno_id    uuid not null references public.perfis (id) on delete cascade,
  aula_id     uuid references public.aulas (id),
  texto       text not null,
  nota_geral  numeric(5, 2),
  notas       jsonb not null default '[]'::jsonb,   -- nota por palavra; o áudio nunca é guardado
  segundos    numeric(6, 2),
  criada_em   timestamptz not null default now()
);

create table public.uso_diario (
  aluno_id            uuid not null references public.perfis (id) on delete cascade,
  dia                 date not null,
  mensagens           integer not null default 0,
  gravacoes           integer not null default 0,
  custo_estimado_usd  numeric(10, 4) not null default 0,
  primary key (aluno_id, dia)
);

-- ---------------------------------------------------------------------------
-- 6. Sistema
-- ---------------------------------------------------------------------------

create table public.configuracoes (
  chave          text primary key,
  valor          jsonb not null,
  atualizado_em  timestamptz not null default now()
);

create table public.notificacoes (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null,
  canal          text not null check (canal in ('email', 'whatsapp')),
  aluno_id       uuid references public.perfis (id) on delete cascade,
  destinatario   text not null,
  dados          jsonb not null default '{}'::jsonb,
  agendada_para  timestamptz not null default now(),
  enviada_em     timestamptz,
  erro           text
);
create index notificacoes_fila on public.notificacoes (agendada_para) where enviada_em is null;

create table public.registro_alteracoes (
  id         bigint generated always as identity primary key,
  pessoa_id  uuid references public.perfis (id) on delete set null,
  tabela     text not null,
  registro   text not null,
  antes      jsonb,
  depois     jsonb,
  quando     timestamptz not null default now()
);

insert into public.configuracoes (chave, valor) values
  ('agenda_janela_dias',            '7'),
  ('reserva_fecha_min_antes',       '15'),
  ('cancelamento_min_antes',        '120'),
  ('papo_mensagens_por_dia',        '40'),
  ('pronuncia_gravacoes_por_dia',   '30'),
  ('pronuncia_segundos_max',        '30');

-- ---------------------------------------------------------------------------
-- 7. Gatilhos de apoio
-- ---------------------------------------------------------------------------

create function public.tocar_atualizado_em() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

create trigger perfis_atualizado      before update on public.perfis          for each row execute function public.tocar_atualizado_em();
create trigger aulas_atualizado       before update on public.aulas           for each row execute function public.tocar_atualizado_em();
create trigger matriculas_atualizado  before update on public.matriculas      for each row execute function public.tocar_atualizado_em();
create trigger progresso_atualizado   before update on public.progresso_aulas for each row execute function public.tocar_atualizado_em();

-- Fuso inválido quebraria o cálculo da semana e dos horários: recusa na gravação.
create function public.validar_fuso() returns trigger
language plpgsql as $$
begin
  perform now() at time zone new.fuso;
  return new;
exception when invalid_parameter_value then
  raise exception 'fuso_invalido: %', new.fuso using errcode = '22023';
end $$;

create trigger perfis_fuso before insert or update of fuso on public.perfis
  for each row execute function public.validar_fuso();

-- Todo usuário criado no login do Supabase ganha um perfil de aluno.
create function public.criar_perfil_do_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nome', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger usuario_criado after insert on auth.users
  for each row execute function public.criar_perfil_do_usuario();

-- ---------------------------------------------------------------------------
-- 8. Funções usadas pelas regras de acesso
-- ---------------------------------------------------------------------------

create function public.eh_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel in ('professor', 'admin'));
$$;

create function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'admin');
$$;

-- Curso principal exige matrícula nele; curso complementar vem com qualquer matrícula ativa.
create function public.aluno_ve_curso(p_curso uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from cursos c
    where c.id = p_curso
      and c.situacao = 'publicado'
      and c.arquivado_em is null
      and exists (
        select 1 from matriculas m
        where m.aluno_id = auth.uid()
          and m.situacao = 'ativa'
          and (m.expira_em is null or m.expira_em > now())
          and (c.tipo = 'complementar' or m.curso_id = c.id)
      )
  );
$$;

create function public.aluno_ve_aula(p_aula uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from aulas a
    join modulos mo on mo.id = a.modulo_id
    where a.id = p_aula
      and a.situacao = 'publicado'
      and a.arquivado_em is null
      and mo.arquivado_em is null
      and aluno_ve_curso(mo.curso_id)
  );
$$;

create function public.pode_conversacao() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from matriculas m
    where m.aluno_id = auth.uid()
      and m.situacao = 'ativa'
      and (m.expira_em is null or m.expira_em > now())
      and m.inclui_conversacao
  );
$$;

create function public.config_int(p_chave text, p_padrao integer) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select (valor #>> '{}')::integer from configuracoes where chave = p_chave), p_padrao);
$$;

-- ---------------------------------------------------------------------------
-- 9. Conversação: agenda, reserva, cancelamento e avaliação
-- ---------------------------------------------------------------------------

-- Turmas abertas dentro da janela, com as vagas que restam. O aluno não lê as
-- reservas dos colegas; esta função conta por ele.
create function public.agenda_turmas(p_nivel text default null)
returns table (
  turma_id uuid, tema_id uuid, titulo_es text, nivel text, inicio timestamptz,
  duracao_min integer, vagas integer, vagas_restantes integer, ja_reservada boolean
)
language sql stable security definer set search_path = public as $$
  select t.id, te.id, te.titulo_es, te.nivel, t.inicio, t.duracao_min, t.vagas,
         t.vagas - (select count(*)::integer from reservas r where r.turma_id = t.id and r.situacao = 'confirmada'),
         exists (select 1 from reservas r where r.turma_id = t.id and r.aluno_id = auth.uid() and r.situacao = 'confirmada')
  from turmas t
  join temas_conversacao te on te.id = t.tema_id
  where (eh_equipe() or pode_conversacao())
    and t.situacao = 'aberta'
    and t.inicio > now()
    and t.inicio <= now() + make_interval(days => config_int('agenda_janela_dias', 7))
    and (p_nivel is null or te.nivel = p_nivel)
  order by t.inicio;
$$;

-- Reserva em uma única operação. Duas travas, sempre nesta ordem:
--   1) o perfil do aluno  -> o limite semanal não é furado por pedidos simultâneos;
--   2) a linha da turma   -> a última vaga nunca vai para dois alunos.
create function public.reservar_turma(p_turma uuid) returns public.reservas
language plpgsql security definer set search_path = public as $$
declare
  v_aluno      uuid := auth.uid();
  v_fuso       text;
  v_turma      turmas;
  v_limite     integer;
  v_semana_ini timestamptz;
  v_na_semana  integer;
  v_ocupadas   integer;
  v_reserva    reservas;
begin
  if v_aluno is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;

  select fuso into v_fuso from perfis where id = v_aluno for update;
  if not found then
    raise exception 'perfil_inexistente' using errcode = 'P0001';
  end if;

  select * into v_turma from turmas where id = p_turma for update;
  if not found then
    raise exception 'turma_inexistente' using errcode = 'P0001';
  end if;
  if v_turma.situacao <> 'aberta' then
    raise exception 'turma_fechada' using errcode = 'P0001';
  end if;
  if v_turma.inicio <= now() + make_interval(mins => config_int('reserva_fecha_min_antes', 15)) then
    raise exception 'reserva_encerrada' using errcode = 'P0001';
  end if;
  if v_turma.inicio > now() + make_interval(days => config_int('agenda_janela_dias', 7)) then
    raise exception 'fora_da_janela' using errcode = 'P0001';
  end if;

  select max(m.reservas_por_semana) into v_limite
  from matriculas m
  where m.aluno_id = v_aluno
    and m.situacao = 'ativa'
    and (m.expira_em is null or m.expira_em > now())
    and m.inclui_conversacao;
  if v_limite is null then
    raise exception 'sem_direito_a_conversacao' using errcode = 'P0001';
  end if;

  if exists (select 1 from reservas where turma_id = p_turma and aluno_id = v_aluno and situacao = 'confirmada') then
    raise exception 'ja_reservada' using errcode = 'P0001';
  end if;

  -- Semana de segunda a domingo no fuso do aluno, a semana em que a aula acontece.
  v_semana_ini := date_trunc('week', v_turma.inicio at time zone v_fuso) at time zone v_fuso;
  select count(*) into v_na_semana
  from reservas r
  join turmas t on t.id = r.turma_id
  where r.aluno_id = v_aluno
    and r.situacao = 'confirmada'
    and t.inicio >= v_semana_ini
    and t.inicio <  v_semana_ini + interval '7 days';
  if v_na_semana >= v_limite then
    raise exception 'limite_semanal' using errcode = 'P0001';
  end if;

  select count(*) into v_ocupadas from reservas where turma_id = p_turma and situacao = 'confirmada';
  if v_ocupadas >= v_turma.vagas then
    raise exception 'turma_lotada' using errcode = 'P0001';
  end if;

  insert into reservas (turma_id, aluno_id)
  values (p_turma, v_aluno)
  on conflict (turma_id, aluno_id)
    do update set situacao = 'confirmada', criada_em = now(), cancelada_em = null, presente = null
  returning * into v_reserva;

  return v_reserva;
end $$;

-- Cancelar dentro do prazo devolve o crédito da semana (a reserva deixa de contar).
create function public.cancelar_reserva(p_reserva uuid) returns public.reservas
language plpgsql security definer set search_path = public as $$
declare
  v_aluno   uuid := auth.uid();
  v_reserva reservas;
  v_inicio  timestamptz;
begin
  select r.* into v_reserva from reservas r where r.id = p_reserva and r.aluno_id = v_aluno for update;
  if not found then
    raise exception 'reserva_inexistente' using errcode = 'P0001';
  end if;
  if v_reserva.situacao = 'cancelada' then
    return v_reserva;
  end if;
  select inicio into v_inicio from turmas where id = v_reserva.turma_id;
  if v_inicio < now() + make_interval(mins => config_int('cancelamento_min_antes', 120)) then
    raise exception 'cancelamento_fora_do_prazo' using errcode = 'P0001';
  end if;
  update reservas set situacao = 'cancelada', cancelada_em = now() where id = p_reserva returning * into v_reserva;
  return v_reserva;
end $$;

create function public.avaliar_aula(p_reserva uuid, p_nota integer, p_comentario text default null)
returns public.avaliacoes
language plpgsql security definer set search_path = public as $$
declare
  v_fim       timestamptz;
  v_avaliacao avaliacoes;
begin
  select t.inicio + make_interval(mins => t.duracao_min) into v_fim
  from reservas r join turmas t on t.id = r.turma_id
  where r.id = p_reserva and r.aluno_id = auth.uid() and r.situacao = 'confirmada';
  if not found then
    raise exception 'reserva_inexistente' using errcode = 'P0001';
  end if;
  if v_fim > now() then
    raise exception 'aula_ainda_nao_terminou' using errcode = 'P0001';
  end if;
  insert into avaliacoes (reserva_id, nota, comentario) values (p_reserva, p_nota, p_comentario)
  on conflict (reserva_id) do update set nota = excluded.nota, comentario = excluded.comentario
  returning * into v_avaliacao;
  return v_avaliacao;
end $$;

-- ---------------------------------------------------------------------------
-- 10. Pagamento: eventos da Greenn (chamadas só pelo servidor)
-- PROVISÓRIO: segue a documentação pública do webhook; os campos serão
-- conferidos com eventos reais na fase 0 antes de ir para produção.
-- ---------------------------------------------------------------------------

-- Grava o evento bruto uma única vez. Devolve o id e se ele é novo.
create function public.registrar_evento_pagamento(p_payload jsonb)
returns table (evento_id bigint, novo boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_tipo   text := coalesce(p_payload ->> 'type', 'desconhecido');
  v_ref    text := coalesce(p_payload #>> '{sale,id}', p_payload #>> '{contract,id}', p_payload #>> '{lead,id}', md5(p_payload::text));
  v_status text := coalesce(p_payload ->> 'currentStatus', '');
  v_chave  text;
  v_id     bigint;
begin
  v_chave := v_tipo || ':' || v_ref || ':' || v_status;
  insert into eventos_pagamento (tipo, evento, status_atual, chave_idempotencia, payload)
  values (v_tipo, p_payload ->> 'event', nullif(v_status, ''), v_chave, p_payload)
  on conflict (chave_idempotencia) do nothing
  returning id into v_id;
  if v_id is not null then
    return query select v_id, true;
  else
    return query select e.id, false from eventos_pagamento e where e.chave_idempotencia = v_chave;
  end if;
end $$;

-- Aplica o evento à matrícula do aluno (o servidor já criou ou localizou o usuário pelo e-mail).
create function public.aplicar_evento_pagamento(p_evento bigint, p_aluno uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_ev       eventos_pagamento;
  v_oferta   ofertas;
  v_status   text;
  v_assin    boolean;
  v_fim      timestamptz;
  v_result   text := 'ignorado';
begin
  select * into v_ev from eventos_pagamento where id = p_evento for update;
  if not found then
    raise exception 'evento_inexistente' using errcode = 'P0001';
  end if;
  if v_ev.processado_em is not null then
    return 'ja_processado';
  end if;

  v_status := v_ev.status_atual;
  v_assin  := upper(coalesce(v_ev.payload #>> '{product,type}', '')) = 'SUBSCRIPTION';

  select * into v_oferta from ofertas
  where greenn_product_id = (v_ev.payload #>> '{product,id}')::bigint and ativa;
  if not found then
    update eventos_pagamento set aluno_id = p_aluno, erro = 'oferta_desconhecida' where id = p_evento;
    return 'oferta_desconhecida';
  end if;

  if v_ev.tipo = 'sale' and v_status = 'paid' and not v_assin then
    insert into matriculas (aluno_id, curso_id, oferta_id, situacao, expira_em, origem,
                            inclui_conversacao, reservas_por_semana, greenn_sale_id)
    values (p_aluno, v_oferta.curso_id, v_oferta.id, 'ativa',
            case when v_oferta.dias_de_acesso is null then null else now() + make_interval(days => v_oferta.dias_de_acesso) end,
            'greenn', v_oferta.inclui_conversacao, v_oferta.reservas_por_semana, (v_ev.payload #>> '{sale,id}')::bigint)
    on conflict (aluno_id, curso_id) do update set
      situacao = 'ativa', oferta_id = excluded.oferta_id, expira_em = excluded.expira_em, origem = 'greenn',
      inclui_conversacao = excluded.inclui_conversacao, reservas_por_semana = excluded.reservas_por_semana,
      greenn_sale_id = excluded.greenn_sale_id;
    v_result := 'acesso_liberado';

  elsif v_ev.tipo = 'sale' and v_status in ('refunded', 'chargedback') then
    update matriculas set situacao = 'encerrada', expira_em = now()
    where aluno_id = p_aluno and curso_id = v_oferta.curso_id;
    v_result := 'acesso_encerrado';

  elsif v_ev.tipo = 'contract' and v_status in ('paid', 'trialing') then
    v_fim := nullif(v_ev.payload #>> '{contract,current_period_end}', '')::timestamptz;
    insert into matriculas (aluno_id, curso_id, oferta_id, situacao, expira_em, origem,
                            inclui_conversacao, reservas_por_semana, greenn_contract_id)
    values (p_aluno, v_oferta.curso_id, v_oferta.id, 'ativa', v_fim, 'greenn',
            v_oferta.inclui_conversacao, v_oferta.reservas_por_semana, (v_ev.payload #>> '{contract,id}')::bigint)
    on conflict (aluno_id, curso_id) do update set
      situacao = 'ativa', oferta_id = excluded.oferta_id, expira_em = excluded.expira_em, origem = 'greenn',
      inclui_conversacao = excluded.inclui_conversacao, reservas_por_semana = excluded.reservas_por_semana,
      greenn_contract_id = excluded.greenn_contract_id;
    v_result := 'acesso_liberado';

  elsif v_ev.tipo = 'contract' and v_status in ('unpaid', 'canceled') then
    -- O acesso vai até o fim do período já pago; sem essa data, encerra agora.
    v_fim := nullif(v_ev.payload #>> '{contract,current_period_end}', '')::timestamptz;
    update matriculas set expira_em = least(coalesce(v_fim, now()), coalesce(expira_em, 'infinity'))
    where aluno_id = p_aluno and curso_id = v_oferta.curso_id;
    v_result := 'acesso_ate_fim_do_periodo';
  end if;

  update eventos_pagamento set aluno_id = p_aluno, processado_em = now(), erro = null where id = p_evento;
  return v_result;
end $$;

-- ---------------------------------------------------------------------------
-- 11. Regras de acesso por linha
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- A equipe (professor e administrador) lê e edita todo o conteúdo e as turmas.
do $$
declare t text;
begin
  foreach t in array array[
    'cursos', 'modulos', 'aulas', 'legendas', 'frases_pronuncia', 'materiais', 'quizzes',
    'perguntas', 'tarefas', 'dias_trilha', 'itens_dia', 'temas_conversacao', 'turmas'
  ] loop
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('create policy equipe_tudo on public.%I for all to authenticated using (eh_equipe()) with check (eh_equipe())', t);
  end loop;
end $$;

-- Aluno: só conteúdo publicado de curso com matrícula ativa.
create policy aluno_le on public.cursos           for select to authenticated using (aluno_ve_curso(id));
create policy aluno_le on public.modulos          for select to authenticated using (arquivado_em is null and aluno_ve_curso(curso_id));
create policy aluno_le on public.aulas            for select to authenticated using (aluno_ve_aula(id));
create policy aluno_le on public.legendas         for select to authenticated using (aluno_ve_aula(aula_id));
create policy aluno_le on public.frases_pronuncia for select to authenticated using (aluno_ve_aula(aula_id));
create policy aluno_le on public.materiais        for select to authenticated using (
  (aula_id is not null and aluno_ve_aula(aula_id)) or (aula_id is null and curso_id is not null and aluno_ve_curso(curso_id)));
create policy aluno_le on public.quizzes          for select to authenticated using (situacao = 'publicado' and aluno_ve_aula(aula_id));
create policy aluno_le on public.tarefas          for select to authenticated using (arquivado_em is null and aluno_ve_curso(curso_id));
create policy aluno_le on public.dias_trilha      for select to authenticated using (aluno_ve_curso(curso_id));
create policy aluno_le on public.itens_dia        for select to authenticated using (
  exists (select 1 from public.dias_trilha d where d.id = dia_id and aluno_ve_curso(d.curso_id)));
-- perguntas: sem regra para aluno (guardam o gabarito); o servidor entrega e corrige.

create policy aluno_le on public.temas_conversacao for select to authenticated using (arquivado_em is null and pode_conversacao());
create policy aluno_le on public.turmas            for select to authenticated using (pode_conversacao());

-- Perfil: cada um lê o seu; a equipe lê todos. O aluno só altera campos pessoais (nunca o papel).
create policy proprio_ou_equipe on public.perfis for select to authenticated using (id = auth.uid() or eh_equipe());
create policy proprio_altera    on public.perfis for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
grant update (nome, fuso, idioma, whatsapp, whatsapp_autorizado, aceite_termos_em) on public.perfis to authenticated;

-- Dados do próprio aluno: ele lê os seus, a equipe lê todos.
create policy proprio_ou_equipe on public.matriculas         for select to authenticated using (aluno_id = auth.uid() or eh_admin());
create policy proprio_ou_equipe on public.progresso_aulas    for select to authenticated using (aluno_id = auth.uid() or eh_equipe());
create policy proprio_ou_equipe on public.tentativas_quiz    for select to authenticated using (aluno_id = auth.uid() or eh_equipe());
create policy proprio_ou_equipe on public.itens_concluidos   for select to authenticated using (aluno_id = auth.uid() or eh_equipe());
create policy proprio_ou_equipe on public.reservas           for select to authenticated using (aluno_id = auth.uid() or eh_equipe());
create policy proprio_ou_equipe on public.conversas_papo     for select to authenticated using (aluno_id = auth.uid() or eh_equipe());
create policy proprio_ou_equipe on public.praticas_pronuncia for select to authenticated using (aluno_id = auth.uid() or eh_equipe());
create policy proprio_ou_equipe on public.uso_diario         for select to authenticated using (aluno_id = auth.uid() or eh_equipe());
create policy proprio_ou_equipe on public.mensagens_papo     for select to authenticated using (
  exists (select 1 from public.conversas_papo c where c.id = conversa_id and (c.aluno_id = auth.uid() or eh_equipe())));
create policy proprio_ou_equipe on public.avaliacoes         for select to authenticated using (
  eh_equipe() or exists (select 1 from public.reservas r where r.id = reserva_id and r.aluno_id = auth.uid()));

-- O aluno grava o próprio progresso, só em aula que ele pode ver.
grant insert, update on public.progresso_aulas to authenticated;
create policy aluno_grava  on public.progresso_aulas for insert to authenticated with check (aluno_id = auth.uid() and aluno_ve_aula(aula_id));
create policy aluno_altera on public.progresso_aulas for update to authenticated using (aluno_id = auth.uid()) with check (aluno_id = auth.uid() and aluno_ve_aula(aula_id));

grant insert, delete on public.itens_concluidos to authenticated;
create policy aluno_marca    on public.itens_concluidos for insert to authenticated with check (
  aluno_id = auth.uid() and exists (
    select 1 from public.itens_dia i join public.dias_trilha d on d.id = i.dia_id
    where i.id = item_dia_id and aluno_ve_curso(d.curso_id)));
create policy aluno_desmarca on public.itens_concluidos for delete to authenticated using (aluno_id = auth.uid());

-- A equipe marca presença nas reservas.
grant update (presente) on public.reservas to authenticated;
create policy equipe_presenca on public.reservas for update to authenticated using (eh_equipe()) with check (eh_equipe());

-- Só administrador: ofertas, pagamentos, configurações, registro. A equipe lê configurações e notificações.
grant insert, update, delete on public.ofertas, public.configuracoes to authenticated;
create policy admin_tudo   on public.ofertas             for all    to authenticated using (eh_admin()) with check (eh_admin());
create policy admin_le     on public.eventos_pagamento   for select to authenticated using (eh_admin());
create policy admin_le     on public.registro_alteracoes for select to authenticated using (eh_admin());
create policy equipe_le    on public.configuracoes       for select to authenticated using (eh_equipe());
create policy admin_altera on public.configuracoes       for all    to authenticated using (eh_admin()) with check (eh_admin());
create policy equipe_le    on public.notificacoes        for select to authenticated using (eh_equipe());

-- Funções: o que o aluno pode chamar e o que é só do servidor.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.eh_equipe(), public.eh_admin(), public.aluno_ve_curso(uuid), public.aluno_ve_aula(uuid),
  public.pode_conversacao(), public.config_int(text, integer), public.agenda_turmas(text),
  public.reservar_turma(uuid), public.cancelar_reserva(uuid), public.avaliar_aula(uuid, integer, text)
  to authenticated;
grant execute on all functions in schema public to service_role;

commit;
