# O que só o dono pode fazer

O código desta versão endurece o app sem ligar a criptografia e sem mexer no banco de produção. Os passos abaixo ficam com você.

## 1. Rodar o SQL no Supabase

No SQL Editor, nesta ordem, se ainda não rodou:

1. `supabase/acesso.sql` (fila e tabela de acessos), se a fila ainda não existe.
2. `supabase/seguranca-rls.sql` (tira permissão larga e devolve ao site só as colunas que ele já grava).
3. `supabase/seguranca-extra.sql` (tabela `cakto_eventos` e revogação nas tabelas que só o servidor usa). Não mexe em `user_state`.

Não cifre `user_state` por SQL. O navegador lê essa coluna direto. A criptografia em `server/cripto.ts` continua desligada enquanto `ENCRYPTION_AT_REST` não for exatamente `true`.

## 2. Variáveis na Vercel

Nunca use prefixo `VITE_` para segredo. O navegador só pode ver a URL e a chave anônima do Supabase.

- `CAKTO_WEBHOOK_SECRET`: o mesmo segredo configurado no webhook da Cakto.
- `ACESSO_MODO=convite`: liga a trava. Sem isso, ninguém é cortado.
- `ACESSO_CORTE`: data em que acaba o prazo de quem já usava.
- `ACESSO_NOVOS_DESDE`: contas criadas depois dessa data não ganham o prazo antigo.
- `ADMIN_SECRET`, `WHATSAPP_APP_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: só no servidor.
- `VITE_PLAUSIBLE_DOMAIN` e `VITE_META_PIXEL_ID`: opcionais. Sem eles, nenhuma métrica é carregada.

Na Cakto, a URL de obrigado (página de sucesso) pode ser `https://www.granaseria.com.br/obrigado`. O webhook continua em `https://www.granaseria.com.br/api/cakto`.

Se a Cakto passar a mandar assinatura HMAC do corpo, use o cabeçalho `x-cakto-signature` com `sha256=` e o hex do HMAC-SHA256 do corpo cru, com o mesmo segredo. Sem esse cabeçalho, o segredo no corpo ou em `x-cakto-secret` continua valendo.

## 3. Chaves para rotacionar

A varredura do código atual não achou chave de serviço, token de WhatsApp nem chave de IA commitada. A chave anônima do Supabase, se estiver na Vercel como `VITE_SUPABASE_ANON_KEY`, é pública por desenho: ela só é segura com o RLS aplicado.

Rotacione mesmo assim se alguma destas já passou por chat, print ou variável errada:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `WHATSAPP_TOKEN` e `WHATSAPP_APP_SECRET`
- `ADMIN_SECRET` e `CAKTO_WEBHOOK_SECRET`
- `FIELD_ENCRYPTION_KEY`, se um dia tiver sido gerada

## 4. O que o código não faz sozinho

- Backup automático do Postgres: ligue o ponto de restauração no painel do Supabase.
- Alerta: o servidor escreve `alerta-uso` no log quando alguém estoura o limite de IA. Um dreno de log da Vercel pode avisar você. O log não leva nome, e-mail nem telefone.
- Força bruta no login: o login é link mágico do Supabase (não há senha neste banco). Ative a proteção de senha vazada e o limite de taxa em Authentication, no painel do Supabase.
- A trava de plano só corta quando `ACESSO_MODO=convite` e a decisão é `bloqueado`. Se o banco cair na hora da consulta, a rota segue, para um pisca não trancar todo mundo. Com o banco no ar e a pessoa bloqueada, a rota paga responde 402.
