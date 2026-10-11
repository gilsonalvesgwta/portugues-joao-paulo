-- O aluno confirma o fuso horário na primeira visita.
-- A transação é aberta por quem aplica: a migração entra inteira ou não entra.
--
-- Toda conta nasce com o fuso de Madri, e as aulas ao vivo aparecem na hora desse fuso. Quem mora
-- em outro lugar via os horários errados até descobrir a troca em "Mi cuenta". Agora a área do
-- aluno pede a confirmação do fuso antes de mostrar qualquer coisa; esta coluna guarda quando a
-- pessoa confirmou. Vazia: ainda não confirmou.
alter table public.perfis add column fuso_confirmado_em timestamptz;

-- A pessoa marca a própria confirmação junto com o fuso (as regras de linha já limitam cada um ao
-- próprio perfil). As outras colunas que a sessão pode alterar continuam as mesmas.
grant update (fuso_confirmado_em) on public.perfis to authenticated;

-- Quem já tinha trocado o fuso por conta própria já escolheu: não precisa confirmar de novo.
update public.perfis set fuso_confirmado_em = now() where fuso <> 'Europe/Madrid';
