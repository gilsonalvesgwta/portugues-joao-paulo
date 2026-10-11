-- Apagar a conta de uma pessoa a pedido dela.
-- A transação é aberta por quem aplica: a migração entra inteira ou não entra.
--
-- A conta é apagada pelo serviço de login (que leva junto o perfil, as matrículas, o progresso,
-- as reservas, as avaliações e as conversas). O que não é levado junto são os avisos de compra,
-- que ficam para a conferência das vendas: esta função tira deles o nome e o e-mail do comprador.
-- Também saem os registros de e-mails enviados àquele endereço e o histórico de trocas de e-mail da pessoa.

create function public.apagar_dados_de_compra(p_pessoa uuid, p_email text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_email   text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_quantos integer;
begin
  update eventos_pagamento
  set payload = payload - 'client' - 'lead'
  where (payload ? 'client' or payload ? 'lead')
    and (aluno_id = p_pessoa
         or (v_email is not null and lower(coalesce(payload -> 'client' ->> 'email', payload -> 'lead' ->> 'email')) = v_email));
  get diagnostics v_quantos = row_count;

  if v_email is not null then
    delete from notificacoes where lower(destinatario) = v_email;
  end if;
  -- O histórico de trocas de e-mail e de nome daquela pessoa guarda os valores antigos.
  delete from registro_alteracoes where tabela = 'perfis' and registro = p_pessoa::text;
  return v_quantos;
end $$;

-- Só o servidor do aplicativo chama, depois de conferir que quem pede é o administrador.
revoke execute on function public.apagar_dados_de_compra(uuid, text) from public, anon, authenticated;
grant execute on function public.apagar_dados_de_compra(uuid, text) to service_role;
