-- Áudios do quiz: a voz do professor em cada palavra do jogo de combinar pares.
-- A transação é aberta por quem aplica: a migração entra inteira ou não entra.
--
-- Os áudios ficam no próprio banco (são curtos: uma palavra ou uma expressão). Assim eles entram
-- nas cópias de segurança e vão junto quando a plataforma muda de VPS, sem pasta à parte.
-- Cada áudio pertence a uma aula. Só a equipe lê, grava e apaga; o aluno ouve pelo aplicativo,
-- que entrega o som pelo identificador, sem revelar a palavra.

create table public.audios (
  id         uuid primary key default gen_random_uuid(),
  aula_id    uuid not null references public.aulas (id),
  tipo       text not null check (tipo in ('audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm')),
  dados      bytea not null check (octet_length(dados) between 44 and 2097152),
  criado_em  timestamptz not null default now()
);
create index audios_aula on public.audios (aula_id, criado_em);

alter table public.audios enable row level security;
revoke all on public.audios from anon, authenticated;
grant select, insert, delete on public.audios to authenticated;
grant all on public.audios to service_role;
create policy equipe_tudo on public.audios for all to authenticated using (eh_equipe()) with check (eh_equipe());
