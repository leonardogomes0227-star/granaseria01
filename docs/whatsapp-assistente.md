# Assistente de gastos pelo WhatsApp — guia de configuração (fase de teste)

O assistente recebe mensagens como *"gastei 35 no mercado"*, grava no Supabase e responde com o total do dia e do mês.
Nesta fase, **só os números listados em `ALLOWED_NUMBERS` são atendidos** (você + 1 pessoa). Qualquer outro número é ignorado.

```
WhatsApp ──► Meta (Cloud API) ──► Vercel /api/whatsapp ──► Supabase (tabela expenses)
                    ▲                       │
                    └──── resposta ◄────────┘
```

## O que a pessoa pode mandar

| Mensagem | O que acontece |
|---|---|
| `gastei 35 no mercado`, `uber 18,50`, `R$ 1.234,56 aluguel` | Registra o gasto e já categoriza |
| `mercado 80 no pix`, `uber 18,50 débito`, `tênis 250 crédito`, `padaria 12 dinheiro` | Registra o gasto e guarda a **forma de pagamento** (Pix, Débito, Crédito, Dinheiro, Boleto, Vale ou Cartão) |
| `recebi 200 de freela`, `caiu 3000 salário`, `vendi o fogão 400 pix` | Registra uma **entrada** de dinheiro, com a origem (Salário, Renda extra, Venda, Reembolso, Presente, Rendimento) e mostra o saldo do mês |
| `entradas` | O dinheiro que entrou no mês, por origem, e as últimas entradas |
| `saldo` | Entrou, saiu e saldo do mês |
| `formas de pagamento` | Quanto saiu no mês em cada forma de pagamento (o `mês` também mostra) |
| `apagar entrada` | Desfaz a última entrada |
| `nova dívida cartão 2000` | Acrescenta uma dívida às que já estão salvas no diagnóstico e mostra a ordem de pagamento de novo (também em *Sair das dívidas → Nova dívida*) |
| `apagar dívida` ou `quitei o cartão` | Mostra as dívidas numeradas e apaga a escolhida (com `quitei`, comemora); depois mostra a ordem de pagamento de novo |
| `posso comprar 300` | Faz a conta com o saldo real do mês (entrou − saiu) e diz quanto sobra por dia depois da compra |
| 📸 foto do cupom, nota ou comprovante de pix | A IA lê o valor, o lugar, a categoria e a forma de pagamento e anota o gasto (ou a entrada, se o pix foi recebido). Precisa de `ANTHROPIC_API_KEY` |
| `resumo semanal` | Mostra a semana e liga o resumo automático (domingo de manhã) e o do mês (dia 1). `parar resumo` desliga |
| `anotar` | Tudo o que dá pra mandar: gasto, entrada e foto |
| `gastos` (ou *Gastos e entradas* no menu) | Abre as opções de gastos: anotar, hoje, ontem, semana, mês, quanto ainda posso gastar, últimos e desfazer |
| `hoje` | Lista os gastos de hoje |
| `ontem` | Lista os gastos de ontem |
| `semana` | Total desde segunda, por categoria |
| `mês` / `resumo` | Total do mês, por categoria |
| `últimos` | Os 10 últimos gastos anotados no mês, com o dia |
| `quanto ainda posso gastar` | Por categoria (casa, comida, transporte, lazer): quanto já gastou do que planejou no diagnóstico, quanto ainda dá e uns quantos reais por dia até o fim do mês. Sem diagnóstico, convida a fazer |
| `apagar` | Desfaz o último registro |
| `oi` / `ajuda` | Mostra os comandos |

Categorias automáticas: Alimentação, Transporte, Moradia, Saúde, Lazer, Compras, Educação e Outros.

---

> **Entradas e forma de pagamento:** rode também, uma vez, `supabase/entradas.sql` (cria a tabela `incomes` e a coluna `expenses.payment_method`). Sem o SQL o bot continua anotando gastos normalmente, só não guarda a forma de pagamento e avisa que as entradas ainda não estão ativas.

## Passo 1 — Banco de dados (Supabase)

