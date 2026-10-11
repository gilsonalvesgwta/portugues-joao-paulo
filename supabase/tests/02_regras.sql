-- Testes das regras de acesso, da reserva e do pagamento.
-- Cada bloco troca de usuário com teste.entrar(n) e age com o papel "authenticated",
-- exatamente como o aplicativo fará. Qualquer falha interrompe o arquivo.
\set ON_ERROR_STOP on
set client_min_messages = notice;

-- ============ 1. Aluno matriculado (1) ============
set role authenticated;
select teste.entrar(1);
do $$
begin
  perform teste.confere((select count(*) from cursos) = 2, 'aluno matriculado vê o curso principal e o complementar, não o rascunho');
  perform teste.confere((select count(*) from aulas) = 1, 'aluno vê só a aula publicada do seu curso');
  perform teste.confere((select count(*) from perguntas) = 0, 'aluno não lê as perguntas (gabarito protegido)');
  perform teste.confere((select count(*) from quizzes) = 1, 'aluno vê o quiz publicado');
  perform teste.confere((select count(*) from itens_dia) = 3, 'aluno vê os 3 itens do dia 1');
  perform teste.confere((select count(*) from perfis) = 1, 'aluno lê só o próprio perfil');
  perform teste.confere((select count(*) from matriculas) = 1, 'aluno lê só a própria matrícula');
  perform teste.confere((select count(*) from eventos_pagamento) = 0, 'aluno não lê pagamentos');
  perform teste.confere((select count(*) from ofertas) = 0, 'aluno não lê ofertas');
  perform teste.espera_erro($q$insert into aulas (modulo_id, numero, titulo_pt, titulo_es) values (teste.tid(10), 9, 'x', 'x')$q$,
    'row-level security', 'aluno não cria aula');
  perform teste.espera_erro($q$update perfis set papel = 'admin' where id = teste.uid(1)$q$,
    'permission denied', 'aluno não muda o próprio papel');
  perform teste.espera_erro($q$select salvar_quiz(teste.tid(20), 'facil', 70, 'publicado', '[]'::jsonb)$q$,
    'sem_permissao', 'aluno não grava quiz');
  perform teste.confere((select count(*) from resumo_dos_quizzes()) = 0, 'aluno não recebe o resumo dos quizzes');
  perform teste.espera_erro($q$select salvar_trilha(teste.tid(1), '[]'::jsonb)$q$, 'sem_permissao', 'aluno não grava a trilha');
  perform teste.confere(jsonb_array_length(ler_trilha(teste.tid(1))) = 1 and jsonb_array_length(ler_trilha(teste.tid(1)) -> 0 -> 'itens') = 3,
    'aluno lê a trilha do seu curso: 1 dia com 3 itens');
  perform teste.confere(ler_trilha(teste.tid(3)) = '[]'::jsonb, 'aluno não lê a trilha de curso em rascunho');
  update perfis set nome = 'Aluno Um', fuso = 'America/Bogota' where id = teste.uid(1);
  perform teste.confere((select nome from perfis where id = teste.uid(1)) = 'Aluno Um', 'aluno altera nome e fuso');
  perform teste.espera_erro($q$update perfis set fuso = 'Lugar/Inexistente' where id = teste.uid(1)$q$,
    'fuso_invalido', 'fuso inválido é recusado');

  insert into progresso_aulas (aluno_id, aula_id, posicao_seg) values (teste.uid(1), teste.tid(20), 42);
  perform teste.confere((select posicao_seg from progresso_aulas where aula_id = teste.tid(20)) = 42, 'aluno grava o próprio progresso');
  perform teste.espera_erro($q$insert into progresso_aulas (aluno_id, aula_id) values (teste.uid(1), teste.tid(21))$q$,
    'row-level security', 'aluno não grava progresso em aula em rascunho');
  perform teste.espera_erro($q$insert into progresso_aulas (aluno_id, aula_id) values (teste.uid(2), teste.tid(20))$q$,
    'row-level security', 'aluno não grava progresso em nome de outro');
  insert into itens_concluidos (aluno_id, item_dia_id) values (teste.uid(1), teste.tid(53));
  perform teste.confere((select count(*) from itens_concluidos) = 1, 'aluno marca a tarefa do dia');
  perform teste.espera_erro($q$select registrar_evento_pagamento('{"type":"sale"}'::jsonb)$q$,
    'permission denied', 'aluno não chama as funções de pagamento');
