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
