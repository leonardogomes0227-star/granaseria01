-- Fundação da spec v2 — rode uma vez no Supabase (SQL Editor → New query → Run). Só acrescenta: nada é apagado.
-- Depende de supabase/whatsapp.sql e supabase/entradas.sql (expenses e incomes) e de supabase/coach.sql (coach_perfil).
-- O site e o bot funcionam antes e depois deste SQL: o código detecta as colunas novas sozinho.

-- 1. Lançamentos (gastos e entradas): apagar com "Desfazer", origem e ligação com uma missão.
alter table public.expenses add column if not exists deleted_at timestamptz;
alter table public.expenses add column if not exists updated_at timestamptz;
alter table public.expenses add column if not exists origem     text not null default 'whatsapp' check (origem in ('site', 'whatsapp'));
alter table public.expenses add column if not exists missao_id  text;

alter table public.incomes add column if not exists deleted_at timestamptz;
alter table public.incomes add column if not exists updated_at timestamptz;
alter table public.incomes add column if not exists origem     text not null default 'whatsapp' check (origem in ('site', 'whatsapp'));
alter table public.incomes add column if not exists missao_id  text;

-- o que o site e o bot leem: só o que não foi apagado
create index if not exists expenses_phone_alive_idx on public.expenses (phone, created_at desc) where deleted_at is null;
create index if not exists incomes_phone_alive_idx  on public.incomes  (phone, created_at desc) where deleted_at is null;

-- 2. Correção de meses futuros (regra 0.6): gasto ou entrada com data num mês que ainda não chegou (fuso de Brasília)
-- é marcado como apagado. Não some: dá pra ver com "where deleted_at is not null" e desfazer com deleted_at = null.
update public.expenses set deleted_at = now()
where deleted_at is null
  and created_at >= ((date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month') at time zone 'America/Sao_Paulo');
update public.incomes set deleted_at = now()
where deleted_at is null
  and created_at >= ((date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month') at time zone 'America/Sao_Paulo');

-- 3. Agente principal com os 7 agentes (a coluna antiga "coach" só aceita 3; ela continua lá, intocada).
alter table public.coach_perfil add column if not exists agente text;