end $$;

-- ============ 2. Sem matrícula (12) e com acesso vencido (11) ============
select teste.entrar(12);
do $$
begin
  perform teste.confere((select count(*) from cursos) = 0 and (select count(*) from aulas) = 0, 'sem matrícula não vê conteúdo');
  perform teste.confere((select count(*) from turmas) = 0, 'sem matrícula não vê turmas');
  perform teste.confere((select count(*) from agenda_turmas()) = 0, 'sem matrícula a agenda vem vazia');
  perform teste.espera_erro($q$select reservar_turma(teste.tid(101))$q$, 'sem_direito_a_conversacao', 'sem matrícula não reserva');
end $$;
select teste.entrar(11);
do $$
begin
  perform teste.confere((select count(*) from cursos) = 0 and (select count(*) from aulas) = 0, 'acesso vencido não vê conteúdo');
  perform teste.espera_erro($q$select reservar_turma(teste.tid(101))$q$, 'sem_direito_a_conversacao', 'acesso vencido não reserva');
end $$;

-- ============ 3. Professor (901) e administrador (900) ============
select teste.entrar(901);
do $$
begin
  perform teste.confere((select count(*) from aulas) = 3, 'professor vê todas as aulas, inclusive rascunhos');
  perform teste.confere((select count(*) from perguntas) = 1, 'professor lê as perguntas');
  perform salvar_quiz(teste.tid(21), 'medio', 80, 'rascunho',
    '[{"tipo": "ordenar", "palavras": ["a", "b"], "traducao": "c"}, {"tipo": "completar", "frase": "x ___", "opcoes": ["a", "b"], "correta": 0}]'::jsonb);
  perform teste.confere((select count(*) from perguntas p join quizzes q on q.id = p.quiz_id where q.aula_id = teste.tid(21)) = 2,
    'professor grava o quiz com as perguntas');
  perform teste.confere((select p.conteudo from perguntas p join quizzes q on q.id = p.quiz_id where q.aula_id = teste.tid(21) and p.ordem = 1)
    = '{"palavras": ["a", "b"], "traducao": "c"}'::jsonb, 'a pergunta guarda o conteúdo sem repetir o tipo');
  perform salvar_quiz(teste.tid(21), 'facil', 70, 'publicado', '[{"tipo": "ordenar", "palavras": ["d", "e"], "traducao": "f"}]'::jsonb);
  perform teste.confere((select count(*) from quizzes where aula_id = teste.tid(21)) = 1
    and (select count(*) from perguntas p join quizzes q on q.id = p.quiz_id where q.aula_id = teste.tid(21)) = 1,
    'gravar de novo troca as perguntas sem duplicar o quiz');
  perform teste.espera_erro($q$select salvar_quiz(teste.tid(21), 'facil', 70, 'publicado', '[{"tipo": "ordenar", "palavras": ["g"]}, {"tipo": "inventado"}]'::jsonb)$q$,
    'perguntas_tipo_check', 'pergunta de tipo desconhecido é recusada');
  perform teste.confere((select p.conteudo ->> 'traducao' from perguntas p join quizzes q on q.id = p.quiz_id where q.aula_id = teste.tid(21)) = 'f',
    'quando a gravação falha, o quiz anterior continua inteiro');
  perform teste.espera_erro($q$select salvar_quiz(gen_random_uuid(), 'facil', 70, 'rascunho', '[]'::jsonb)$q$,
    'aula_inexistente', 'quiz de aula que não existe é recusado');
  perform teste.confere((select perguntas from resumo_dos_quizzes() where aula_id = teste.tid(21)) = 1
    and (select count(*) from resumo_dos_quizzes()) = 2, 'o resumo conta as perguntas de cada quiz');

  -- Trilha: o dia 1 tinha aula (51), quiz (52) e tarefa (53); o aluno 1 já marcou a tarefa.
  perform salvar_trilha(teste.tid(1), jsonb_build_array(
    jsonb_build_object('itens', jsonb_build_array(
      jsonb_build_object('id', teste.tid(51), 'tipo', 'aula', 'alvo', teste.tid(20), 'obrigatorio', true))),
    jsonb_build_object('itens', jsonb_build_array(
      jsonb_build_object('id', teste.tid(53), 'tipo', 'tarefa', 'alvo', teste.tid(40), 'obrigatorio', false),
      jsonb_build_object('id', teste.tid(52), 'tipo', 'quiz', 'alvo', teste.tid(30), 'obrigatorio', true),
      jsonb_build_object('id', null, 'tipo', 'aula', 'alvo', teste.tid(21), 'obrigatorio', true)))));
  perform teste.confere((select count(*) from dias_trilha where curso_id = teste.tid(1)) = 2, 'a trilha passa a ter 2 dias');
  perform teste.confere((select d.numero from itens_dia i join dias_trilha d on d.id = i.dia_id where i.id = teste.tid(53)) = 2
    and (select ordem from itens_dia where id = teste.tid(53)) = 1 and not (select obrigatorio from itens_dia where id = teste.tid(53)),
    'o item que já existia é movido para o dia e a posição novos');
  perform teste.confere((select count(*) from itens_concluidos where item_dia_id = teste.tid(53)) = 1,
    'reorganizar a trilha não apaga o que o aluno já marcou');
  perform teste.confere((select count(*) from itens_dia i join dias_trilha d on d.id = i.dia_id where d.curso_id = teste.tid(1)) = 4,
    'o item novo entra na trilha');
  perform teste.confere(jsonb_path_query_array(ler_trilha(teste.tid(1)), '$[*].itens[*].tipo') = '["aula", "tarefa", "quiz", "aula"]'::jsonb,
    'a leitura devolve os dias e os itens na ordem');

  perform teste.espera_erro(format($q$select salvar_trilha(teste.tid(1), jsonb_build_array(jsonb_build_object('itens', jsonb_build_array(
    jsonb_build_object('id', null, 'tipo', 'aula', 'alvo', %L::uuid, 'obrigatorio', true)))))$q$, teste.tid(22)),
    'item_de_outro_curso', 'aula de outro curso não entra na trilha');
  perform teste.espera_erro(format($q$select salvar_trilha(teste.tid(1), jsonb_build_array(jsonb_build_object('itens', jsonb_build_array(
    jsonb_build_object('id', null, 'tipo', 'aula', 'alvo', %1$L::uuid, 'obrigatorio', true),
    jsonb_build_object('id', null, 'tipo', 'aula', 'alvo', %1$L::uuid, 'obrigatorio', true)))))$q$, teste.tid(20)),
    'itens_dia_aula_unica', 'a mesma aula não entra duas vezes');
  perform teste.espera_erro(format($q$select salvar_trilha(teste.tid(1), jsonb_build_array(jsonb_build_object('itens', jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid(), 'tipo', 'aula', 'alvo', %L::uuid, 'obrigatorio', true)))))$q$, teste.tid(20)),
    'item_inexistente', 'item com identificador inventado é recusado');
  perform teste.confere((select count(*) from itens_dia i join dias_trilha d on d.id = i.dia_id where d.curso_id = teste.tid(1)) = 4
    and (select count(*) from itens_concluidos where item_dia_id = teste.tid(53)) = 1,
    'quando a gravação falha, a trilha anterior continua inteira');

  perform salvar_trilha(teste.tid(1), jsonb_build_array(
    jsonb_build_object('itens', jsonb_build_array(
      jsonb_build_object('id', teste.tid(51), 'tipo', 'aula', 'alvo', teste.tid(20), 'obrigatorio', true),
      jsonb_build_object('id', teste.tid(52), 'tipo', 'quiz', 'alvo', teste.tid(30), 'obrigatorio', true)))));
  perform teste.confere((select count(*) from dias_trilha where curso_id = teste.tid(1)) = 1
    and (select count(*) from itens_dia i join dias_trilha d on d.id = i.dia_id where d.curso_id = teste.tid(1)) = 2,
    'o que saiu da trilha é apagado, e o dia que sobrou também');
  perform teste.confere((select count(*) from itens_concluidos where item_dia_id = teste.tid(53)) = 0,
    'a marcação de um item que saiu da trilha vai embora com ele');
  insert into aulas (modulo_id, numero, titulo_pt, titulo_es) values (teste.tid(10), 3, 'Aula 3', 'Clase 3');
  perform teste.confere((select count(*) from aulas) = 4, 'professor cria aula');
  perform teste.confere((select count(*) from eventos_pagamento) = 0 and (select count(*) from ofertas) = 0, 'professor não vê pagamentos nem ofertas');
  -- sem regra que permita, o update do professor não alcança nenhuma linha
  update configuracoes set valor = '99' where chave = 'agenda_janela_dias';
  perform teste.confere(not found, 'professor não altera configurações');
