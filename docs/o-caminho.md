# O Caminho — auditoria (Etapa 0)

Base: leitura do código em nov/2026 (`src/App.tsx`, `AppShell.tsx`, `Plano.tsx`, `src/tools.ts`, `src/gs/*`, `api/*`, `server/whatsapp/*`). Baseline: 42 arquivos de teste, 360 testes passando.

> **Aviso:** `docs/referencia/grana-seria-referencia.html` (o MVP aprovado) **não está no repositório**. O visual segue a seção 8 do prompt (cores, fontes, moeda, raios). Quando o arquivo for enviado, a comparação tela a tela entra como ajuste.

## 1. A causa do "R$ 0,00 × Economia R$ 10.000"

- **"Pode gastar hoje"** vem de `detalheDisponivel` (`selectores.ts`): renda (ou saldo informado) − contas fixas − parcelas − fatura aberta − reserva combinada − atraso − gastos anotados. Com saldo informado baixo, ou com compromissos maiores que a renda, o resultado é ≤ 0 e a tela mostra R$ 0,00 por dia. Está certo.
- **"Economia"** é calculada **dentro da tela** (`Inicio.tsx`, linhas 58–63): `receitas − despesas`, onde `receitas` cai para `config.renda` quando nada foi registrado e `despesas` soma **só** o que já foi anotado ou pago. No começo do mês, sem nada pago, dá "renda inteira = 100% de economia".
- Ou seja: são duas réguas. Uma desconta o que ainda vai sair; a outra só olha o que já saiu, e ainda usa uma renda que pode nem ter caído. A segunda quebra a regra "a tela não calcula".
- **Correção (Etapa 4):** o indicador "Economia" sai da Início. O que aparece é o "pode gastar" e "sobra prevista no mês" (`disp.livre`), ambos do mesmo seletor. Em Relatórios, a economia de meses **fechados** continua (ali ela é fato, não previsão).

## 2. De onde vem cada número da Início atual

| Bloco | Fonte | Situação |
|---|---|---|
| Pode gastar hoje, livres no mês, dias | `detalheDisponivel` | certo |
| Receitas | `receitasRecebidas` ou `config.renda` | cálculo na tela (sai) |
| Despesas | `totalVariaveis + fixosPagos` | cálculo na tela (sai) |
| Economia | receitas − despesas, na tela | **errado** (seção 1) |
| Orientação | `recomendacoes` (`coachRegras` + `coachExtras`) | certo, mas repete "Contas próximas" |
| Contas próximas | `prioridades` | certo |
| Maiores gastos | `gastosPorCategoria` | certo |
| Revisão da semana | `resumoDaSemana` | certo |
| Plano de saída | `planoDeSaida`, `passoDoDia` | certo |

## 3. Inventário final (confirmado no código)

A tabela 3.2 do prompt confere. **Achados a mais**, que entram no registro:

| Achado | Onde | Área |
|---|---|---|
| Amortizar (pagar parcelas adiantadas) | `Amortizacao.tsx`, `amortizacao.ts`, dentro de Dívidas | Pagar |
| Outros cartões (até 6) e "Todas as faturas" | `CartaoControle.tsx`, `outrosCartoes` | Pagar |
| Simular compra no cartão | `CartaoControle.tsx` | Pagar |
| Saldo informado | `SaldoSheet` na Início, `informarSaldo` | Caminho / Perfil |
| Adiar aviso (2 dias) | `adiarAviso` | Caminho |
| Minha conta (login por e-mail) | `/conta`, `Account.tsx` | Perfil |
| Painel do dono | `/admin`, `api/admin.ts` | fora do app (mantido) |
| Tema escuro | `tema.ts` | Perfil |
| Agentes personalizados (juntar, lembrar, método) | `CriarAgente.tsx`, `agentesCustom.ts` | Perfil → Lembretes |
| Conversa de investimentos | `api/investimentos/chat.ts`, `investir/Conversar.tsx` | Guardar → Investir |
| Mercado ao vivo | `api/mercado.ts`, `investir/Mercado.tsx` | Guardar → Investir |
| Continuar no WhatsApp | `api/continuar.ts`, `ContinueWhatsApp.tsx` | Perfil → WhatsApp |
| Bot: metas, ofertas, atalhos, plano, resumo, feedback, áudio | `server/whatsapp/{goals,offers,shortcuts,planbot,summary,feedback}.ts`, `server/transcribe.ts` | Perfil → WhatsApp |
| Crons: lembretes e resumo | `api/lembretes.ts`, `api/resumo.ts` | Perfil → Lembretes |

