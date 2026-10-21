# GRANA SÉRIA — Especificação Completa v2 ("O Coach")

> Documento mestre. Leia INTEIRO antes de escrever qualquer código.
> Implemente por FASES (seção 14). Ao fim de cada fase, pare, rode o build, faça commit e me mostre o resumo.

---

## 0. REGRAS INVIOLÁVEIS

1. **NUNCA remover** páginas, rotas, componentes, tabelas ou funcionalidades existentes sem eu pedir com todas as letras. Tudo aqui é **acréscimo ou melhoria**. Se algo antigo conflitar com esta spec, **pergunte antes**.
2. **Antes de cada fase:** `git add -A && git commit -m "backup antes da fase X"`.
3. **Antes de aplicar cada fase:** liste arquivos a criar / alterar / apagar e espere meu "ok".
4. **Primeiro investigue, depois construa:** leia o código atual e o schema do Supabase. Reaproveite tabelas e componentes que já existem. Só crie tabela nova se não houver equivalente. Migrations sempre aditivas (`add column`, `create table if not exists`), nunca `drop` sem pedir.
5. **Uma fonte de verdade:** toda tela (Início, Meu mês, Plano, Agentes, Chat, futuro WhatsApp) lê e grava as MESMAS tabelas.
6. **Datas:** fuso `America/Sao_Paulo`. Nunca permitir registrar ou "fechar" mês futuro.
7. **Responsivo:** perfeito em 375px, 768px e 1280px.
8. **Não mexer na landing page** (rota pública inicial), exceto se pedido.
9. **Sem IA/API paga por enquanto.** Os chats são roteirizados (motor de roteiro, seção 5). Deixe um ponto de extensão preparado para IA no futuro.
10. Texto do app em **português do Brasil**, tom humano, curto, sem jargão financeiro. Rodapé onde houver projeção: "Estimativa com os seus números. Não é recomendação de investimento."
11. Rodar `npm run build` e corrigir todos os erros de TypeScript ao fim de cada fase.

---

## 1. VISÃO DO PRODUTO

O Grana Séria é **um coach de finanças pessoais** inspirado em *O Homem Mais Rico da Babilônia*. A pessoa não preenche planilhas: ela **conversa com mentores** (os agentes do livro), que montam **missões** curtas e acompanham o progresso dela, comemorando cada avanço.

### Os 4 pilares (toda decisão de design passa por aqui)

| Pilar | Regra prática |
|---|---|
| **Simples** | Cada tela tem UMA ação principal. Nada de muros de números. Detalhe só quando a pessoa toca. |
| **Controle total** | Tudo pode ser editado, apagado ou refeito. Apagar sempre tem "Desfazer". |
| **Vontade de fazer** | Missões curtas, progresso visível, selos, sequência, comemoração. A pessoa sente que está ganhando. |
| **Bonito** | Estética old money (verde escuro, areia, dourado), animações suaves, agentes ilustrados com personalidade. |

### Pergunta que o Início sempre responde
**"O que eu faço hoje?"**

---

## 2. OS AGENTES (MENTORES)

Os agentes JÁ existem no app (página Agentes). Esta seção define personalidade, função e roteiro de cada um. Mantenha as ilustrações atuais.

| Agente | No livro | Função no app | Princípio (selo) | Tom |
|---|---|---|---|---|
| **Arkad** | O homem mais rico da Babilônia | Reserva de emergência, "pague-se primeiro" | 1ª cura: *Comece a encher sua bolsa* | Calmo, sábio, paciente |
| **Bansir** | O construtor de carros que vivia sem sobrar nada | Contas fixas e vencimentos | 2ª cura: *Controle seus gastos* | Amigo, gente como a gente, prático |
| **Nomasir** | Filho de Arkad, aprendeu as 5 leis do ouro errando | Cortar gastos que não servem, limites por categoria | 2ª cura (parte variável) | Jovem, direto, sincero sobre os próprios erros |
| **Dabasir** | Mercador de camelos que saiu das dívidas | Quitar dívidas (método 70/20/10) | 4ª cura: *Proteja seu tesouro* | Firme, sem julgamento, já esteve no fundo |
| **Mathon** | Agiota/emprestador de ouro | Comparar empréstimos antes de assinar | 4ª cura: *Proteja seu tesouro* | Desconfiado, analítico, protetor |
| **Rodan** | Fabricante de lanças que ganhou ouro do rei | Destino do 13º, bônus e dinheiro extra | 3ª cura: *Faça seu ouro multiplicar* | Entusiasmado mas prudente |
| **Sharru Nada** | Príncipe mercador | Investir e "viver de renda" | 6ª cura: *Garanta renda futura* + 7ª: *Aumente sua capacidade de ganhar* | Ambicioso, inspirador |

