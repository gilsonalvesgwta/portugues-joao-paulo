-- Alunos e matrícula pela administração.
-- A transação é aberta por quem aplica: a migração entra inteira ou não entra.
--
-- Até aqui só o servidor (pagamento) gravava matrículas. Agora o administrador também grava,
-- com a própria sessão: cadastra o aluno, matricula, suspende, encerra e muda a validade.
-- O professor continua sem ler nem gravar matrículas.

-- ---------------------------------------------------------------------------
-- 1. O administrador grava matrículas e corrige o cadastro das pessoas
-- ---------------------------------------------------------------------------

grant insert, update on public.matriculas to authenticated;
create policy admin_cria   on public.matriculas for insert to authenticated with check (eh_admin());
create policy admin_altera on public.matriculas for update to authenticated using (eh_admin()) with check (eh_admin());

-- As colunas que a sessão pode alterar em perfis continuam as mesmas (nome, fuso, idioma...):
-- papel e e-mail não entram. O papel muda só pela função definir_papel, abaixo; o e-mail muda
-- no login e é copiado para o perfil pelo gatilho.
create policy admin_altera on public.perfis for update to authenticated using (eh_admin()) with check (eh_admin());

-- Quando o e-mail de uma conta é corrigido no login, o perfil acompanha.
create function public.espelhar_email_do_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.perfis set email = new.email where id = new.id and email is distinct from new.email;
  return new;
end $$;

create trigger usuario_mudou_email after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.espelhar_email_do_usuario();

-- ---------------------------------------------------------------------------
-- 2. Histórico: quem mudou o quê em matrículas e ofertas
-- ---------------------------------------------------------------------------

-- Grava em registro_alteracoes o antes e o depois de cada linha. Quando a mudança vem do
-- servidor (compra, reembolso), não há pessoa logada e pessoa_id fica vazio.
create function public.registrar_alteracao() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_antes  jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_depois jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
begin
  -- Gravar de novo o mesmo conteúdo não entra no histórico.
  if tg_op = 'UPDATE' and (v_antes - 'atualizado_em') = (v_depois - 'atualizado_em') then
    return new;
  end if;
  insert into registro_alteracoes (pessoa_id, tabela, registro, antes, depois)
  values (
    (select id from perfis where id = auth.uid()),
    tg_table_name,
    coalesce(v_depois ->> 'id', v_antes ->> 'id'),
    v_antes,
    v_depois
  );
  return coalesce(new, old);
end $$;

create trigger matriculas_historico after insert or update or delete on public.matriculas
  for each row execute function public.registrar_alteracao();
create trigger ofertas_historico after insert or update or delete on public.ofertas
  for each row execute function public.registrar_alteracao();

-- ---------------------------------------------------------------------------
-- 3. Papel: aluno, professor ou administrador
-- ---------------------------------------------------------------------------

-- Só o administrador muda o papel de alguém, e nunca o próprio: assim sempre sobra pelo menos
-- um administrador (quem está fazendo a mudança).
create function public.definir_papel(p_pessoa uuid, p_papel text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_antes text;
begin
  if not eh_admin() then
    raise exception 'sem_permissao';
  end if;
  if p_papel is null or p_papel not in ('aluno', 'professor', 'admin') then
    raise exception 'papel_invalido';
  end if;
  if p_pessoa = auth.uid() then
    raise exception 'proprio_papel';
  end if;
  select papel into v_antes from perfis where id = p_pessoa for update;
  if not found then
    raise exception 'pessoa_inexistente';
  end if;
  if v_antes = p_papel then
    return;
  end if;
  update perfis set papel = p_papel where id = p_pessoa;
  insert into registro_alteracoes (pessoa_id, tabela, registro, antes, depois)
  values (auth.uid(), 'perfis', p_pessoa::text, jsonb_build_object('papel', v_antes), jsonb_build_object('papel', p_papel));
end $$;

-- ---------------------------------------------------------------------------
-- 4. Lista de pessoas para a tela de alunos
-- ---------------------------------------------------------------------------

-- Uma página da lista, com o total, em uma resposta só. p_filtro: 'alunos' (padrão),
-- 'com_acesso', 'sem_acesso' ou 'equipe'. A busca é por nome ou e-mail; os sinais % e _
-- valem como texto comum.
create function public.lista_de_pessoas(p_busca text, p_filtro text, p_limite integer, p_pulo integer)
returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  v_busca  text := '%' || replace(replace(replace(btrim(coalesce(p_busca, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_filtro text := coalesce(p_filtro, 'alunos');
  v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 100);
  v_pulo   integer := greatest(coalesce(p_pulo, 0), 0);
  v_saida  jsonb;
begin
  if not eh_admin() then
    raise exception 'sem_permissao';
  end if;

  with base as (
    select p.id, p.nome, p.email, p.papel, p.criado_em,
           coalesce(m.total, 0) as matriculas,
           coalesce(m.cursos, '[]'::jsonb) as cursos_com_acesso
    from perfis p
    left join lateral (
      select count(*) as total,
             jsonb_agg(c.titulo_pt order by c.ordem, c.titulo_pt)
               filter (where ma.situacao = 'ativa' and (ma.expira_em is null or ma.expira_em > now())) as cursos
      from matriculas ma
      join cursos c on c.id = ma.curso_id
      where ma.aluno_id = p.id
    ) m on true
    where p.nome ilike v_busca or p.email ilike v_busca
  ),
  filtrada as (
    select * from base b
    where case v_filtro
      when 'equipe'     then b.papel <> 'aluno'
      when 'com_acesso' then b.papel = 'aluno' and jsonb_array_length(b.cursos_com_acesso) > 0
      when 'sem_acesso' then b.papel = 'aluno' and jsonb_array_length(b.cursos_com_acesso) = 0
      else b.papel = 'aluno'
    end
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrada),
    'pessoas', coalesce(
      (select jsonb_agg(to_jsonb(f) order by f.criado_em desc, f.id)
       from (select * from filtrada order by criado_em desc, id limit v_limite offset v_pulo) f),
      '[]'::jsonb)
  ) into v_saida;
  return v_saida;
end $$;

revoke execute on function public.espelhar_email_do_usuario() from public, anon, authenticated;
revoke execute on function public.registrar_alteracao() from public, anon, authenticated;
revoke execute on function public.definir_papel(uuid, text) from public, anon;
grant execute on function public.definir_papel(uuid, text) to authenticated, service_role;
revoke execute on function public.lista_de_pessoas(text, text, integer, integer) from public, anon;
grant execute on function public.lista_de_pessoas(text, text, integer, integer) to authenticated, service_role;
