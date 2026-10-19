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
| `nova dívida`, `quitei o cartão`, `posso comprar 300`, `diagnóstico`, `meta`… | Ferramenta: responde com o link dela no site, já logado (nada de ferramenta roda no WhatsApp) |
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
| `gastei 2 mil no conserto`, `celular 1,5k` | Entende "mil" e "k" |
| `tênis 300 parcelado em 3x` | Anota R$ 300 (o "3x" não vira valor) |
| `40 na feira e 20 na padaria` | Anota os dois gastos de uma vez |
| `gastei 30 ontem no mercado` | Anota com a data de ontem (também `anteontem`) |
| `guardei 200`, `investi 500 no tesouro` | Categoria 🐖 Guardado, com elogio: sai do saldo, mas não é desperdício |
| `quanto gastei com mercado?`, `quanto gastei no mês` | Total da categoria (ou da palavra) no mês, com os maiores gastos |
| `mercado` (sem valor) | Pergunta quanto foi |
| `obrigado`, `valeu`, 👍 | Responde com simpatia, em vez de "não entendi" |

Categorias automáticas: Alimentação, Transporte, Moradia, Saúde, Lazer, Compras, Educação, Pets, Cuidados pessoais, Doações, Guardado e Outros.

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

## Login obrigatório no site (pelo WhatsApp) e feedback

**Pra abrir qualquer ferramenta ou o diagnóstico, a pessoa precisa entrar.** O login é o WhatsApp:
1. *Entrar com WhatsApp* abre a conversa com "Quero entrar no site".
2. O bot responde com o link pessoal.
3. O link leva de volta direto pra ferramenta que ela queria.

Depois de entrar, o **nome é obrigatório** ("Como você quer ser chamado?"). Ele fica salvo junto com o resto (`gs-nome`), e o bot já sugere o nome do WhatsApp. Quem tem conta por e-mail também passa.

**Todo link do site que o bot manda já vai com o login** (`?t=…`), então quem vem do WhatsApp nem vê a tela de entrar.

**Feedback sem escrever:** no fim de cada ferramenta e do diagnóstico aparece "Isso te ajudou? 👍 Ajudou / 👎 Faltou algo". Só no 👎 abre um campo opcional. Vai pro `/admin` como `site-<ferramenta>`, junto com o feedback do WhatsApp.

**No `/admin`:**
- a lista **Pessoas**: nome, final do número, último uso, se já entrou no site e o que usou;
- as ferramentas abertas no site aparecem com 🌐.

**"oi" explica a novidade:** qualquer saudação (oi, olá, bom dia, e aí…) responde explicando que as ferramentas agora ficam no site, com o link pra tocar já logado (página inicial, ou o painel pra quem já tem diagnóstico), e lembra que o dia a dia continua no WhatsApp.

**Aviso pra quem já usa o bot:**
- Na próxima mensagem que a pessoa mandar, o bot avisa uma vez que as ferramentas agora ficam no site, com o passo a passo (*entrar* → link → pronto).
- Pra avisar todo mundo de uma vez: botão **Avisar todo mundo** no `/admin`. Cada pessoa recebe o aviso com o **próprio link de acesso** (já logado):
  - quem falou com o bot nas **últimas 24 horas** recebe o texto completo na hora (a Meta permite texto livre nessa janela);
  - os outros recebem pelo modelo aprovado `novidade_site` (ou o nome em `WHATSAPP_NEWS_TEMPLATE`), categoria **Utilidade** ou **Marketing**, pt_BR, com **uma variável** (o link):

```
📣 Novidade na Grana Séria!

Pra ficar mais fácil, agora tudo fica no nosso site, com passo a passo e salvo na sua conta: diagnóstico e plano de ação, qual dívida pagar primeiro, 13º, metas e seus direitos.

👉 Toque pra entrar (já com a sua conta, sem senha): {{1}}

Aqui no WhatsApp você continua anotando o dia a dia, tipo "mercado 80 no pix". O que você anota aqui aparece no site.
```
  Exemplo pra Meta no {{1}}: `https://granaseria.com.br/?t=exemplo`.

