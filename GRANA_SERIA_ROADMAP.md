# GRANA SÉRIA 2.0 — ROADMAP

Documento vivo: diagnóstico, decisões, plano e progresso. Consulte antes de cada tarefa e atualize ao fim de cada etapa.
Base: auditoria da Fase 1 (nov/2026), sem nenhuma alteração de código. Complementa `PROGRESS.md` e `docs/spec-v2.md` (não os substitui).

## Status das fases

| Fase | Tema | Status |
|---|---|---|
| 1 | Auditoria + roadmap | Concluída |
| 2 | Experiência e arquitetura | Concluída (`docs/regras-financeiras.md`, rotas e navegação abaixo) |
| 3 | Design system | Concluída em escopo enxuto (reuso de `tokens.css`/`gs.css` + `gs2.css`; sem reescrever o CSS legado) |
| 4 | Dashboard (Início) | Concluída |
| 5 | Meu dinheiro | Concluída (parcial: ver pendências) |
| 6 | Planejamento | Concluída (parcial: ver pendências) |
| 7 | Evolução | Concluída |
| 8 | Coach financeiro | Concluída (IA depende de `ANTHROPIC_API_KEY`) |
| 9 | Mobile e performance | Concluída (bundle inicial −18%; verificado em 390 e 1280 px) |
| 10 | Testes finais | Concluída (ver registro) |

---|---|---|
| 1 | Auditoria + roadmap | **Concluída (aguardando aprovação)** |
| 2 | Experiência e arquitetura | Pendente |
| 3 | Design system | Pendente |
| 4 | Dashboard (Início) | Pendente |
| 5 | Meu dinheiro | Pendente |
| 6 | Planejamento | Pendente |
| 7 | Evolução | Pendente |
| 8 | Coach financeiro | Pendente |
| 9 | Mobile e performance | Pendente |
| 10 | Testes finais | Pendente |

---

## 1. Diagnóstico geral

O Grana Séria **não é um projeto inicial: é um produto maduro** (~57 mil linhas, 123 PRs, 501 testes passando em 44 arquivos). Reformular do zero seria um erro. O caminho é **reorganizar, unificar e dar voz de coach** ao que já existe.

**Stack (manter):** Vite + React 18 + TypeScript + React Router 6, Tailwind + CSS próprio, framer-motion, PWA (`public/sw.js`). Backend: funções serverless da Vercel em `api/*.ts` + `server/`. Banco: Supabase (REST com service role). IA: `@anthropic-ai/sdk`, só no servidor. Testes: Vitest. Crons: `/api/lembretes` e `/api/resumo`. Canal extra: bot de WhatsApp (Meta Cloud API).

**Como os dados fluem hoje:**
- **Estado do app** = um JSON único (`grana-seria:v1`, `src/gs/tipos.ts`) no `localStorage`, sincronizado com o Supabase (`wa_profiles.state` ou `user_state.state`) via `src/sync.ts` / `api/painel.ts`. Toda regra financeira é função pura sobre esse estado (`src/gs/selectores.ts` e arquivos `*Logica.ts`), com testes.
- **Lançamentos do WhatsApp** ficam nas tabelas `expenses` / `incomes` (`numeric(12,2)`), chave = telefone, e são importados pelo site (`api/lancamentos.ts`).
- **Login:** (a) link do WhatsApp → token → telefone (maioria); (b) e-mail via Supabase Auth, com RLS `auth.uid()` em `user_state`. Tabelas `wa_*`/`coach_*`/`expenses` com RLS ligado e **sem policy** (só o servidor com service role acessa).

**Navegação atual (5 abas):** Início · Meu mês · Ferramentas (`/plano/*`, 13 ferramentas) · Investir · Assistentes. Já é próxima das 5 áreas pedidas, mas com nomes e conteúdo diferentes.

## 2. Funcionalidades existentes (preservar)

