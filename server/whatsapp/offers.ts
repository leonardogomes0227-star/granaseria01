// O único convite que o assistente faz sozinho: o resumo semanal (é sobre os próprios gastos).
// No WhatsApp ficam só as entradas e as saídas: nenhuma ferramenta é oferecida aqui. Cada convite só uma vez por mês.

export interface Offer {
  key: string; // identifica o tipo do convite (o limite de um por mês é por tipo)
  text: string;
}

/** Convite pro resumo semanal (o resumo só é mandado pra quem pediu). */
export const SUMMARY_OFFER: Offer = {
  key: 'resumo',
  text: '💡 Quer que eu te mande um resumo da semana todo domingo, aqui no WhatsApp? Mande *resumo semanal*.',
};
