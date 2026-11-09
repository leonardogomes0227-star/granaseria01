# Regras financeiras do Grana Séria

Código: `src/gs/selectores.ts` (`detalheDisponivel`). Testes: `src/gs/disponivel.test.ts`. **Uma só regra para o app inteiro**: `livreParaGastar` e `limiteDiario` leem dela.

## Vocabulário
| Termo | Significa | Confiança |
|---|---|---|
| Saldo conhecido | o que a **pessoa informou** (`config.saldoInformado`, com data) + o que registrou depois | confirmado |
| Receita recebida | `receitas` registradas (tipo `salario` confirma a renda do mês; `extra` soma) | confirmado |
| Renda prevista | `config.renda`, enquanto o salário não foi registrado | **estimado** |
| Despesa realizada | gastos do dia a dia + contas fixas com baixa + pagamentos de dívida | confirmado |
| Pendentes | contas fixas sem baixa, parcelas de dívida do mês, fatura aberta do cartão | confirmado/estimado |
| Reservado | `patrimonioGuardado` (aportes, **fora** os de metas com nome `meta:…`) | confirmado |
| Dinheiro disponível | ver abaixo | confirmado ou estimado, e o app diz qual |

O app **nunca** chama isso de "saldo bancário".

## Dinheiro disponível (por mês) e "pode gastar hoje"
**Modo saldo** (há saldo informado e o mês é o atual):
`saldo informado + receitas depois dele − gastos/contas/dívidas/guardado/faturas pagas depois dele` = saldo estimado hoje; disponível = isso − (contas fixas que faltam pagar + parcelas de dívida ainda não pagas no mês + fatura aberta + reserva combinada que falta guardar + atraso que falta pagar). **O salário previsto não entra** até ser registrado (a tela avisa).

**Modo renda** (sem saldo): `renda efetiva − contas fixas − parcelas − fatura aberta − reserva combinada − atraso − gastos do dia a dia`. Renda efetiva = `max(renda informada, salário registrado) + receitas extras`. Marcado como **estimado** até o salário ser registrado.

**Incompleto** (sem renda e sem saldo): não calcula; pede o dado. Nunca mostra valor inventado.

`pode gastar por dia = max(0, disponível) / dias restantes (hoje incluso)`. Disponível negativo mostra R$ 0 por dia e diz quanto os compromissos passam.

## Sem duplicidade
- **Conta fixa paga**: a fonte é `GastoFixo.pagamentos[mês]`. O histórico mostra uma linha derivada; não existe segunda despesa.
- **Cartão**: compra no cartão não vira gasto (vai para `cartao.usado`); a **fatura aberta** é o compromisso. Pagar a fatura zera o aberto e não é despesa nova.
- **Guardar** sai do disponível uma vez (aporte). Sacar da reserva (valor negativo) devolve.
- **Meta com nome**: guardar para a meta cria um aporte `meta:<id>` (sai do disponível, não infla a reserva de emergência). Excluir a meta passa o valor para a reserva.
- **Receita do WhatsApp** (`incomes`) entra como receita uma vez (pelo `serverId`).

- **Contas e transferências** (`contas`, `transferencias`, `contaId`): só organizam. Transferir entre contas é neutro (não entra em entrou/saiu nem muda o disponível). Conta com transferência não pode ser removida; sem transferências, remover desvincula os lançamentos (nada é apagado).

## Limites conhecidos (honestos)
- Dinheiro é `number` com `arred()` de 2 casas; o banco usa `numeric(12,2)`. Sem centavos inteiros (decisão: não migrar o estado agora).
- Sem contas bancárias separadas, transferências, estornos e pagamento parcial de conta fixa (a baixa aceita o valor pago; o excedente/diferença não gera pendência nova).
- Parcelas de dívida do mês em modo saldo usam a parcela mínima cadastrada.
- Fusos: datas do app usam o fuso de Brasília (`gs/datas.ts`).
