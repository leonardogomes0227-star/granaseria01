-- Segurança: rode no Supabase (SQL Editor → New query → Run) DEPOIS que o site novo estiver no ar.
-- Só tira permissão. Não apaga linha, não muda coluna, não muda dado.
-- Pode rodar de novo. Se uma tabela ainda não existir (as coach_*, por exemplo), essa parte é pulada.
--
-- Ordem: 1) faça o deploy deste PR  2) abra o site e confira que "Vincular meu WhatsApp" gera um código
-- de 10 letras  3) rode este arquivo. Se rodar antes do deploy, o botão antigo de vincular para de gravar
-- o código até a pessoa receber o site novo. O resto da conta (sincronizar, lembrete) continua.
--
-- O que isto faz:
--   * As tabelas que só o servidor usa deixam de ter GRANT para anon e authenticated.
--     Hoje o RLS ligado e sem policy já esconde as linhas, mas o GRANT padrão do Supabase continua.
--     Se alguém desligar o RLS, a chave pública passaria a ler tudo. Sem o GRANT, a leitura quebra
--     com permissão negada, do mesmo jeito que user_state já faz.
--   * A pessoa logada deixa de poder gravar link_code. Quem grava o código é o servidor
--     (POST /api/painel?acao=vincular), com a service role. Ela continua podendo ler o próprio código.
--
-- Criptografia: este arquivo NÃO cifra nada. O código de cifra está em server/cripto.ts e nasce desligado
-- (ENCRYPTION_AT_REST não é "true"). Não cifre user_state por SQL: o navegador lê essa coluna direto
-- (src/sync.ts). Cifrar a coluna quebraria as contas que já existem. O caminho seguro é a sincronização
-- passar pelo servidor primeiro, e só então ligar a flag. Veja o comentário no topo de server/cripto.ts.

do $$
declare
  tabelas text[] := array[
    'expenses', 'incomes', 'wa_sessions', 'wa_profiles', 'wa_usage', 'wa_events', 'wa_processed',
    'coach_perfil', 'coach_chat', 'coach_plano', 'coach_aportes'
  ];
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

do $$
begin
  revoke insert, update on table public.user_state from authenticated;
  grant insert (user_id, state, updated_at, reminder_day, reminders)
    on table public.user_state to authenticated;
  grant update (user_id, state, updated_at, reminder_day, reminders)
    on table public.user_state to authenticated;
exception
  when undefined_table or undefined_column then
    raise notice 'user_state ainda não está como em supabase/conta.sql; não alterei os grants.';
end $$;
