-- Grana Séria: SQL do app novo. Rode UMA vez no Supabase (SQL Editor -> New query -> Cole tudo -> Run).
-- É seguro rodar de novo: só acrescenta, nunca apaga nada. O site e o bot funcionam antes e depois (o código detecta as colunas novas).
-- Depende só de supabase/whatsapp.sql (a tabela expenses), que você já rodou.
-- NÃO inclui as tabelas coach_* (coach_perfil, coach_chat, coach_plano, coach_aportes): eram do coach antigo e o app novo não usa.

-- 1. Gastos: como foi pago (Pix, Débito, Crédito...)
alter table public.expenses add column if not exists payment_method text;

-- 2. Entradas de dinheiro (salário, freela, venda...)
create table if not exists public.incomes (
  id            bigint generated always as identity primary key,
  phone         text           not null,
  amount        numeric(12, 2) not null check (amount > 0),
  source        text           not null default 'Outros',
  description   text           not null default '',
  method        text,
  wa_message_id text           unique,
  created_at    timestamptz    not null default now()
);
create index if not exists incomes_phone_created_at_idx on public.incomes (phone, created_at desc);
alter table public.incomes enable row level security; -- sem policy: só o servidor acessa

-- 3. Gastos e entradas lançados pelo app: apagar com "Desfazer" e saber a origem
alter table public.expenses add column if not exists deleted_at timestamptz;
alter table public.expenses add column if not exists updated_at timestamptz;
alter table public.expenses add column if not exists origem text not null default 'whatsapp' check (origem in ('site', 'whatsapp'));
alter table public.expenses add column if not exists missao_id text;

alter table public.incomes add column if not exists deleted_at timestamptz;
alter table public.incomes add column if not exists updated_at timestamptz;
alter table public.incomes add column if not exists origem text not null default 'whatsapp' check (origem in ('site', 'whatsapp'));
alter table public.incomes add column if not exists missao_id text;

create index if not exists expenses_phone_alive_idx on public.expenses (phone, created_at desc) where deleted_at is null;
create index if not exists incomes_phone_alive_idx  on public.incomes  (phone, created_at desc) where deleted_at is null;

-- 4. OPCIONAL (tire os "--" do começo das linhas se quiser rodar): marca como apagado qualquer gasto ou entrada
-- com data num mês que ainda não chegou. Não some de verdade: dá pra ver com "where deleted_at is not null"
-- e desfazer com "deleted_at = null".
-- update public.expenses set deleted_at = now()
-- where deleted_at is null
--   and created_at >= ((date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month') at time zone 'America/Sao_Paulo');
-- update public.incomes set deleted_at = now()
-- where deleted_at is null
--   and created_at >= ((date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month') at time zone 'America/Sao_Paulo');