end $$;
select teste.entrar(900);
do $$
begin
  perform teste.confere((select count(*) from ofertas) = 2, 'administrador vê as ofertas');
  update configuracoes set valor = '7' where chave = 'agenda_janela_dias';
  perform teste.confere(found, 'administrador altera configurações');
end $$;

-- ============ 4. Reserva, repetição e cancelamento (aluno 1) ============
select teste.entrar(1);
do $$
declare v_res reservas;
begin
  perform teste.confere((select vagas_restantes from agenda_turmas() where turma_id = teste.tid(101)) = 10, 'agenda mostra 10 vagas');
  v_res := reservar_turma(teste.tid(101));
  perform teste.confere(v_res.situacao = 'confirmada', 'aluno reserva uma vaga');
  perform teste.confere((select vagas_restantes from agenda_turmas() where turma_id = teste.tid(101)) = 9, 'agenda passa a mostrar 9 vagas');
  perform teste.confere((select ja_reservada from agenda_turmas() where turma_id = teste.tid(101)), 'agenda marca a turma como já reservada');
  perform teste.espera_erro($q$select reservar_turma(teste.tid(101))$q$, 'ja_reservada', 'não reserva duas vezes a mesma turma');
  v_res := cancelar_reserva(v_res.id);
  perform teste.confere(v_res.situacao = 'cancelada', 'aluno cancela dentro do prazo');
  perform teste.confere((select vagas_restantes from agenda_turmas() where turma_id = teste.tid(101)) = 10, 'a vaga volta para a turma');
  v_res := reservar_turma(teste.tid(101));
  perform teste.confere(v_res.situacao = 'confirmada', 'aluno reserva de novo depois de cancelar');
  perform teste.espera_erro($q$insert into reservas (turma_id, aluno_id) values (teste.tid(108), teste.uid(1))$q$,
    'permission denied', 'aluno não grava reserva direto na tabela');