### Regras gerais dos agentes
- Cada agente tem: `id`, `nome`, `titulo` (ex: "Calmo · foco em reserva"), `cor` (do card), `avatar`, `funcao`, `status` (`ativo` | `disponivel` | `em_espera`).
- **Tocar num agente ativo abre o chat com ele.** Agente disponível: tocar mostra uma prévia (o que ele faz + "Ativar") e ao ativar já abre o chat.
- Um agente "em espera" é um agente ativo cuja missão está concluída ou pausada. Mostra "Missão cumprida ✓" ou "Pausado".
- Texto do card dos agentes ativos no Início = **status real da missão** dele (ex: "Faltam R$ 1.200 pra quitar o cartão"), nunca texto genérico.
- Lembretes: escrever "Próximo lembrete: 22 out" (nunca só "Aviso: 22 out").

---

## 3. MODELO DE DADOS (Supabase)

> Investigue o schema atual primeiro. Mapeie cada entidade abaixo para a tabela existente equivalente. Só crie o que faltar. Todas as tabelas com RLS por `user_id = auth.uid()`.

### Entidades necessárias

**profiles** (provavelmente já existe)
- `renda_mensal` numeric
- `agente_principal` text
- `onboarding_concluido` bool
- `sequencia_meses` int (calculado, pode ser view)

**agentes_usuario**
- `user_id`, `agente_id`, `status` (`ativo`|`disponivel`|`em_espera`), `ativado_em`, `proximo_lembrete` date

**conversas**
- `id`, `user_id`, `agente_id`, `roteiro_id`, `status` (`em_andamento`|`concluida`|`abandonada`), `passo_atual`, `created_at`, `updated_at`

**conversa_respostas**
- `id`, `conversa_id`, `passo_id`, `valor` jsonb, `ordem` int, `created_at`
- Editar resposta = apagar respostas com `ordem` maior e regravar.

**missoes**
- `id`, `user_id`, `agente_id`, `conversa_origem_id`, `titulo`, `tipo` (`reserva`|`divida`|`gastos`|`contas`|`investir`|`extra`), `meta_valor` numeric, `valor_atual` numeric, `valor_mensal` numeric, `data_inicio` date, `data_prevista` date, `prioridade` int, `status` (`ativa`|`concluida`|`pausada`|`arquivada`), `created_at`
- Refazer plano: missão antiga vira `arquivada` SOMENTE quando a nova conversa é concluída.

**missao_passos**
- `id`, `missao_id`, `ordem`, `titulo`, `valor` numeric null, `data_alvo` date null, `concluido_em` timestamp null

**dividas**
- `id`, `user_id`, `nome`, `saldo` numeric, `parcela` numeric, `juros_mes` numeric null, `ordem_pagamento` int, `quitada_em` null

**contas_fixas** (já existe como "Gastos fixos" — reaproveitar)
- `nome`, `valor`, `dia_vencimento`, `categoria`, `pagamentos` (por mês)

**lancamentos** (já existe — reaproveitar)
- `valor` (+entrada / −saída), `categoria`, `descricao`, `data`, `origem` (`site`|`whatsapp`), `missao_id` null (quando é um aporte/pagamento ligado a uma missão)

**limites_categoria**
- `user_id`, `categoria`, `limite_mensal`

**selos_usuario**
- `user_id`, `selo_id`, `conquistado_em`

**eventos_desfazer** (opcional, pode ser só no front)
- para suportar "Desfazer" de exclusão por 5 s: preferir soft delete (`deleted_at`) + job/rotina que ignora registros com `deleted_at`.

> **Soft delete em todas as entidades do usuário** (`deleted_at timestamp null`). Todas as queries filtram `deleted_at is null`.

---

## 4. CÁLCULOS (lógica central — criar em `src/lib/financas.ts`, funções puras e testáveis)

```
custoEssencial = soma(contas_fixas.valor)
metaReserva = 6 * custoEssencial                     // arredondar para centena
sobraTeorica = renda - custoEssencial - soma(parcelas dividas)
aporteSugerido = max(10% da renda, 0)                // princípio "1/10" do livro
```

**Dívidas — método Dabasir (70/20/10), aplicado sobre o que sobra após contas fixas quando há dívida:**
- 70% para viver (gastos variáveis)
- 20% para pagar dívidas
- 10% para guardar
- Ordem de pagamento sugerida: maior juros primeiro; se juros desconhecidos, menor saldo primeiro (mostrar a escolha e deixar o usuário trocar).
- Previsão de quitação = simulação mês a mês com os 20%, rolando o valor de uma dívida quitada para a próxima.

