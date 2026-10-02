-- Assistente de gastos pelo WhatsApp — rode isso uma vez no Supabase (SQL Editor → New query → Run).

create table if not exists public.expenses (
  id            bigint generated always as identity primary key,
  phone         text           not null,                 -- número no formato 5511987654321
  amount        numeric(12, 2) not null check (amount > 0),
  category      text           not null,
  description   text           not null default '',
  wa_message_id text           unique,                   -- evita gravar a mesma mensagem duas vezes
  created_at    timestamptz    not null default now()
);

create index if not exists expenses_phone_created_at_idx on public.expenses (phone, created_at desc);

-- Segurança: com RLS ligado e sem nenhuma policy, ninguém acessa a tabela pela chave pública (anon).
-- Só o servidor, com a service role key guardada na Vercel, consegue ler e gravar.
alter table public.expenses enable row level security;