end $$;

-- ============ 5. Janela da agenda e prazos (alunos 3 e 4) ============
select teste.entrar(4);
do $$
begin
  perform teste.espera_erro($q$select reservar_turma(teste.tid(112))$q$, 'fora_da_janela', 'turma a 9 dias fica fora da janela de 7');
  perform teste.confere(not exists (select 1 from agenda_turmas() where turma_id = teste.tid(112)), 'agenda não mostra turma fora da janela');
end $$;
select teste.entrar(3);
do $$
declare v_res reservas;
begin
  perform teste.espera_erro($q$select reservar_turma(teste.tid(106))$q$, 'reserva_encerrada', 'não reserva a 10 minutos do início');
  v_res := reservar_turma(teste.tid(107));
  perform teste.espera_erro(format($q$select cancelar_reserva(%L)$q$, v_res.id), 'cancelamento_fora_do_prazo', 'não cancela a 60 minutos do início');
end $$;

-- ============ 6. Limite semanal (aluno 2) ============
reset role;
update public.configuracoes set valor = '21' where chave = 'agenda_janela_dias';  -- só para alcançar a semana que vem
set role authenticated;
select teste.entrar(2);
do $$
declare v_a reservas; v_b reservas;
begin
  v_a := reservar_turma(teste.tid(102));
  v_b := reservar_turma(teste.tid(103));
  perform teste.espera_erro($q$select reservar_turma(teste.tid(104))$q$, 'limite_semanal', 'terceira reserva na mesma semana é recusada');
  perform teste.confere((reservar_turma(teste.tid(105))).situacao = 'confirmada', 'reserva em outra semana é aceita');
  perform cancelar_reserva(v_a.id);
  perform teste.confere((reservar_turma(teste.tid(104))).situacao = 'confirmada', 'cancelar devolve o crédito da semana');
end $$;

