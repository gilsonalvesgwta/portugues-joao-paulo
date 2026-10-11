-- Só para testes fora do Supabase: recria o mínimo que o Supabase já oferece
-- (papéis anon/authenticated/service_role, auth.users e auth.uid()).
-- NUNCA rodar no banco de produção.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Mesmo contrato do Supabase: o id do usuário vem do campo "sub" do token.
create function auth.uid() returns uuid
language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- O Supabase entrega tabelas, funções e sequências novas do esquema public já liberadas para
-- anon, authenticated e service_role. O ambiente de teste faz igual: assim, se uma migração
-- esquecer de fechar uma tabela ou uma função, os testes das regras acusam.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