- **Início** (`src/gs/Inicio.tsx`): "Pode gastar hoje", próximas ações (até 3, via `insights.ts`), rosca da renda, resumo da semana, banner de avisos.
- **Meu mês** (`MeuMes.tsx`): contas fixas com dar baixa, gastos do dia a dia por categoria, limites por categoria, atrasos manuais, importação do WhatsApp.
- **Planejamento (já existe quase tudo):** Dívidas (bola de neve/maior juro, painel vivo), Atrasos, Orçamento em envelopes, Calendário (contas + parcelas + fatura), Cartão (limite, fatura, parcelados, faturas futuras), Empréstimos, Parcelado vs à vista, Posso comprar isso, Assinaturas, Reserva, Dinheiro extra, Viver de renda.
- **Onboarding** (`Onboarding.tsx`): hoje só pergunta a renda (+ dia do salário).
- **Saúde financeira** (`saude.ts`, nota 0–100), **missões/selos**, **assistentes** (lembretes configuráveis), **avisos**.
- **IA já integrada:** `api/conselheiro.ts` (conversa livre, limite diário, 503 sem chave), `api/investimentos/chat.ts`, `api/fatura.ts` (leitura de fatura), `server/whatsapp/smart.ts`. Sem `ANTHROPIC_API_KEY` tudo degrada para o modo roteirizado.
- **Segurança já presente:** token hash no weblink com TTL, RLS ligado, validação de payload/tamanho nas APIs, comparação em tempo constante no admin, "Apagar tudo" (LGPD), soft delete com desfazer.

## 3. Problemas encontrados

**Regras financeiras (prioridade máxima — a spec exige confiança):**
1. **"Pode gastar hoje" é uma estimativa de orçamento, não um saldo.** Usa `renda − fixos − parcelas − reserva − atraso − gastos` (`selectores.ts`). Não existe "saldo bancário conhecido" nem distinção *confirmado × estimado* na tela. A renda é a declarada, mesmo antes de o salário cair. A tela não explica o cálculo e não avisa quando os dados estão incompletos.
2. **Cartão fora da conta.** `compromissosDoMes` não inclui fatura do cartão nem parcelados (`Cartao.usado/parcelados` ficam separados de `lancamentos`). Risco de dupla contagem se a pessoa anotar a compra no cartão como gasto *e* a fatura, ou de subcontagem se não anotar. **Precisa de regra única documentada** (proposta na seção 6).
3. **Dinheiro em `number` (float JS) dentro de JSON**, com `arred()` manual. O banco usa `numeric(12,2)` (ok), mas o estado do app não. Aceitável se tudo passar por `arred`; migrar para centavos inteiros seria estrutural → **não recomendo agora**; em vez disso, testes de propriedade nos cálculos.
4. **Modelo de lançamento pobre:** `Lancamento` (cliente) não tem tipo receita/despesa, conta, forma de pagamento, recorrência, estorno, transferência nem pagamento parcial. Receita no cliente é essencialmente `config.renda` (+ `incomes` do servidor). Não há contas bancárias nem saldo por conta.
5. **Pagar conta × lançamento:** hoje `GastoFixo.pagamentos[mes]` é separado de `lancamentos`, o que evita duplicidade por construção — mas por isso o histórico de movimentações não mostra contas pagas. A regra precisa ficar explícita antes de unificar a tela "Meu dinheiro".
6. Fuso: lógica de data espalhada (`gs/datas.ts`, `coachChat/months.ts`, `api/*` usando UTC-3 fixo e `toISOString().slice(0,10)` em `conselheiro.ts` = dia em UTC). Consolidar.

