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
| `hoje` | Lista os gastos de hoje |
| `semana` | Total desde segunda, por categoria |
| `mês` / `resumo` | Total do mês, por categoria |
| `apagar` | Desfaz o último registro |
| `oi` / `ajuda` | Mostra os comandos |

Categorias automáticas: Alimentação, Transporte, Moradia, Saúde, Lazer, Compras, Educação e Outros.

---

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

## Começar pelo objetivo da pessoa

Quem chega pela primeira vez não vê uma lista de ferramentas: o bot pergunta **"o que você quer resolver agora?"** e mostra os objetivos
(sair das dívidas, juntar dinheiro, controlar os gastos, achar dinheiro que sobra, usar o 13º ou um extra, decidir uma compra, comparar empréstimos,
conhecer os direitos, organizar tudo). Cada um explica em uma frase o que vai acontecer e já abre a ferramenta certa.
Quem preferir escrever com as próprias palavras também é entendido, quando a frase começa declarando o objetivo:
*quero sair das dívidas*, *preciso juntar dinheiro pra viajar*, *como faço pra guardar dinheiro?*, *me ajuda* (mostra a lista).
A palavra *objetivo* abre a lista a qualquer hora. As escolhas aparecem no painel `/admin`, em "O que as pessoas querem resolver".
O código está em `server/whatsapp/goals.ts`.

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
