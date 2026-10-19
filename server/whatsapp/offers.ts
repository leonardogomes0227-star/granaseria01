// Ofertas no contexto: em vez de a pessoa procurar a ferramenta no menu, o assistente sugere a certa
// quando o que ela anotou combina (entrou 13º → "onde colocar", entrou salário → "plano do mês"…).
// No máximo uma oferta por mensagem, e cada tipo só uma vez por mês, pra não virar propaganda.
// As ferramentas ficam no site: a oferta traz o link.

import { siteLink } from './site.js';

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
    return { key: 'extra', text: `💡 Dinheiro extra merece um destino. Veja onde colocar cada real: ${siteLink('extra')}` };
  }
  if (source === 'Salário') {
    return { key: 'plano', text: `💡 Caiu o salário! Separe logo uma parte pra você, antes de gastar. Pra saber quanto, o diagnóstico monta seu plano: ${siteLink('diag')}` };
  }
  return null;
}

export function offerForExpense(description: string): Offer | null {
  const t = normalize(description);
  if (SUBSCRIPTION.test(t)) {
    return { key: 'vazamentos', text: `💡 Assinaturas e tarifas somem do radar. Veja quais costumam pesar e como cancelar: ${siteLink('vazamentos')}` };
  }
  if (DEBT.test(t)) {
    return { key: 'dividas', text: `💡 Tem dívida pesando? Veja qual pagar primeiro: ${siteLink('dividas')}` };
  }
  return null;
}

/** Convite pro resumo semanal (o resumo só é mandado pra quem pediu). */
export const SUMMARY_OFFER: Offer = {
  key: 'resumo',
  text: '💡 Quer que eu te mande um resumo da semana todo domingo, aqui no WhatsApp? Mande *resumo semanal*.',
};
