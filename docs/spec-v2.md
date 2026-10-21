# Spec v2 ("O Coach") — mapa do que existe e decisões

Resumo da Fase 1 da [especificação v2](./spec-v2-original.md): o que a spec pede, onde isso já existe no código e como cada conflito foi resolvido. Regra geral: **nada foi removido**. Tudo é acréscimo; rotas antigas continuam funcionando.

## 1. Onde ficam os dados (uma fonte de verdade)

O app tem dois lugares de dados, e as telas novas usam os mesmos dois:

| Onde | O que guarda | Quem lê e grava |
|---|---|---|
| **Tabelas `expenses` e `incomes`** (Supabase, chave = telefone) | Lançamentos: gastos e entradas | WhatsApp, painel, Meu mês, resumos, e agora o site (`api/lancamentos.ts`) |
| **Estado sincronizado** (um JSON por pessoa: `wa_profiles.state` ou `user_state.state`) | Tudo o que é plano: diagnóstico, contas fixas, dívidas, metas, tarefas, agentes, e as entidades novas da spec | Site (`src/sync.ts` → `SYNC_KEYS`) e WhatsApp (`server/whatsapp/hubdb.ts` → `HANDOFF_KEYS`), com as **mesmas chaves** |

Entidades da spec × onde ficam:

| Spec (seção 3) | Onde fica | Observação |
|---|---|---|
| `profiles` | chave `gs-eu` (renda, dia do salário, agente principal, onboarding) + `gs-nome` | não existia tabela de perfil para quem entra pelo WhatsApp |
| `agentes_usuario` | `gs-agentes` (lista dos ativos, já existia) + `gs-agentes-meta` (ativado em, pausado, lembretes) | `em_espera` sai do status da missão |
| `conversas` / `conversa_respostas` | `gs-conversas` (histórico de respostas por conversa) | editar = cortar as respostas depois daquela, como a spec pede |
| `missoes` / `missao_passos` | `gs-missoes` (missões com passos e o que foi guardado/pago em cada mês) | "Refazer": a missão antiga só é arquivada quando o novo chat termina |
| `dividas` | `selos-wizard-progress` (diagnóstico) + lista das missões de dívida | o bot lê o diagnóstico; nada muda para ele |
| `contas_fixas` | `gs-contas` (Gastos fixos, já existia) | reaproveitada como a spec pede |
| `lancamentos` | `expenses` + `incomes` com as colunas novas `origem`, `missao_id`, `deleted_at`, `updated_at` | `supabase/fundacao.sql` |
| `limites_categoria` | `gs-limites` | os limites do diagnóstico continuam valendo como padrão |
| `selos_usuario` | `gs-selos-v2` (selo → data em que ganhou) | os selos antigos (4 leis) continuam em `/ferramentas/meus-selos` |
| soft delete | `deleted_at` nas tabelas de lançamentos; nas chaves do estado, "Desfazer" por 5 s antes de gravar | |

Por que não criar tabelas novas por `user_id` com RLS `auth.uid()`: a maioria das pessoas entra pelo link do WhatsApp e **não tem `auth.uid()`**. O servidor acessa por telefone com a service role, e o RLS fica ligado sem policy (ninguém acessa pela chave pública), igual às tabelas `wa_*` e `coach_*`.

## 2. Conflitos e como ficaram

| Tema | Spec | Hoje | Decisão |
|---|---|---|---|
| WhatsApp | placeholder "Em breve" | está no ar: grava gastos e entradas, resumos, lembretes | **continua igual**. Ganha origem e o apagar com desfazer. O Perfil mostra o status real, não "Em breve". |
| Login / RLS | `auth.uid()` | link do WhatsApp → telefone | mantém o telefone (seção 1) |
| Rotas | `/inicio`, `/meu-mes`, `/missoes`, `/agentes`, `/agentes/:id/chat`, `/perfil`, `/selos` | `/`, `/mes`, `/plano`, `/conselheiros`, `/conta` | as rotas da spec entram como **nomes novos para as mesmas telas**; as antigas continuam |
| IA paga | sem IA por enquanto | conversa livre (`api/conselheiro.ts`) e leitura do WhatsApp por IA | ficam como estão, desligadas sem chave. Os chats novos são roteirizados, com ponto de extensão `ProvedorDeFala` |
| Meses futuros | nunca | o Acompanhar deixava fechar vários meses no mesmo dia; contas podiam ser pagas em mês que não chegou | trava no site e no WhatsApp, faxina com backup (`gs-futuros-removidos`) e SQL que marca lançamentos futuros como apagados |
| Mês do plano | — | o mês N do plano é pago durante o mês (início + N - 1), a folga de um mês que o WhatsApp já usava | mantido: a trava usa a mesma regra |
| Pagar conta adiantado | — | dava para pagar a conta de um mês que ainda não chegou | só dá para ver o mês futuro; o pagamento entra quando o mês chega. Pagamentos antigos feitos adiantado (com data de hoje ou antes) continuam |
| "Quanto posso gastar hoje" | fórmula planejada (renda - fixas - guardar - parcelas - gastos) | saldo real (entradas anotadas - saídas - contas pagas - guardado) | as duas estão em `src/lib/financas.ts`. A Início passa para a da spec junto com as missões (Fase 3), com o saldo real como reserva quando não há renda declarada |
| Agente do onboarding | Arkad, Dabasir, Nomasir | o coach oferecia Arkad, Nomasir, Sharru | a escolha passa a ser a da spec; quem já tinha Sharru continua funcionando |
| Novas dependências | framer-motion, canvas-confetti, vitest | nenhuma | vitest na Fase 1; as outras nas fases 6 e 7 |
| Raio dos cards | 20px | 22px | token `--raio-card` com 22px (sem mudança visual) |

## 3. O que a Fase 1 entregou

- `src/lib/financas.ts`: as contas da seção 4 em funções puras (meta da reserva, sobra, 10%, Dabasir 70/20/10, ordem e quitação das dívidas, quanto por dia, previsão, coerência, empréstimo, viver de renda, dinheiro extra), com testes em `src/lib/financas.test.ts`. Os testes também travam os números que as telas já mostram.
- `src/lib/mesesFuturos.ts`: trava e faxina de meses futuros (navegador, painel e WhatsApp), com testes.
- Lançamentos: `api/lancamentos.ts` (listar um mês, anotar pelo site, editar, apagar e desfazer) e soft delete no bot (`server/whatsapp/db.ts`), que funciona antes e depois do SQL.
- `supabase/fundacao.sql`: migration só aditiva.
- `src/tokens.css`: os tokens da seção 10 com os valores atuais; `theme.css` e `app.css` apontam para eles.
- "Apagar meus dados" (LGPD) passou a apagar também as tabelas do coach.

## 4. Antes de publicar

1. Rodar [`supabase/fundacao.sql`](../supabase/fundacao.sql) no SQL Editor do Supabase. O app funciona sem ele, mas "Desfazer" de lançamento e a origem `site` só valem depois.
2. `npm test` roda os testes das contas.