**Segurança / arquitetura:**
7. **Autorização por bearer token → telefone, com service role no servidor.** O isolamento depende 100% de cada handler filtrar por `phone`. Não há teste de isolamento entre usuários nas APIs. Risco médio; mitigar com testes e um helper único de acesso por dono.
8. `api/conselheiro.ts` envia ao modelo um `context` **montado pelo navegador** (até 4 KB). Isso é um problema duplo para o Coach: o cliente pode forjar números (a IA "aceita" dados falsos) e o prompt deixa de ser auditável. O Coach 2.0 deve **montar o contexto no servidor** a partir do estado salvo, só com os campos necessários (minimização de dados).
9. Estado inteiro enviado por `PUT /api/painel` até 500 KB, *last-write-wins* (sem versão/ETag): dois dispositivos podem sobrescrever dados.
10. Dois "motores" de chat/coach paralelos (`src/chat/*` e `src/coachChat/*`) + 44 arquivos com nomes de personagens antigos sem rota (Dabasir, Bansir, Arkad, Nomasir, Sharru, Mathon, Rodan). Dívida técnica e risco jurídico (já anotado em `PROGRESS.md`). `api/conselheiro.ts` ainda usa as personas antigas.
11. CSS em várias camadas (`site.css` 1,8 mil linhas legado + `app.css` + `gs.css` + `ouro*.css` + `tokens.css`): identidade inconsistente e difícil de manter.
12. `supabase/coach.sql` e `fundacao.sql` seguem sem rodar em produção (decisão do dono): partes do app dependem de tabelas que podem não existir; os handlers já retornam 503 nesse caso.

## 4. Problemas de experiência do usuário

- Início não responde às 8 perguntas da spec: falta saldo/disponível/reservado/pendentes explicados, orientação única do coach, metas, estados (endividado / organizado / sem dados) e "como foi calculado".
- "Ferramentas" é uma lista de 13 telas independentes: a pessoa precisa saber o que procurar. Falta um caminho guiado ("sua missão de hoje").
- Registrar gasto: existem `AnotarSheet` / `Registrar` / `PossoComprarChat` / WhatsApp, em vários lugares. Falta **um** botão global "+ Adicionar movimentação", categorias sugeridas por descrição e atalhos dos frequentes (a categorização por texto existe em `lib/categorias.ts` e no bot; **reaproveitar**).
- Onboarding pede só renda (bom), mas não há checklist de configuração progressivo nem primeira visão financeira.
- Linguagem às vezes infantilizada ("jogo", "medalhas", "fases") — a spec pede disciplina, não gamificação infantil.
- "Assistentes" mistura lembretes configuráveis com a ideia de coach; o Coach real (IA) não tem área própria.

## 5. Oportunidades e o que precisa ser criado

**Reaproveitar (já existe, só reorganizar):** insights/próximas ações, calendário, cartão, dívidas, atrasos, orçamento, reserva, saúde, resumo da semana, categorização, avisos, API de lançamentos, conselheiro com limite diário.

**Criar:**
1. **Motor único de "dinheiro disponível"** (módulo puro + doc + testes) com níveis de confiança e explicação.
2. Modelo de movimentação enriquecido (tipo, conta, forma de pagamento, recorrência, vínculo com conta/fatura) — **só aditivo**.
3. Início "Meu dia financeiro" com estados adaptativos e missão do dia.
4. Botão global de adicionar movimentação + atalhos + sugestão de categoria.
5. Área **Evolução** (receita × despesa, categorias, fixo × variável, planejado × realizado, comparações honestas com mínimo de dados).
6. Metas financeiras (hoje só reserva e agentes "juntar"): entidade `Meta` simples.
7. **Coach** com contexto montado no servidor, recomendações proativas explicáveis e limite de notificações.
8. Checklist de configuração progressiva e preferências de notificação.
9. Design system unificado (tokens + componentes).

**Remover/simplificar** (só com sua autorização, depois de mapear dependências): código dos personagens antigos sem rota; telas de ferramenta duplicadas pelo novo Início.

## 6. Decisões de arquitetura propostas (para aprovação)

