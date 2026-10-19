// Ofertas no contexto: em vez de a pessoa procurar a ferramenta no menu, o assistente sugere a certa
// quando o que ela anotou combina (entrou 13º → "onde colocar", entrou salário → "plano do mês"…).
// No máximo uma oferta por mensagem, e cada tipo só uma vez por mês, pra não virar propaganda.

export interface Offer {
  key: string; // identifica o tipo da oferta (o limite de uma por mês é por tipo)
  text: string;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const EXTRA_INCOME = /\b(13o?|decimo terceiro|decimo|bonus|restituicao|ferias|premio|plr|participacao|rescisao|fgts)\b/;
const SUBSCRIPTION = /\b(netflix|spotify|prime|disney|hbo|max|globoplay|youtube premium|deezer|streaming|assinatura|anuidade|tarifa|mensalidade do app)\b/;
const DEBT = /\b(fatura|rotativo|juros|emprestimo|consignado|cheque especial|financiamento|parcela do|divida)\b/;

export function offerForIncome(source: string, description: string): Offer | null {
  const t = normalize(`${source} ${description}`);
  if (EXTRA_INCOME.test(t)) {
    return { key: 'extra', text: '💡 Dinheiro extra merece um destino. Mande *13º* e eu mostro onde colocar cada real.' };
  }
  if (source === 'Salário') {
    return { key: 'plano', text: '💡 Caiu o salário! Mande *plano* pra ver o que pagar e o que guardar neste mês.' };
  }
  return null;
}

export function offerForExpense(description: string): Offer | null {
  const t = normalize(description);
  if (SUBSCRIPTION.test(t)) {
    return { key: 'vazamentos', text: '💡 Assinaturas e tarifas somem do radar. Mande *vazamentos* e eu mostro quais costumam pesar no mês.' };
  }
  if (DEBT.test(t)) {
    return { key: 'dividas', text: '💡 Tem dívida pesando? Mande *dívidas* e eu mostro qual pagar primeiro.' };
  }
  return null;
}