**Prioridade das missões:** dívidas (1) → contas fixas em dia (2) → reserva (3) → gastos/limites (4) → investir (5) → extra (6).
**Investir só começa** quando reserva ≥ 100% da meta (ou o usuário forçar manualmente, com aviso).

**Quanto posso gastar hoje:**
```
disponivelMes = renda - contasFixasDoMes - aportesPlanejadosDoMes - parcelasDoMes - gastosVariaveisJaFeitos
diasRestantes = dias até fim do mês (incluindo hoje)
porDia = floor(disponivelMes / diasRestantes)   // nunca negativo; se negativo, mostrar estado "estourou" (seção 7.1)
```

**Previsão de data de uma missão:** `mesesRestantes = ceil((meta - atual) / valorMensal)`. Recalcula sempre que entra aporte, muda valor mensal ou um mês passa sem aporte.

**Coerência (usada nos chats):**
- se `|sobraInformada - sobraTeorica| > 100` → o agente pergunta pra onde vai a diferença.
- se `custoEssencial > renda` → agente avisa com calma e oferece revisar.

Escreva testes simples (vitest) para essas funções.

---

## 5. MOTOR DE CHAT ROTEIRIZADO

### Arquitetura
- `src/chat/engine.ts`: motor genérico.
- `src/chat/roteiros/*.ts`: um arquivo por roteiro.
- `src/components/chat/*`: UI.

### Estrutura de um passo
```ts
type Passo = {
  id: string
  falas: string[] | ((ctx) => string[])   // 1 a 3 balões; podem usar respostas anteriores
  resposta:
    | { tipo: 'dinheiro'; min?: number; sugestao?: (ctx) => number }
    | { tipo: 'botoes'; opcoes: { valor: string; rotulo: string }[] }
    | { tipo: 'multiplo'; opcoes: {...}[] }
    | { tipo: 'texto'; placeholder: string; max: number }
    | { tipo: 'data' }
    | { tipo: 'lista'; campos: Campo[] }   // ex: adicionar várias dívidas
    | { tipo: 'nenhuma' }                  // só fala, avança sozinho
  validar?: (valor, ctx) => string | null  // mensagem de erro dita PELO agente
  proximo: string | ((valor, ctx) => string)
  aoResponder?: (valor, ctx) => Promise<void> // grava no Supabase
}
```

### UI do chat
- Header: seta voltar, avatar, nome, título do agente, ícone **↺ Recomeçar** e menu **⋯** (Ver missão, Apagar conversa).
- Balões do agente à esquerda (fundo branco), do usuário à direita (verde escuro). Avatar do agente só no primeiro balão de cada bloco.
- Indicador "digitando…" de 500–900 ms antes de cada balão (proporcional ao tamanho do texto). Botão "pular animação" ao tocar na tela.
- Input fixo embaixo, muda conforme o tipo: teclado numérico com máscara R$, chips de botões grandes, date picker, etc. Ao lado do input de dinheiro: chips de sugestão quando houver (ex: "R$ 600 (10%)").
- **Editar resposta:** tocar num balão do usuário → "✎ Editar". Ao reenviar, remove respostas posteriores (tela + banco) e continua dali.
- **Recomeçar:** modal "Recomeçar a conversa? Suas respostas serão apagadas e o [agente] vai perguntar tudo de novo. Sua missão atual continua valendo até você terminar a nova." → [Cancelar] [Recomeçar].
- Progresso salvo a cada resposta. Sair e voltar continua de onde parou, com o agente dizendo "Continuando de onde paramos…".
- Final de roteiro: **card de resultado dentro do chat** (seção 6) com botão "Começar missão".
- Scroll automático suave, respeitando se o usuário rolou pra cima.
- Acessível: foco no input, aria-live nos balões novos.

---

## 6. ROTEIROS (falas completas)

> As falas abaixo são a base. Mantenha o tom de cada agente. `{nome}` = primeiro nome do usuário. Valores sempre formatados em R$.

### 6.1 Onboarding / "Montar plano com o coach" (agente principal escolhido, padrão Arkad)

**Escolha do agente principal** (tela antes do chat): 3 cards grandes — Arkad ("Quero começar a guardar"), Dabasir ("Quero sair das dívidas"), Nomasir ("Quero parar de perder dinheiro no mês"). O roteiro abaixo é o mesmo, só as falas mudam de tom.

1. **boas_vindas** (nenhuma)
   - Arkad: "Que bom ter você aqui, {nome}." / "Vamos montar o seu plano com calma. São poucas perguntas, e você pode corrigir qualquer resposta depois."
