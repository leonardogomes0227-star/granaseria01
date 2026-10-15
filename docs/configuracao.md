# Configuração — métricas, conta, WhatsApp, leitor de fatura e Google

Tudo no site funciona sem configurar nada (os dados ficam no navegador da pessoa).
Cada parte abaixo **liga sozinha** quando as variáveis existem na Vercel
(**Settings → Environment Variables**, ambiente *Production*). Depois de salvar variáveis,
faça **Deployments → ⋯ → Redeploy**.

| Parte | Precisa de | Custo |
|---|---|---|
| 1. Métricas | conta no Plausible (e/ou Pixel da Meta) | Plausible: a partir de ~US$ 9/mês (30 dias grátis) |
| 2. Conta (login) | projeto no Supabase | grátis até 50 mil usuários/mês |
| 3. WhatsApp vinculado + lembrete | parte 2 + o assistente do [`whatsapp-assistente.md`](./whatsapp-assistente.md) | lembrete: alguns centavos por mensagem (modelo "Utilidade") |
| 4. Leitor de fatura | parte 2 + chave da API da Anthropic | centavos por leitura; limite de 5 leituras/pessoa/mês |
| 5. Google | nada (já vem no build) | grátis |
| 6. Painel do dono | parte 2 + `ADMIN_SECRET` | grátis |

---

## 1. Métricas (Plausible)

1. Crie a conta em **plausible.io** → **Add website** → domínio `granaseria.com.br` (ou o seu).
2. Na Vercel: `VITE_PLAUSIBLE_DOMAIN` = o mesmo domínio.
3. No Plausible, em **Site settings → Goals → Add goal → Custom event**, cadastre os eventos que quer acompanhar:

| Evento | Quando acontece |
|---|---|
| `diagnostico_iniciado` | clicou em fazer o diagnóstico |
| `diagnostico_etapa` | chegou em cada etapa (propriedade `etapa`) |
| `diagnostico_concluido` | viu o resultado |
| `plano_seguido` | começou a seguir o plano mês a mês |
| `mes_fechado` | fechou um mês do plano (`cumprido` true/false) |
| `ferramenta_aberta` | abriu uma ferramenta (`ferramenta`) |
| `vazamento_marcado`, `mensagem_copiada`, `fatura_lida`, `guia_lido` | uso das ferramentas |
| `login_link_enviado`, `login_feito`, `whatsapp_vinculado` | conta |
| `checkout_clique` | clicou em comprar |

4. Em **Funnels**, monte: `diagnostico_iniciado` → `diagnostico_concluido` → `plano_seguido` → `mes_fechado`.
   É esse funil que mostra onde as pessoas desistem.

**Pixel da Meta (opcional, pra anúncios):** `VITE_META_PIXEL_ID` = o ID do pixel (Gerenciador de Eventos da Meta).
Os mesmos eventos chegam lá como eventos personalizados. Nenhum evento manda valores em reais.

## 2. Conta (Supabase)

Use o mesmo projeto do assistente de WhatsApp, se já tiver criado.

1. **SQL Editor → New query**: rode [`supabase/whatsapp.sql`](../supabase/whatsapp.sql) (se ainda não rodou) e depois [`supabase/conta.sql`](../supabase/conta.sql).
2. **Authentication → URL Configuration**:
   - **Site URL:** `https://granaseria.com.br`
   - **Redirect URLs:** adicione `https://granaseria.com.br/conta`
3. **Authentication → Email Templates → Magic Link** (opcional): troque o texto pra português, ex.:
   *"Seu link de acesso à Grana Séria: {{ .ConfirmationURL }}"*.
   O e-mail padrão do Supabase tem limite baixo de envios por hora — quando tiver volume, configure um SMTP próprio
   (Resend, Brevo…) em **Project Settings → Authentication → SMTP**.
4. **Project Settings → API**, copie e coloque na Vercel:

| Variável | Valor |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | chave **anon public** (essa pode ir pro navegador; quem protege os dados são as regras do `conta.sql`) |
| `SUPABASE_URL` | Project URL (de novo, agora pro servidor) |
| `SUPABASE_SERVICE_ROLE_KEY` | chave **service_role** (secreta — só na Vercel) |

Com isso aparece "Entrar" no menu. O login é por link no e-mail, sem senha.

## 3. WhatsApp vinculado e lembrete mensal

Pré-requisito: o assistente configurado conforme [`whatsapp-assistente.md`](./whatsapp-assistente.md).

