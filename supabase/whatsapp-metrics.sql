-- Métricas e feedback do assistente do WhatsApp — rode uma vez no Supabase (SQL Editor → New query → Run).
-- Não guarda o telefone: só uma "impressão digital" (hash) pra contar pessoas distintas sem saber quem são.

create table if not exists public.wa_events (
  id         bigint generated always as identity primary key,
  person     text        not null,                  -- hash do telefone
  event      text        not null,                  -- ex.: diag_done · plan_follow · tool:extra · feedback:up:diag
  note       text,                                  -- só no feedback "não ajudou": o que faltou (até 280 caracteres)
  created_at timestamptz not null default now()
);

create index if not exists wa_events_event_created_idx on public.wa_events (event, created_at desc);
create index if not exists wa_events_person_idx        on public.wa_events (person);

alter table public.wa_events enable row level security;
