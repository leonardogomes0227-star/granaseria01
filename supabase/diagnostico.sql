-- Só LÊ. Não altera nada. Rode no SQL Editor do Supabase do Grana Séria e me mande o resultado (print).
-- Mostra cada tabela do schema public, quantas linhas tem e se ela pertence ao Grana Séria.
select
  c.relname as tabela,
  case when c.relname in ('expenses','incomes','wa_sessions','wa_profiles','wa_usage','wa_events','wa_processed','user_state','coach_perfil','coach_chat','coach_plano','coach_aportes')
       then 'do Grana Séria' else 'DE OUTRO PROJETO?' end as dono,
  c.reltuples::bigint as linhas_aprox
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by dono desc, c.relname;
