# Onde paramos (13/10/2026) e o que vem a seguir

## Estado atual
- Bot do WhatsApp no ar no **número de teste** (+1 555 650-7892), com 14 ferramentas, leitura de fatura (precisa de `ANTHROPIC_API_KEY`) e o "coach" (próximo passo, voz da Babilônia, orçamento 🟢🟡🔴, feedback 👍/👎, "apagar meus dados").
- Mergeados hoje: coach (#16), começo rápido de 3 perguntas (#17), diagnóstico que deixa a pessoa escolher por onde começar (#18).
- Testadores liberados na Meta e no `ALLOWED_NUMBERS`: o dono, o primo e o tio. O tio já foi atendido (logs 200). Primo: confirmar se mandou "oi" e se respondeu.
- Número de teste não aceita foto/nome de perfil (limite da Meta). A foto (640x640) está pronta para o número oficial.

## Conferir amanhã (rápido)
1. Vercel → Deployments: o último deploy está **Ready**?
2. Supabase: rodou `supabase/whatsapp-metrics.sql`? (tabela `wa_events`)
3. Feedback do tio e do primo: o que travou, o que não entenderam, o 👎 com a nota do que faltou.
4. Testar no zap: `oi` → `rápido` → `diagnóstico` → `próximo passo` → gastar algo → `apagar meus dados`.

## Próximos passos (em ordem)
1. Ajustar o bot com o feedback dos testes.
2. (Opcional) `ANTHROPIC_API_KEY` na Vercel (+ `WHATSAPP_AI_MODEL=claude-haiku-5-5` para custo menor) e Redeploy: liga a IA nas frases soltas e a leitura de fatura.
3. Adaptar o texto do plano no **site** (ainda diz "Libere R$ X nos gastos"; o WhatsApp já pergunta por onde começar).
4. Ideias adiadas: áudio (precisa de outro serviço de transcrição), foto de recibo, outros gastos como categoria, metas com nome, lembretes automáticos (precisam de modelo aprovado e número oficial).

## Antes de abrir para o público (não fazer antes)
- **Trocar as chaves expostas no chat:** chave secreta do Supabase, token do WhatsApp, segredo do app e token de verificação.
- Número oficial: desbloquear o chip (67 99608-5267), adicionar na Meta, `POST {WABA}/subscribed_apps`, atualizar `WHATSAPP_PHONE_NUMBER_ID` e `VITE_WHATSAPP_NUMBER`, criar o modelo `lembrete_plano` (pt_BR), corrigir o telefone do MEI na Receita, subir a foto de perfil.
- Plano da Vercel (Hobby é só uso não comercial), LGPD, regras da CVM e limites do MEI.
- Decidir preço (grátis ou R$ 27) e cobrança; e-mail de contato; analytics.