-- ============ 7. Avaliação da aula ============
select teste.entrar(1);
do $$
declare v_id uuid := (select id from reservas where turma_id = teste.tid(101) and aluno_id = teste.uid(1));
begin
  perform teste.espera_erro(format($q$select avaliar_aula(%L, 5)$q$, v_id), 'aula_ainda_nao_terminou', 'não avalia antes do fim da aula');
end $$;
reset role;
update public.turmas set inicio = now() - interval '2 hours' where id = teste.tid(101);
set role authenticated;
select teste.entrar(1);
do $$
declare v_id uuid := (select id from reservas where turma_id = teste.tid(101) and aluno_id = teste.uid(1));
begin
  perform teste.confere((avaliar_aula(v_id, 5, 'Muy buena')).nota = 5, 'aluno avalia depois da aula');
  perform teste.espera_erro(format($q$select avaliar_aula(%L, 9)$q$, v_id), 'check', 'nota fora de 1 a 5 é recusada');
end $$;

-- ============ 8. Pagamento (servidor, papel service_role) ============
reset role;
set role service_role;
do $$
declare
  v_venda jsonb := '{"type":"sale","event":"saleUpdated","oldStatus":"waiting_payment","currentStatus":"paid",
                     "product":{"id":5001,"type":"TRANSACTION"},"sale":{"id":777,"status":"paid"},
                     "client":{"id":1,"email":"pessoa12@exemplo.test","name":"Pessoa Doze"}}';
  v_id bigint; v_novo boolean;
begin
  select evento_id, novo into v_id, v_novo from registrar_evento_pagamento(v_venda);
  perform teste.confere(v_novo, 'evento de venda é gravado');
  perform teste.confere(not (select novo from registrar_evento_pagamento(v_venda)), 'o mesmo evento repetido não é gravado de novo');
  perform teste.confere(aplicar_evento_pagamento(v_id, teste.uid(12)) = 'acesso_liberado', 'venda paga libera o acesso');
  perform teste.confere(aplicar_evento_pagamento(v_id, teste.uid(12)) = 'ja_processado', 'evento já processado não é aplicado duas vezes');
  perform teste.confere((select situacao = 'ativa' and expira_em between now() + interval '364 days' and now() + interval '366 days'
                         from matriculas where aluno_id = teste.uid(12)), 'matrícula ativa por 365 dias');

  select evento_id into v_id from registrar_evento_pagamento(jsonb_set(v_venda, '{currentStatus}', '"refunded"'));
  perform teste.confere(aplicar_evento_pagamento(v_id, teste.uid(12)) = 'acesso_encerrado', 'reembolso encerra o acesso');
  perform teste.confere((select situacao from matriculas where aluno_id = teste.uid(12)) = 'encerrada', 'matrícula fica encerrada');

  select evento_id into v_id from registrar_evento_pagamento(jsonb_set(jsonb_set(v_venda, '{product,id}', '9999'), '{sale,id}', '778'));
  perform teste.confere(aplicar_evento_pagamento(v_id, teste.uid(12)) = 'oferta_desconhecida', 'produto sem oferta cadastrada fica marcado com erro');
  perform teste.confere((select erro from eventos_pagamento where id = v_id) = 'oferta_desconhecida' and
                        (select processado_em is null from eventos_pagamento where id = v_id), 'o evento com erro fica pendente para reprocessar');
end $$;
do $$
declare
  v_contrato jsonb := jsonb_build_object('type', 'contract', 'event', 'contractUpdated', 'currentStatus', 'paid',
    'product', jsonb_build_object('id', 5002, 'type', 'SUBSCRIPTION'),
    'contract', jsonb_build_object('id', 888, 'current_period_end', (now() + interval '30 days')::text));
  v_id bigint;
begin
  select evento_id into v_id from registrar_evento_pagamento(v_contrato);
  perform teste.confere(aplicar_evento_pagamento(v_id, teste.uid(12)) = 'acesso_liberado', 'assinatura paga libera o acesso');
  perform teste.confere((select situacao = 'ativa' and expira_em > now() + interval '29 days' from matriculas where aluno_id = teste.uid(12)),
    'assinatura vale até o fim do período pago');
  select evento_id into v_id from registrar_evento_pagamento(jsonb_set(v_contrato, '{currentStatus}', '"canceled"'));
  perform teste.confere(aplicar_evento_pagamento(v_id, teste.uid(12)) = 'acesso_ate_fim_do_periodo', 'cancelar a assinatura mantém o acesso até o fim do período');
  perform teste.confere((select situacao = 'ativa' and expira_em > now() + interval '29 days' from matriculas where aluno_id = teste.uid(12)),
    'o acesso continua até a data já paga');
