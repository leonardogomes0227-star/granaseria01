# Grana Séria

App de finanças pessoais em português (Vite + React + TypeScript, funções da Vercel em `api/`).

## Como rodar
```
npm install
npm run dev        # http://localhost:5173
npm test           # testes (vitest)
npm run typecheck  # tsc
npm run lint
npm run build
```

## Variáveis de ambiente (veja `.env.example`)
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (padrão `claude-haiku-5-5`): chat do Assistente de Investimentos. Sem a chave, o chat usa o modo guiado.
- `BRAPI_TOKEN` (opcional): Ibovespa e B3 na aba Investir.
- Supabase/WhatsApp: veja `docs/configuracao.md`.

Os dados financeiros ficam no aparelho (`grana-seria:v1`). Quem entra com o WhatsApp ou o e-mail ganha uma cópia no Supabase (`user_state`, `wa_profiles`), que o botão "Apagar tudo" de Meus dados também remove (`DELETE /api/painel`). Conteúdo educativo, não é recomendação de investimento.
