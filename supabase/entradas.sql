-- Entradas de dinheiro e forma de pagamento — rode isso uma vez no Supabase (SQL Editor → New query → Run).
-- Depende de supabase/whatsapp.sql (tabela expenses) já ter sido rodado.

-- Como o gasto foi pago: Pix, Débito, Crédito, Dinheiro, Boleto, Cartão ou Vale. Vazio = a pessoa não disse.
alter table public.expenses add column if not exists payment_method text;

-- Dinheiro que entrou: salário, freela, venda, presente, reembolso…
create table if not exists public.incomes (
  id            bigint generated always as identity primary key,
  phone         text           not null,
  amount        numeric(12, 2) not null check (amount > 0),
  source        text           not null default 'Outros',   -- Salário, Renda extra, Venda, Reembolso, Presente, Rendimento, Outros
  description   text           not null default '',
  method        text,                                         -- como caiu: Pix, Dinheiro, Transferência…
  wa_message_id text           unique,
  created_at    timestamptz    not null default now()
);

create index if not exists incomes_phone_created_at_idx on public.incomes (phone, created_at desc);

alter table public.incomes enable row level security;
