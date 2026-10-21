import type { ToolId } from './tools';

// Começo, meio e fim de cada ferramenta, em palavras simples: aparece no painel dela, com o passo em que a pessoa está.
export const JOURNEYS: Partial<Record<ToolId, [string, string, string]>> = {
  bills: ['Cadastre suas contas e dívidas', 'Marque cada uma como paga no dia', 'Mês sem atraso e sem multa'],
  debts: ['Coloque as dívidas e quanto dá pra pagar', 'Pague na ordem, uma de cada vez', 'Livre das dívidas'],
  tracker: ['Comece a seguir o seu plano', 'Todo mês, diga se fez o que o plano pedia', 'Reserva pronta e dinheiro rendendo'],
  goal: ['Diga o objetivo e o valor', 'Guarde a parte do mês, todo mês', 'Objetivo alcançado'],
  richdad: ['Veja o seu placar de hoje', 'Guarde e quite dívidas: o placar sobe', 'O dinheiro rendendo paga suas contas'],
  leaks: ['Marque o que você paga todo mês', 'Cancele o que você não usa', 'O que sobrava indo pro plano'],
  rights: ['Escolha o seu problema', 'Mande a mensagem pronta pro banco', 'Resolvido, sem pagar a mais'],
  loan: ['Coloque as propostas', 'Compare o custo total de cada uma', 'Assine só a mais barata, ou nenhuma'],
  extra: ['Diga quanto vai entrar', 'Separe cada parte no destino certo', 'Plano adiantado'],
  fatura: ['Mande a fatura', 'Veja os juros e as cobranças escondidas', 'Cancele o que você não reconhece'],
  impulse: ['Diga o preço da compra', 'Veja quanto custa em dias de trabalho', 'Compre só se couber no plano'],
};