2. **renda** (dinheiro)
   - "Primeiro: quanto entra por mês, em média, já descontado o que sai direto do pagamento?"
   - validar 0 → "Sem renda agora? Tudo bem. Coloque o valor que entra, mesmo que seja pouco ou irregular."
3. **renda_variavel** (botões: "Fixa todo mês" / "Varia bastante")
   - "Esse valor é o mesmo todo mês ou muda bastante?"
   - Se varia: "Então vamos usar um mês fraco como base. Melhor sobrar do que faltar."
4. **fixos** (dinheiro)
   - "Agora os gastos que se repetem todo mês: aluguel, contas, mercado, transporte." / "Quanto isso dá, mais ou menos?"
   - Coerência: se > renda → "Hm, {nome}, isso passa do que entra. Quer revisar algum dos dois?" [Revisar renda] [Revisar gastos] [Está certo mesmo]
5. **sobra** (dinheiro, aceita 0)
   - "E no fim do mês, costuma sobrar quanto? Pode ser zero, sem problema."
   - Coerência (diferença > R$100): "Pela conta, sobrariam uns {diferenca}. Pra onde costuma ir esse dinheiro?" → múltiplo: [Lanches e delivery] [Compras] [Cartão e parcelas] [Ajudo alguém] [Não sei]
   - Resposta "Não sei": "Esse é o dinheiro que escapa sem a gente ver. O Nomasir é ótimo nisso. Vou deixar ele de olho."  → ativa Nomasir.
6. **tem_divida** (botões: "Tenho" / "Não tenho")
   - "Você tem alguma dívida hoje? Cartão, empréstimo, financiamento…"
   - Se tenho: "Entendo. Vamos cuidar disso primeiro, uma coisa de cada vez." → **lista_dividas**
7. **lista_dividas** (lista: nome, quanto deve, parcela/mês, juros se souber) — botão "+ Adicionar outra" e "Pronto"
   - "Me conta cada uma. Se não souber os juros, pode deixar em branco."
   - Ao terminar: "Ok. O Dabasir já passou por isso e sabe o caminho. Ele vai cuidar das dívidas com você." → ativa Dabasir.
8. **guardado** (dinheiro, aceita 0)
   - "Você já tem algum dinheiro guardado hoje?"
9. **quanto_guardar** (dinheiro com sugestão 10% da renda)
   - Arkad: "Na Babilônia aprendi uma regra simples: de cada dez moedas que entram, uma fica com você." / "Pra você, isso seria {10%}. Quanto você consegue guardar por mês, de verdade?"
   - Se tem dívida, sugestão = 10% da sobra (método Dabasir) e a fala explica.
   - Se valor > sobra teórica: "Isso é mais do que sobra hoje. Prefiro um valor menor que você consiga cumprir. Quer ajustar?"
10. **resultado** (nenhuma) → "Pronto, {nome}. Preparei seu plano." → **Card de resultado**:
    - Título "Seu plano com {agente}"
    - Máx. 3 linhas (prioridade): ex. "1. Pagar R$ 300/mês no cartão · quitado em mar/27", "2. Guardar R$ 150/mês · reserva em jul/28", "3. Gastar até R$ 102 por dia"
    - Agentes ativados (avatares pequenos)
    - Botões: [Começar] (primário) · [Ajustar respostas]
    - Ao Começar: confete dourado, cria missões, vai para Início com o card "Sua missão de hoje".

### 6.2 Arkad — Reserva
- Abertura: "Uma reserva é o que separa um imprevisto de uma crise." / "Hoje você tem {atual} guardado. Vamos ver quanto falta?"
- Pergunta custo essencial (pré-preenchido com contas fixas): "Seus gastos essenciais dão {custo}/mês. Seis meses disso seria {meta}. Quer usar essa meta?" [Usar {meta}] [Prefiro outro valor]
- Valor mensal (sugestão 10%) → "Quando o salário cai, em que dia?" (data) → lembrete nesse dia.
- Resultado: Missão "Reserva de emergência" — passos: 1. Guardar {mensal} no dia {dia} · 2. Chegar a {meta/2} (metade) · 3. Reserva completa em {data}.

### 6.3 Dabasir — Dívidas
- Abertura: "Eu já devi pra meio mundo, {nome}. Sei como pesa." / "A saída que encontrei foi simples: de tudo que sobra, 7 partes pra viver, 2 pra pagar quem eu devo e 1 pra guardar."
- Revisa a lista de dívidas (editar/adicionar).
- "Quer começar pela que tem os juros mais altos (economiza mais) ou pela menor (dá ânimo ver uma acabar logo)?" [Juros mais altos] [Menor primeiro]
- "Uma regra: enquanto a gente paga, nada de dívida nova. Combinado?" [Combinado]
- Resultado: Missão "Sair das dívidas" — passos: 1. Pagar {valor} em {primeira dívida} este mês · 2. Quitar {primeira dívida} até {data} · 3. Livre das dívidas em {data final}. Mostra mini linha do tempo das dívidas.