Cada pessoa recebe uma vez só, e quem recebe pelo modelo não vê o aviso de novo no chat.

## Meu painel no site (o WhatsApp é o login)

Mandar `painel` no WhatsApp (ou tocar em *Meu painel no site* no menu) gera um **link pessoal**: `granaseria.com.br/painel?t=…`. Ao abrir, o navegador fica ligado ao número, sem e-mail e sem senha, e a página **Meu painel** mostra:
- o mês: entrou, saiu, saldo e quanto dá por dia (o que a pessoa anotou no WhatsApp);
- quanto ainda dá pra gastar em cada coisa (limites do diagnóstico);
- os últimos lançamentos;
- o plano de ação do diagnóstico;
- as ferramentas.

Tudo fica salvo pelo número: o que muda no site (diagnóstico, plano, vazamentos, check-ins) vai pro WhatsApp (`/api/painel`, a cada 4s), e o que muda no WhatsApp aparece no site. Quem vem do site pelo *Continuar no WhatsApp* já recebe o link junto. `sair do painel` desconecta todos os navegadores; `apagar meus dados` apaga os links também. O token fica só no navegador; o servidor guarda o hash dele na `wa_sessions` (chave `weblink:<hash>`), válido por 180 dias desde o último uso.

## WhatsApp = dia a dia; ferramentas = site

O WhatsApp cuida **só** do dinheiro que entra e sai: anotar gastos e entradas (texto ou foto do cupom), saldo, quanto ainda dá pra gastar, resumo da semana. **Nenhuma ferramenta roda aqui.** Todas ficam no site: qualquer palavra, objetivo escrito (*quero sair das dívidas*) ou botão antigo que abria uma delas (*diagnóstico*, *dívidas*, *nova dívida*, *quitei*, *13º*, *vazamentos*, *direitos*, *renegociar*, *meta*, *empréstimo*, *posso comprar*, *fatura*, *check-in*, *plano*, *próximo passo*…) responde com o link certo, já logado (`server/whatsapp/site.ts`). *ferramentas* ou *site* manda o link da página inicial, onde a pessoa escolhe o que quer fazer. Conversas de ferramenta que tinham ficado abertas antes são descartadas. O bot também não oferece mais ferramentas sozinho depois de um gasto: o único convite é o do resumo semanal.

`menu`: Como anotar · Saldo do mês · Quanto posso gastar · Gastos de hoje · da semana · do mês · Entradas do mês · Formas de pagamento · Resumo da semana · Meu painel no site.

O caminho de volta é o botão *Continuar no WhatsApp* do resultado do diagnóstico (seção acima): com o diagnóstico importado, o *quanto posso gastar* passa a usar os limites por categoria.

Fatura (legenda "fatura"/"extrato" ou foto que a leitura reconhece como fatura) recebe o link do leitor do site.

## Ofertas no contexto

Não há mais oferta de ferramenta depois de um gasto ou entrada. O único convite que o bot faz sozinho é o do resumo semanal (uma vez por mês, pra quem já anotou alguns gastos e ainda não recebe o resumo). Código em `server/whatsapp/offers.ts`.

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

## Objetivos e atalhos

O objetivo escrito com as próprias palavras (*quero sair das dívidas*, *preciso juntar dinheiro*) ainda é entendido (`server/whatsapp/goals.ts`), mas agora responde com o link da ferramenta certa no site. *Me ajuda* mostra o menu do dia a dia. No site, a página inicial abre com **"O que você quer fazer com o seu dinheiro?"**: seis caminhos (organizar as finanças, ver o mês no painel, anotar gastos, sair das dívidas, juntar dinheiro, decidir uma compra) e o resto em *Mais ferramentas*.

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
