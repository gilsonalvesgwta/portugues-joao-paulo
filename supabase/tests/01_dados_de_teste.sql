-- Dados fictícios para os testes. Rodado como superusuário.

create schema teste;
grant usage on schema teste to authenticated, service_role;

create function teste.uid(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function teste.tid(n integer) returns uuid language sql immutable as $$
  select ('11111111-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;

-- Passa a agir como o usuário n (papel authenticated + token com o id dele).
create function teste.entrar(n integer) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', teste.uid(n))::text, false);
end $$;

create function teste.confere(p_ok boolean, p_nome text) returns void language plpgsql as $$
begin
  if p_ok is not true then
    raise exception 'FALHOU: %', p_nome;
  end if;
  raise notice 'ok - %', p_nome;
end $$;

-- Executa um comando que DEVE falhar com a mensagem esperada.
create function teste.espera_erro(p_sql text, p_trecho text, p_nome text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_trecho in sqlerrm) > 0 then
      raise notice 'ok - %', p_nome;
      return;
    end if;
    raise exception 'FALHOU: % (erro inesperado: %)', p_nome, sqlerrm;
  end;
  raise exception 'FALHOU: % (o comando deveria ter sido recusado)', p_nome;
end $$;

grant execute on all functions in schema teste to authenticated, service_role;

-- Pessoas: 900 admin, 901 professor, 1..12 alunos, 21..31 disputa de vagas, 40 disputa do limite semanal.
insert into auth.users (id, email)
select teste.uid(n), 'pessoa' || n || '@exemplo.test'
from unnest(array[900, 901] || array(select generate_series(1, 12)) || array(select generate_series(21, 31)) || array[40]) as n;

update public.perfis set papel = 'admin'     where id = teste.uid(900);
update public.perfis set papel = 'professor' where id = teste.uid(901);

-- Cursos: 1 principal publicado, 2 complementar publicado, 3 rascunho.
insert into public.cursos (id, titulo_pt, titulo_es, tipo, situacao) values
  (teste.tid(1), 'Português do Brasil', 'Portugués de Brasil', 'principal',    'publicado'),
  (teste.tid(2), 'Curso extra',         'Curso extra',         'complementar', 'publicado'),
  (teste.tid(3), 'Curso em rascunho',   'Curso en borrador',   'principal',    'rascunho');

insert into public.modulos (id, curso_id, ordem, titulo_pt, titulo_es) values
  (teste.tid(10), teste.tid(1), 1, 'Módulo 1', 'Módulo 1'),
  (teste.tid(11), teste.tid(3), 1, 'Módulo do rascunho', 'Módulo del borrador');

insert into public.aulas (id, modulo_id, numero, titulo_pt, titulo_es, situacao) values
  (teste.tid(20), teste.tid(10), 1, 'Aula 1', 'Clase 1', 'publicado'),
  (teste.tid(21), teste.tid(10), 2, 'Aula 2 (rascunho)', 'Clase 2 (borrador)', 'rascunho'),
  (teste.tid(22), teste.tid(11), 1, 'Aula de curso em rascunho', 'Clase de curso en borrador', 'publicado');

insert into public.quizzes (id, aula_id, situacao) values (teste.tid(30), teste.tid(20), 'publicado');
insert into public.perguntas (quiz_id, tipo, conteudo) values
  (teste.tid(30), 'multipla_escolha', '{"pergunta": "exemplo", "opcoes": ["a", "b"], "correta": 0}');

insert into public.tarefas (id, curso_id, aula_id, titulo_es, instrucao_es) values
  (teste.tid(40), teste.tid(1), teste.tid(20), 'Tarea de ejemplo', 'Instrucción de ejemplo');

insert into public.dias_trilha (id, curso_id, numero) values (teste.tid(50), teste.tid(1), 1);
insert into public.itens_dia (id, dia_id, tipo, aula_id, quiz_id, tarefa_id, ordem) values
  (teste.tid(51), teste.tid(50), 'aula',   teste.tid(20), null, null, 1),
  (teste.tid(52), teste.tid(50), 'quiz',   null, teste.tid(30), null, 2),
  (teste.tid(53), teste.tid(50), 'tarefa', null, null, teste.tid(40), 3);

-- Ofertas da Greenn: 5001 pagamento único com 365 dias; 5002 assinatura.
insert into public.ofertas (id, greenn_product_id, curso_id, nome, dias_de_acesso) values
  (teste.tid(60), 5001, teste.tid(1), 'Acesso anual', 365),
  (teste.tid(61), 5002, teste.tid(1), 'Assinatura mensal', null);

-- Matrículas: alunos 1..11, 21..31 e 40 ativos; aluno 11 com acesso vencido; aluno 12 sem matrícula.
insert into public.matriculas (aluno_id, curso_id, origem)
select teste.uid(n), teste.tid(1), 'manual'
from unnest(array(select generate_series(1, 11)) || array(select generate_series(21, 31)) || array[40]) as n;
update public.matriculas set expira_em = now() - interval '1 day' where aluno_id = teste.uid(11);

-- Conversação.
insert into public.temas_conversacao (id, titulo_es, nivel) values (teste.tid(70), 'Tema de ejemplo', 'basico');

insert into public.turmas (id, tema_id, inicio, vagas) values
  (teste.tid(101), teste.tid(70), now() + interval '2 days', 10),                                              -- uso geral
  (teste.tid(102), teste.tid(70), date_trunc('week', now()) + interval '7 days'  + interval '1 day 18 hours', 10), -- terça da semana que vem
  (teste.tid(103), teste.tid(70), date_trunc('week', now()) + interval '7 days'  + interval '2 days 18 hours', 10), -- quarta
  (teste.tid(104), teste.tid(70), date_trunc('week', now()) + interval '7 days'  + interval '3 days 18 hours', 10), -- quinta
  (teste.tid(105), teste.tid(70), date_trunc('week', now()) + interval '14 days' + interval '1 day 18 hours', 10),  -- semana seguinte
  (teste.tid(106), teste.tid(70), now() + interval '10 minutes', 10),                                          -- reserva já encerrada
  (teste.tid(107), teste.tid(70), now() + interval '60 minutes', 10),                                          -- cancelamento fora do prazo
  (teste.tid(108), teste.tid(70), now() + interval '3 days', 10),                                              -- 11 alunos, 10 vagas
  (teste.tid(109), teste.tid(70), date_trunc('week', now()) + interval '7 days'  + interval '1 day 20 hours', 10),
  (teste.tid(110), teste.tid(70), date_trunc('week', now()) + interval '7 days'  + interval '2 days 20 hours', 10),
  (teste.tid(111), teste.tid(70), date_trunc('week', now()) + interval '7 days'  + interval '3 days 20 hours', 10),
  (teste.tid(112), teste.tid(70), now() + interval '9 days', 10);                                              -- fora da janela de 7 dias
