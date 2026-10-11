-- Avisos de pagamento da Greenn: dois ajustes nas funções do servidor.
-- A transação é aberta por quem aplica: a migração entra inteira ou não entra.
-- PROVISÓRIO, como o resto do pagamento: segue a documentação pública do webhook e será
-- conferido com eventos reais antes de ir para produção.

-- 1. Assinatura: cada cobrança paga manda o mesmo contrato com o mesmo status ("paid").
--    A chave que impede gravar o mesmo aviso duas vezes passa a incluir a cobrança (ou o fim do
--    período pago): assim a renovação de cada mês é um aviso novo e estende o acesso.
--    O aviso é guardado como veio, menos documento, endereço e telefone do comprador, que o
--    servidor tira antes de chamar esta função.
create or replace function public.registrar_evento_pagamento(p_payload jsonb)
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
  if v_tipo = 'contract' then
    v_chave := v_chave || ':' || coalesce(p_payload #>> '{currentSale,id}', p_payload #>> '{contract,current_period_end}', '');
  end if;
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

-- 2. Compra de quem já tem acesso: os dias comprados somam ao que ainda resta, em vez de
--    recomeçar de hoje; e a compra nunca encurta um acesso que estava sem prazo.
create or replace function public.aplicar_evento_pagamento(p_evento bigint, p_aluno uuid) returns text
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
      situacao = 'ativa', oferta_id = excluded.oferta_id, origem = 'greenn',
      expira_em = case
        when v_oferta.dias_de_acesso is null then null
        when matriculas.situacao = 'ativa' and matriculas.expira_em is null then null
        when matriculas.situacao = 'ativa' and matriculas.expira_em > now()
          then matriculas.expira_em + make_interval(days => v_oferta.dias_de_acesso)
        else now() + make_interval(days => v_oferta.dias_de_acesso)
      end,
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

-- A tela de pagamentos lista os avisos do mais novo para o mais antigo e separa os pendentes.
create index eventos_pagamento_pendentes on public.eventos_pagamento (id) where processado_em is null;
