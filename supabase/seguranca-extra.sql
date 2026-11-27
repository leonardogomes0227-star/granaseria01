-- Complemento de segurança. Rode no SQL Editor do Supabase DEPOIS de supabase/acesso.sql
-- e de supabase/seguranca-rls.sql. Pode rodar de novo.
-- Não apaga linha, não muda dado de quem já usa, não liga criptografia.
--
-- O que faz:
--   * Cria cakto_eventos, para o webhook ignorar o mesmo aviso duas vezes (replay).
--   * Tira GRANT de anon e authenticated nas tabelas que só o servidor usa.
--     O RLS sem policy já esconde as linhas. Sem o GRANT, desligar o RLS não abre a tabela.

create table if not exists public.cakto_eventos (
  id         text primary key,
  ref        text,
  evento     text,
  criado_em  timestamptz not null default now()
);

alter table public.cakto_eventos enable row level security;

do $$
declare
  tabelas text[] := array['cakto_eventos', 'fila_espera', 'acessos'];
  t text;
begin
  foreach t in array tabelas
  loop
    begin
      execute format('revoke all on table public.%I from anon, authenticated', t);
    exception
      when undefined_table then
        null;
    end;
  end loop;
end $$;

-- user_state não entra aqui: o navegador grava o caderno nessa tabela.
-- O recorte das colunas continua em supabase/seguranca-rls.sql.
