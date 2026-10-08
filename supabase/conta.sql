-- Conta da pessoa: login por e-mail, dados sincronizados entre aparelhos e WhatsApp vinculado.
-- Rode uma vez no Supabase (SQL Editor → New query → Run), depois de whatsapp.sql.

create table if not exists public.user_state (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  state             jsonb       not null default '{}'::jsonb, -- diagnóstico, plano, vazamentos, check-ins
  updated_at        timestamptz not null default now(),
  -- WhatsApp: só o servidor grava o número, depois que a pessoa manda o código pelo próprio WhatsApp
  phone             text unique,
  link_code         text unique,
  link_code_expires timestamptz,
  reminder_day      int check (reminder_day between 1 and 31),
  reminders         boolean     not null default true,
  last_reminder     date,
  -- leitor de fatura: limite de uso por mês (gravado só pelo servidor)
  fatura_month      text,
  fatura_count      int         not null default 0
);

alter table public.user_state enable row level security;

drop policy if exists "user_state: ler a própria" on public.user_state;
drop policy if exists "user_state: criar a própria" on public.user_state;
drop policy if exists "user_state: editar a própria" on public.user_state;
drop policy if exists "user_state: apagar a própria" on public.user_state;

create policy "user_state: ler a própria" on public.user_state
  for select to authenticated using (auth.uid() = user_id);
create policy "user_state: criar a própria" on public.user_state
  for insert to authenticated with check (auth.uid() = user_id);
create policy "user_state: editar a própria" on public.user_state
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_state: apagar a própria" on public.user_state
  for delete to authenticated using (auth.uid() = user_id);

-- O navegador só mexe nestas colunas. phone, last_reminder e fatura_* ficam com o servidor
-- (service role), pra ninguém vincular o WhatsApp de outra pessoa nem burlar o limite da fatura.
-- user_id entra no update porque o upsert reescreve a chave; a regra acima impede trocar de usuário.
revoke all on public.user_state from anon, authenticated;
grant select, delete on public.user_state to authenticated;
grant insert (user_id, state, updated_at, link_code, link_code_expires, reminder_day, reminders)
  on public.user_state to authenticated;
grant update (user_id, state, updated_at, link_code, link_code_expires, reminder_day, reminders)
  on public.user_state to authenticated;

-- Desvincular o WhatsApp pelo site (a pessoa não pode escrever em phone diretamente)
create or replace function public.unlink_whatsapp()
returns void
language sql
security definer
set search_path = public
as $$
  update public.user_state set phone = null where user_id = auth.uid();
$$;

revoke all on function public.unlink_whatsapp() from public, anon;
grant execute on function public.unlink_whatsapp() to authenticated;

-- Mensagens do WhatsApp já processadas (a Meta às vezes reenvia: "paguei" não pode fechar dois meses)
create table if not exists public.wa_processed (
  id         text primary key,
  created_at timestamptz not null default now()
);
alter table public.wa_processed enable row level security; -- sem policy: só o servidor acessa
