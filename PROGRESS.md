# PROGRESS

**Fase atual:** 0 concluída. Próximo passo exato: Fase 1 (tema areia/dourado + store `grana-seria:v1` + 5 abas + onboarding + rosca).

## Fase 0 — diagnóstico
- Stack: Vite + React 18 + TS, react-router 6, lucide-react, framer-motion, vitest, eslint. Funções serverless em `api/*.ts` (Vercel), Supabase via REST (`server/whatsapp/db.ts`).
- Login: link do WhatsApp -> token em `localStorage` (`gs-painel-token`); e-mail em `/conta`. Preservar.
- Dados hoje: JSON sincronizado (`SYNC_KEYS` em `src/sync.ts`, espelhado em `server/whatsapp/hubdb.ts`) + lançamentos no Supabase (`api/lancamentos.ts`). Chaves: `gs-missoes`, `gs-eu`, `gs-contas`, `gs-guardado`, `gs-limites`...
- Rotas: `/`, `/mes`, `/plano`, `/missoes`, `/conselheiros`, `/agentes/:id/chat`, `/selos`, `/perfil`, `/coach*`, públicas (`/guias`, `/termos-de-uso`, `/politica-de-privacidade`, `/diagnostico`, `/admin`).
- Backend existe: o novo store deve seguir o padrão (chave nova entra em `SYNC_KEYS` e `HANDOFF_KEYS`).
- Nomes antigos dos agentes: 56 arquivos (src/chat/roteiros/*, src/agents.ts, src/chat/agentes.ts, src/missoes.ts, componentes de chat/missões/Meu mês, CSS de tokens, api/coach.ts, api/conselheiro.ts, docs).
- Aviso: o pedido novo substitui o visual verde "Ouro Antigo" e a spec v2 que acabou de ir ao ar (PR 77). Isso é uma reestruturação grande: será feita por fases, sem apagar dados salvos (migração).

## Decisões
- Spec v2 e Ouro Antigo já estão em `main`; novas fases entram por cima, com migração dos dados `gs-*` para `grana-seria:v1`.
