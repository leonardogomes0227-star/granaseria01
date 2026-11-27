# Fila de espera, convite, preço de fundador e corte de acesso

Nada disto liga sozinho. Enquanto você não fizer os passos 1 a 3, o app continua aberto para todos.

## 1. Banco de dados (uma vez)
Supabase → SQL Editor → cole e rode `supabase/acesso.sql`. Cria `fila_espera` e `acessos` (só o servidor lê e grava).

## 2. Variáveis na Vercel
| Variável | Para quê |
|---|---|
| `CAKTO_WEBHOOK_SECRET` | segredo do aviso de pagamento da Cakto (você escolhe; o mesmo vai no passo 3) |
| `ADMIN_SECRET` | já existe; protege a lista da fila e o botão de chamar os próximos |
| `ACESSO_CORTE` | data limite de quem já usava, em ISO. Ex.: `2026-12-10T23:59:00-03:00` |
| `ACESSO_NOVOS_DESDE` | **quem chega depois não ganha o prazo**: contas criadas depois dessa data precisam de convite e assinatura. Use o dia em que ligar o `ACESSO_MODO`. Ex.: `2026-11-30T00:00:00-03:00`. Vale só para contas por e-mail; contas só de WhatsApp contam como antigas |
| `ACESSO_MODO` | **só quando estiver pronto**: `convite`. Sem ela (ou com outro valor), ninguém é cortado |
| `FILA_LIBERA_EM_SEGUNDOS` | quanto a tela de espera dura antes de liberar o convite. Padrão: 20. Zero libera na hora. No máximo 3600. Não cria assinatura |

## 3. Aviso de pagamento (Cakto)
Cakto → Integrações → Webhooks → adicionar:
- **URL:** `https://www.granaseria.com.br/api/cakto`
- **Segredo:** o mesmo de `CAKTO_WEBHOOK_SECRET`
- **Eventos:** compra aprovada, renovação, cancelamento, reembolso, chargeback.

Faça uma compra de teste e olhe os logs da Vercel (`cakto: ...`): confirma que o aviso chegou. O servidor reconhece **preço de fundador pelo valor pago**: mensal até R$ 25 e anual abaixo de R$ 250. Se mudar os preços, ajuste em `api/cakto.ts`.

## 4. Como funciona para a pessoa
- **Quem já usava** (modo `convite`): vê um aviso com o prazo e os dois links de fundador (mensal e anual). Até `ACESSO_CORTE` o acesso segue. Depois, sem assinatura, o app mostra "acesso encerrado", com os links, **Baixar os meus dados** e o contato.
- **Quem chega agora:** deixa nome e WhatsApp na página inicial. A tela diz "Preparando seu acesso" e, depois de `FILA_LIBERA_EM_SEGUNDOS`, o convite abre sozinho. A página não mostra posição nem quantidade de pessoas. O convite só destrava os botões de assinar. A assinatura paga continua só pelo webhook da Cakto.
- **/planos:** os botões de assinar também só abrem para quem tem convite válido.
- **Convite manual:** o passo 5 continua valendo, se quiser chamar um grupo na hora. Quem já está convidado ou ativo não é mexido. Quem foi recusado não é liberado sozinho.

## 5. Chamar a próxima onda
```
curl -X POST https://www.granaseria.com.br/api/fila \
  -H "Authorization: Bearer $ADMIN_SECRET" -H "Content-Type: application/json" \
  -d '{"acao":"convidar","quantidade":50,"dias":7}'
```
Devolve `nome`, `whatsapp`, `codigo` e `ate` de cada chamado. Para ver a fila toda: `GET /api/fila?lista=1` com o mesmo cabeçalho.

## 6. Mensagens (WhatsApp)
Mensagens que **você** inicia precisam de modelo aprovado pela Meta. Textos sugeridos:

**Fundadores (quem usa com frequência)**
> Oi, {nome}! Você está com a gente desde o começo e isso fez diferença no Grana Séria. Estamos abrindo o plano oficial e quero que você continue com preço de fundador: R$ 20 por mês (ou R$ 200 por ano), fixo enquanto a assinatura estiver ativa. O seu acesso segue liberado até {data}. Garanta aqui: {link}. Se preferir não continuar, tudo bem: dá para baixar os seus dados em Meus dados.

**Convite da fila**
> {nome}, a sua vez chegou. O seu convite do Grana Séria vale até {data}: {link do convite}.

**Lembrete (um dia antes do fim)**
> {nome}, o seu convite vence amanhã. Garanta a sua vaga: {link do convite}.

Enquanto os modelos não estão aprovados, o bot só responde a quem escreveu nas últimas 24 horas.

## 7. Lançar com segurança
1. Rode o passo 1 e teste a fila na página pública.
2. Configure o webhook (passo 3) e faça uma compra de teste.
3. Defina `ACESSO_CORTE` com uma data **a pelo menos 10 dias** e `ACESSO_NOVOS_DESDE` com a data de hoje.
4. Só então coloque `ACESSO_MODO=convite`. Para desfazer na hora: apague a variável.
5. Em qualquer erro do servidor de acesso o app **libera**: cortar só acontece quando o servidor tem certeza.
