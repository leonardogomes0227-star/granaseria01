// Caça-vazamentos e direitos do consumidor financeiro.
// Cada vazamento tem um valor típico (editável) e uma mensagem pronta pra resolver.
// O que a pessoa marca fica salvo e entra no plano de ação como dinheiro a mais por mês.

export interface Leak {
  id: string;
  title: string;
  what: string; // como descobrir se acontece com você
  typical: number; // economia típica por mês, em R$
  fix: string; // o que fazer
  message?: string; // texto pronto pra mandar
}

export const LEAKS: Leak[] = [
  {
    id: 'assinaturas',
    title: 'Assinaturas esquecidas',
    what: 'Streaming, apps, academia, "teste grátis" que virou cobrança. Procure cobranças que se repetem todo mês na fatura do cartão.',
    typical: 60,
    fix: 'Cancele o que você não usou nos últimos 30 dias. Assinaturas pelo celular se cancelam em Configurações → Assinaturas (iPhone) ou Play Store → Pagamentos e assinaturas (Android).',
  },
  {
    id: 'tarifa',
    title: 'Pacote de tarifas do banco',
    what: 'Olhe no extrato se aparece "tarifa", "cesta" ou "pacote de serviços" todo mês.',
    typical: 40,
    fix: 'Todo banco é obrigado a oferecer os serviços essenciais de graça (Resolução CMN 3.919/2010). Peça a troca do pacote pelos serviços essenciais gratuitos, ou leve a conta pra um banco digital sem tarifa.',
    message:
      'Olá! Quero cancelar o pacote de tarifas da minha conta e passar a usar apenas os serviços essenciais gratuitos, conforme a Resolução CMN nº 3.919/2010. Peço a confirmação do cancelamento e o protocolo do atendimento. Obrigado!',
  },
  {
    id: 'anuidade',
    title: 'Anuidade do cartão',
    what: 'Procure "anuidade" ou "tarifa de anuidade" na fatura.',
    typical: 35,
    fix: 'Peça isenção — muitos bancos isentam pra não perder o cliente. Se não isentarem, troque por um cartão sem anuidade.',
    message:
      'Olá! Estou sendo cobrado de anuidade no meu cartão e gostaria de pedir a isenção. Se não for possível, peço o cancelamento do cartão. Aguardo retorno com o protocolo. Obrigado!',
  },
  {
    id: 'seguros',
    title: 'Seguros que você não pediu',
    what: 'Seguro de cartão, "proteção" de conta, seguro prestamista no empréstimo. Procure "seguro" ou "proteção" na fatura, no extrato e no contrato do empréstimo.',
    typical: 25,
    fix: 'Condicionar um produto à compra de outro é venda casada, proibida pelo Código de Defesa do Consumidor (art. 39, I). Peça o cancelamento e a devolução do que foi cobrado sem você autorizar.',
    message:
      'Olá! Identifiquei a cobrança de um seguro/proteção que não solicitei. Peço o cancelamento imediato e a devolução dos valores cobrados, já que não autorizei essa contratação (Código de Defesa do Consumidor, art. 39, I). Aguardo o protocolo. Obrigado!',
  },
  {
    id: 'celular',
    title: 'Plano de celular e internet',
    what: 'Você usa todos os gigas do plano? Faz mais de um ano que não renegocia a internet de casa?',
    typical: 50,
    fix: 'Ligue pedindo cancelamento: o setor de retenção costuma oferecer desconto. Compare com planos controle e faça portabilidade se a outra operadora for mais barata.',
    message:
      'Olá! Estou avaliando cancelar meu plano porque encontrei ofertas mais baratas. Antes, gostaria de saber se vocês têm uma proposta melhor pra me manter como cliente. Obrigado!',
  },
  {
    id: 'delivery',
    title: 'Delivery e corridas por app',
    what: 'Some os pedidos de comida e as corridas do último mês no histórico dos apps.',
    typical: 150,
    fix: 'Defina um teto semanal e deixe os apps fora da tela inicial. Trocar 2 pedidos por semana por comida feita em casa já muda o mês.',
  },
  {
    id: 'atraso',
    title: 'Multa e juros de contas atrasadas',
    what: 'Luz, água, boleto ou fatura pagos depois do vencimento.',
    typical: 30,
    fix: 'Coloque as contas fixas no débito automático ou mude o vencimento pra logo depois do dia do pagamento — a empresa é obrigada a oferecer opções de data.',
  },
  {
    id: 'carro',
    title: 'Seguro do carro sem cotação',
    what: 'Você renova o seguro todo ano sem comparar?',
    typical: 40,
    fix: 'Cote em pelo menos 3 seguradoras ou num corretor online antes de renovar. A diferença pro mesmo carro costuma ser grande.',
  },
];