end $$;
reset role;

-- ============ 9. Alunos e matrícula pela administração ============
set role authenticated;
select teste.entrar(1);
do $$
begin
  perform teste.espera_erro($q$insert into matriculas (aluno_id, curso_id, origem) values (teste.uid(1), teste.tid(3), 'manual')$q$,
    'row-level security', 'aluno não se matricula sozinho');
  update matriculas set expira_em = null, inclui_conversacao = false where aluno_id = teste.uid(1);
  perform teste.confere((select inclui_conversacao from matriculas where aluno_id = teste.uid(1)), 'aluno não altera a própria matrícula');
  perform teste.espera_erro($q$select lista_de_pessoas('', 'alunos', 50, 0)$q$, 'sem_permissao', 'aluno não lista as pessoas');
  perform teste.espera_erro($q$select definir_papel(teste.uid(1), 'admin')$q$, 'sem_permissao', 'aluno não muda papel pela função');
  perform teste.confere((select count(*) from registro_alteracoes) = 0, 'aluno não lê o histórico');
end $$;
select teste.entrar(901);
do $$
begin
  perform teste.espera_erro($q$insert into matriculas (aluno_id, curso_id, origem) values (teste.uid(12), teste.tid(3), 'manual')$q$,
    'row-level security', 'professor não matricula');
  perform teste.espera_erro($q$select lista_de_pessoas('', 'alunos', 50, 0)$q$, 'sem_permissao', 'professor não lista as pessoas');
  perform teste.espera_erro($q$select definir_papel(teste.uid(12), 'professor')$q$, 'sem_permissao', 'professor não muda papel');
  update perfis set nome = 'Trocado' where id = teste.uid(12);
  perform teste.confere((select nome from perfis where id = teste.uid(12)) <> 'Trocado', 'professor não altera o cadastro de outra pessoa');
end $$;
select teste.entrar(900);
do $$
declare
  v_id uuid;
  v_lista jsonb;