1. Crie uma conta em **supabase.com** → **New project** (região *São Paulo*). Anote a senha.
2. No projeto: **SQL Editor → New query**, cole o conteúdo de [`supabase/whatsapp.sql`](../supabase/whatsapp.sql) e clique **Run**.
3. Em **Project Settings → API**, copie:
   - **Project URL** → vai ser o `SUPABASE_URL`
   - **service_role key** (secreta) → vai ser o `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ A `service_role` dá acesso total ao banco. Ela só vai na Vercel — nunca no código, nunca em mensagem.

## Passo 2 — Conta e app na Meta

1. **Não ative o WhatsApp comum no chip.** Se já ativou, apague a conta (WhatsApp → Configurações → Conta → Apagar conta) antes de seguir.
2. Acesse **business.facebook.com** e crie um portfólio empresarial (nome: Grana Séria).
3. Acesse **developers.facebook.com → Meus apps → Criar app** → tipo **Empresa/Business** → vincule ao portfólio.
4. No painel do app, adicione o produto **WhatsApp**.
5. Em **WhatsApp → Configuração da API (API Setup)** → **Adicionar número de telefone**:
   nome de exibição "Grana Séria", número do chip, confirmação por SMS.
   A Meta pode pedir uma forma de pagamento na conta do WhatsApp Business — responder mensagens que a pessoa manda é gratuito.
6. Anote o **Phone Number ID** do número do chip (aparece em API Setup) → `WHATSAPP_PHONE_NUMBER_ID`.
7. **Token permanente** (o token que aparece em API Setup expira em 24h):
   - business.facebook.com → **Configurações → Usuários do sistema → Adicionar** (função Admin)
   - **Atribuir ativos** → seu app (controle total) e sua conta do WhatsApp
   - **Gerar token** → escolha o app, validade *Nunca*, permissões `whatsapp_business_messaging` e `whatsapp_business_management`
   - Esse token → `WHATSAPP_TOKEN`
8. **Chave secreta do app**: developers.facebook.com → seu app → **Configurações do app → Básico → Chave secreta do app** → `WHATSAPP_APP_SECRET`.

## Passo 3 — Variáveis na Vercel

Vercel → projeto **granaseria01** → **Settings → Environment Variables** (ambiente *Production*):

| Nome | Valor |
|---|---|
| `WHATSAPP_TOKEN` | token permanente do passo 2.7 |
| `WHATSAPP_PHONE_NUMBER_ID` | do passo 2.6 |
| `WHATSAPP_APP_SECRET` | do passo 2.8 |
| `WHATSAPP_VERIFY_TOKEN` | invente uma senha qualquer, ex.: `granaseria-2026-xyz` |
| `ALLOWED_NUMBERS` | números liberados, separados por vírgula, com 55 + DDD: `5511987654321,5521912345678` |
| `SUPABASE_URL` | do passo 1.3 |
| `SUPABASE_SERVICE_ROLE_KEY` | do passo 1.3 |

Depois de salvar: **Deployments → ⋯ no último deploy → Redeploy** (as variáveis só valem num deploy novo).

## Passo 4 — Ligar o webhook

1. developers.facebook.com → seu app → **WhatsApp → Configuração (Configuration) → Webhook → Editar**:
   - **URL de retorno:** `https://granaseria.com.br/api/whatsapp`
   - **Token de verificação:** o mesmo `WHATSAPP_VERIFY_TOKEN` do passo 3
   - Clique **Verificar e salvar**. Se der erro, confira se fez o *Redeploy*.
2. Ainda em Webhook → **Campos (Webhook fields)** → assine o campo **messages**.
3. **Publique o app** (topo do painel: modo *Desenvolvimento → Ativo/Live*). A Meta pede a URL da política de privacidade:
   `https://granaseria.com.br/politica-de-privacidade`

## Passo 5 — Testar

Do seu celular (um dos números em `ALLOWED_NUMBERS`), mande **oi** para o número do chip. Deve chegar o menu.
Depois: `gastei 35 no mercado` → `hoje` → `mês` → `apagar`.

Os gastos aparecem no Supabase em **Table Editor → expenses**.

### Se não responder

- Vercel → projeto → **Logs**, filtrando por `/api/whatsapp`:
  - **sem nenhuma chamada** → webhook não configurado/assinado (passo 4) ou app não publicado
  - **401** → `WHATSAPP_APP_SECRET` errado
  - chamada 200 mas sem resposta → seu número não está em `ALLOWED_NUMBERS` (confira o formato `55DDD9XXXXXXXX`)
  - `WhatsApp send 401` → token expirado/errado; `Supabase ... 401` → chave do Supabase errada

## Do site pro WhatsApp, sem cadastro

