# O Caminho: como testar (para o dono)

Abra o site no celular, entre pelo link do WhatsApp e siga a ordem abaixo. Cada item diz o que você deve ver.

## 1. Do zero até o primeiro destino (3 minutos)
1. **Meus dados → Limpar tudo e recomeçar** (mantém a conta). Recarregue.
2. Onboarding: informe a renda, pule o resto. No fim aparece o cartão do WhatsApp e o botão **Ver meu caminho**.
3. Na tela **Seu caminho**: o cartão do destino com a moeda, o marco em letras grandes e a data, "Ver o caminho todo" e "Como cheguei nessa data" (as premissas).

## 1b. O seu plano (o Coach escolhe o que aparece)
- Na tela inicial, toque em **Monte o seu plano**. Três perguntas: o que resolver primeiro (os marcados com ★ são o que os seus números pedem), o que não quer ver agora e o ritmo.
- Depois de **Usar este plano**: só 3 passos na tela e só as ferramentas do plano. As outras ficam em "Todas as ferramentas" e recolhidas em cada área, com "Colocar no meu plano".
- Registre uma receita extra (13º): aparece "O Coach indica: Dinheiro extra", com **Liberar**.

## 2. O dia a dia
4. Toque no **+** no centro da barra: anote um gasto (valor → categoria → Salvar). O "Hoje você pode gastar" muda na hora.
5. No **+**, "Anotar por foto (cupom ou pix)": só funciona com a `ANTHROPIC_API_KEY` na Vercel. Sem ela, o site avisa e sugere o WhatsApp.
6. Cadastre uma conta fixa com vencimento de alguns dias atrás. Em **Seus passos deste mês** ela vira o passo 1, com **Pagar agora**. Pague: vem a festa do marco "Em dia com as contas" e o destino passa para o próximo marco.

## 3. Decidir com o caminho
7. **Gastos → Posso comprar isso?**: digite um valor alto. Aparece "Impacto no seu caminho" (de que mês para que mês) e **Colocar no meu caminho**. Volte ao Caminho: o passo está na lista.
8. Faça o mesmo em À vista ou parcelado, Empréstimo, Onde cortar, Gastos escondidos e Dinheiro extra.

## 4. Coach
9. Toque em **Coach** no topo. Os 9 assuntos funcionam sem IA. Abra "Quero sair das dívidas": compara bola de neve e maior juro, dá a data de liberdade e oferece o cartão [Fazer] [Ajustar] [Agora não].
10. Abra o Coach a partir de Quitar dívidas: o primeiro assunto já é "Quero sair das dívidas".
11. Na busca **O que você quer resolver?**, digite algo que não existe: aparece "Pergunte ao Coach" com o texto levado junto.
12. Com a chave de IA ativa, escreva uma pergunta livre: a resposta usa as ferramentas do servidor (os números batem com as telas) e as ações chegam como cartões.

## 5. Voltar depois
13. Feche o app e volte depois de um dia: no topo do Caminho aparece **Bem-vindo de volta** com o que mudou e "Continuar de onde parei" (rola até o passo com um brilho dourado).

## 6. Links antigos
14. Abra `/plano`, `/mes`, `/relatorios`, `/ferramentas/quitar-dividas` e um link antigo do WhatsApp: todos abrem a tela certa.

## Checklist da verificação final (Etapa 9)

| Item | Caminho | Pagar | Gastos | Guardar | Perfil | Coach | Ferramentas |
|---|---|---|---|---|---|---|---|
| 1 botão dourado principal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| nenhum aviso repetido (motor único `passos.ts`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| números só dos selectores e lógicas puras | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| estado vazio | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| sem jargão sem explicação | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| toque ≥ 44px (medido no navegador) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓* | ✓ |
| contraste AA (axe, 390px) | ✓ | ✓ (corrigido) | ✓ | ✓ | ✓ | ✓ | ✓ |

\* os interruptores de aviso do Coach medem 52×32 na tela, com área de toque ampliada por CSS.

**Medições:** 40 capturas (10 telas × 360, 390 e 1280px e fonte a 130%) sem rolagem lateral e sem erro de página; axe (WCAG A e AA) sem violações depois da correção de contraste; Lighthouse mobile na página inicial pública: desempenho 87, acessibilidade 100, boas práticas 100, SEO 100. Fluxo ponta a ponta automatizado: onboarding → destino → anotar gasto → pagar atrasada → festa e marco avança → Coach "posso comprar" → impacto → colocar no caminho → voltar 2 dias depois → Bem-vindo de volta → brilho no passo.

**Limites honestos:**
- O MVP `docs/referencia/grana-seria-referencia.html` não estava no repositório; o visual seguiu a seção 8 do prompt e a skill de design pedida pelo dono.
- A foto no + e a conversa livre do Coach dependem da `ANTHROPIC_API_KEY` na Vercel. Sem ela tudo o mais funciona e o app diz o que está desligado.
- Só Chromium foi testado (sem Safari e Firefox). Sem teste com pessoas reais.
- A "Resposta em uma frase + Como cheguei nisso" foi aplicada nas 6 ferramentas de decisão; as demais mantêm o "o que fazer agora" que já tinham. Salvar a etapa das ferramentas de vários passos ("Continuar passo 2 de 4") está pronto no estado e no registro, mas ainda não é gravado por cada ferramenta.
- O Lighthouse mediu a página pública; as telas logadas foram medidas por axe e pelas capturas.
