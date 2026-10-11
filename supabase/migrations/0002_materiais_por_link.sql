-- Materiais de apoio por link.
-- Decisão do dono do projeto: os arquivos (PDFs e afins) ficam fora da plataforma, no Google
-- Drive ou parecido, e o professor só cadastra o link. A tabela deixa de guardar arquivo e tamanho.
-- A transação é aberta por quem aplica: a migração entra inteira ou não entra.

alter table public.materiais rename column arquivo to link;
alter table public.materiais drop column tamanho_bytes;

-- Só endereço https, sem espaços. A tela já confere; o banco é a segunda tranca.
alter table public.materiais
  add constraint materiais_link_https check (link ~ '^https://[^[:space:]]+$' and char_length(link) <= 500);

create index materiais_aula on public.materiais (aula_id, ordem);
