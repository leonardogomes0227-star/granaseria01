-- Fila de espera e controle de acesso (convite, assinatura, preço de fundador).
-- Rode uma vez no SQL Editor do Supabase. Só o servidor (service role) lê e grava: nada aqui é aberto ao navegador.

create table if not exists public.fila_espera (
  id           bigserial primary key,
  nome         text        not null,
  whatsapp     text        not null unique,          -- só números, com 55 (ex.: 5567999999999)
  codigo       text        not null unique,          -- código curto da pessoa, usado no link de indicação
  indicado_por text,                                 -- código de quem indicou
  status       text        not null default 'espera' check (status in ('espera', 'convidado', 'ativo', 'recusado')),
  convidado_em timestamptz,
  convite_ate  timestamptz,
  criado_em    timestamptz not null default now()
);
create index if not exists fila_espera_status on public.fila_espera (status, id);
create index if not exists fila_espera_indicado on public.fila_espera (indicado_por);

create table if not exists public.acessos (
  id            bigserial primary key,
  whatsapp      text unique,
  email         text unique,
  tipo          text        not null default 'assinante' check (tipo in ('assinante', 'cortesia')),
  plano         text        check (plano in ('mensal', 'anual')),
  fundador      boolean     not null default false,
  status        text        not null default 'ativo' check (status in ('ativo', 'cancelado')),
  valido_ate    timestamptz,                         -- até quando o que foi pago vale
  cakto_ref     text,
  atualizado_em timestamptz not null default now()
);

alter table public.fila_espera enable row level security;
alter table public.acessos     enable row level security;
-- sem nenhuma policy: o navegador não enxerga estas tabelas; a service role (servidor) ignora o RLS.
