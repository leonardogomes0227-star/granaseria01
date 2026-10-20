-- Coach em chat — rode isso uma vez no Supabase (SQL Editor → New query → Run).
-- Segue o padrão das tabelas wa_*: a chave é o telefone (quem entra pelo link do WhatsApp) e o acesso é só pelo servidor.

-- O coach que a pessoa escolheu (pode trocar quando quiser).
create table if not exists public.coach_perfil (
  phone      text primary key,
  coach      text        not null check (coach in ('arkad', 'nomasir', 'sharru')),
  updated_at timestamptz not null default now()
);

-- Onde a conversa parou: as respostas dadas, em ordem, de cada roteiro ('plano', 'checkin:2026-10').
create table if not exists public.coach_chat (
  phone      text        not null,
  script     text        not null,
  history    jsonb       not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (phone, script)
);

-- As respostas do roteiro "Montar plano" e o plano calculado a partir delas.
create table if not exists public.coach_plano (
  phone      text primary key,
  respostas  jsonb       not null default '{}'::jsonb,
  plano      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Quanto a pessoa guardou em cada mês (um registro por mês; refazer o check-in corrige o valor).
create table if not exists public.coach_aportes (
  phone      text        not null,
  mes        text        not null check (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  valor      numeric     not null check (valor >= 0),
  origem     text        not null default 'site' check (origem in ('site', 'whatsapp')),
  created_at timestamptz not null default now(),
  primary key (phone, mes)
);

-- Nunca aceita mês futuro (fuso de Brasília), mesmo que alguém chame a API direto.
create or replace function public.coach_aportes_sem_futuro() returns trigger language plpgsql as $$
begin
  if new.mes > to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') then
    raise exception 'mes futuro nao permitido: %', new.mes;
  end if;
  return new;
end $$;

drop trigger if exists coach_aportes_sem_futuro on public.coach_aportes;
create trigger coach_aportes_sem_futuro before insert or update on public.coach_aportes
  for each row execute function public.coach_aportes_sem_futuro();

-- Faxina: tira qualquer mês futuro que já exista (a tabela é nova, então normalmente não há nenhum).
delete from public.coach_aportes where mes > to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM');

-- Segurança: RLS ligado e sem policy = ninguém acessa pela chave pública; só o servidor (service role).
alter table public.coach_perfil  enable row level security;
alter table public.coach_chat    enable row level security;
alter table public.coach_plano   enable row level security;
alter table public.coach_aportes enable row level security;