Rotas hoje: 5 abas (`NAV`), 14 itens no "Mais" (`MAIS`), 13 ferramentas em `/plano/*` + `/investir` + `/recuperacao`, 15 slugs em `/ferramentas/:slug`, e redirecionamentos antigos (`/missoes`, `/conselheiros`, `/agentes`, `/perfil`, `/selos`, `/painel#…`).

## 4. Fusões das ferramentas antigas (`/ferramentas/:slug`)

Critério: a rota antiga **continua abrindo**. Onde a nova faz tudo o que a antiga fazia com os dados já cadastrados, a rota antiga leva para a nova. Onde a antiga tem algo que a nova não tem, ela fica como está e ganha lugar no registro.

| Slug antigo | Decisão | Vai para |
|---|---|---|
| `minhas-contas` | fusão | Contas fixas (`/pagar`) |
| `quitar-dividas` | fusão | Quitar dívidas (`/plano/dividas`) |
| `comparador-de-emprestimo` | fusão | Empréstimo (`/plano/emprestimos`) |
| `vale-a-pena-comprar` | fusão | Posso comprar isso? (`/plano/comprar`) |
| `decimo-terceiro` | fusão | Dinheiro extra (`/plano/extras`) |
| `caca-vazamentos` | fusão | Gastos escondidos (`/plano/assinaturas`) |
| `calculadora-de-meta` | fusão | Metas (`/guardar#metas`) |
| `leitor-de-fatura` | fica | Pagar → Importar fatura (a leitura por IA é diferente da leitura no navegador) |
| `meu-plano` | fica | Caminho (o plano mês a mês do diagnóstico) |
| `seus-direitos` | fica | Pagar → "Sair do vermelho" |
| `check-in-mensal` | fica | Caminho → acompanhamento |
| `placar-pai-rico` | fica | Guardar → "Fazer render" |
| `simulador-longo-prazo` | fica | Guardar → "Fazer render" |
| `frase-do-dia` | fica | Caminho (citação) |
| `meus-selos` | fica | Caminho → selos |

**Aplicado na Etapa 3** com a autorização geral do dono ("tudo permitido"). Reverter uma fusão é trocar uma linha em `ALIAS_FERRAMENTAS` (`App.tsx`): o componente antigo continua no repositório.

## 5. As datas dos marcos

| # | Marco | Feito quando | Data prevista | O que falta hoje |
|---|---|---|---|---|
| 1 | Em dia com as contas | sem atraso aberto (`atrasosAbertos`) | `situacaoAtrasos().plano.emDiaEm` | nada; sem valor mensal definido e sem histórico, a data é nula e o app pede "quanto sobra por mês" |
| 2 | Livre das dívidas caras | nenhuma dívida aberta com juro ≥ `JURO_CARO` (1,5% ao mês) | maior `quitaEm` das caras em `simular()` | o conceito "cara" só existia em `extrasLogica`; reaproveitado |
| 3 | Livre de todas as dívidas | `totalDividas = 0` | `simular().dataFinal` | sem `planoDividas`, usa `pagamentoSugerido` e avisa na premissa |
| 4 | Reserva completa | `patrimonioGuardado ≥ reservaMeta` | `mesesParaMeta(falta, planoMensalReserva)` | começa a contar depois do marco anterior (o "pague-se primeiro" pausa com atraso) |
| 5 | Objetivo | meta batida | prazo da meta, ou `falta ÷ valor mensal` | `config.objetivo` é só texto; sem meta com valor, o marco pede para criar a meta |
| 6 | Dinheiro trabalhando | aporte com origem `investimento` ou plano de aporte definido | logo após a reserva | não havia marca de "primeiro investimento"; usa os dois sinais acima |
| 7 | Viver de renda | patrimônio ≥ `patrimonioParaRenda` | `mesesAteMeta` | horizonte longo: mostra o ano, não o mês |

Os marcos correm **em sequência**: o dinheiro que hoje vai para o atraso passa para a dívida, depois para a reserva. É a mesma cascata de `rumoDoExtra` e de `investir/calculos.caminhoInvestir`.

`simularImpacto(estado, mudanca)` refaz o cálculo com o estado alterado: `compra` (tira da sobra ou vira parcela), `corte` (soma ao valor mensal), `extra` (aplica a cascata), `parcela` (compromisso novo por N meses).

## 6. O que está escondido e onde passa a aparecer