No resultado do diagnóstico do site há o botão **Continuar no WhatsApp** (logo abaixo da nota e no fim da página). Ele manda o que está no navegador (diagnóstico, plano, vazamentos) pra `/api/continuar`, que guarda por **24 horas** com um código curto e abre o WhatsApp com a mensagem pronta: *"Oi! Fiz meu diagnóstico no site e quero continuar por aqui. Código: GS-K7P2Q9"*. O bot importa tudo pro número e já responde com o resumo e o próximo passo. O código vale uma vez só. Não precisa de e-mail nem de SQL novo (fica na `wa_sessions`). O login por e-mail continua existindo pra quem quer o plano salvo em vários aparelhos e o lembrete mensal.

O número do link é `VITE_WHATSAPP_NUMBER` na Vercel; sem ela, vale o oficial (5567996085267).

## Meu painel no site (o WhatsApp é o login)

Mandar `painel` no WhatsApp (ou tocar em *Meu painel no site* no menu) gera um **link pessoal**: `granaseria.com.br/painel?t=…`. Ao abrir, o navegador fica ligado ao número, sem e-mail e sem senha, e a página **Meu painel** mostra:
- o mês: entrou, saiu, saldo e quanto dá por dia (o que a pessoa anotou no WhatsApp);
- quanto ainda dá pra gastar em cada coisa (limites do diagnóstico);
- os últimos lançamentos;
- o plano de ação do diagnóstico;
- as ferramentas.

Tudo fica salvo pelo número: o que muda no site (diagnóstico, plano, vazamentos, check-ins) vai pro WhatsApp (`/api/painel`, a cada 4s), e o que muda no WhatsApp aparece no site. Quem vem do site pelo *Continuar no WhatsApp* já recebe o link junto. `sair do painel` desconecta todos os navegadores; `apagar meus dados` apaga os links também. O token fica só no navegador; o servidor guarda o hash dele na `wa_sessions` (chave `weblink:<hash>`), válido por 180 dias desde o último uso.

## WhatsApp = dia a dia; ferramentas = site

O WhatsApp cuida só do dinheiro que entra e sai: anotar gastos e entradas (texto ou foto do cupom), saldo, quanto ainda dá pra gastar, posso comprar, resumo da semana. As ferramentas maiores ficam no site, sem cadastro: qualquer palavra ou botão que antes abria uma delas aqui (*diagnóstico*, *dívidas*, *13º*, *vazamentos*, *direitos*, *renegociar*, *meta*, *empréstimo*, *fatura*, *check-in*…) agora responde com o link certo (`server/whatsapp/site.ts`). *ferramentas* manda todos os links.

`menu`: Como anotar · Saldo do mês · Quanto posso gastar · Gastos e entradas · Posso comprar? · Resumo da semana · Ferramentas no site.

O caminho de volta é o botão *Continuar no WhatsApp* do resultado do diagnóstico (seção acima): com o diagnóstico importado, o *quanto posso gastar* passa a usar os limites por categoria.

Fatura (legenda "fatura"/"extrato" ou foto que a leitura reconhece como fatura) recebe o link do leitor do site.

## Ofertas no contexto

Depois de uma anotação, o assistente sugere a ferramenta certa, no máximo uma por mensagem e cada tipo uma vez por mês: 13º/bônus → *13º*; salário → *plano*; Netflix/tarifa → *vazamentos*; fatura/juros → *dívidas*; quem já anotou 5 gastos no mês e não recebe o resumo → *resumo semanal*.

## Resumo automático (semana e mês)

A rota `/api/resumo` roda todo dia às 10h (Brasília) pelo cron da Vercel. No **domingo** manda o resumo da semana; no **dia 1**, o do mês que fechou. Só pra quem pediu (`resumo semanal`) e só se tiver algo anotado. Pra testar na hora: `GET /api/resumo?tipo=semana` (ou `tipo=mes`) com o cabeçalho `Authorization: Bearer <CRON_SECRET>`.

Fora da janela de 24h a Meta só entrega **modelos aprovados**. Crie dois no WhatsApp Manager (categoria **Utilidade**, idioma **Português (BR)**):

**`resumo_semanal`**
```
📊 Sua semana na Grana Séria

💸 Gastou {{1}}.
O que mais pesou: {{2}}.
No mês: {{3}}.

💡 {{4}}

Pra parar de receber, responda: parar resumo
```
Exemplos pra Meta: {{1}} `R$ 450,00 em 12 anotações`, {{2}} `Alimentação (R$ 200,00)`, {{3}} `saldo do mês R$ 1.200,00, uns R$ 90,00 por dia até o fim do mês`, {{4}} `Mande *vazamentos* e eu mostro quais assinaturas pesam.`

