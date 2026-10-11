-- Tarefas: como os materiais, o que for arquivo fica fora da plataforma e entra só o link.
-- A transação é aberta por quem aplica: a migração entra inteira ou não entra.

alter table public.tarefas drop column arquivo;

-- Link opcional; quando existe, só endereço https, sem espaços.
alter table public.tarefas
  add constraint tarefas_link_https check (link is null or (link ~ '^https://[^[:space:]]+$' and char_length(link) <= 500));

create index tarefas_curso on public.tarefas (curso_id);
