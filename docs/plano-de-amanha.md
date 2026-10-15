# Onde paramos (15/10/2026) e o que vem a seguir

## Estado atual: FASE DE TESTE (sem gastar nada ainda)
- Bot do WhatsApp no ar no **número oficial** (+55 67 99608-5267, "Grana Séria"), registrado na Meta, com a verificação da empresa **aprovada** e o webhook ligado.
- Dados da Meta: app `1089161990666692`, conta do WhatsApp Business (WABA) `964938020005688`, Phone Number ID `1346290138574545`.
- **Modo aberto ligado** (`WHATSAPP_OPEN=true`, PR #20): qualquer número que mandar mensagem é atendido. Como ainda é teste, só divulgar pra amigos e família.
- 14 ferramentas, coach (próximo passo, voz da Babilônia, orçamento 🟢🟡🔴, feedback 👍/👎, "apagar meus dados"), começo rápido de 3 perguntas e diagnóstico. Testado pelo dono e pela namorada: tudo respondeu certo.
- O número de teste antigo (+1 555 650-7892) não é mais usado.

## O que não custa nada (dá pra testar à vontade)
- Responder quem escreveu primeiro no WhatsApp é gratuito (janela de 24h).
- Sem `ANTHROPIC_API_KEY` na Vercel, o bot usa só as regras simples e **não gasta IA**. Também não lê fatura.
- Vercel Hobby, Supabase grátis e verificação da Meta já feita: custo zero hoje.

## Roteiro de testes (fazer com amigos e anotar o que travou)
1. `oi` → `rápido` → `próximo passo`.
2. `diagnóstico` completo, escolhendo por onde começar.
3. Gastos: `gastei 35 no mercado`, várias despesas numa frase, `hoje`, `semana`, `mês`, `apagar` (desfaz o último).
4. As ferramentas: 13º, caça-vazamentos, direitos, calculadoras, frase do dia, selos, check-in.
5. `plano`, `paguei`, `não paguei`.
6. 👍/👎 com a nota do que faltou.
7. `apagar meus dados`: conferir que apaga mesmo.
8. Vincular a conta do site: `VINCULAR 123456` (precisa do login por e-mail).
9. Mensagens estranhas: áudio, figurinha, texto sem sentido.
10. Olhar a aba **Logs** da Vercel (`/api/whatsapp`) e a tabela `wa_events` no Supabase pra ver onde as pessoas travam.

## Ajustes pendentes
1. Ajustar o bot com o feedback dos testes.
2. Adaptar o texto do plano no **site** (ainda diz "Libere R$ X nos gastos"; o WhatsApp já pergunta por onde começar).
3. Ideias adiadas: áudio (precisa de outro serviço de transcrição), foto de recibo, outros gastos como categoria, metas com nome.

## Só quando for gastar (não fazer antes)
- **Trocar as chaves expostas no chat:** chave `service_role` do Supabase, token do WhatsApp, segredo do app e token de verificação. Atualizar na Vercel e no webhook da Meta (token de verificação), e fazer Redeploy.
- **IA:** `ANTHROPIC_API_KEY` (créditos em platform.claude.com) com `WHATSAPP_AI_MODEL=claude-haiku-5-5` e `WHATSAPP_AI_DAILY_LIMIT` pra segurar o custo. Liga a IA nas frases soltas e a leitura de fatura.
- **Lembrete mensal:** criar o modelo `lembrete_plano` (Utilidade, pt_BR) no WhatsApp Manager, adicionar forma de pagamento na Meta, e definir `CRON_SECRET`, `WHATSAPP_REMINDER_TEMPLATE` e `SITE_URL`.
- **Perfil do número:** subir a foto (640x640) e a descrição; corrigir o telefone do MEI na Receita.
- **Vercel Pro** (o Hobby é só uso não comercial), **LGPD** (política e termos), regras da CVM e limites do MEI.
- Decidir preço (grátis ou R$ 27) e cobrança; e-mail de contato; analytics.
- Se quiser voltar ao modo fechado: apagar `WHATSAPP_OPEN` e usar `ALLOWED_NUMBERS`.