| Hoje | Passa a aparecer |
|---|---|
| Menu "Mais" (14 itens) | grade de cada área + Perfil |
| 13 ferramentas em lista dentro de Planejamento | Pagar, Gastos e Guardar, com a pergunta que resolvem e status vivo |
| 15 ferramentas antigas sem link (iam para `/conselheiros` → Coach) | registro único, busca e "Todas as ferramentas" |
| WhatsApp (texto, foto, áudio, resumos) | onboarding, Perfil e selo "via WhatsApp" nos lançamentos |
| Importar fatura (PDF, CSV, foto, texto) dentro do Cartão | atalho em Pagar |
| "Como calculei" | já no cartão do "pode gastar" |
| Mensagem pronta para negociar | Coach (fluxo 2) e Pagar |
| Festa de quitação | festa de cada marco |
| Saúde financeira 0–100 | Perfil (não volta para a tela inicial: é nota sem ação) |
| Tema escuro | Perfil |

## 7. Teste de utilidade (antes)

(a) pergunta real · (b) resposta em frase com número e data · (c) 1 botão · (d) liga ao Caminho · (e) usa dados cadastrados

| Ferramenta | a | b | c | d | e | Melhoria |
|---|---|---|---|---|---|---|
| Contas fixas | sim | sim | sim | não | sim | alimenta o marco 1 e os passos |
| Sair do atraso | sim | sim | sim | não | sim | data vira o marco 1 |
| Quitar dívidas | sim | sim | sim | não | sim | data vira os marcos 2 e 3 |
| Empréstimo | sim | não | não | não | não | veredito + impacto na data |
| Cartão | sim | sim | sim | não | sim | fatura vira passo |
| Importar fatura | sim | sim | sim | não | sim | atalho em Pagar |
| Calendário | sim | sim | não | não | sim | botão "pagar a próxima" |
| Modo recuperação | sim | sim | sim | não | sim | usa o mesmo Caminho |
| Lançamentos | sim | não | sim | não | sim | topo com o número da área |
| Orçamento | sim | sim | sim | não | sim | limite vira passo |
| Onde cortar | sim | não | não | não | sim | "cortando X você chega N meses antes" |
| Gastos escondidos | sim | sim | sim | não | sim | impacto do cancelamento |
| Posso comprar? | sim | sim | sim | não | sim | impacto no destino |
| À vista ou parcelado | sim | sim | não | não | não | impacto + botão |
| Relatórios | sim | não | não | não | sim | frase-resumo e 1 ação |
| Reserva | sim | sim | sim | não | sim | data vira o marco 4 |
| Metas | sim | sim | sim | não | sim | marco 5 |
| Dinheiro extra | sim | sim | sim | não | sim | "N meses antes" |
| Investir | sim | sim | sim | parcial | sim | marco 6 |
| Viver de renda | sim | sim | não | não | sim | marco 7 + botão |
| Coach | sim | não | sim | não | sim | fluxos com números das funções |
| Antigas que ficam | sim | varia | varia | não | parcial | lugar no registro; revisão na Etapa 6 |

Nenhuma ferramenta tinha o item (d). É exatamente o que o dono descreveu.

## 8. Plano de arquivos

**Novos (puros, com teste):** `src/gs/caminho.ts`, `src/gs/passos.ts`, `src/gs/registroFerramentas.ts`, `src/gs/buscaFerramentas.ts`, `src/gs/voltou.ts` (Bem-vindo de volta), `src/gs/coachFluxos.ts`.

**Novos (tela):** `src/gs/caminho.css` (tokens e componentes do visual novo), `src/gs/base/*` (Card, CartaoDestino, LinhaDoTempo, Marco/Selo, ToolTile, ToolHeader, Segmented, ListItem, StatusDot, ProgressRing, NumPad, Citacao…), `src/gs/TelaCaminho.tsx`, `AreaPagar.tsx`, `AreaGastos.tsx`, `AreaGuardar.tsx`, `Perfil.tsx`, `TodasFerramentas.tsx`, `Resolver.tsx` (a busca), `Impacto.tsx` (cartão de impacto + "Colocar no meu caminho"), `DevUI.tsx`.

**Alterados:** `tipos.ts` + `migracao.ts` (campo aditivo `caminho`: passos, ocultos, última visita, último passo, marcos comemorados, etapas salvas), `acoes.ts`, `AppShell.tsx` (navegação), `App.tsx` (rotas e aliases), `Moeda.tsx` (3D), `tokens.css`, as telas das ferramentas (bloco de impacto), `Coach.tsx`, `api/conselheiro.ts` + `server/coachTools.ts` (tool use no servidor), `Planos.tsx`, `Onboarding.tsx`.

