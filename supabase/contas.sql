-- Contas do site + assistente do WhatsApp gravando na mesma tabela de gastos.
-- Rode uma vez no Supabase (SQL Editor → New query → Run). Pode rodar de novo sem problema:
-- tudo aqui é idempotente.
--
-- Pressupõe as tabelas profiles, diagnosticos e gastos já criadas (com RLS ligado).

-- ---------------------------------------------------------------------------
-- 1. Permissões (RLS): cada usuário só lê e grava o que é seu.
--    Se você já criou policies equivalentes, estas se somam a elas sem conflito.
-- ---------------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.diagnosticos enable row level security;
alter table public.gastos       enable row level security;

drop policy if exists "profiles_select_proprio" on public.profiles;
create policy "profiles_select_proprio" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_update_proprio" on public.profiles;
create policy "profiles_update_proprio" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "diagnosticos_select_proprio" on public.diagnosticos;
create policy "diagnosticos_select_proprio" on public.diagnosticos
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "diagnosticos_insert_proprio" on public.diagnosticos;
create policy "diagnosticos_insert_proprio" on public.diagnosticos
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "gastos_select_proprio" on public.gastos;
create policy "gastos_select_proprio" on public.gastos
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "gastos_insert_proprio" on public.gastos;
create policy "gastos_insert_proprio" on public.gastos
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "gastos_update_proprio" on public.gastos;
create policy "gastos_update_proprio" on public.gastos
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "gastos_delete_proprio" on public.gastos;
create policy "gastos_delete_proprio" on public.gastos
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Índices pras consultas do site e do bot.
-- ---------------------------------------------------------------------------

create index if not exists diagnosticos_user_criado_idx on public.diagnosticos (user_id, criado_em desc);
create index if not exists gastos_user_data_idx         on public.gastos (user_id, data desc, criado_em desc);

-- ---------------------------------------------------------------------------
-- 3. Assistente do WhatsApp: evita gravar a mesma mensagem duas vezes
--    (a Meta às vezes reenvia). Gastos do site ficam com essa coluna vazia.
-- ---------------------------------------------------------------------------

alter table public.gastos add column if not exists wa_message_id text;
create unique index if not exists gastos_wa_message_id_key on public.gastos (wa_message_id);

-- ---------------------------------------------------------------------------
-- 4. (Opcional) Traz os gastos da fase de teste — tabela antiga "expenses" —
--    para "gastos", ligando pelo telefone do perfil. Gastos de números sem conta
--    no site ficam de fora. Rodar de novo não duplica nada.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.expenses') is not null then
    insert into public.gastos (user_id, valor, categoria, descricao, data, origem, wa_message_id, criado_em)
    select p.id,
           e.amount,
           e.category,
           nullif(e.description, ''),
           (e.created_at at time zone 'America/Sao_Paulo')::date,
           'whatsapp',
           e.wa_message_id,
           e.created_at
    from public.expenses e
    join public.profiles p on p.telefone = e.phone
    on conflict (wa_message_id) do nothing;
  end if;
end $$;
