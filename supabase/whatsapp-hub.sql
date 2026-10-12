-- Ferramentas do site no WhatsApp — rode isso uma vez no Supabase (SQL Editor → New query → Run).
-- Depende de supabase/whatsapp.sql (tabela expenses) e supabase/conta.sql (tabela wa_processed) já terem sido rodados.

-- Conversa em andamento (diagnóstico, 13º, caça-vazamentos): em que pergunta a pessoa parou.
create table if not exists public.wa_sessions (
  phone      text primary key,                        -- 5567999999999
  flow       text        not null,
  step       text        not null,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Dados de quem usa o WhatsApp sem conta no site: diagnóstico, plano, vazamentos.
-- Mesmo formato do user_state.state do site, pra o plano funcionar igual nos dois lugares.
create table if not exists public.wa_profiles (
  phone      text primary key,
  state      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Contador de uso (limite diário da IA, limite mensal do leitor de fatura).
create table if not exists public.wa_usage (
  phone  text not null,
  period text not null,                               -- ex.: ai:2026-10-12 · fatura:2026-10
  count  int  not null default 0,
  primary key (phone, period)
);

-- Segurança: RLS ligado e sem policy = ninguém acessa pela chave pública; só o servidor (service role).
alter table public.wa_sessions enable row level security;
alter table public.wa_profiles enable row level security;
alter table public.wa_usage    enable row level security;