**`resumo_mensal`**
```
🗓️ Seu {{1}} na Grana Séria

📥 Entrou: {{2}}
📤 Saiu: {{3}}
⚖️ Resultado: {{4}}

Pra parar de receber, responda: parar resumo
```
Exemplos: {{1}} `outubro`, {{2}} `R$ 3.000,00`, {{3}} `R$ 2.500,00, mais em Moradia`, {{4}} `sobraram R$ 500,00 (16% do que entrou).`

Variáveis (opcionais): `WHATSAPP_WEEKLY_TEMPLATE` (padrão `resumo_semanal`), `WHATSAPP_MONTHLY_TEMPLATE` (padrão `resumo_mensal`), `CRON_SECRET` (o mesmo dos lembretes). Cada mensagem de modelo tem custo na Meta (categoria utilidade).

## Fotos: cupom, comprovante e fatura

- **Foto** (ou PDF com legenda "comprovante") → leitura de cupom: vira gasto, com a data do documento se for dos últimos 31 dias. Limite `RECEIPT_MONTHLY_LIMIT` (padrão 60 por mês por pessoa).
- **PDF**, legenda "fatura"/"extrato", ou foto que a leitura reconhece como fatura → leitor de fatura (limite `FATURA_MONTHLY_LIMIT`, padrão 5).
- **Áudio** ainda não: a API do Claude não recebe áudio. O bot responde pedindo texto ou foto.

## Começar pelo objetivo da pessoa

Quem chega pela primeira vez não vê uma lista de ferramentas: o bot pergunta **"o que você quer resolver agora?"** e mostra os objetivos
(sair das dívidas, juntar dinheiro, controlar os gastos, achar dinheiro que sobra, usar o 13º ou um extra, decidir uma compra, comparar empréstimos,
conhecer os direitos, organizar tudo). Cada um explica em uma frase o que vai acontecer e já abre a ferramenta certa.
Quem preferir escrever com as próprias palavras também é entendido, quando a frase começa declarando o objetivo:
*quero sair das dívidas*, *preciso juntar dinheiro pra viajar*, *como faço pra guardar dinheiro?*, *me ajuda* (mostra a lista).
A palavra *objetivo* abre a lista a qualquer hora. As escolhas aparecem no painel `/admin`, em "O que as pessoas querem resolver".
O código está em `server/whatsapp/goals.ts`.

## Atalhos: sem passar pelo menu toda vez

- **O bot ensina o atalho na hora:** ao abrir uma ferramenta pelo menu, ele manda antes uma linha como "Da próxima vez, é só mandar *meta* que eu abro direto". As palavras estão em `server/whatsapp/shortcuts.ts`.
- **Mais jeitos de escrever:** *juntar dinheiro* ou *poupar* abrem a meta; *assinaturas* ou *dinheiro perdido*, o caça-vazamentos; *minhas dívidas*, as dívidas; *posso comprar 2000*, o vale a pena comprar.
- **Atalhos de cada pessoa:** no "oi" de quem já fez o diagnóstico, o bot mostra até 3 botões com as ferramentas que ela mais usa (pelo histórico de uso da própria pessoa, sem guardar o telefone).
- O menu também lembra: "você pode escrever direto o que quer, tipo *meta*, *dívidas* ou *gastos*".

## Ferramentas do site no WhatsApp

Mande **oi** ou **menu** e o bot mostra uma lista de opções, agrupada em *Começar*, *Economizar e proteger* e *Mais*. Depois de cada ferramenta, aparecem os botões *Ver menu*, *Próximo passo* e *Dar opinião*. Também funcionam palavras digitadas, mesmo no meio de outra conversa:

| Ferramenta | Como chamar |
|---|---|
| Começo rápido (3 perguntas: renda, gastos, dívidas) | `rápido` |
| Diagnóstico (8 perguntas) | `diagnóstico` |
| Meu plano, `paguei`, `não paguei` | `plano` |
| O que fazer com o 13º / dinheiro extra | `13º` |
| Caça-vazamentos | `vazamentos` |
| Seus direitos com o banco | `direitos` |
| Vale a pena comprar isso? | `vale a pena comprar 2000` |
| Calculadora de meta | `meta` |
| Simulador de longo prazo | `longo prazo` |
| Comparador de empréstimo (aceita "5000 em 12x de 520") | `empréstimo` |
| Avalanche × bola de neve | `dívidas` |
| Check-in mensal | `check-in` |
| Selos e perfil | `selos` |
| Frase do dia | `frase` |
| Leitor de fatura | mandar o **PDF ou a foto** da fatura (precisa de `ANTHROPIC_API_KEY`) |