**Mantidos como estão:** `selectores.ts` e todas as `*Logica.ts` (só leitura), `server/whatsapp/*`, `supabase/*` (nenhuma migration), `src/config.ts` (preços e links).

## 9. Decisões tomadas sem perguntar (para o dono rever)

1. Fusões da seção 4.
2. "Dívida cara" = juro a partir de 1,5% ao mês (o mesmo corte que o Dinheiro extra já usava).
3. O Coach continua **sem nome de personagem**.
4. O indicador "Economia" sai da tela inicial (seção 1).
5. Tema escuro continua existindo, no Perfil.

## 10. Teste de utilidade (depois, Etapa 9)

(a) pergunta real · (b) resposta em frase com número e data · (c) 1 botão · (d) liga ao Caminho ou ao plano do mês · (e) usa os dados já cadastrados

| Ferramenta | a | b | c | d | e | Como ficou |
|---|---|---|---|---|---|---|
| Contas fixas | sim | sim | sim | sim | sim | resposta no topo ("Falta pagar R$ X… a primeira é…") com Pagar e Colocar no caminho; alimenta o marco 1 e os passos |
| Calendário | sim | sim | sim | sim | sim | "Ainda vencem R$ X; o próximo é…, e sobram R$ Y" |
| Sair do atraso | sim | sim | sim | sim | sim | data de ficar em dia = marco 1; "Continuar (passo N de 3)" |
| Anotar atrasada | sim | sim | sim | sim | sim | entra no plano de atrasos |
| Quitar dívidas | sim | sim | sim | sim | sim | "Você fica livre em…" = marcos 2 e 3; Continuar passo 2/3 e 3/3 |
| Empréstimo | sim | sim | sim | sim | sim | custo real + impacto na data + Colocar no caminho |
| Cartão | sim | sim | sim | sim | sim | "Pague R$ X inteiros até dia Y" + passo |
| Importar fatura | sim | sim | sim | sim | sim | abre direto; atualiza fatura e parcelas |
| Modo recuperação | sim | sim | sim | sim | sim | "Você deve R$ X e fica em dia em…"; etapa do raio-X salva |
| Lançamentos | sim | sim | sim | sim | sim | "Você gastou R$ X, mais em…; ainda dá R$ Y por dia" |
| Orçamento | sim | sim | sim | sim | sim | categoria que passou + passo |
| Onde cortar | sim | sim | sim | sim | sim | "Cortando R$ X você chega N meses antes" |
| Gastos escondidos | sim | sim | sim | sim | sim | total por ano + impacto de cancelar |
| Posso comprar? | sim | sim | sim | sim | sim | horas de trabalho + impacto na data |
| À vista ou parcelado | sim | sim | sim | sim | sim | duelo + impacto da parcela |
| Relatórios | sim | sim | sim | sim | sim | "Em out sobraram R$ X, mais/menos que a sua média" |
| Reserva | sim | sim | sim | sim | sim | "Completa em…" = marco 4 |
| Metas | sim | sim | sim | sim | sim | "Você chega em… guardando R$ X" = marco 5 |
| Dinheiro extra | sim | sim | sim | sim | sim | cascata + "N meses antes" |
| Investir | sim | sim | sim | sim | sim | depois da reserva (marco 6); passo N de M |
| Viver de renda | sim | sim | sim | sim | sim | ano previsto = marco 7 |
| Coach | sim | sim | sim | sim | sim | 9 fluxos + monta o plano e libera ferramentas |
| Antigas mantidas (direitos, check-in, placar, simulador, plano do diagnóstico, selos, leitor de fatura) | sim | sim | sim | sim | sim | abrem com a resposta calculada dos dados do app no topo (`RESPOSTA_DO_SLUG`), com botão e Colocar no caminho; a tela antiga segue embaixo |
| Frase do dia | sim | não se aplica | sim | não | não | é conteúdo (citação), não cálculo |

**Mudança pedida pelo dono depois da Etapa 9:** "tem coisa que a pessoa não vai usar". O site continua com todas as ferramentas, mas **cada pessoa só vê as do plano dela**. O Coach monta o plano com 3 perguntas (o que resolver primeiro, o que não quer ver agora, um passo por vez ou o mês todo), a tela inicial mostra só os próximos 3 passos e as ferramentas do plano, e o Coach **indica e libera** outras quando a vida pede (entrou dinheiro extra → Dinheiro extra; reserva completa → Investir). As não liberadas ficam em "Todas as ferramentas" e recolhidas em cada área, com "Colocar no meu plano". Lógica em `src/gs/planoPessoal.ts` (testada).