### 6.4 Bansir — Contas fixas
- Abertura: "Eu vivia trabalhando e o dinheiro nunca chegava no fim do mês. Começou a mudar quando eu soube exatamente o que vencia e quando."
- Lista: cada conta (nome, valor, dia de vencimento). Pré-preenche com as já cadastradas.
- "Quer que eu te lembre um dia antes de cada uma vencer?" [Sim] [Não]
- Resultado: Missão "Contas em dia" — recorrente mensal, passos = contas do mês.

### 6.5 Nomasir — Cortar e limitar gastos
- Abertura: "Vou ser sincero: eu perdi todo o ouro que meu pai me deu antes de aprender. Gasto pequeno que se repete é o que mais pesa."
- Múltiplo: "Onde você acha que mais escapa?" [Delivery] [Assinaturas] [Compras online] [Saídas] [Transporte por app] [Outro]
- Para cada escolhida: "Quanto vai nisso por mês, mais ou menos?" → "E quanto você topa gastar no máximo?"
- Assinaturas: "Lista as que você paga. Qual você não usou no último mês?" → cria passos "Cancelar X".
- Resultado: Missão "Segurar os gastos" — limites por categoria + passos de corte. Mostra "Economia estimada: {valor}/mês → {valor x 12}/ano".

### 6.6 Mathon — Antes de pegar empréstimo
- Uso pontual (não gera missão recorrente; gera um "Parecer").
- Pergunta: valor, número de parcelas, valor da parcela (ou taxa), para quê.
- Calcula: total pago, juros totais, taxa mensal efetiva aproximada.
- Fala: "Você vai pagar {total} por {valor}. São {juros} só de juros." + parecer: se taxa > 5% a.m.: "Esse ouro sai caro. Se puder esperar {meses} guardando {parcela}, você compra sem pagar juros."
- Botões: [Comparar outra proposta] (lado a lado, até 3) [Salvar parecer].

### 6.7 Rodan — Dinheiro extra (13º, bônus, freela)
- "Recebeu um dinheiro a mais? Vamos dar destino a ele antes que ele suma."
- Valor → sugestão automática pela prioridade: dívida > reserva > investir > um pouco pra você (10%).
- Fala: "Minha sugestão: {x} pra dívida, {y} pra reserva e {z} pra você aproveitar sem culpa."
- Sliders para ajustar a divisão (soma sempre 100%). Ao confirmar, lança aportes nas missões.

### 6.8 Sharru Nada — Investir / viver de renda
- Só fica totalmente liberado após reserva completa; antes disso: "Primeiro a reserva, depois a gente faz o ouro trabalhar. Faltam {x} meses." [Me avisa quando chegar a hora]
- Pergunta custo de vida desejado → "Pra viver de renda com {custo}/mês, você precisaria de aproximadamente {custo*12/0.06} investidos (estimativa conservadora de 0,5% ao mês)."
- Valor mensal para investir → linha de projeção (gráfico simples) "em 5, 10 e 20 anos".
- Rodapé obrigatório: "Estimativa. Não é recomendação de investimento."
- Também: "Quer aumentar o que entra?" → passos opcionais de 7ª cura (curso, freela, aumento).

### 6.9 Check-in do mês (agente da missão, aparece no início do mês e via card no Início)
- "Começou {mês}. Conseguiu {ação} em {mês anterior}?" [Fiz tudo] [Fiz uma parte → valor] [Não deu]
- Fiz tudo: celebração + "Mais um mês na conta. Sequência: {n} meses."
- Não deu: "Acontece. Sua nova previsão é {data}. Quer manter o valor ou ajustar?" [Manter] [Ajustar valor]
- Só para mês atual ou anterior (até dia 10). Nunca futuro.

---

## 7. TELAS

### 7.1 Início (`/inicio`) — "O que eu faço hoje?"
Ordem de cima pra baixo:
1. **Saudação**: "Oi, {Nome}" (só primeira letra maiúscula) + chip da sequência "🔥 {n} meses guardando" (ícone, não emoji, se o design pedir).
2. **Card verde "Quanto posso gastar hoje"** (já existe — manter): valor grande com count-up; "Sobram R$ X até o fim do mês". Ações: [+ Anotar] [Gastos fixos] [Agentes].
   - Estado "estourou": card muda para tom âmbar, "Você passou R$ X do limite do mês", e Nomasir sugere: "Vamos ver onde dá pra segurar até o dia 30?" [Ver gastos].
