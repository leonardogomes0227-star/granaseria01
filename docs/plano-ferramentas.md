# Plano: ferramentas mais usáveis

## O problema
- São 14 ferramentas em um menu. As pessoas usam só o assistente de anotar (e o que escreveram foi "um sistema pra colocar o dinheiro que entra").
- As ferramentas **pedem dados que o assistente já tem**. Ex.: "Vale a pena comprar?" pergunta a renda, mesmo a pessoa já tendo anotado as entradas do mês.
- A pessoa precisa **saber que a ferramenta existe** e ir procurá-la no menu. Quase ninguém vai.

## A ideia
**O assistente é o produto. As ferramentas viram respostas dele, na hora certa e com os dados que ele já tem.** Ninguém abre "calculadora": a pessoa conta uma situação e o assistente usa a ferramenta certa.

## 1. Usar o que o assistente já sabe (perguntar zero)
| Ferramenta | Hoje | Depois |
|---|---|---|
| Vale a pena comprar | pergunta renda e preço | `posso comprar tênis 300?` → "Seu saldo é R$ X. Ficaria R$ Y, dá R$ Z por dia até o fim do mês" |
| Diagnóstico | 20+ perguntas | Pré-preenchido com entradas e gastos dos últimos 30 dias. A pessoa só confirma ("sua renda é R$ 3.000, certo?") |
| Meta | pergunta valor e prazo | Já diz "com seu saldo, dá pra juntar isso em N meses" |
| Plano do mês | só com diagnóstico | Cai sozinho quando entra o salário: "caiu o salário: separe R$ X pra você, R$ Y pra dívida" |

## 2. Aparecer na hora certa (contexto, não menu)
| Quando | O assistente oferece |
|---|---|
| Entrou 13º, restituição, bônus | 13º e dinheiro extra (onde colocar cada real) |
| Entrou salário | Plano do mês (pagar-se primeiro, separar o que guardar) |
| Gasto com Netflix, Spotify, tarifa, anuidade | Caça-vazamentos |
| Gasto no "cartão" cresce, ou a pessoa fala em dívida | Dívidas (qual pagar primeiro) |
| Gastou mais de 70% de uma categoria | Quanto ainda pode gastar ali |
| Pergunta "posso comprar…?" | Vale a pena comprar, com o saldo real |
| Passou o dia 25 | Check-in do mês |

Regra: **uma oferta por vez, com botão "sim / agora não"**, e nunca duas ofertas seguidas. Se disser "agora não", não oferece a mesma de novo por 30 dias.

## 3. Menos ferramentas à vista (14 → 5 "trabalhos")
1. **Anotar** (gastos, entradas, forma de pagamento)
2. **Meu mês** (saldo, quanto dá por dia, por categoria, por forma de pagamento)
3. **Meu plano** (diagnóstico + plano + check-in, tudo junto)
4. **Sair das dívidas** (dívidas + empréstimo + leitura de fatura)
5. **Guardar e proteger** (meta, longo prazo, 13º, vazamentos, direitos)

Selos e frase do dia deixam de ser ferramentas: viram o fechamento da mensagem semanal.

## 4. Fazer a pessoa voltar (sem ela lembrar)
- **Resumo da semana** (domingo): "você gastou R$ X, entrou R$ Y, sobram R$ Z por dia". Termina com 1 oferta de ferramenta.
- **Resumo do mês** no dia 1.
- Precisa de modelo de mensagem aprovado na Meta (utilidade) e do CRON já previsto em `api/lembretes.ts`.

## 5. Anotar sem digitar
- Áudio ("gastei trinta e cinco no mercado no pix").
- Foto do cupom / comprovante de pix.
- É o que mais reduz esforço e o que mais compete com apps que importam do banco.

## Ordem sugerida
1. **Semana 1:** "posso comprar X?" com saldo real + ofertas no contexto (13º, salário, vazamentos). Pouco código, já muda a sensação do produto.
2. **Semana 2:** diagnóstico pré-preenchido + menu em 5 trabalhos.
3. **Semana 3:** resumo semanal automático (depende da Meta aprovar o modelo).
4. **Depois:** áudio e foto do cupom.

## Como saber se funcionou (já temos `wa_events` e o painel `/admin`)
- % de quem anota o 2º gasto e volta no dia seguinte.
- % que aceita uma oferta ("sim") versus "agora não".
- Quantas ferramentas são abertas por oferta versus pelo menu (se o menu quase não for usado, o plano está dando certo).
- Quem volta em outro dia da semana.

## Decisões que são suas
- O que fica grátis e o que é pago (ex.: anotar grátis; plano do mês, resumos e leitura de fatura no pago).
- Se vale ligar a IA (`ANTHROPIC_API_KEY`) já: ela entende frases soltas e áudio transcrito, mas tem custo.