begin
  insert into matriculas (aluno_id, curso_id, origem, expira_em, inclui_conversacao, reservas_por_semana)
  values (teste.uid(12), teste.tid(3), 'manual', now() + interval '30 days', false, 0)
  returning id into v_id;
  perform teste.confere(v_id is not null, 'administrador matricula um aluno');
  perform teste.confere((select pessoa_id = teste.uid(900) and antes is null and depois ->> 'origem' = 'manual'
                         from registro_alteracoes where tabela = 'matriculas' and registro = v_id::text),
    'a matrícula nova entra no histórico com quem fez');

  update matriculas set situacao = 'suspensa' where id = v_id;
  perform teste.confere((select count(*) from registro_alteracoes where registro = v_id::text) = 2 and
                        (select antes ->> 'situacao' = 'ativa' and depois ->> 'situacao' = 'suspensa'
                         from registro_alteracoes where registro = v_id::text order by id desc limit 1),
    'suspender entra no histórico com o antes e o depois');
  update matriculas set situacao = 'suspensa' where id = v_id;
  perform teste.confere((select count(*) from registro_alteracoes where registro = v_id::text) = 2, 'gravar o mesmo conteúdo não entra no histórico');
  perform teste.espera_erro(format($q$delete from matriculas where id = %L$q$, v_id), 'permission denied', 'nem o administrador apaga matrícula');
  perform teste.espera_erro($q$insert into matriculas (aluno_id, curso_id, origem) values (teste.uid(12), teste.tid(3), 'manual')$q$,
    'duplicate key', 'não existem duas matrículas da mesma pessoa no mesmo curso');

  update perfis set nome = 'Pessoa Doze' where id = teste.uid(12);
  perform teste.confere((select nome from perfis where id = teste.uid(12)) = 'Pessoa Doze', 'administrador corrige o nome de outra pessoa');
  perform teste.espera_erro($q$update perfis set papel = 'professor' where id = teste.uid(12)$q$,
    'permission denied', 'nem o administrador muda papel direto na tabela');
  perform teste.espera_erro($q$update perfis set email = 'outro@exemplo.test' where id = teste.uid(12)$q$,
    'permission denied', 'nem o administrador muda e-mail direto na tabela');

  perform teste.espera_erro($q$select definir_papel(teste.uid(900), 'aluno')$q$, 'proprio_papel', 'administrador não muda o próprio papel');
  perform teste.espera_erro($q$select definir_papel(teste.uid(12), 'dono')$q$, 'papel_invalido', 'papel desconhecido é recusado');
  perform teste.espera_erro($q$select definir_papel(teste.uid(999), 'professor')$q$, 'pessoa_inexistente', 'pessoa inexistente é recusada');
  perform definir_papel(teste.uid(10), 'professor');
  perform teste.confere((select papel from perfis where id = teste.uid(10)) = 'professor', 'administrador torna uma pessoa professora');
  perform teste.confere((select pessoa_id = teste.uid(900) and antes ->> 'papel' = 'aluno' and depois ->> 'papel' = 'professor'
                         from registro_alteracoes where tabela = 'perfis' and registro = teste.uid(10)::text),
    'a mudança de papel entra no histórico');

  v_lista := lista_de_pessoas('', 'equipe', 50, 0);
  perform teste.confere((v_lista ->> 'total')::integer = 3, 'lista da equipe: administrador e dois professores');
  v_lista := lista_de_pessoas('', 'alunos', 5, 0);
  perform teste.confere((v_lista ->> 'total')::integer = 23 and jsonb_array_length(v_lista -> 'pessoas') = 5, 'lista de alunos: total de 23, página de 5');
  perform teste.confere((lista_de_pessoas('', 'alunos', 5, 20) -> 'pessoas') @> (lista_de_pessoas('', 'alunos', 100, 22) -> 'pessoas')
                        and jsonb_array_length(lista_de_pessoas('', 'alunos', 5, 20) -> 'pessoas') = 3, 'a última página traz o resto');
  perform teste.confere((lista_de_pessoas('', 'sem_acesso', 50, 0) -> 'pessoas' -> 0 ->> 'email') = 'pessoa11@exemplo.test'
                        and (lista_de_pessoas('', 'sem_acesso', 50, 0) ->> 'total')::integer = 1, 'sem acesso: só quem está com a matrícula vencida');
  perform teste.confere((lista_de_pessoas('', 'com_acesso', 50, 0) ->> 'total')::integer = 22, 'com acesso: os outros 22 alunos');
  v_lista := lista_de_pessoas('  PESSOA12@  ', 'alunos', 50, 0);
  perform teste.confere((v_lista ->> 'total')::integer = 1 and (v_lista -> 'pessoas' -> 0 ->> 'matriculas')::integer = 2
                        and (v_lista -> 'pessoas' -> 0 -> 'cursos_com_acesso') = '["Português do Brasil"]'::jsonb,
    'busca por e-mail sem ligar para maiúsculas; a matrícula suspensa não conta como acesso');
  perform teste.confere((lista_de_pessoas('%', 'alunos', 50, 0) ->> 'total')::integer = 0 and
                        (lista_de_pessoas('pessoa_', 'alunos', 50, 0) ->> 'total')::integer = 0, 'os sinais % e _ valem como texto na busca');
end $$;
reset role;
update auth.users set email = 'doze.corrigido@exemplo.test' where id = teste.uid(12);
do $$
begin
  perform teste.confere((select email from public.perfis where id = teste.uid(12)) = 'doze.corrigido@exemplo.test', 'e-mail corrigido no login aparece no perfil');
end $$;
select set_config('request.jwt.claims', '', false); -- o servidor não age em nome de ninguém
set role service_role;
do $$
begin
  update matriculas set situacao = 'encerrada' where aluno_id = teste.uid(12) and curso_id = teste.tid(3);
  perform teste.confere((select pessoa_id is null and depois ->> 'situacao' = 'encerrada' from registro_alteracoes
                         where tabela = 'matriculas' order by id desc limit 1), 'mudança feita pelo servidor entra no histórico sem pessoa');
end $$;
reset role;

\echo 'REGRAS: todos os testes passaram'