3. **"Sua missão de hoje"** (NOVO): UM card com avatar do agente, a ação mais importante agora e um botão de ação direta. Regra de escolha: passo pendente mais prioritário com data mais próxima; se nada pendente, check-in do mês; se nada, dica do agente principal.
4. **Card "Montar plano com o coach"** (já existe): se o onboarding foi concluído, troca para "Refazer meu plano".
5. **Missões ativas** (NOVO, carrossel horizontal no mobile / grid no desktop): card por missão com anel de progresso, título, "faltam R$ X · {data}".
6. **Seus agentes ativos** (já existe): texto = status real; "Próximo lembrete: {data}". Tocar abre o chat.
7. **Mensagem da semana**: balão com frase do agente principal comentando o progresso real (gerada por regras, ex: "Você guardou R$ 300 a mais que no mês passado. Isso é Babilônia pura.").

### 7.2 Meu mês (`/meu-mes`) — manter tudo, melhorar
- Card de saldo (já existe). Entrou/Saiu/Contas pagas/Guardado: tocar em cada um filtra a lista de lançamentos.
- "Posso comprar isso?" (já existe) → abrir como mini-chat com Nomasir: valor + à vista/parcelado → resposta "Cabe: sobram R$ X por dia depois" ou "Não cabe este mês. Se guardar R$ Y por semana, dá em {data}."
- **Quanto ainda dá em cada coisa**: toda categoria precisa ter limite; se não tiver, mostrar "Sem limite · Definir" (hoje "Outros" aparece com barra cheia sem limite — corrigir). Cores: normal < 80% · âmbar 80–100% · vermelho > 100%.
- **Últimos lançamentos**: swipe para editar/apagar, toast "Desfazer". Agrupar por dia ("Hoje", "Ontem", "18 out").
- **Anotar** (modal ou sheet): valor grande com teclado numérico, toggle Saída/Entrada, categorias como chips com ícone, descrição opcional, data (padrão hoje). Detectar categoria por palavras ("táxi", "uber" → Transporte; "ifood", "lanche" → Comida). Também permitir marcar "isso foi um aporte pra minha reserva" → vincula à missão.
- Seletor de mês no topo (só meses passados e o atual).

### 7.3 Plano → renomear o item de menu para **"Missões"** (manter a rota `/plano` funcionando e criar `/missoes` apontando para a mesma página)
- Cabeçalho: "Suas missões" + resumo "{n} ativas · {m} concluídas".
- Lista em ordem de prioridade (timeline vertical, ordem do tempo): bolinha = preenchida (em andamento), check (concluída), contorno (futura).
- **Card de missão**:
  - avatar + nome do agente, título, anel de progresso grande, "R$ {atual} de R$ {meta}", "Previsão: {data}" e status ("Em dia" verde / "R$ X atrás · nova data {data}" âmbar).
  - Próximo passo em destaque com botão de ação ("Marquei que guardei", "Paguei a parcela").
  - Os 3 passos listados com check.
  - Dica do agente (1 frase com "e se": "Guardando R$ 100 a mais, termina em {data}.").
  - Menu ⋯: Editar respostas · Refazer com {agente} · Pausar · Apagar missão.
- Investir sem barra antes de começar: "Começa quando a reserva completar · {data}".
- Gastos fixos: viram a missão recorrente do Bansir (contam no progresso do mês).
- Seção recolhida "Concluídas" com as missões finalizadas e data.
- Contagem do cabeçalho do mês SEMPRE coerente com o que está na tela. Barras com 0% vazias.

### 7.4 Agentes (`/agentes`) — manter, melhorar
- "Meus agentes" e "Disponíveis" (já existe).
- Card: ilustração, nome, título/tom, função, status da missão. Tocar = abrir chat (ativo) ou prévia (disponível).
- Prévia de agente disponível (bottom sheet): ilustração grande, quem ele é no livro (1 frase), o que faz por você, exemplo de fala dele, [Ativar e conversar].
- Desativar agente: menu ⋯ → "Desativar" (missão dele fica pausada, não apagada).

### 7.5 Chat (`/agentes/:id/chat`) — ver seção 5.

### 7.6 Selos (`/selos`, link no perfil e no Início)
- Grid de selos: conquistados coloridos com data; bloqueados em cinza com "Como ganhar".
- Tocar num selo: modal com ilustração, nome, princípio do livro (frase curta, paráfrase), quando ganhou, botão "Compartilhar" (gera imagem do selo para story 1080x1920 com a marca Grana Séria).