`cancelar` sai de qualquer conversa. Gastos continuam do jeito de sempre: `gastei 35 no mercado`.

**Antes de usar, rode uma vez no Supabase** (SQL Editor → New query → Run) o conteúdo de `supabase/whatsapp-hub.sql`.
Ele cria três tabelas: `wa_sessions` (em que pergunta a pessoa parou), `wa_profiles` (diagnóstico, plano, vazamentos e check-ins de
quem usa só o WhatsApp, sem conta) e `wa_usage` (limites de uso). Sem o SQL, o menu fica desligado e o bot segue só com gastos e plano.

- Quem **tem conta** no site e vinculou o número usa os mesmos dados nos dois lugares (o diagnóstico feito no WhatsApp aparece no site).
- Quem **não tem conta** tem os dados guardados pelo número, em `wa_profiles`.
- Limites por pessoa: respostas com IA por dia (`WHATSAPP_AI_DAILY_LIMIT`, padrão 40) e leituras de fatura por mês (`FATURA_MONTHLY_LIMIT`, padrão 5). Passou do limite da IA, o bot segue só com as regras.
- A leitura da fatura pode levar uns 30 segundos; `api/whatsapp.ts` tem `maxDuration` de 60 s no `vercel.json`.

## O coach: próximo passo, feedback e métricas

- **`oi`** de quem já é de casa, ou **`próximo passo`** / **`e agora`**: o bot olha a situação e diz **um** passo, na ordem das leis do ouro
  (conhecer → seguir o plano → controlar os gastos → proteger → acompanhar). O combinado do plano só aparece quando o mês chega.
- **Orçamento no dia a dia:** depois do diagnóstico, cada gasto anotado mostra como está a categoria (🟢 🟡 🔴) contra o que a pessoa disse que gasta.
- **Chama pelo nome** quando o nome do WhatsApp parece um nome (letras, até 20 caracteres); senão segue sem nome.
- **Pedido de feedback automático:** quando a pessoa já usou de verdade (2 dias diferentes e 6 mensagens, ou 12 mensagens num dia só), o bot pergunta
  "como está sendo usar a Grana Séria?" com os botões 😀 / 😕 (o 😕 pede uma frase do que falta). Só pergunta no fim de uma conversa, nunca no meio de um diagnóstico,
  nem logo depois de um feedback; no máximo 3 vezes por pessoa, com 14 dias entre elas (as seguintes só se a pessoa voltou a usar). Aparece no painel `/admin`.
  Quem toca 😀 ou 😕 é convidado a **escrever** o que ajudou ou o que falta (até 600 caracteres, ou *pular*).
- **Feedback escrito quando quiser:** a pessoa manda *feedback* (ou *sugestão*, *reclamação*, *opinião*) ou escolhe *Mais → 💬 Dar feedback*, e o texto cai no painel `/admin`, em "O que as pessoas escreveram".
- **`apagar meus dados`** (com confirmação): apaga gastos, perfil, conversa, contadores e métricas daquele número. Se a pessoa tem conta no site, os dados da conta continuam lá (ela apaga em /conta).
- **"Isso te ajudou?"** (👍/👎) depois do diagnóstico, do 13º e dos vazamentos. O 👎 pede uma frase do que faltou.

**Métricas:** rode `supabase/whatsapp-metrics.sql` uma vez. Não guarda o telefone, só um hash (`METRICS_SALT` na Vercel é opcional).
Consultas úteis (SQL Editor):

```sql
-- quantas pessoas chegaram a cada etapa
select event, count(distinct person) as pessoas, count(*) as vezes
from wa_events group by event order by pessoas desc;

-- do primeiro oi até seguir o plano
select count(distinct person) filter (where event = 'greeting')    as chegaram,
       count(distinct person) filter (where event = 'quick_done')  as fizeram_rapido,
       count(distinct person) filter (where event = 'diag_done')   as fizeram_diagnostico,
       count(distinct person) filter (where event = 'plan_follow') as seguiram_plano
from wa_events;

-- o que as pessoas dizem quando o 👎 aparece
select created_at, event, note from wa_events where note is not null order by created_at desc limit 50;
```

Os diálogos e a voz estão em `docs/voz-da-grana-seria.md`.
