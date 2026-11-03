# PROGRESS

**Onde estamos:** app novo no ar (areia e dourado). 5 abas: Início, Meu mês, Ferramentas, Investir, Assistentes. Capa nova pra quem não conhece finanças.

## Feito
- **Visual e estrutura:** tema areia/dourado em todo o site, PWA, 5 abas, avatar abre "Meus dados", capa nova (linguagem simples, glossário, exemplo, FAQ).
- **Ferramentas** (aba Ferramentas, grupos por objetivo, busca e estado em cada uma). Todas no mesmo molde: número principal com anel, "o que fazer agora", conquistas e "Mais ajuda":
  - Sair do atraso (`/plano/atrasos`): acha conta fixa ou parcela de dívida de meses anteriores sem pagamento, estima multa (2%) e juros (1% ao mês), põe na ordem (moradia, luz/água, financiamento, outras, cartão) e monta o plano mês a mês com o que sobra. "Separei", "Paguei" (usa primeiro o separado), "Já tinha pago", "Não devo essa", mensagem pra negociar. O que sai pro atraso desce do "pode gastar". No Início, quando o salário cai, diz o que pagar ou quanto separar (e segura o "guarde 10%" enquanto tiver atraso).
  - Quitar dívidas (painel vivo, contagem até ficar livre, meta do mês, cabe no bolso, vencimento com aviso, falar com o banco).
  - Orçamento, Calendário (contas + parcelas de dívida + fatura), Gastos escondidos (revisão de uso), Reserva de emergência (3/6/12 meses, saque), Dinheiro extra (efeito + histórico), Viver de renda, Posso comprar isso?, À vista ou parcelado, Cartão de crédito (compras parceladas, faturas futuras), Comparar empréstimos (vira dívida ao contratar).
- **Investir:** dados ao vivo (Banco Central, CoinGecko), simulação, chat, plano.
- **Avisos no app:** conta a vencer, parcela de dívida, fatura do cartão, categoria que estourou, salário caiu e não guardou.

## Falta
- **WhatsApp:** lembretes e "paguei 200 do cartão" por mensagem. Precisa do número da API configurado e de modelos de mensagem aprovados pela Meta.
- **Código antigo** com os nomes dos agentes antigos (Dabasir, Bansir, Arkad…) ainda está no repositório, sem rota. A exclusão em massa foi bloqueada pelo ambiente. Precisa de autorização do dono. Depois: `grep -ri "dabasir\|bansir\|arkad\|nomasir\|sharru\|mathon\|rodan" src server api public` até zerar.
- **Supabase:** `supabase/coach.sql` e `supabase/fundacao.sql` seguem pendentes (dono pediu pra deixar pro final).
- **Verificar no ar:** a aba Investir com dados reais (não dá pra testar do ambiente de desenvolvimento). Se der erro, a tela mostra "Detalhe: …".
- **Auditoria final** (Fase 9): matriz de requisitos e relatório com "como testar".
- **Funil de vendas** (landing com captura, eventos, mensagens, n8n): só discutido. Decisões abertas: preço/plano, número do WhatsApp, nomes dos personagens (risco jurídico).
- **Ideias:** ligar as ferramentas no Início (resumo do que fazer hoje), PDF do plano de dívidas, modo casal, compartilhar progresso.

## Notas técnicas
- Store `grana-seria:v1` (localStorage, sincronizado). Telas em `src/gs/`. Lógica pura com teste em `*Logica.ts` e afins (mais de 450 testes).
- Nunca mostrar número de mercado inventado. `ANTHROPIC_API_KEY` só no servidor.