**Lista de selos (mínimo):**
| Selo | Princípio | Como ganhar |
|---|---|---|
| A primeira moeda | Comece a encher sua bolsa | Primeiro aporte na reserva |
| Bolsa cheia | Comece a encher sua bolsa | Reserva 100% |
| Mão firme | Controle seus gastos | Fechar um mês dentro de todos os limites |
| Sem vazamentos | Controle seus gastos | Cancelar uma assinatura/gasto via Nomasir |
| Corrente quebrada | Proteja seu tesouro | Quitar a primeira dívida |
| Livre | Proteja seu tesouro | Quitar todas as dívidas |
| Olho de Mathon | Proteja seu tesouro | Avaliar um empréstimo antes de assinar |
| Ouro que trabalha | Faça seu ouro multiplicar | Primeiro aporte em investimento |
| Destino certo | Faça seu ouro multiplicar | Dar destino a um dinheiro extra com Rodan |
| Constância (3/6/12) | Hábito | 3, 6 e 12 meses seguidos guardando |
| Contas em dia | Controle seus gastos | Pagar todas as contas fixas de um mês antes do vencimento |

### 7.7 Perfil / Configurações (`/perfil`)
- Nome, renda, dia do salário, agente principal.
- Notificações e lembretes (por agente).
- WhatsApp: placeholder "Em breve: anote gastos mandando mensagem" (não implementar a integração agora; deixe a coluna `origem` pronta).
- **Zona de controle:** "Refazer meu plano" · "Exportar meus dados (CSV)" · "Recomeçar do zero" (apaga tudo; confirmação digitando RECOMEÇAR).
- Link para "Meus selos".

---

## 8. CONTROLE TOTAL (aplicar em TODO o app)

| Ação | Comportamento |
|---|---|
| Apagar item (lançamento, conta, dívida, passo) | Sem modal. Soft delete + toast "Apagado · Desfazer" (5 s). |
| Apagar missão / conversa | Modal de confirmação curto, depois toast com Desfazer. |
| Editar | Mesmo formulário/sheet da criação, preenchido. |
| Editar resposta do chat | Seção 5. Recalcula a missão ao concluir. |
| Refazer plano de um agente | Reabre o roteiro do zero; missão antiga só arquivada ao concluir o novo. |
| Recomeçar do zero | Perfil, confirmação digitando RECOMEÇAR. |
| Mobile | Swipe esquerda = Apagar, swipe direita = Editar. |
| Desktop | Menu ⋯ no hover. |

---

## 9. MOTIVAÇÃO (o que faz a pessoa querer voltar)

- **Comemorações** (componente `<Celebracao />` reutilizável):
  - Passo concluído: check animado + leve vibração (navigator.vibrate quando existir) + fala curta do agente em toast.
  - Missão concluída: tela cheia com confete dourado (canvas-confetti), ilustração do agente, frase, selo ganho, [Compartilhar] [Próxima missão].
  - Selo: modal com o selo "girando" (CSS 3D) ao aparecer.
- **Sequência**: meses seguidos com pelo menos um aporte. Mostrar no Início. Perder a sequência: mensagem gentil, nunca punitiva ("Recomeçar também é parte. Vamos de novo este mês?").
- **Progresso sempre visível**: anéis e barras animam do valor anterior para o novo.
- **Tom**: nunca culpar, nunca usar medo. Comemorar o pequeno. Quando algo dá errado, o agente oferece um próximo passo concreto.
- **Mensagens de agente por regra** (`src/lib/mensagensAgente.ts`): banco de frases por agente e por situação (em dia, atrasado, perto da meta, meta batida, mês estourado, primeira vez), com variação para não repetir a mesma frase duas vezes seguidas.

---

## 10. DESIGN SYSTEM

- **Cores** (manter as atuais, centralizar como tokens CSS/Tailwind):
  - `--verde-900` (card principal, botões primários), `--areia-50` (fundo), `--areia-200` (trilhas de barra), `--dourado-500` (destaques, conquistas), `--ambar-500` (atenção), `--vermelho-500` (estourou), `--branco` (cards).
- **Tipografia**: manter a atual. Escala: 40/32 (números grandes), 24 (títulos), 17 (subtítulos), 15 (corpo), 13 (legendas). Números com `font-variant-numeric: tabular-nums`.
- **Cards**: raio 20px, borda 1px sutil, sombra mínima. Espaçamento base 8px (16/24/32).
- **Ícones**: lucide-react (já é o padrão do projeto, conferir).
- **Movimento** (framer-motion):
  - Entrada de página: fade + 8px de subida, 200 ms.
  - Listas: stagger 40 ms.
  - Count-up em valores de R$ (600 ms).
  - Bottom sheets com arrasto para fechar.
  - Respeitar `prefers-reduced-motion`.