**D1. Manter o modelo "estado JSON + tabelas de lançamentos"; não migrar para tabelas por usuário.** A razão já documentada em `spec-v2.md` continua válida (maioria entra pelo WhatsApp, sem `auth.uid()`). Mudanças são aditivas, com `migrar()` versionado.

**D2. Regra do "dinheiro disponível" (a documentar em `docs/regras-financeiras.md` na Fase 2):**
- *Confirmado* = o que a pessoa registrou (saldo informado, receitas recebidas, despesas pagas).
- *Estimado* = renda declarada ainda não recebida, médias de gasto, contas futuras.
- `disponível_no_mês = (saldo_ou_renda_recebida) − pendentes_do_mês − reserva_combinada − atraso − faturas_a_pagar`; `por_dia = max(0, disponível) / dias_restantes`.
- Cada parcela vem com selo **confirmado/estimado**; sem renda ou sem contas, a tela diz "dados incompletos" e o que falta.
- **Cartão:** compra no cartão = gasto na *data da compra* (categoria normal); a **fatura paga não é despesa** (é liquidação do passivo). Fatura em aberto entra como compromisso só pelo que **ainda não foi lançado** como gasto. Parcelas futuras entram nos meses em que caem.
- **Conta fixa paga:** `pagamentos[mes]` é a fonte; a movimentação exibida é *derivada* dele, nunca um segundo registro.
- Dinheiro como `arred(x, 2)` em um único lugar; testes de propriedade (soma de partes = total, pagar não altera o disponível duas vezes).

**D3. Coach = camada fina sobre o que existe.** Reutiliza `ANTHROPIC_API_KEY`/`api/conselheiro.ts` (renomeado/refeito em `api/coach.ts` v2, sem personagens). Contexto sempre montado no servidor (resumo numérico mínimo, sem nome/telefone), instrução de nunca inventar números e de perguntar quando faltar dado, limite diário mantido. **Sem chave: o Coach mostra só as recomendações calculadas por regras (insights) e avisa que a conversa não está ativada — sem respostas fixas disfarçadas de IA.** Recomendações proativas são regras determinísticas explicáveis (não exigem IA).

**D4. Navegação-alvo (5 áreas, mesmas rotas antigas como alias):** Início · Meu dinheiro (era Meu mês) · Planejamento (era Ferramentas/plano) · Evolução (nova) · Coach (era Assistentes + conversa). **Investir** vira item secundário dentro de Planejamento (hoje ocupa uma das 5 abas e tem dados de mercado; não faz parte do pedido — decisão sua).

**D5. Design system:** consolidar em `tokens.css` + componentes `src/components/ui`. Paleta: marrom escuro, dourado suave, bege, branco, verde/vermelho/âmbar funcionais. Aposentar camadas CSS legadas só depois de migrar as telas.

## 7. Riscos técnicos

| Risco | Mitigação |
|---|---|
| Mudar a fórmula do "pode gastar" muda números que o usuário já vê | Testes que travam os casos atuais; mostrar "como foi calculado"; mudança comunicada |
| Estado JSON único: migração errada corrompe dados | `migrar()` aditivo + backup antes de migrar + testes de migração; nenhuma migration destrutiva |
| Last-write-wins entre dispositivos | Adicionar versão/`updatedAt` no PUT (compare-and-swap) |
| Isolamento entre usuários depende de cada handler | Helper único + testes por endpoint; revisão de segurança na Fase 10 |
| Contexto do Coach vindo do cliente | Montar no servidor (D3) |
| SQL pendentes (`coach.sql`, `fundacao.sql`) | Confirmar com o dono quando rodar; código segue tolerante |
| Remoção do código antigo bloqueada no ambiente | Fazer com sua autorização, por PR separado |
| Escopo (123 PRs de ferramentas) | Reorganizar antes de criar; uma fase por vez com validação |

## 8. Plano de implementação

