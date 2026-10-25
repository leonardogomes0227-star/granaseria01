# PROGRESS

**Fase atual:** 0 a 8 feitas no código; falta a Fase 9 completa (auditoria) e a limpeza do código antigo.
**Próximo passo exato:** apagar o código antigo (agentes com os 7 nomes, missões, chat roteirizado, coach) e rodar `grep -ri "dabasir\|bansir\|arkad\|nomasir\|sharru\|mathon\|rodan" src server api public` até zerar. A varredura em massa com `git rm` foi bloqueada pelo ambiente; precisa de autorização do dono (veja "Avisos").

## O que existe (app novo em `src/gs/`)
- Tema areia/dourado: `src/gs/gs.css` (tokens `--bg`, `--gold`, `--ink`…), ligado só dentro do app (`src/gs/visual.ts`).
- Store `grana-seria:v1` (`store.ts`, `tipos.ts`, `migracao.ts`): versão, migração das chaves `gs-*` antigas, leitura com try/catch. Entra em `SYNC_KEYS` e `HANDOFF_KEYS`. Espelha contas e guardado nas chaves antigas (só leitura, pro WhatsApp).
- Seletores puros (`selectores.ts`), dívidas (`dividas.ts`), ferramentas (`ferramentas.ts`), insights e resumo (`insights.ts`), agentes (`agentesCustom.ts`), investir (`investir/calculos.ts`), mercado (`server/mercado/calculos.ts`): todos com testes (343 no total).
- Telas: Início (rosca, próximas ações, resumo), Meu mês (Contas fixas | Dia a dia), Plano (dívidas em 4 passos, posso comprar, assinaturas, reserva, renda, empréstimos, extras), Investir (Mercado, Meu plano, Simulação, Conversar), Assistentes (+ criar agente), Meus dados, Sobre.
- Servidor: `api/mercado.ts` (+ `server/mercado/fontes.ts`), `api/investimentos/chat.ts`. `.env.example` com as variáveis.
- PWA: `public/manifest.webmanifest`, `public/sw.js` (só o casco, nunca `/api`), ícones.

## Decisões
- Lançamentos do WhatsApp entram no store uma vez cada (pelo id do servidor); apagar no app apaga lá (com desfazer).
- Antecedência dos avisos é global (Meus dados) e também por assistente na configuração.
- Banco de dados (Supabase): nada novo é exigido por este app; `supabase/coach.sql` e `supabase/fundacao.sql` seguem pendentes (dono pediu pra deixar pro final).

## Avisos
- Não deu pra validar as séries do Banco Central e a CoinGecko daqui (o ambiente bloqueia a saída). O servidor valida cada série (Selic/CDI entre 5% e 25% a.a., IPCA, taxas mensais) e descarta o que vier estranho; sem dado, a tela diz "Sem conexão com os dados de mercado agora". Séries usadas: 432, 4389, 13522, 4391 (CDI no mês), 433, 1. Confirmar no ar.
- Ibovespa e B3 só aparecem com `BRAPI_TOKEN`; o formato da brapi não foi testado.
- Código antigo ainda no repositório (sem rota): `src/chat`, `src/components/{chat,missoes,mes,selos,perfil}`, `src/coachChat`, `src/missoes*.ts`, `src/eu.ts`, `src/agents.ts`, `api/coach.ts`, `api/conselheiro.ts`, etc.