- **Estados**: skeleton em todo carregamento; estados vazios com a ilustração do agente + frase + botão (ex: Missões vazias → Arkad: "Nenhuma missão ainda. Vamos montar a primeira?" [Conversar com Arkad]).
- **Navegação**:
  - Desktop: header atual (Início, Agentes, Meu mês, Missões) + avatar.
  - Mobile: bottom nav fixa com 4 itens + botão central flutuante **"+ Anotar"**.
  - Nome no header: só primeiro nome; no mobile só avatar.
- **Toasts**: canto inferior, com ação ("Desfazer").
- **Acessibilidade**: contraste AA, alvos de toque ≥ 44px, labels em inputs, foco visível.

---

## 11. TEXTOS (guia de escrita)

- Frases curtas. Uma ideia por frase.
- Proibido: "fechar o mês", "o combinado", "meses fechados", "aporte" na interface (usar "guardar"), "inadimplência", "despesa" (usar "gasto").
- Verbos de ação nos botões: "Guardei", "Paguei", "Começar", "Ajustar".
- Sempre dizer **o que acontece depois** ("Se não deu, o plano recalcula a data sozinho.").
- Datas: "jul/28", "22 out", "hoje", "amanhã".
- Valores: "R$ 1.225" (sem centavos em resumos; com centavos em lançamentos).

---

## 12. CASOS DE BORDA (testar todos)

- Usuário novo sem nenhum dado → Início mostra só o convite para montar o plano (com Arkad) e o botão Anotar.
- Renda 0 ou gastos > renda.
- Sem dívida / com 5 dívidas.
- Reserva já completa no onboarding → pula para Sharru Nada.
- Mudança de mês com o app aberto.
- Usuário apaga uma conta fixa paga no mês → recalcula "quanto posso gastar".
- Usuário edita a renda no perfil → todas as missões recalculam e o Início atualiza.
- Abandonar chat no meio e voltar dias depois.
- Refazer plano e abandonar no meio → missão antiga continua ativa.
- Registros antigos de meses futuros (bug anterior) → migration que os marca como `deleted_at` e recalcula.
- Valores enormes (R$ 1.000.000) e pequenos (R$ 0,50) sem quebrar layout.

---

## 13. PONTOS DE EXTENSÃO (preparar, não implementar)

- `origem: 'whatsapp'` nos lançamentos e aportes.
- `src/chat/engine.ts` com interface `ProvedorDeFala` para no futuro trocar falas roteirizadas por IA em passos específicos (ex: pergunta livre do usuário).
- Notificações push/e-mail: tabela de lembretes já com `proximo_lembrete`.

---

## 14. FASES DE IMPLEMENTAÇÃO

Cada fase: commit de backup → lista de arquivos → meu ok → implementar → `npm run build` → testar casos da fase → commit → resumo curto.

**Fase 1 — Fundação**
- Investigar código e schema. Me entregar um mapa: o que existe × o que a spec pede.
- Migrations aditivas (seção 3), soft delete, correção de meses futuros.
- `src/lib/financas.ts` + testes.
- Tokens de design centralizados.

**Fase 2 — Motor de chat + onboarding**
- Engine (seção 5), UI do chat, roteiro 6.1, editar resposta, recomeçar, salvar progresso.
- Resultado do chat cria missões e alimenta Início / Meu mês / Plano.

**Fase 3 — Missões**
- Tabelas de missão/passos ligadas aos dados existentes, página Missões (7.3) sem perder nada do Plano atual, card "Sua missão de hoje" no Início.

**Fase 4 — Agentes conversáveis**
- Roteiros 6.2 a 6.8, prévia de agente, status real nos cards, check-in do mês (6.9).

**Fase 5 — Controle total**
- Seção 8 inteira em todas as telas + Perfil (7.7).

**Fase 6 — Motivação**
- Selos (7.6), sequência, `<Celebracao />`, mensagens dos agentes por regra, compartilhar selo.

**Fase 7 — Polimento**
- Movimento, skeletons, estados vazios, bottom nav mobile, Meu mês melhorado (7.2), revisão de textos (seção 11), acessibilidade.

**Fase 8 — QA final**
- Rodar todos os casos da seção 12, conferir responsivo nos 3 tamanhos, listar o que ficou pendente.

---

## 15. CRITÉRIO DE PRONTO

Uma pessoa nova consegue, **sem ajuda**:
1. Abrir o app, conversar com Arkad e ter um plano em menos de 3 minutos.
2. Entender na tela inicial o que precisa fazer hoje.
3. Anotar um gasto em menos de 10 segundos.
4. Corrigir, apagar ou refazer qualquer coisa sem medo.
5. Sentir que está avançando (progresso, sequência, selos) e querer voltar no mês seguinte.