export interface Right {
  id: string;
  title: string;
  law: string;
  summary: string;
  message?: string;
}

export const RIGHTS: Right[] = [
  {
    id: 'portabilidade',
    title: 'Levar sua dívida pra outro banco com juros menores',
    law: 'Portabilidade de crédito — Resolução CMN 4.292/2013',
    summary:
      'Empréstimo, consignado e financiamento podem ser transferidos pra outra instituição que cobre menos. O banco atual não pode impedir — no máximo, fazer uma contraproposta.',
    message:
      'Olá! Tenho um contrato de crédito com outra instituição e quero fazer a portabilidade pra vocês. Podem me enviar uma proposta com a taxa de juros e o Custo Efetivo Total (CET)? Obrigado!',
  },
  {
    id: 'quitacao',
    title: 'Desconto ao pagar antes',
    law: 'Código de Defesa do Consumidor, art. 52, § 2º',
    summary:
      'Quem quita um empréstimo ou financiamento antes do prazo (ou adianta parcelas) tem direito à redução proporcional dos juros. Peça sempre o valor de quitação antecipada.',
    message:
      'Olá! Quero quitar antecipadamente meu contrato (ou adiantar parcelas). Peço o valor atualizado com a redução proporcional dos juros, conforme o art. 52, § 2º do Código de Defesa do Consumidor. Obrigado!',
  },
  {
    id: 'rotativo',
    title: 'Teto pros juros do cartão',
    law: 'Lei 14.690/2023 e Resolução CMN 4.549/2017',
    summary:
      'Juros e encargos do rotativo não podem passar de 100% do valor da dívida original. E o banco só pode deixar a dívida no rotativo por um mês — depois, tem que oferecer parcelamento com juros menores.',
  },
  {
    id: 'cheque',
    title: 'Teto pro cheque especial',
    law: 'Resolução CMN 4.765/2019',
    summary: 'Os juros do cheque especial são limitados a 8% ao mês. Se cobrarem mais, reclame no banco e no Banco Central.',
  },
  {
    id: 'superendividamento',
    title: 'Renegociar tudo de uma vez, preservando o mínimo pra viver',
    law: 'Lei do Superendividamento — Lei 14.181/2021',
    summary:
      'Se as dívidas não cabem mais na renda, você pode pedir uma conciliação com todos os credores juntos, pelo Procon ou pela Justiça, num plano de até 5 anos que preserve o mínimo pros seus gastos básicos.',
  },
  {
    id: 'cobranca',
    title: 'Devolução em dobro de cobrança indevida',
    law: 'Código de Defesa do Consumidor, art. 42',
    summary: 'Quem paga um valor cobrado indevidamente tem direito a receber de volta o dobro do que pagou a mais, com correção.',
  },
  {
    id: 'negativacao',
    title: 'Nome negativado tem prazo',
    law: 'Código de Defesa do Consumidor, art. 43, § 1º',
    summary: 'Seu nome não pode ficar nos cadastros de devedores (Serasa, SPC) por mais de 5 anos pela mesma dívida.',
  },
];

/* ---------- vazamentos marcados (salvos no navegador) ---------- */

const LEAKS_KEY = 'selos-leaks';

export type LeakSelection = Record<string, number>; // id → economia por mês que a pessoa acredita ter

export function getLeakSelection(): LeakSelection {
  try {
    const raw = localStorage.getItem(LEAKS_KEY);
    return raw ? (JSON.parse(raw) as LeakSelection) : {};
  } catch {
    return {};
  }
}

export function saveLeakSelection(sel: LeakSelection): void {
  try {
    localStorage.setItem(LEAKS_KEY, JSON.stringify(sel));
  } catch {
    // segue sem persistir
  }
}

export function leaksMonthlyTotal(sel: LeakSelection = getLeakSelection()): number {
  return Object.values(sel).reduce((s, v) => s + (v > 0 ? v : 0), 0);
}

/* ---------- direitos que valem pro caso da pessoa ---------- */

// Recebe só o que precisa do plano, pra não acoplar este arquivo ao cálculo
export function relevantRights(plan: { debts: { kind: string }[]; stuck: boolean }): string[] {
  const kinds = new Set(plan.debts.map((d) => d.kind));
  const ids: string[] = [];
  if (kinds.has('cartao')) ids.push('rotativo');
  if (kinds.has('cheque')) ids.push('cheque');
  if (kinds.has('emprestimo') || kinds.has('consignado') || kinds.has('financiamento') || kinds.has('outro')) {
    ids.push('portabilidade', 'quitacao');
  }
  if (plan.stuck) ids.push('superendividamento');
  return ids;
}