Cada fase termina com: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` verdes + atualização desta seção.

- **Fase 2 — Experiência e arquitetura:** `docs/regras-financeiras.md` (D2), mapa de telas e fluxos, tabela de rotas (aliases), inventário de componentes reutilizáveis. Sem UI.
- **Fase 3 — Design system:** tokens, botão/card/campo/modal/alerta/estado vazio/loading/toast padronizados; documentar em `docs/design-system.md` curto.
- **Fase 4 — Início:** motor de disponível (puro + testes) → tela com saudação, resumo (4–6 indicadores com explicação), "Quanto posso gastar hoje" clicável com o cálculo, orientação do coach (regras), próximas ações com "Resolver agora", resumo de gastos, metas, estados adaptativos, missão do dia.
- **Fase 5 — Meu dinheiro:** "+ Adicionar movimentação" global, edição/exclusão com confirmação+desfazer (já existe parte), busca, filtros, categoria sugerida, atalhos, receita × despesa, vínculo conta paga ↔ movimentação.
- **Fase 6 — Planejamento:** consolidar contas/cartões/dívidas/calendário sob uma entrada, semáforo vermelho/amarelo/verde, regra do cartão (D2).
- **Fase 7 — Evolução:** gráficos explicáveis com mínimo de dados, comparações semana/mês, planejado × realizado, metas.
- **Fase 8 — Coach:** `api/coach` v2 com contexto no servidor, recomendações proativas com teto de notificações e preferências, chat com IA quando houver chave; documentar o que falta.
- **Fase 9 — Mobile e performance:** auditoria em 360/390/768/1280 px, lazy-load de gráficos/Investir, redução de re-render e de requisições repetidas.
- **Fase 10 — Testes finais:** isolamento de usuários, fluxos de erro, matriz de requisitos, revisão de segurança, docs.

## 9. Perguntas que preciso que você decida antes da Fase 2

1. **Investir** deixa de ser uma das 5 áreas e vira parte de Planejamento? (recomendado: sim)
2. **Saldo bancário:** posso adicionar um campo opcional "saldo atual informado por você" (com data) como base do disponível, mantendo a renda declarada como alternativa estimada? (recomendado: sim)
3. **Personagens antigos:** autoriza apagar o código sem rota e remover as personas de `api/conselheiro.ts` (um PR separado)? (recomendado: sim, depois da Fase 4)
4. **Coach com IA:** a `ANTHROPIC_API_KEY` já está configurada na Vercel? Sem ela, o Coach começa só com recomendações por regras.
5. **SQL pendentes** (`fundacao.sql`, `coach.sql`): quer que eu os trate como obrigatórios no deploy da Fase 5/8?

## 10. Registro de progresso

### Fase 1 — Auditoria
Só este documento. Baseline: 501 testes passando.

### Fases 2 a 10 — Implementação (nov/2026)
**Decisões aprovadas e aplicadas:** Investir virou item de Planejamento; saldo informado opcional; código de personagens sem rota removido (62 arquivos mortos, achados por análise de alcance a partir de `src/main.tsx` e `api/*`); personas removidas de `api/conselheiro.ts`.

**Navegação nova (rotas antigas continuam como alias):** Início `/` · Meu dinheiro `/mes` · Planejar `/plano` (inclui Investir) · Evolução `/evolucao` · Coach `/coach` (Assistentes/lembretes seguem em `/assistentes`, ligado pelo Coach).

**Entregue**
- **Regra única do disponível** (`selectores.ts`, `docs/regras-financeiras.md`): modos saldo/renda/incompleto, selo confirmado × estimado, fatura aberta do cartão como compromisso, receitas (`salario` confirma renda; `extra` soma), "Como calculei" com cada linha. 12 testes.
- **Início "Meu dia financeiro"** (`Inicio.tsx`): saudação por horário e situação (sem dados / endividado / atenção / organizado, que reordena os blocos), "pode gastar hoje" clicável, 6 indicadores com explicação, orientação do coach com "Por que estou vendo isso?", missão do dia, próximas ações, para onde vai o dinheiro, metas, checklist de configuração.
- **Meu dinheiro:** botão global "+ Adicionar movimentação" (FAB no celular, botão no topo no PC) com despesa/receita, categoria sugerida pela descrição (Mercado, Netflix→Assinaturas, Farmácia→Saúde…), atalhos dos gastos frequentes, forma de pagamento, editar/excluir com confirmação e desfazer; aba **Histórico** com busca e filtros; conta paga derivada (sem duplicar).
- **Planejamento:** semáforo de prioridades (contas, fatura, parcelas) no topo; Investir entra aqui.
- **Evolução:** receitas × despesas, categorias, fixo × variável, planejado × realizado (só com limites definidos pela pessoa), dívidas, patrimônio, metas, frases comparativas que só aparecem com dados suficientes.
- **Metas** (nova entidade): criar, guardar (sai do disponível, não infla a reserva), excluir com desfazer.
- **Coach:** recomendações por regras, explicáveis e filtráveis (preferências de aviso) funcionam sem IA. Conversa com IA em `api/conselheiro.ts` v2: contexto **montado no servidor** (`server/coachContexto.ts`, sem nome/telefone/e-mail/descrições), login por link do WhatsApp **ou e-mail**, limite diário, `GET` informa se está ativa. Sem chave, a tela diz isso (nada simulado).
- **Onboarding em 5 passos pulaveis** (renda, despesas fixas, dívidas, cartão, objetivo) + primeira visão (estimativa) + checklist no Início.
- **Performance:** telas de ferramentas, Evolução e Coach com carregamento sob demanda (bundle principal 957 kB → 780 kB).

**Arquivos principais:** `src/gs/{selectores,coachRegras,evolucaoLogica,movimentos,prioridades,sugestoes}.ts` (puros, testados), `src/gs/{Inicio,AdicionarMov,Historico,Evolucao,Coach,Metas,ComoCalculei,Checklist,Onboarding,Plano,MeuMes}.tsx`, `src/gs/gs2.css`, `server/coachContexto.ts`, `api/conselheiro.ts`, `src/components/AppShell.tsx`, `src/App.tsx`, `docs/regras-financeiras.md`.

**Testes (finais):** 37 arquivos, 315 testes, todos passando; `typecheck`, `typecheck:server`, `lint` (0 erros), `build` verdes. A contagem caiu de 501 para 315 porque os ~220 testes de código morto removido saíram junto; os novos cobrem disponível, coach por regras, evolução, movimentos, prioridades, sugestões, migração aditiva e contexto do coach. Fluxo ponta a ponta no navegador (Playwright, 390 px): onboarding → primeira visão → adicionar despesa e receita → histórico → excluir com confirmação → criar meta e guardar → Coach, sem erros de página; sem rolagem horizontal em Início, Meu dinheiro, Planejar, Evolução e Coach (390 e 1280 px).

### Pendências e limites (honestos)
1. **Cartão:** não há ainda fechamento/corte automático da fatura nem visão de fatura por mês no calendário além do que já existia; a regra de não duplicar está feita, o "fechar fatura" é manual como antes.
2. **Concorrência entre dispositivos** (last-write-wins no `PUT /api/painel`): não alterado (risco 9). Proposta: `updatedAt` como condição de gravação. Mudança de sincronização pede cuidado e testes próprios.
3. **Isolamento entre usuários:** coberto por desenho (todo handler filtra por telefone/usuário do token) e pelo teste do contexto do coach, mas **sem teste automatizado por endpoint** (exige simular o Supabase). Recomendado antes de abrir para muita gente.
4. **Recorrência de movimentações, transferências entre contas, estornos e contas bancárias separadas:** não implementados (o modelo atual é "conta fixa" + gastos). Receita recorrente é só a renda mensal informada.
5. **Notificações:** preferências por tipo (vencimento/orçamento/coach) valem dentro do app. Lembretes por WhatsApp seguem as regras antigas (`api/lembretes`, `api/resumo`) e dependem dos modelos aprovados pela Meta (ver `PROGRESS.md`).
6. **Conversa com IA:** só funciona com `ANTHROPIC_API_KEY` na Vercel (modelo em `CONSELHEIRO_AI_MODEL`, limite em `CONSELHEIRO_DAILY_LIMIT`). O contexto inclui nomes das contas e dívidas que a pessoa cadastrou.
7. **SQL pendentes** (`supabase/fundacao.sql`, `coach.sql`): seguem como antes; nada novo depende deles. Nenhuma migration nova.
8. **Nomes antigos** ainda existem em `src/agents.ts`, `src/missoes.ts`, `src/lib/financas.ts`, `api/coach.ts`/`server/coach.ts`, `src/coachChat/months.ts` e no mapa de migração (`ID_ANTIGO`), que precisam existir para dados antigos e para o WhatsApp. Limpeza adicional merece um PR próprio.
9. Gráficos próprios em SVG (sem biblioteca); acessíveis por rótulo, sem tabela alternativa.

---

## 11. Redesign UX/UI "Prompt Master" — plano proposto (aguardando aprovação)

**Diagnóstico (evidências no código, nov/2026)**
1. Desktop desperdiça espaço: `.gs-principal { max-width: 720px }` e navegação só em abas no topo (sem lateral).
2. Três camadas de CSS (`site.css`/`app.css`/`ouro.css` legados + `gs.css` + `gs2.css`, ~4,2 mil linhas), 25 usos de `!important`/peso 900 em títulos; a identidade pedida (sutil, grafite, dourado suave) briga com o herói preto radial e o título extrabold.
3. Início tem ~10 blocos em sequência (coach, missão, resumo, metas, ações, gastos, checklist, rosca): é informação demais e coach/missão repetem a mesma coisa.
4. Faltam no Início: ocultar valores, 4 KPIs fixos (saldo, receitas, despesas, economia), gráfico com troca de período, "contas próximas" resumidas, ações rápidas (despesa, receita, transferir, meta, relatórios), data e sino de avisos.
5. Lançamentos: um único formulário com tudo visível; não há passos, nem conta, transferência, duplicar, filtro por período livre/conta nem ordenação. `Lancamento` não tem `contaId` (não existe modelo de contas).
6. Metas moram em Evolução; não há metas concluídas, modelos (reserva, carro, viagem…) nem ícones. Orçamento por categoria existe em `/plano/orcamento`, mas não é a visão principal do Planejamento.
7. Evolução cobre boa parte dos relatórios, mas com período fixo (6 meses), sem comparação escolhida e sem economia acumulada.
8. Coach: histórico de conversa só em memória; sem cards de insight dentro do chat.
9. Navegação atual (Início · Meu dinheiro · Planejar · Evolução · Coach) difere da pedida (Início · Lançamentos · Planejamento · Relatórios · Coach); Contas fixas, Calendário, Guias, Assistentes e Dados não têm menu secundário claro.
10. Não medido ainda: Lighthouse, axe, contraste, Safari/Firefox. Bundle principal 780 kB.
Limite: o site público foi usado só como referência (a landing é o `Landing.tsx` do repositório); nada de produção foi alterado.

**Plano (cada fase fecha com testes + capturas 390/768/1280 px)**
- F1 Design system: tokens (cor, tipo, espaço, raio, sombra) em `tokens.css`; componentes base (Card, Botão, Campo, Seleção, Modal, Alerta, Vazio, Skeleton, Tooltip); desativar camadas legadas só depois de migrar telas. Sem mudar regra financeira.
- F2 Navegação: lateral no desktop e barra inferior no celular (Início · Lançamentos · Planejamento · Relatórios · Coach) + menu "Mais" (Contas fixas, Calendário, Ferramentas, Investir, Assistentes, Guias, Meus dados). Rotas antigas viram alias.
- F3 Dashboard: cabeçalho (saudação, data, sino), 4 KPIs com ocultar/mostrar, gráfico com período, contas próximas, categorias, ações rápidas, insights (reaproveitando `coachRegras`). Menos blocos, sem repetição.
- F4 Lançamentos: passos valor → tipo → categoria (ícones) → conta → data → descrição; avançados recolhidos; duplicar; histórico com período, categoria, tipo, conta e ordenação.
- F5 Planejamento: orçamento por categoria com 3 estados; metas com modelos, prazos, concluídas.
- F6 Coach: cards de insight, ações, sugestões, histórico local do aparelho.
- F7 Relatórios: período livre, comparação, economia acumulada, progresso das metas.
- F8 Revisão: acessibilidade, performance, navegadores, fluxos financeiros, testes.

**Riscos:** trocar o layout afeta as 13 ferramentas (por isso F1 é por tokens, não por tela); contas/transferências exigem campo novo aditivo (`contas`, `Lancamento.contaId`) e uma regra clara para o saldo informado; renomear rotas exige alias; histórico do Coach sem tabela nova = só no aparelho.

### Redesign UX/UI 2.0 — execução (nov/2026)
**Status:** Fases 1 a 8 concluídas, com as decisões aprovadas (contas opcionais e transferência neutra; menu Mais; histórico do Coach só no aparelho; cartão claro em vez do preto).
- **F1 Design system:** tokens `--ds-*` e componentes (`gs-badge`, `gs-skeleton`, `gs-icone-btn`, categorias com ícone, Kpi) em `src/gs/gs2.css`; cartão de destaque claro com filete dourado suave; títulos mais leves (650); áreas de toque de 44 px.
- **F2 Navegação:** lateral no desktop (≥900 px) e barra inferior no celular com Início · Lançamentos · Planejamento · Relatórios · Coach; "Mais" (menu agrupado) no celular e na lateral; sino com contagem de avisos; data no topo. Rotas novas `/lancamentos`, `/relatorios`; as antigas (`/mes`, `/evolucao`, `/assistentes`) continuam.
- **F3 Dashboard:** saudação, ocultar/mostrar valores (preferência do aparelho), "pode gastar hoje" explicado, 4 indicadores com dica, ações rápidas (despesa, receita, transferir, meta, relatórios), gráfico 3/6/12 meses com comparação, contas próximas com "Pagar", categorias com %, insights do coach, checklist.
- **F4 Lançamentos:** adicionar em 3 passos (valor/tipo → categoria com ícones → conta e data) para despesa, receita e transferência; "mais opções" recolhido; editar, duplicar, excluir com confirmação; histórico com período (mês, 7 dias, 30 dias, ano), tipo, categoria, conta e ordenação; gerenciar contas. Dado novo, só aditivo: `contas`, `transferencias`, `contaId`.
- **F5 Planejamento:** orçamento por categoria com 3 estados, metas com modelos, prazo com valor mensal sugerido e metas concluídas.
- **F6 Coach:** histórico da conversa no aparelho, "Nova conversa".
- **F7 Relatórios:** período 3/6/12 meses, comparação mês × mês, economia acumulada.
- **F8 Revisão:** 320 testes, `typecheck`, `typecheck:server`, `lint` (0 erros), `build`. Playwright em 390 e 1280 px: sem erros de página nem rolagem horizontal; fluxo completo (onboarding, despesa com categoria sugerida, receita, transferência, duplicar, excluir, ocultar valores, meta) passou.
- **Não feito / limites:** sem axe/Lighthouse e sem Safari/Firefox (só Chromium); switches do Coach têm área de toque ampliada por CSS, mas medem 52×32; saldo por conta não existe (contas só organizam); o formulário antigo "Dia a dia" continua na aba própria; bundle principal 798 kB.