**Vincular:** em *Minha conta*, a pessoa toca em "Vincular meu WhatsApp" e manda `VINCULAR 123456` pro número.
O número vem do próprio WhatsApp, então ninguém vincula o número de outra pessoa.
Quem vinculou pode usar o assistente mesmo fora do `ALLOWED_NUMBERS`.

**Abrir pra todo mundo:** na Vercel, `WHATSAPP_OPEN` = `true` e Redeploy. Qualquer número que mandar mensagem é atendido,
sem precisar do `ALLOWED_NUMBERS`. Pra voltar ao modo fechado, apague a variável (ou use `false`) e faça Redeploy.
Antes de ligar, confira o custo da IA (`WHATSAPP_AI_DAILY_LIMIT`, `FATURA_MONTHLY_LIMIT`), a LGPD e a troca das chaves.

**Comandos novos:** `plano`, `paguei`, `não paguei`, `lembrete 5`, `parar lembretes`, `voltar lembretes`.

**Lembrete:** a Vercel chama `/api/lembretes` todo dia às 9h (Brasília) — está em `vercel.json`, nada pra fazer lá.
Fora da janela de 24h, a Meta só entrega **modelos aprovados**, então crie o modelo:

1. **business.facebook.com → WhatsApp Manager → Modelos de mensagem → Criar modelo**
   - Categoria: **Utilidade**
   - Nome: `lembrete_plano` · Idioma: **Português (BR)**
   - Corpo:
     > Oi! Hoje é dia do seu plano Grana Séria: {{1}}. Quando pagar, responda PAGUEI. Pra ver os detalhes, responda PLANO.
   - Exemplo do {{1}}: `R$ 800 em Cartão Nubank e R$ 350 em Empréstimo`
2. Espere a aprovação (costuma levar minutos).
3. Na Vercel:

| Variável | Valor |
|---|---|
| `CRON_SECRET` | invente uma senha longa (a Vercel usa pra chamar o lembrete) |
| `WHATSAPP_REMINDER_TEMPLATE` | `lembrete_plano` (se usar outro nome) |
| `SITE_URL` | `https://granaseria.com.br` (usado nos links das mensagens e no sitemap) |

## 4. Leitor de fatura com IA

1. Crie a conta em **platform.claude.com** → **API Keys → Create Key**. Coloque créditos em **Billing**.
2. Na Vercel: `ANTHROPIC_API_KEY` = a chave. Opcional: `FATURA_MONTHLY_LIMIT` (padrão 5 leituras por pessoa por mês).
3. A mesma chave liga o **assistente inteligente do WhatsApp** (entende perguntas, vários gastos numa frase, "ontem gastei…", correções). Sem a chave, o bot segue só com as regras simples. Opcional: `WHATSAPP_AI_MODEL` (padrão `claude-opus-5-5`; `claude-haiku-5-5` deixa cada resposta muito mais barata).

O leitor só funciona pra quem está logado (parte 2) — é assim que o limite por pessoa é contado.
O arquivo vai pra API, a leitura volta pro navegador e nada é guardado.

## 6. Painel do dono (`/admin`)

Mostra quantas pessoas usam o assistente do WhatsApp, quantas estão ativas (hoje, 7 e 30 dias), quanto tempo ficam usando (dias de uso, quem volta),
onde chegam no funil (oi → começo rápido → diagnóstico → plano), as ferramentas mais abertas e o feedback 👍/👎 com as notas.

1. Rode `supabase/whatsapp-metrics.sql` (tabela `wa_events`), se ainda não rodou.
2. Na Vercel: `ADMIN_SECRET` = uma senha longa que só você sabe. Redeploy.
3. Abra `https://granaseria.com.br/admin` e digite a senha.

O painel não guarda nem mostra telefone: as métricas usam só um hash de cada pessoa. A contagem de mensagens e de dias de uso começa a valer
a partir do deploy que trouxe o painel (os eventos antigos entram nas contagens de pessoas, funil e feedback). A página fica fora do Google (`noindex` e `Disallow` no robots).

## 5. Google

O build já gera uma página estática pra cada guia e ferramenta, mais `sitemap.xml` e `robots.txt`.

1. Acesse **search.google.com/search-console** → **Adicionar propriedade** → prefixo de URL `https://granaseria.com.br`.
2. Verifique pelo método **Tag HTML** (cole a meta tag no `index.html`, no `<head>`) e faça o deploy.
3. Em **Sitemaps**, envie `sitemap.xml`.

Os guias ficam em `src/guides.ts`: pra criar um novo, copie um bloco, mude o `slug`, o texto e a ferramenta do `cta`.
