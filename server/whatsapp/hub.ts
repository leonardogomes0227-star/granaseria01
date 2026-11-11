// As ferramentas do site, conversando pelo WhatsApp.
//
// Tudo aqui é função pura: recebe (conversa em andamento, perfil, mensagem) e devolve (respostas, nova conversa,
// novo perfil). Quem lê e grava no banco é o api/whatsapp.ts. Assim dá pra testar sem Supabase e sem Meta.
// Os cálculos são os mesmos do site (src/plan.ts, src/leaks.ts, src/calculations.ts): o que o bot responde bate
// com o que a pessoa vê na tela.

import type { Outgoing } from './meta.js';
import type { StateSnapshot } from '../account/db.js';
import { buildPlan, simulateLumpSum, monthLong, effectiveRate, type LumpResult } from '../../src/plan.js';
import { LEAKS, RIGHTS, relevantRights, leaksMonthlyTotal, type LeakSelection } from '../../src/leaks.js';
import { calculateDiagnosis, calculateHealthScore } from '../../src/calculations.js';
import { getArchetype } from '../../src/archetypes.js';
import { nextStep } from './coach.js';
import { TIP_WORD } from './shortcuts.js';
import { siteToolsOut, toSite, welcomeOut } from './site.js';
import { goalFromText } from './goals.js';
import { calcMenu, maisMenu, startCompra, startMeta, startLongo, startEmprestimo, startDividas, startAddDebt, startRemoveDebt, startCheckin, selosOut, fraseOut, toolStep, type MonthBalance } from './tools.js';
import type { WizardData, DebtItem } from '../../src/types.js';
import type { Tracking } from '../../src/tracking.js';
import { parseAmount } from './parse.js';
import { diagnosisFrom, firstName, leaksFrom, normalize, parseDebt, parseMoney, txt, buttons, brl, type Session, type HubInput, type HubResult, type History } from './hubcore.js';

export { parseMoney, parseDebt, diagnosisFrom, normalize, firstName } from './hubcore.js';
export type { Session, HubInput, HubResult, Flow, History } from './hubcore.js';

/* ---------- menu ---------- */

/** O menu de todo dia: o WhatsApp cuida do dinheiro que entra e sai; as ferramentas maiores ficam no site. */
export function simpleMenu(name?: string | null): Outgoing[] {
  return [
    {
      kind: 'list',
      text: `${name ? `${name}, é` : 'É'} só me mandar o que gastou ou recebeu, por exemplo: *mercado 80 no pix* ou *recebi 200 de freela*. 🪙\n\nAqui eu cuido só do que entra e do que sai. O resto fica no site: toque em *Meu painel no site*.`,
      button: 'Ver opções',
      rows: [
        { id: 'job:anotar', title: '✍️ Como anotar', description: 'Gastos, entradas, forma de pagamento e foto' },
        { id: 'gastos:saldo', title: '⚖️ Saldo do mês', description: 'Entrou, saiu e quanto dá por dia' },
        { id: 'gastos:sobra', title: '🎯 Quanto posso gastar', description: 'Por categoria, até o fim do mês' },
        { id: 'gastos:hoje', title: '📅 Gastos de hoje', description: 'O que você gastou hoje' },
        { id: 'gastos:semana', title: '🗓️ Gastos da semana', description: 'Total desde segunda, por categoria' },
        { id: 'gastos:mes', title: '📊 Gastos do mês', description: 'Resumo do mês por categoria' },
        { id: 'gastos:entradas', title: '📥 Entradas do mês', description: 'O dinheiro que entrou, por origem' },
        { id: 'gastos:formas', title: '💳 Formas de pagamento', description: 'Quanto saiu no pix, débito, crédito…' },
        { id: 'gastos:resumo', title: '📬 Resumo da semana', description: 'Como foi a semana, e todo domingo aqui' },
        { id: 'site:painel', title: '📲 Meu painel no site', description: 'Seu mês, seu plano e as ferramentas' },
      ],
    },
  ];
}

/** Cada trabalho do menu abre só as ferramentas dele. */
export function jobMenu(job: string, faturaEnabled = false): Outgoing[] | null {
  const list = (text: string, rows: { id: string; title: string; description: string }[]): Outgoing[] => [{ kind: 'list', text, button: 'Ver opções', rows }];
  if (job === 'plano') {
    return list('📋 *Meu plano.* O que você quer ver?', [
      { id: 'menu:proximo', title: '🧭 Meu próximo passo', description: 'Uma coisa só pra fazer agora' },
      { id: 'menu:plano', title: '📋 Plano do mês', description: 'O que pagar e guardar neste mês' },
      { id: 'menu:rapido', title: '⚡ Começo rápido', description: 'Onde você está, em 1 minuto' },
      { id: 'menu:diag', title: '📊 Diagnóstico completo', description: 'Nota, plano e datas, usando o que você anotou' },
      { id: 'menu:checkin', title: '📅 Check-in do mês', description: 'Como foi seu mês, em 1 minuto' },
    ]);
  }
  if (job === 'dividas') {
    return list('💳 *Sair das dívidas.* Por onde começamos?', [
      { id: 'calc:dividas', title: '❄️ Qual pagar primeiro', description: 'A ordem certa e a data de ficar livre' },
      { id: 'calc:novadivida', title: '➕ Nova dívida', description: 'Esqueceu uma? Junte às que já estão salvas' },
      { id: 'calc:apagardivida', title: '🗑️ Apagar ou quitar', description: 'Quitou ou errou uma dívida? Tire da lista' },
      { id: 'calc:emprestimo', title: '🏦 Comparar empréstimos', description: 'Qual proposta sai mais barata no total' },
      ...(faturaEnabled ? [{ id: 'menu:fatura', title: '🧾 Ler minha fatura', description: 'Juros, tarifas e cobranças escondidas' }] : []),
      { id: 'menu:direitos', title: '⚖️ Meus direitos', description: 'O que a lei garante com banco e dívida' },
    ]);
  }
  if (job === 'guardar') {
    return list('🛟 *Guardar e proteger.* O que você quer fazer?', [
      { id: 'calc:meta', title: '🎯 Juntar pra uma meta', description: 'Quanto guardar por mês pra chegar lá' },
      { id: 'menu:13o', title: '🎁 13º e dinheiro extra', description: 'Onde colocar cada real' },
      { id: 'calc:compra', title: '🛍️ Posso comprar?', description: 'Com o seu saldo de verdade' },
      { id: 'menu:vazamentos', title: '🔎 Dinheiro perdido', description: 'Assinaturas e tarifas que você nem vê' },
      { id: 'calc:longo', title: '📈 Longo prazo', description: 'Quanto seu dinheiro vira com os anos' },
    ]);
  }
  return null;
}

export function menu(faturaEnabled = false, name?: string | null): Outgoing[] {
  const start = [
    { id: 'menu:proximo', title: '🧭 Meu próximo passo', description: 'Não sabe por onde começar? Toque aqui' },
    { id: 'menu:gastos', title: '⚖️ Meu mês', description: 'Saldo, gastos, entradas e formas de pagamento' },
    { id: 'menu:diag', title: '📊 Fazer meu diagnóstico', description: 'Veja onde você está e receba um plano' },
    { id: 'menu:plano', title: '📋 Meu plano', description: 'O que pagar e guardar neste mês' },
  ];
  const save = [
    { id: 'menu:vazamentos', title: '🔎 Achar dinheiro perdido', description: 'Assinaturas e tarifas que você nem percebe' },
    { id: 'menu:13o', title: '🎁 13º e dinheiro extra', description: 'Onde colocar cada real' },
    { id: 'menu:direitos', title: '⚖️ Meus direitos', description: 'O que a lei garante com banco e dívida' },
    ...(faturaEnabled ? [{ id: 'menu:fatura', title: '🧾 Ler minha fatura', description: 'Mande a foto ou o PDF e eu acho cobranças escondidas' }] : []),
  ];
  const more = [
    { id: 'menu:calc', title: '🧮 Calculadoras', description: 'Comprar, juntar dinheiro, empréstimo, dívidas' },
    { id: 'menu:mais', title: '✨ Mais', description: 'Check-in, selos, frase do dia e dar feedback' },
  ];
  return [
    {
      kind: 'list',
      text: `${name ? `${name}, como` : 'Como'} posso ajudar? 🪙 Toque em *Ver opções*.\n\n💸 Pra *anotar um gasto*, é só escrever, por exemplo: *gastei 35 no mercado*.\n🎯 Prefere dizer o que quer resolver? Mande *objetivo*.\n💬 Pra dar sua opinião, mande *feedback*.\n⚡ Dica: você pode escrever direto o que quer, tipo *meta*, *dívidas* ou *gastos*.`,
      button: 'Ver opções',
      rows: [...start, ...save, ...more],
      sections: [
        { title: 'Começar', rows: start },
        { title: 'Economizar e proteger', rows: save },
        { title: 'Mais', rows: more },
      ],
    },
  ];
}

/** Gastos do dia a dia: anotar e consultar. Os botões "gastos:*" viram os comandos de sempre (hoje, semana, mês…). */
export function gastosMenu(): Outgoing {
  return {
    kind: 'list',
    text: '⚖️ *Meu mês.* Pra anotar, é só escrever, por exemplo:\n• *gastei 35 no mercado no pix*\n• *uber 18,50 débito*\n• *recebi 200 de freela*\n\nOu escolha o que ver:',
    button: 'Ver opções',
    rows: [
      { id: 'gastos:saldo', title: '⚖️ Saldo do mês', description: 'Entrou, saiu e quanto dá por dia' },
      { id: 'gastos:hoje', title: '📅 Gastos de hoje', description: 'O que você gastou hoje' },
      { id: 'gastos:semana', title: '🗓️ Gastos da semana', description: 'Total desde segunda, por categoria' },
      { id: 'gastos:mes', title: '📊 Gastos do mês', description: 'Resumo do mês por categoria' },
      { id: 'gastos:formas', title: '💳 Formas de pagamento', description: 'Quanto saiu no pix, débito, crédito…' },
      { id: 'gastos:entradas', title: '📥 Entradas do mês', description: 'O dinheiro que entrou, por origem' },
      { id: 'gastos:sobra', title: '🎯 Quanto posso gastar', description: 'Por categoria, até o fim do mês' },
      { id: 'gastos:ultimos', title: '🧾 Últimos gastos', description: 'Os últimos que você anotou' },
      { id: 'gastos:anotar', title: '✍️ Anotar um gasto', description: 'Com a forma de pagamento: pix, cartão…' },
      { id: 'gastos:entrada', title: '💰 Anotar uma entrada', description: 'Salário, freela, venda, dinheiro extra' },
    ],
  };
}

/** Depois de uma ferramenta, sempre um caminho de volta: menu, próximo passo ou opinião. */
const MENU_HINT = buttons('O que você quer fazer agora?', [
  ['menu:menu', '📋 Ver menu'],
  ['menu:proximo', '🧭 Próximo passo'],
  ['mais:feedback', '💬 Dar opinião'],
]);
function withMenuHint(r: HubResult): HubResult {
  const last = r.out[r.out.length - 1];
  return r.session === null && last && last.kind === 'text' ? { ...r, out: [...r.out, MENU_HINT] } : r;
}

/** "Isso te ajudou?": mede se a ferramenta presta e pega o que faltou, na voz de quem pergunta de coração. */
export const feedbackAsk = (tool: string): Outgoing =>
  buttons('Isso te ajudou?', [
    [`fb:up:${tool}`, '👍 Ajudou'],
    [`fb:down:${tool}`, '👎 Faltou algo'],
  ]);

const EXPIRED = txt('Essa opção já expirou. Mande *menu* pra ver as opções de novo. 🙂');

/* ---------- diagnóstico ---------- */

type DiagStep = 'income' | 'moradia' | 'alimentacao' | 'transporte' | 'lazer' | 'debts' | 'reserve' | 'savings';

const DIAG_QUESTION: Record<DiagStep, string> = {
  income: '💰 *1 de 8.* Quanto você recebe por mês? Pode ser o que cai na sua conta, já com os descontos.\n\nResponda só o valor, ex.: *3500*',
  moradia: '🏠 *2 de 8.* Agora vamos ver pra onde o dinheiro vai. Quanto você gasta por mês com a casa? Aluguel ou prestação, condomínio, luz, água e internet.',
  alimentacao: '🍽️ *3 de 8.* E com comida? Mercado, restaurante, delivery…',
  transporte: '🚗 *4 de 8.* Transporte: combustível, ônibus, aplicativo, manutenção…',
  lazer: '🎉 *5 de 8.* Lazer: saídas, streaming, viagens, compras de prazer…',
  debts:
    '💳 *6 de 8.* Dívidas. Sem medo: a gente só precisa enxergar. Mande uma por mensagem, com o tipo e o valor que ainda falta pagar.\n\nEx.: *cartão 4500*\nEx.: *empréstimo 3000 parcela 250*\nSe souber os juros: *cheque especial 800 juros 8*\n\nSe não tem dívida, mande *não tenho*.',
  reserve: '🛟 *7 de 8.* Quanto você tem guardado pra emergências (dinheiro que dá pra pegar rápido, se precisar)? Se ainda não tem nada, mande *0*, e tudo bem.',
  savings: '🐖 *8 de 8.* Última pergunta: em média, quanto você consegue guardar por mês? Se não sobra nada, mande *0*.',
};

const MONEY_HINT = 'Não entendi o valor. 🤔 Responda só o número, ex.: *1200* (ou *cancelar* pra sair).';

/* ---------- pré-preenchido com o que a pessoa já anotou ---------- */

const PRE_MIN_DAYS = 7; // menos que uma semana de registro não diz muito sobre o mês

interface Prefill {
  income: number;
  spend: number;
  moradia: number;
  alimentacao: number;
  transporte: number;
  lazer: number;
  other: number; // saúde, educação e outros: não entram nas 4 contas do diagnóstico
  projected: boolean; // os gastos foram projetados pro mês inteiro
}

/**
 * Entradas e gastos dos últimos 30 dias viram números de um mês. Com poucos dias de registro, os gastos do dia a dia
 * são projetados pro mês inteiro; a renda e a casa (aluguel, luz, água: uma vez por mês) não.
 */
export function prefillFrom(h?: History): Prefill | null {
  if (!h || h.income <= 0 || h.spent <= 0 || h.days < PRE_MIN_DAYS) return null;
  const days = Math.min(30, h.days);
  const month = (v: number) => Math.round((v * 30) / days);
  const raw = (...names: string[]) => names.reduce((t, n) => t + (h.byCategory[n] ?? 0), 0);
  const moradia = Math.round(raw('Moradia'));
  const alimentacao = month(raw('Alimentação'));
  const transporte = month(raw('Transporte'));
  const lazer = month(raw('Lazer', 'Compras'));
  const other = month(Math.max(0, h.spent - raw('Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Compras')));
  return { income: Math.round(h.income), spend: moradia + alimentacao + transporte + lazer + other, moradia, alimentacao, transporte, lazer, other, projected: days < 30 };
}

const PRE_BUTTONS: [string, string][] = [
  ['pre:yes', '✅ Sim, usar'],
  ['pre:no', '✍️ Eu respondo'],
];

const preWhen = (p: Prefill) => (p.projected ? 'Pelo que você anotou até agora (projetando os gastos do dia a dia pro mês inteiro)' : 'Pelo que você anotou nos últimos 30 dias');

function startDiag(name?: string | null, then?: 'extra', history?: History): HubResult {
  const pre = prefillFrom(history);
  if (pre) {
    // quem já anota não precisa responder 5 perguntas: confere os números e segue pras dívidas
    const lines = [
      `${name ? `${name}, vamos` : 'Vamos'} olhar pro seu ouro juntos. 🪙 Já tenho boa parte das respostas. ${preWhen(pre)}:`,
      '',
      `💰 Renda: ${brl(pre.income)}`,
      `🏠 Casa: ${brl(pre.moradia)}`,
      `🍽️ Comida: ${brl(pre.alimentacao)}`,
      `🚗 Transporte: ${brl(pre.transporte)}`,
      `🎉 Lazer e compras: ${brl(pre.lazer)}`,
      ...(pre.other > 0 ? [`📌 Saúde, educação e outros: ${brl(pre.other)}`] : []),
      '',
      'Uso esses números? Depois faltam só 3 perguntas (dívidas, reserva e quanto você guarda).',
    ];
    return {
      out: [buttons(lines.join('\n'), PRE_BUTTONS)],
      session: { flow: 'diag', step: 'pre', data: { pre, ...(then ? { then } : {}) } },
      event: 'diag_start',
    };
  }
  return {
    out: [
      txt(`${name ? `${name}, vamos` : 'Vamos'} olhar pro seu ouro juntos. 🪙 São 8 perguntas, uns 2 minutos, e os números ficam só entre nós. Pra parar, é só mandar *cancelar*.`),
      txt(DIAG_QUESTION.income),
    ],
    session: { flow: 'diag', step: 'income', data: then ? { then } : {} },
    event: 'diag_start',
  };
}

/* ---------- começo rápido (3 perguntas) ---------- */

const QUICK_QUESTION = {
  q_income: '💰 *1 de 3.* Quanto você recebe por mês? Pode ser o que cai na sua conta, já com os descontos.\n\nResponda só o valor, ex.: *3500*',
  q_spend: '🧾 *2 de 3.* E quanto você gasta por mês, somando tudo? Pode ser aproximado: casa, comida, transporte, lazer, contas…',
  q_debt: '💳 *3 de 3.* Você deve alguma coisa (cartão, empréstimo, cheque especial)? Mande o valor total, mesmo aproximado. Se não deve nada, mande *não tenho*.',
} as const;

function startQuick(name?: string | null, history?: History): HubResult {
  const pre = prefillFrom(history);
  if (pre) {
    return {
      out: [
        buttons(
          `${name ? `${name}, bora` : 'Bora'} começar leve. 🪙 ${preWhen(pre)}: entrou *${brl(pre.income)}* e saiu *${brl(pre.spend)}* por mês.\n\nUso esses números? Aí falta só uma pergunta.`,
          PRE_BUTTONS
        ),
      ],
      session: { flow: 'diag', step: 'q_pre', data: { income: pre.income, spend: pre.spend } },
      event: 'quick_start',
    };
  }
  return {
    out: [
      txt(`${name ? `${name}, bora` : 'Bora'} começar leve. 🪙 São só 3 perguntas, 1 minuto, e já te mostro onde você está. Pra parar, mande *cancelar*.`),
      txt(QUICK_QUESTION.q_income),
    ],
    session: { flow: 'diag', step: 'q_income', data: {} },
    event: 'quick_start',
  };
}

/** Percentual com até 2 casas (81,25%), sem zeros sobrando (81%). */
const pctOf = (part: number, whole: number) =>
  `${((part / whole) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

function quickResult(income: number, spend: number, debt: number, name?: string | null): HubResult {
  const free = income - spend;
  const tenth = income * 0.1;
  const lines = [`${name ? `${name}, olha` : 'Olha'} onde você está: 🙂`, ''];
  lines.push(`Entra ${brl(income)} · sai ${brl(spend)} (${pctOf(spend, income)} da renda)`);
  if (free > 0) {
    lines.push(`Sobra ${brl(free)} por mês, ${pctOf(free, income)} do que você ganha.`);
    lines.push('', free >= tenth
      ? '👏 Você já consegue guardar pelo menos 10% do que ganha, o primeiro hábito do livro. O desafio agora é guardar de verdade, logo que o dinheiro cai, antes de gastar.'
      : `O primeiro hábito do livro é guardar pelo menos 10% do que se ganha, ou seja, ${brl(tenth)} por mês. Falta pouco: dá pra chegar lá gastando ${brl(tenth - free)} a menos em alguma coisa.`);
    const reserve = spend * 6;
    const months = Math.ceil(reserve / free);
    lines.push(`🛟 A reserva de emergência ideal cobre 6 meses de gastos: ${brl(reserve)}. É um dinheiro guardado pra imprevistos, como ficar sem trabalho. Guardando ${brl(free)} por mês, você chega lá em cerca de ${months} ${months === 1 ? 'mês' : 'meses'}.`);
  } else {
    lines.push(free === 0 ? 'Não sobra nada no fim do mês.' : `Falta ${brl(-free)} por mês pra fechar a conta.`);
    lines.push('', 'Isso é mais comum do que parece, e tem saída. O primeiro passo é ver pra onde o dinheiro vai: anote cada gasto aqui, mandando por exemplo *gastei 35 no mercado*, por uns dias.');
  }
  if (debt > 0) {
    lines.push('', `💳 Dívidas de ${brl(debt)}: ${debt > income * 3 ? 'é bastante, mas ' : ''}o jeito certo é atacar primeiro a que tem juros mais altos. No diagnóstico completo eu calculo a ordem e a data de ficar livre.`);
  }
  return {
    out: [
      txt(lines.join('\n')),
      buttons('Esse é só o começo. Quer o plano completo, com nota, datas e passo a passo?', [['menu:diag', 'Diagnóstico completo'], ['menu:menu', 'Ver opções']]),
    ],
    session: null,
    event: 'quick_done',
  };
}

function stepQuick(session: Session, text: string, name?: string | null): HubResult {
  const d = session.data as { income?: number; spend?: number };
  const t = normalize(text);
  if (session.step === 'q_pre') {
    if (PRE_YES.test(t)) return { out: [txt(`Combinado, usei seus registros. 👍\n\n${QUICK_QUESTION.q_debt}`)], session: { flow: 'diag', step: 'q_debt', data: d } };
    return { out: [txt(QUICK_QUESTION.q_income)], session: { flow: 'diag', step: 'q_income', data: {} } };
  }
  if (session.step === 'q_debt') {
    const none = /^(nao tenho|nao|nenhuma|nenhum|sem dividas?|zero|0)$/.test(t);
    const v = none ? 0 : parseMoney(text);
    if (v === null) return { out: [txt('Não entendi. 🤔 Mande o valor total, ex.: *4500*, ou *não tenho*.')], session };
    return quickResult(d.income ?? 0, d.spend ?? 0, v, name);
  }
  const v = parseMoney(text);
  if (v === null || v <= 0) return { out: [txt(MONEY_HINT)], session };
  if (session.step === 'q_income') {
    return { out: [txt(`Anotado: ${brl(v)} por mês. 👍\n\n${QUICK_QUESTION.q_spend}`)], session: { flow: 'diag', step: 'q_spend', data: { income: v } } };
  }
  return { out: [txt(`Gastos: ${brl(v)}. Certo.\n\n${QUICK_QUESTION.q_debt}`)], session: { flow: 'diag', step: 'q_debt', data: { ...session.data, spend: v } } };
}

const PRE_YES = /^(pre:yes|sim|s|pode|pode usar|usar|isso|ok|certo|esta certo|ta certo)$/;

const kinderLabel = (score: number) => (score >= 70 ? 'saúde financeira forte' : score >= 40 ? 'no caminho, com ajustes' : 'hora de cuidar com carinho, e tem saída');

/** O que já está bom (até 2): a pessoa precisa ouvir o que está certo antes de ouvir o que falta. */
function whatIsGood(data: WizardData, plan: ReturnType<typeof buildPlan>, d: ReturnType<typeof calculateDiagnosis>): string[] {
  const good: string[] = [];
  const debtTotal = plan.debts.reduce((s, x) => s + x.balance, 0);
  if (plan.debts.length === 0) good.push('Você não tem dívidas. Isso já é meio caminho andado.');
  else if (!plan.stuck && debtTotal < data.monthlyIncome) good.push(`Suas dívidas (${brl(debtTotal)}) são menores que um salário seu. Dá pra resolver, e rápido.`);
  if (d.savingsRate >= 10) good.push(`Você já guarda ${Math.round(d.savingsRate)}% da renda: o primeiro hábito do livro, cumprido.`);
  else if (data.currentSavings > 0) good.push('Você já guarda alguma coisa todo mês. É o começo de tudo.');
  if (data.emergencyFund > 0) good.push('Você já começou uma reserva pra imprevistos.');
  const keys = Object.keys(d.idealExpenses) as (keyof typeof d.idealExpenses)[];
  if (keys.filter((k) => data.expenses[k] <= d.idealExpenses[k]).length >= 3) good.push('A maior parte dos seus gastos está dentro do saudável.');
  if (good.length === 0) good.push('Você olhou os números de frente, e é justamente o que a maioria evita.');
  return good.slice(0, 2);
}

/** O que mais pesa (até 2), dito sem julgamento. */
function whatWeighs(data: WizardData, plan: ReturnType<typeof buildPlan>): string[] {
  const heavy: string[] = [];
  if (plan.stuck) heavy.push('Suas dívidas crescem mais rápido do que o valor que dá pra pagar hoje.');
  else if (plan.debts[0] && plan.debts[0].rate >= 8) heavy.push(`${plan.debts[0].name} cobra ${plan.debts[0].rate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% ao mês. É a que mais pesa.`);
  const worst = [...plan.cuts].sort((a, b) => b.amount - a.amount)[0];
  if (worst && data.monthlyIncome > 0) {
    heavy.push(`${worst.label} está em ${Math.round((worst.current / data.monthlyIncome) * 100)}% da renda (o saudável é até ${Math.round((worst.ceiling / data.monthlyIncome) * 100)}%).`);
  }
  if (plan.reserve.target > 0 && !plan.reserve.alreadyDone && data.emergencyFund <= 0) heavy.push('Ainda não existe uma reserva pra imprevistos.');
  return heavy.slice(0, 2);
}

function diagSummary(data: WizardData, now: Date, name?: string | null): string {
  const d = calculateDiagnosis(data);
  const score = calculateHealthScore(data, d);
  const plan = buildPlan(data, { start: now });
  const archetype = getArchetype(data, d);
  const lines = [`${name ? `${name}, olhei` : 'Olhei'} seus números com carinho. 🙂`, '', '*O que já está bom:*', ...whatIsGood(data, plan, d).map((x) => `• ${x}`)];
  const heavy = whatWeighs(data, plan);
  if (heavy.length > 0) lines.push('', '*O que mais pesa:*', ...heavy.map((x) => `• ${x}`));

  lines.push('', `📊 Nota *${score.score}/100*, ${kinderLabel(score.score)}`, `🎭 Perfil: *${archetype.name}*`, '');
  lines.push(`Renda ${brl(data.monthlyIncome)} · gastos ${brl(d.totalExpenses)} (${pctOf(d.totalExpenses, data.monthlyIncome)} da renda)`);

  if (plan.debts.length > 0) {
    const total = plan.debts.reduce((s, x) => s + x.balance, 0);
    if (plan.stuck) lines.push(`💳 Dívidas: ${brl(total)}. Hoje o valor do plano não cobre nem os juros, então renegociar vem primeiro.`);
    else if (plan.debtFreeMonth !== null) lines.push(`💳 Dívidas: ${brl(total)}. Dá pra estar livre em *${monthLong(plan.start, plan.debtFreeMonth)}*.`);
    else lines.push(`💳 Dívidas: ${brl(total)}.`);
  }

  if (plan.reserve.alreadyDone) lines.push(`🛟 Reserva completa (${brl(plan.reserve.target)}). 👏`);
  else if (plan.reserve.doneMonth !== null) lines.push(`🛟 Reserva: ${brl(plan.reserve.current)} de ${brl(plan.reserve.target)}, pronta em ${monthLong(plan.start, plan.reserve.doneMonth)}.`);
  else lines.push(`🛟 Reserva: ${brl(plan.reserve.current)} de ${brl(plan.reserve.target)}.`);

  lines.push(`💪 Valor mensal do seu plano: *${brl(plan.monthlyPower)}*${plan.powerAssumed ? ' (estimado em 10% da renda)' : ''}`);
  if (plan.cuts.length > 0) lines.push('   _Esse valor conta com os gastos voltando ao saudável. Se for mais devagar, a data se ajusta, sem problema._');
  if (plan.unaccounted >= Math.max(200, data.monthlyIncome * 0.1)) {
    lines.push(`🕵️ *${brl(plan.unaccounted)} da sua renda por mês não aparecem em nenhum gasto que você me contou.* Pra descobrir pra onde vai, anote cada gasto aqui (ex.: *gastei 35 no mercado*) por uns dias.`);
  }
  const first = plan.steps[0];
  const worstCut = [...plan.cuts].sort((a, b) => b.amount - a.amount)[0];
  if (first && first.title.startsWith('Libere') && worstCut) {
    // não manda cortar: mostra onde há folga e deixa a pessoa escolher por onde começar
    const others = plan.cuts.filter((c) => c.key !== worstCut.key).map((c) => c.label.toLowerCase());
    lines.push(
      '',
      '*Por onde começar, você escolhe:*',
      `👉 O lugar com mais folga é *${worstCut.label.toLowerCase()}*: hoje ${brl(worstCut.current)}, e o saudável pra sua renda seria até ${brl(worstCut.ceiling)}. Não precisa cortar tudo de uma vez: cada ${brl(Math.max(10, Math.round(worstCut.amount / 4 / 10) * 10))} a menos já ajuda.${others.length > 0 ? ` Se preferir, dá pra começar por ${others.join(' ou ')}.` : ''}`
    );
  } else if (first) {
    const firstSentence = first.detail.split(/(?<=[.!?])\s/)[0] ?? '';
    lines.push('', '*Seu primeiro passo, um só:*', `👉 ${first.title}.`, firstSentence.length > 0 && firstSentence.length <= 220 ? firstSentence : '');
  }
  return lines.join('\n').trim();
}

/** O fim do diagnóstico em poucas linhas: nota, conta do mês, o que está bom e o que mais pesa. O resto fica em "Ver detalhes". */
function diagShort(data: WizardData, now: Date, name?: string | null): string {
  const d = calculateDiagnosis(data);
  const score = calculateHealthScore(data, d);
  const plan = buildPlan(data, { start: now });
  const debtTotal = plan.debts.reduce((t, x) => t + x.balance, 0);
  const good = whatIsGood(data, plan, d)[0];
  const heavy = whatWeighs(data, plan)[0];
  return [
    `${name ? `Pronto, ${name}!` : 'Pronto!'} Olhei seus números com carinho. 🙂`,
    '',
    `📊 Nota *${score.score}/100*: ${kinderLabel(score.score)}.`,
    `Entra ${brl(data.monthlyIncome)} · sai ${brl(d.totalExpenses)}${debtTotal > 0 ? ` · dívidas ${brl(debtTotal)}` : ''}`,
    '',
    ...(good ? [`✅ ${good}`] : []),
    ...(heavy ? [`⚠️ ${heavy}`] : []),
  ].join('\n');
}

const FOLLOW_BUTTON: [string, string] = ['plan:start', '📋 Lembrar todo mês'];
const DETAILS_BUTTON: [string, string] = ['diag:tudo', '🔍 Ver detalhes'];

/** Um passo só, dito em linguagem simples, com o botão que já faz a ação. */
function firstStepOut(data: WizardData, now: Date): Outgoing {
  const plan = buildPlan(data, { start: now });
  const first = plan.steps[0];
  const sentence = (first?.detail.split(/(?<=[.!?])\s/)[0] ?? '').trim();
  if (plan.stuck) {
    return buttons(
      `👉 *Seu próximo passo: renegociar.*\n\n${sentence || 'Hoje o que você consegue pagar não cobre os juros, então a dívida cresce todo mês.'}\n\nRenegociar baixa os juros e a parcela. Eu te dou a mensagem pronta pra mandar pro banco, é só copiar.`,
      [['next:renegociar', '📝 Mensagem pronta'], FOLLOW_BUTTON, DETAILS_BUTTON]
    );
  }
  const worstCut = [...plan.cuts].sort((a, b) => b.amount - a.amount)[0];
  if (first?.title.startsWith('Libere') && worstCut) {
    return buttons(
      `👉 *Seu próximo passo: segurar ${worstCut.label.toLowerCase()}.*\n\nHoje vai ${brl(worstCut.current)} por mês. O saudável pra sua renda é até ${brl(worstCut.ceiling)}. Não precisa cortar de uma vez: anote cada gasto aqui esta semana (ex.: *mercado 80 no pix*) e eu te aviso quando chegar perto do limite.`,
      [['gastos:sobra', '🎯 Ver meu limite'], FOLLOW_BUTTON, DETAILS_BUTTON]
    );
  }
  if (plan.unaccounted >= Math.max(200, data.monthlyIncome * 0.1)) {
    return buttons(
      `👉 *Seu próximo passo: descobrir pra onde vão ${brl(plan.unaccounted)} por mês.*\n\nEsse dinheiro não apareceu em nenhum gasto que você me contou. Por uns dias, anote tudo aqui do jeito mais simples (ex.: *gastei 35 no mercado*). No fim da semana eu te mostro pra onde foi.`,
      [['job:anotar', '✍️ Como anotar'], FOLLOW_BUTTON, DETAILS_BUTTON]
    );
  }
  return buttons(`👉 *Seu próximo passo: ${first ? first.title.charAt(0).toLowerCase() + first.title.slice(1) : 'guardar 10% do que entra'}.*${sentence ? `\n\n${sentence}` : ''}\n\nQuer que eu te lembre disso todo mês?`, [
    FOLLOW_BUTTON,
    DETAILS_BUTTON,
  ]);
}

/** Quem veio do site com o código: boas-vindas, o resumo do diagnóstico e o próximo passo, como se tivesse feito aqui. */
export function welcomeFromSite(profile: StateSnapshot, now: Date, rawName?: string | null): Outgoing[] {
  const name = firstName(rawName ?? null);
  const data = diagnosisFrom(profile);
  const hello = `${name ? `Oi, ${name}! 👋` : 'Oi! 👋'} Recebi seu diagnóstico do site. 🪙`;
  if (!data) return welcomeOut(name, false);
  return [
    txt(`${hello}\n\n${diagShort(data, now, null).split('\n').slice(2).join('\n')}`),
    buttons(
      `Daqui pra frente eu cuido do seu dia a dia. Me mande o que gastar e o que entrar (ex.: *mercado 80 no pix*, *recebi 3000 salário*) e eu te mostro quanto ainda dá pra gastar em cada coisa, com os limites do seu diagnóstico.`,
      [
        ['gastos:sobra', '🎯 Meus limites'],
        ['job:anotar', '✍️ Como anotar'],
        ['gastos:saldo', '⚖️ Saldo do mês'],
      ]
    ),
  ];
}

export const SITE_CODE = /\bGS[-\s]?([A-HJ-NP-Z2-9]{6})\b/i;

/** Renegociar pelo WhatsApp: a mensagem pronta pro banco e o que fazer se não der. */
export function renegotiateOut(profile: StateSnapshot, now: Date): Outgoing[] {
  const data = diagnosisFrom(profile);
  const plan = data ? buildPlan(data, { start: now }) : null;
  const power = plan && plan.monthlyPower > 0 ? brl(plan.monthlyPower) : 'um valor que caiba no meu orçamento';
  const worst = plan?.debts[0];
  return [
    txt(
      [
        `📝 *Como renegociar${worst ? ` (comece por ${worst.name}, a de juros mais altos)` : ''}:*`,
        '',
        '1. Mande esta mensagem no app ou no chat do banco (ou leia no telefone):',
        '',
        `_Olá! Estou com dificuldade pra pagar minha dívida e quero renegociar. Consigo pagar ${power} por mês no total. Peço uma proposta com juros menores e parcelas que caibam nesse valor, informando o Custo Efetivo Total (CET). Obrigado!_`,
        '',
        '2. Não aceite a primeira proposta se a parcela não couber. Peça outra e compare o *CET* (o custo total).',
        '3. Se nenhuma dívida cabe na sua renda, a *Lei do Superendividamento* permite renegociar tudo de uma vez, pelo Procon, preservando o mínimo pra viver.',
      ].join('\n')
    ),
    buttons('Quer ver mais?', [
      ['dir:superendividamento', '⚖️ Renegociar tudo'],
      ['dir:portabilidade', '🏦 Outro banco'],
      ['calc:dividas', '❄️ Qual pagar 1º'],
    ]),
  ];
}

function withDiagnosis(profile: StateSnapshot, data: WizardData): StateSnapshot {
  // step 6 = tela de revisão do diagnóstico no site; quem abrir o site continua dali
  return { ...profile, 'selos-wizard-progress': JSON.stringify({ data, step: 6 }), 'selos-diagnosis-completed': 'true' };
}

function startTracking(profile: StateSnapshot, data: WizardData, now: Date): StateSnapshot {
  const tracking: Tracking = { createdAt: now.toISOString(), baseline: data, months: [] };
  return { ...profile, 'selos-tracking': JSON.stringify(tracking) };
}

function stepDiag(session: Session, text: string, profile: StateSnapshot, now: Date, name?: string | null): HubResult {
  if (session.step.startsWith('q_')) return stepQuick(session, text, name);
  const step = session.step as DiagStep | 'follow';
  const d = session.data as { income?: number; moradia?: number; alimentacao?: number; transporte?: number; lazer?: number; debts?: DebtItem[]; reserve?: number; savings?: number; then?: 'extra'; ready?: WizardData; pre?: Prefill };
  const t = normalize(text);

  if (session.step === 'pre') {
    const base = d.then ? { then: d.then } : {};
    if (PRE_YES.test(t) && d.pre) {
      const p = d.pre;
      return {
        out: [txt(`Combinado, usei seus registros. 👍\n\n${DIAG_QUESTION.debts}`)],
        session: { flow: 'diag', step: 'debts', data: { ...base, income: p.income, moradia: p.moradia, alimentacao: p.alimentacao, transporte: p.transporte, lazer: p.lazer } },
      };
    }
    return { out: [txt(`Tudo bem, você me diz. 🙂\n\n${DIAG_QUESTION.income}`)], session: { flow: 'diag', step: 'income', data: base } };
  }

  if (step === 'follow') {
    const data = d.ready;
    if (t === 'diag:follow' && data) {
      return {
        out: [
          txt('✅ Combinado! Todo mês eu te lembro do que fazer. Mande *plano* pra ver o mês atual e *paguei* quando cumprir. Sem culpa se atrasar: eu recalculo com você.'),
          feedbackAsk('diag'),
        ],
        session: null,
        profile: startTracking(profile, data, now),
        event: 'plan_follow',
      };
    }
    return { out: [txt('Sem pressa. 🙂 Quando quiser que eu acompanhe, mande *próximo passo*. Seu diagnóstico fica guardado.'), feedbackAsk('diag')], session: null };
  }

  const next = (patch: Record<string, unknown>, to: DiagStep, ack?: string): HubResult => ({
    out: [txt(`${ack ? `${ack}\n\n` : ''}${DIAG_QUESTION[to]}`)],
    session: { flow: 'diag', step: to, data: { ...session.data, ...patch } },
  });

  if (step === 'income') {
    const v = parseMoney(text);
    if (v === null || v <= 0) return { out: [txt('Preciso de um valor maior que zero. Ex.: *3500*')], session };
    return next({ income: v }, 'moradia', `Anotado: ${brl(v)} por mês. 👍`);
  }
  if (step === 'moradia' || step === 'alimentacao' || step === 'transporte' || step === 'lazer') {
    const v = parseMoney(text);
    if (v === null) return { out: [txt(MONEY_HINT)], session };
    const order: DiagStep[] = ['moradia', 'alimentacao', 'transporte', 'lazer', 'debts'];
    const ack =
      step === 'moradia' ? `Casa: ${brl(v)}. Certo.`
      : step === 'alimentacao' ? `Comida: ${brl(v)}. Anotado.`
      : step === 'transporte' ? `Transporte: ${brl(v)}.`
      : v === 0 ? 'Lazer zerado, anotado.' : `Lazer: ${brl(v)}. A vida também conta, né? 🙂`;
    return next({ [step]: v }, order[order.indexOf(step) + 1], ack);
  }

  if (step === 'debts') {
    const debts = d.debts ?? [];
    const none = /^(nao tenho|nao|nenhuma|nenhum|sem dividas?|nao tenho dividas?)$/.test(t);
    const done = /^(pronto|acabou|so isso|so essas|e isso|fim|ok|so)$/.test(t);
    if (none || done) return next({ debts }, 'reserve', debts.length === 0 ? 'Sem dívidas, que bom! 👏' : 'Dívidas anotadas. Enxergar já é metade do caminho.');
    const debt = debts.length < 8 ? parseDebt(text, `wa-${debts.length + 1}`) : null;
    if (!debt) {
      return {
        out: [txt(debts.length >= 8 ? 'Já anotei 8 dívidas, é o máximo por aqui. Mande *pronto*.' : 'Não entendi. 🤔 Mande o tipo e o valor, ex.: *cartão 4500* ou *empréstimo 3000 parcela 250*. Ou *pronto* se acabou.')],
        session,
      };
    }
    const { rate, assumed } = effectiveRate(debt);
    const all = [...debts, debt];
    return {
      out: [
        txt(
          `✅ Anotei: *${debt.description}*, ${brl(debt.value)}${debt.installment ? `, parcela de ${brl(debt.installment)}` : ''}. Juros ${assumed ? 'típicos' : 'de'} ${rate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% ao mês.\n\nTem outra? Mande agora. Se acabou, mande *pronto*.`
        ),
      ],
      session: { ...session, data: { ...session.data, debts: all } },
    };
  }

  if (step === 'reserve') {
    const v = parseMoney(text);
    if (v === null) return { out: [txt(MONEY_HINT)], session };
    return next({ reserve: v }, 'savings', v === 0 ? 'Sem reserva ainda: é onde muita gente começa, e vamos construir.' : 'Você já tem uma reserva começada, isso é ótimo. 👏');
  }

  // savings: última pergunta
  const v = parseMoney(text);
  if (v === null) return { out: [txt(MONEY_HINT)], session };
  const data: WizardData = {
    monthlyIncome: d.income ?? 0,
    currentSavings: v,
    expenses: { moradia: d.moradia ?? 0, alimentacao: d.alimentacao ?? 0, transporte: d.transporte ?? 0, lazer: d.lazer ?? 0 },
    debts: d.debts ?? [],
    emergencyFund: d.reserve ?? 0,
  };
  const saved = withDiagnosis(profile, data);
  const summary = txt(diagShort(data, now, name));

  if (d.then === 'extra') {
    return {
      out: [summary, txt('🎁 Agora sim! Quanto de dinheiro extra vai entrar (13º, restituição do imposto de renda, FGTS, bônus)? Responda só o valor, ex.: *3000*')],
      session: { flow: 'extra', step: 'amount', data: {} },
      profile: saved,
      event: 'diag_done',
    };
  }
  // sem conversa aberta: os botões do passo (limite, anotar, renegociar) funcionam direto
  return { out: [summary, firstStepOut(data, now)], session: null, profile: saved, event: 'diag_done' };
}

/* ---------- 13º e dinheiro extra ---------- */

const GENERIC_ORDER = [
  '*A ordem que mais rende pra qualquer dinheiro extra:*',
  '',
  '1. *Dívidas com juros altos* — cartão, cheque especial e empréstimo pessoal cobram de 5% a 15% ao mês. Pagar essas primeiro rende mais do que qualquer investimento.',
  '2. *Reserva de emergência* — guardar o equivalente a 6 meses dos seus gastos, num lugar seguro de onde você saca quando quiser (como o Tesouro Selic ou um CDB com liquidez diária).',
  '3. *Dívidas com juros menores* — financiamento e consignado. Pagar parcelas antes do prazo reduz os juros, e você tem direito a esse desconto.',
  '4. *Investir* — só depois dos passos acima, e aí vale estudar com calma, por exemplo o Tesouro IPCA+.',
  '',
  'Pra eu dizer exatamente quanto vai em cada dívida e quantos meses você adianta, mande *diagnóstico*.',
].join('\n');

function extraHeadline(r: LumpResult, amount: number): string {
  const { before, after } = r;
  const start = before.start;
  if (r.unstuck) return `Com esse dinheiro, sua dívida passa a ter fim: livre em *${monthLong(start, after.debtFreeMonth ?? 0)}*. Hoje o que você paga não cobre nem os juros.`;
  if (after.stuck) {
    const b = before.debts.reduce((s, x) => s + x.balance, 0);
    const a = after.debts.reduce((s, x) => s + x.balance, 0);
    return `Ajuda, mas ainda não resolve sozinho: ${brl(b)} → ${brl(a)}. Use o extra como abaixo e renegocie também: com desconto à vista, esse dinheiro pode quitar a dívida inteira.`;
  }
  if (r.monthsSooner !== null && r.monthsSooner > 0) {
    const interest = r.interestSaved > 1 ? `, e deixa de pagar ${brl(r.interestSaved)} de juros` : '';
    return `Você sai das dívidas *${r.monthsSooner} ${r.monthsSooner === 1 ? 'mês' : 'meses'} antes*: em ${monthLong(start, after.debtFreeMonth ?? 0)} em vez de ${monthLong(start, before.debtFreeMonth ?? 0)}${interest}.`;
  }
  const reserveSooner = before.reserve.doneMonth !== null && after.reserve.doneMonth !== null ? before.reserve.doneMonth - after.reserve.doneMonth : 0;
  if (reserveSooner > 0) return `Sua reserva fica pronta *${reserveSooner} ${reserveSooner === 1 ? 'mês' : 'meses'} antes*: em ${monthLong(start, after.reserve.doneMonth ?? 0)}.`;
  return `Seu plano já está adiantado: sem dívidas e com a reserva completa, ${brl(amount)} podem ir direto pros investimentos.`;
}

function startExtra(profile: StateSnapshot): HubResult {
  if (diagnosisFrom(profile)) {
    return {
      out: [txt('🎁 *Dinheiro extra* é a chance de pular meses do seu plano. Quanto vai entrar (13º, restituição do imposto de renda, FGTS, bônus)?\n\nResponda só o valor, ex.: *3000*')],
      session: { flow: 'extra', step: 'amount', data: {} },
    };
  }
  return {
    out: [
      buttons('🎁 Pra eu dizer onde colocar cada real e quantos meses você adianta, preciso conhecer sua situação (quanto você ganha, gasta e deve). Leva uns 2 minutos aqui mesmo.', [
        ['extra:diag', 'Fazer agora'],
        ['extra:generic', 'Só a regra geral'],
      ]),
    ],
    session: { flow: 'extra', step: 'need-diag', data: {} },
  };
}

function stepExtra(session: Session, text: string, profile: StateSnapshot, now: Date, name?: string | null): HubResult {
  const t = normalize(text);
  if (session.step === 'need-diag') {
    if (t === 'extra:diag') return startDiag(name, 'extra');
    return { out: [txt(GENERIC_ORDER)], session: null };
  }
  const amount = parseMoney(text);
  if (amount === null || amount <= 0) return { out: [txt('Não entendi o valor. 🤔 Responda só o número, ex.: *3000* (ou *cancelar*).')], session };
  const data = diagnosisFrom(profile);
  if (!data) return startExtra(profile);
  const result = simulateLumpSum(data, amount, { start: now, extraMonthly: leaksMonthlyTotal(leaksFrom(profile)) });
  const alloc = result.allocation.map((a, i) => `${i + 1}. *${a.label}: ${brl(a.amount)}*\n   ${a.why}`);
  return {
    out: [
      txt([`🎁 *${brl(amount)} de dinheiro extra*`, '', extraHeadline(result, amount), '', '*Onde colocar cada real:*', ...alloc].join('\n')),
      txt('⚠️ Não comprometa o extra com compras parceladas novas: o 13º acaba em dezembro, mas as parcelas continuam até o meio do ano.'),
      feedbackAsk('extra'),
    ],
    session: null,
  };
}

/* ---------- caça-vazamentos ---------- */

function startLeaks(): HubResult {
  const list = LEAKS.map((l, i) => `${i + 1}. *${l.title}* (~${brl(l.typical)}/mês)\n   ${l.what}`).join('\n\n');
  return {
    out: [txt(`🔎 *Caça-vazamentos* — dinheiro que sai todo mês sem você perceber (assinaturas esquecidas, tarifas, seguros).\n\nResponda com os números do que acontece com você (ex.: *1, 3, 4*), ou *nenhum*:\n\n${list}`)],
    session: { flow: 'leaks', step: 'pick', data: {} },
  };
}

function leaksFinish(sel: LeakSelection, profile: StateSnapshot, now: Date): HubResult {
  const total = leaksMonthlyTotal(sel);
  const lines = [`🔎 *Você achou ${brl(total)}/mês* — ${brl(total * 12)} por ano.`];
  const diag = diagnosisFrom(profile);
  if (diag && total > 0) {
    const before = buildPlan(diag, { start: now });
    const after = buildPlan(diag, { start: now, extraMonthly: total });
    if (before.debts.length > 0 && before.debtFreeMonth !== null && after.debtFreeMonth !== null && before.debtFreeMonth - after.debtFreeMonth > 0) {
      const n = before.debtFreeMonth - after.debtFreeMonth;
      lines.push(`Isso tira ${n} ${n === 1 ? 'mês' : 'meses'} do seu caminho pra sair das dívidas, e já entra no seu plano.`);
    } else if (before.stuck && !after.stuck) lines.push('Com esse dinheiro, sua dívida passa a ter fim.');
    else lines.push('Esse valor entra no seu plano de ação.');
  } else lines.push('Mande *diagnóstico* e esse valor entra no seu plano de ação.');
  lines.push('', 'Agora, como resolver cada um: 👇');

  const out: Outgoing[] = [txt(lines.join('\n'))];
  for (const l of LEAKS.filter((x) => x.id in sel)) {
    out.push(txt(`*${l.title}*\n${l.fix}`));
    if (l.message) out.push(txt(`Mensagem pronta (é só copiar e mandar):\n\n${l.message}`));
  }
  out.push(feedbackAsk('leaks'));
  return { out, session: null, profile: { ...profile, 'selos-leaks': JSON.stringify(sel) } };
}

function stepLeaks(session: Session, text: string, profile: StateSnapshot, now: Date): HubResult {
  const t = normalize(text);
  const picked = (session.data.picked as string[] | undefined) ?? [];
  const values = (session.data.values as LeakSelection | undefined) ?? {};

  if (session.step === 'pick') {
    if (/^(nenhum|nenhuma|nada|nao|nao acontece)$/.test(t)) return { out: [txt('Ótimo, nada vazando por aqui! 👏 Mande *menu* pra ver outras opções.')], session: null };
    const nums = [...new Set((t.match(/\d+/g) ?? []).map(Number))].filter((n) => n >= 1 && n <= LEAKS.length);
    if (nums.length === 0) return { out: [txt(`Mande os números do que acontece com você, ex.: *1, 3, 4* (de 1 a ${LEAKS.length}), ou *nenhum*.`)], session };
    const ids = nums.map((n) => LEAKS[n - 1].id);
    const vals: LeakSelection = Object.fromEntries(ids.map((id) => [id, LEAKS.find((l) => l.id === id)!.typical]));
    return adjustPrompt({ ...session, step: 'adjust', data: { picked: ids, values: vals } });
  }

  // adjust
  if (/^(ok|pronto|certo|isso|pode ser|seguir|ver)$/.test(t)) return leaksFinish(values, profile, now);
  const pairs = [...t.matchAll(/(\d+)\s*[:=-]?\s*(?:r\$)?\s*(\d+(?:[.,]\d+)?)/g)];
  const next: LeakSelection = { ...values };
  let changed = 0;
  for (const [, idx, val] of pairs) {
    const leak = LEAKS[Number(idx) - 1];
    const v = parseAmount(val);
    if (leak && picked.includes(leak.id) && v !== null) {
      next[leak.id] = v;
      changed++;
    }
  }
  if (changed === 0) return { out: [txt('Pra ajustar, mande o número e o valor, ex.: *1 70* (o item 1 custa R$ 70). Ou *ok* pra seguir.')], session };
  return adjustPrompt({ ...session, data: { picked, values: next } });
}

function adjustPrompt(session: Session): HubResult {
  const picked = session.data.picked as string[];
  const values = session.data.values as LeakSelection;
  const lines = picked.map((id) => `• ${LEAKS.find((l) => l.id === id)!.title}: ${brl(values[id])}/mês`);
  return {
    out: [
      txt(
        `Anotei:\n${lines.join('\n')}\n\nTotal estimado: *${brl(leaksMonthlyTotal(values))}/mês*.\n\nSe algum valor for diferente, mande o número e o valor, ex.: *1 70* (o item 1 custa R$ 70). Ou mande *ok* pra ver como resolver cada um.`
      ),
    ],
    session,
  };
}

/* ---------- direitos ---------- */

const RIGHT_TITLE: Record<string, string> = {
  portabilidade: 'Portabilidade de crédito',
  quitacao: 'Desconto ao quitar antes',
  rotativo: 'Teto dos juros do cartão',
  cheque: 'Teto do cheque especial',
  superendividamento: 'Superendividamento',
  cobranca: 'Cobrança indevida',
  negativacao: 'Nome negativado: prazo',
};

function rightsList(profile: StateSnapshot, now: Date): Outgoing[] {
  const data = diagnosisFrom(profile);
  const mine = data && data.debts.length > 0 ? relevantRights(buildPlan(data, { start: now })) : [];
  const sorted = [...RIGHTS].sort((a, b) => Number(mine.includes(b.id)) - Number(mine.includes(a.id)));
  return [
    {
      kind: 'list',
      text: `⚖️ *Seus direitos com banco e dívida.* Escolha um pra ver a lei e a mensagem pronta.${mine.length > 0 ? '\n\nOs marcados com ⭐ valem pro seu caso, pelo seu diagnóstico.' : ''}`,
      button: 'Ver direitos',
      rows: sorted.map((r) => ({
        id: `dir:${r.id}`,
        title: `${mine.includes(r.id) ? '⭐ ' : ''}${RIGHT_TITLE[r.id] ?? r.title}`,
        description: r.law,
      })),
    },
  ];
}

function rightDetail(id: string): Outgoing[] {
  const r = RIGHTS.find((x) => x.id === id);
  if (!r) return [EXPIRED];
  const out: Outgoing[] = [txt(`⚖️ *${r.title}*\n_${r.law}_\n\n${r.summary}`)];
  if (r.message) out.push(txt(`Mensagem pronta (é só copiar e mandar):\n\n${r.message}`));
  out.push(txt('Se o banco não resolver, reclame no consumidor.gov.br, no Procon ou no Banco Central (bcb.gov.br/meubc).\n\nMande *direitos* pra ver outro. Conteúdo informativo, não substitui orientação jurídica.'));
  return out;
}

/* ---------- ponto de entrada ---------- */

/**
 * As únicas conversas que ainda existem no WhatsApp. As de ferramenta (diagnóstico, dívidas, 13º, metas…) saíram
 * pro site: uma que tenha ficado aberta de antes é descartada por quem chama, e a mensagem segue como gasto.
 */
const LIVE_FLOWS = new Set(['erase', 'feedback', 'fatura']);
export const isLiveFlow = (flow: string): boolean => LIVE_FLOWS.has(flow);

const GREETING = /^(oi+|ola|oie|opa|eai|e ai|eae|salve|hey|hello|hi|inicio|comecar|bom dia|boa tarde|boa noite|tudo bem|oi tudo bem|ola tudo bem)$/;
/** É um "oi"? (o "oi" já explica a novidade do site; o aviso de uma vez só não precisa vir junto) */
export const isGreeting = (raw: string): boolean => GREETING.test(normalize(raw));
const MENU_WORDS = /^(menu|opcoes|menu:menu)$/;
const NEXT_STEP_WORDS = /^(menu:proximo|proximo passo|meu proximo passo|e agora|o que faco|o que eu faco|o que faco hoje|o que eu faco hoje|por onde comeco)$/;
/** A mensagem pede o próximo passo (ou é um oi)? Quem chama usa pra buscar os dados extras só quando precisa. */
export const wantsNextStep = (raw: string): boolean => {
  const t = normalize(raw);
  return GREETING.test(t) || NEXT_STEP_WORDS.test(t);
};

const DIAG_WORDS = /^(diagnostico|fazer diagnostico|meu diagnostico|refazer diagnostico)$/;
const QUICK_WORDS = /^(rapido|comeco rapido|inicio rapido|comecar rapido|diagnostico rapido)$/;

/** A mensagem abre o diagnóstico ou o começo rápido? Quem chama busca os registros dos últimos 30 dias só nesse caso. */
export const wantsHistory = (raw: string): boolean => {
  const t = normalize(raw);
  return DIAG_WORDS.test(t) || QUICK_WORDS.test(t) || ['menu:diag', 'menu:rapido', 'goal:organizar', 'plan:start'].includes(t);
};

/** A mensagem pergunta se pode comprar (ou abre a ferramenta de compra)? Quem chama busca o saldo do mês só nesse caso. */
export const wantsBalance = (raw: string): boolean => {
  const t = normalize(raw);
  return /^(vale a pena|vale comprar|posso comprar|devo comprar)\b/.test(t) || t === 'calc:compra' || t === 'goal:comprar';
};

const ERASE_WORDS = /^(apagar|excluir|deletar) (meus |todos os )?dados$/;

const GASTOS_HELP = txt(
  '✍️ *Pra anotar um gasto, é só me mandar o que gastou:*\n\n• *gastei 35 no mercado*\n• *uber 18,50*\n• *ontem gastei 50 na farmácia*\n\n💳 Diga também *como pagou* (pix, débito, crédito, dinheiro, boleto) pra eu separar por forma de pagamento: *mercado 80 no pix*, *tênis 250 crédito*.\n\nPode escrever do seu jeito. Eu entendo o valor, separo por categoria (mercado, transporte, lazer…) e já digo quanto você gastou hoje e no mês.\n\nPra ver depois: *hoje*, *ontem*, *semana*, *mês*, *formas de pagamento*, *últimos* ou *quanto ainda posso gastar*. Errou? Mande *apagar* pra desfazer o último.'
);

/** "Anotar": tudo o que dá pra mandar, num lugar só. */
function anotarHelp(photos = false): Outgoing {
  return txt(
    [
      '✍️ *Anotar é só escrever, do seu jeito:*',
      '',
      '💸 *Gasto:* *gastei 35 no mercado no pix*, *uber 18,50 débito*, *tênis 250 crédito*',
      '💰 *Entrada:* *recebi 200 de freela*, *caiu 3000 salário*, *vendi o fogão 400*',
      ...(photos ? ['📸 *Foto:* mande a foto do cupom ou do comprovante do pix e eu anoto sozinho'] : []),
      '',
      'A cada anotação eu mostro o saldo do mês e quanto dá pra gastar por dia. Errou? *apagar* (ou *apagar entrada*).',
    ].join('\n')
  );
}

const ENTRADA_HELP = txt(
  '💰 *Pra anotar dinheiro que entrou, é só me contar:*\n\n• *recebi 200 de freela*\n• *caiu 3000 salário*\n• *vendi o fogão 400 pix*\n• *ganhei 100 de presente*\n\nEu guardo a origem (salário, renda extra, venda…) e mostro o saldo do mês: o que entrou menos o que saiu.\n\nPra ver: *entradas* (o que entrou) e *saldo*. Errou? Mande *apagar entrada*.'
);

/** Palavras exatas que abrem uma ferramenta. Valem mesmo no meio de outra conversa (troca de assunto). */
function shortcutStart(t: string, profile: StateSnapshot, now: Date, name?: string | null, balance?: MonthBalance, history?: History): HubResult | null {
  if (/^(gastos|meus gastos|gastos diarios|gastos do dia a dia|gastos do dia|despesas|meu mes)$/.test(t)) return { out: [gastosMenu()], session: null, event: 'tool:gastos' };
  if (/^(13o|13 salario|decimo terceiro|dinheiro extra|restituicao( do ir)?|extra)$/.test(t)) return startExtra(profile);
  if (/^(vazamentos?|caca vazamentos?|cacar vazamentos?|assinaturas|tarifas|dinheiro perdido|dinheiro que sobra)$/.test(t)) return startLeaks();
  if (/^(direitos?|meus direitos|seus direitos)$/.test(t)) return { out: rightsList(profile, now), session: null };
  if (DIAG_WORDS.test(t)) return startDiag(name, undefined, history);
  if (QUICK_WORDS.test(t)) return startQuick(name, history);
  const buy = t.match(/^(?:vale a pena|vale comprar|posso comprar|devo comprar)( comprar)?(?: (.*))?$/);
  if (buy) {
    const price = buy[2] ? parseMoney(buy[2]) : null;
    return startCompra(profile, price && price > 0 ? price : undefined, balance, now);
  }
  if (/^(meta|minha meta|calculadora de meta|juntar dinheiro|guardar dinheiro|poupar|quanto guardar)$/.test(t)) return startMeta();
  if (/^(longo prazo|simulador|aposentadoria|simulador de longo prazo)$/.test(t)) return startLongo(profile);
  if (/^(emprestimo|comparar emprestimos?|financiamento)$/.test(t)) return startEmprestimo();
  const add = t.match(/^(?:nova divida|novo debito|adicionar (?:uma )?divida|incluir (?:uma )?divida|mais uma divida|outra divida|esqueci (?:uma|de uma) divida)(?:\s*[:,-]?\s+(.+))?$/);
  if (add) return startAddDebt(profile, add[1]);
  const del = t.match(/^(?:apagar|apaga|excluir|remover|tirar|deletar) (?:uma |a )?divida(?:\s+(.+))?$/);
  if (del) return startRemoveDebt(profile, del[1]);
  const paid = t.match(/^(?:quitei|terminei de pagar|acabei de pagar|paguei tudo d[oae]|liquidei)\s+(?:a divida d[oae]\s+|a divida\s+)?(.+)$/);
  if (paid) return startRemoveDebt(profile, paid[1], true);
  if (/^(quitei|quitei uma divida|quitei a divida)$/.test(t)) return startRemoveDebt(profile, undefined, true);
  if (/^(dividas|minhas dividas|sair das dividas|pagar dividas|qual divida pagar|avalanche|bola de neve|avalanche x bola de neve)$/.test(t)) return startDividas(profile);
  if (/^(calculadoras?|calcular)$/.test(t)) return { out: calcMenu(), session: null };
  if (/^check[ -]?in( do mes)?$/.test(t)) return startCheckin(profile);
  if (/^(selos|meus selos|perfil|meu perfil)$/.test(t)) return { out: selosOut(profile), session: null };
  if (/^(frase|frase do dia)$/.test(t)) return { out: fraseOut(null, now), session: null };
  if (/^(feedback|sugestao|sugestoes|reclamacao|opiniao|elogio|dar feedback|deixar feedback)$/.test(t)) return startFreeFeedback();

  return null;
}

/** A pessoa quer falar com o dono por conta própria: o texto cai no painel. */
function startFreeFeedback(): HubResult {
  return {
    out: [txt('Quero ouvir você! 🙏 Escreva do seu jeito: o que está bom, o que está ruim ou o que você gostaria que eu fizesse. Quem lê é o criador da Grana Séria. (ou *cancelar*)')],
    session: { flow: 'feedback', step: 'note', data: { tool: 'livre', kind: 'note' } },
  };
}

// Pra medir o uso: qual ferramenta a pessoa abriu
const EVENT_BY_WORD: Record<string, string> = {
  'menu:13o': 'tool:extra',
  'menu:vazamentos': 'tool:leaks',
  vazamentos: 'tool:leaks',
  'menu:direitos': 'tool:rights',
  direitos: 'tool:rights',
  'meus direitos': 'tool:rights',
  'menu:checkin': 'tool:checkin',
  'mais:selos': 'tool:selos',
  selos: 'tool:selos',
  'mais:frase': 'tool:frase',
  frase: 'tool:frase',
  'menu:proximo': 'next_step',
  'proximo passo': 'next_step',
  'menu:fatura': 'tool:fatura',
};

/** Decide se a mensagem é do hub. Devolve null quando não é: aí vale o fluxo antigo (gastos, plano). */
/** Abriu pelo menu? Ensina a palavra que abre a mesma ferramenta direto, numa linha antes da ferramenta. */
function withShortcutTip(r: HubResult, rawText: string): HubResult {
  const word = TIP_WORD[rawText.trim().toLowerCase()];
  if (!word || r.out.length === 0) return r;
  return { ...r, out: [txt(`💡 _Da próxima vez, é só mandar *${word}* que eu abro direto._`), ...r.out] };
}

export function hubStep(input: HubInput): HubResult | null {
  const routed = route(input);
  if (!routed) return routed;
  const result = routed.event === 'site_link' ? routed : withShortcutTip(routed, input.text);
  if (result.event) return result;
  const t = normalize(input.text);
  const opened = result.session && result.session.flow !== input.session?.flow && result.session.flow !== 'feedback' && result.session.flow !== 'erase' ? result.session.flow : null;
  const event = EVENT_BY_WORD[t] ?? (opened ? `tool:${opened}` : undefined);
  return event ? { ...result, event } : result;
}

function route(input: HubInput): HubResult | null {
  const { text, session, profile, now } = input;
  const name = firstName(input.name ?? null);
  const t = normalize(text);

  // saídas
  if (session && /^(cancelar|sair|parar|voltar)$/.test(t)) {
    return { out: [txt('Tudo bem, parei por aqui. Mande *menu* quando quiser continuar. 🙂')], session: null };
  }

  // apagar os dados (LGPD): sempre com confirmação
  if (ERASE_WORDS.test(t)) {
    return {
      out: [
        buttons('Vou apagar tudo o que guardei sobre você aqui: gastos, diagnóstico, plano, vazamentos e o resto. Não dá pra desfazer. Confirma?', [
          ['erase:yes', 'Sim, apagar tudo'],
          ['erase:no', 'Cancelar'],
        ]),
      ],
      session: { flow: 'erase', step: 'confirm', data: {} },
    };
  }

  // "ajuda" é pedido dos comandos: quem responde é o registro de gastos (lista do que dá pra mandar)
  if (!session && /^(ajuda|help|comandos|como funciona|como usar)$/.test(t)) return null;

  // as ferramentas ficam no site: a palavra, o objetivo ou o botão de antes responde com o link (nada roda aqui)
  const site = toSite(t);
  if (site) return { out: site, session: null, event: 'site_link' };

  // recepção
  if (MENU_WORDS.test(t)) return { out: simpleMenu(name), session: null };
  if (t === 'menu:tudo' || /^(ferramentas|mais ferramentas|todas as opcoes|todas as ferramentas)$/.test(t)) return { out: menu(input.faturaEnabled, name), session: null };
  if (t === 'goal:gastos') return { out: [gastosMenu()], session: null, event: 'tool:gastos' };
  if (GREETING.test(t)) return { out: welcomeOut(name, Boolean(diagnosisFrom(profile)), input.expensesThisMonth ?? 0), session: null, event: 'greeting' };
  if (NEXT_STEP_WORDS.test(t)) return { out: nextStep({ profile, now, name, expensesThisMonth: input.expensesThisMonth }), session: null };
  if (t === 'plan:start') {
    const data = diagnosisFrom(profile);
    if (!data) return startDiag(name, undefined, input.history);
    const following = startTracking(profile, data, now);
    return {
      out: [
        txt('✅ Combinado! Agora eu acompanho seu plano mês a mês. Quando cumprir, é só mandar *paguei*. Sem culpa se atrasar: eu recalculo com você.'),
        ...nextStep({ profile: following, now, name, fresh: true }),
      ],
      session: null,
      profile: following,
      event: 'plan_follow',
    };
  }

  // feedback "isso te ajudou?"
  const fb = t.match(/^fb:(up|down):([a-z0-9]+)$/);
  if (fb) {
    if (fb[1] === 'up') {
      if (fb[2] === 'geral') {
        // pedido do bot: quem gostou também escreve o que mais ajudou e o que melhorar
        return {
          out: [txt('Que bom! 🙏 Me conta com suas palavras: o que mais te ajudou e o que eu poderia fazer melhor? (ou *pular*)')],
          session: { flow: 'feedback', step: 'note', data: { tool: 'geral', kind: 'up' } },
        };
      }
      return { out: [txt('Que bom! 🙏 Fico feliz de ter ajudado.')], session: null, event: `feedback:up:${fb[2]}` };
    }
    return {
      out: [txt('Obrigado por contar. 🙏 Me diz em uma frase o que faltou ou o que ficou ruim? (ou *pular*)')],
      session: { flow: 'feedback', step: 'note', data: { tool: fb[2] } },
    };
  }

  // ids de botões e listas
  if (t.startsWith('dir:')) return withMenuHint({ out: rightDetail(t.slice(4)), session: null });
  if (t === 'menu:gastos') return { out: [gastosMenu()], session: null, event: 'tool:gastos' };
  if (t === 'diag:tudo') {
    const data = diagnosisFrom(profile);
    if (!data) return startDiag(name, undefined, input.history);
    return { out: [txt(diagSummary(data, now, name)), buttons('E agora?', [['menu:proximo', '🧭 Meu próximo passo'], FOLLOW_BUTTON])], session: null };
  }
  if (t === 'next:renegociar' || /^(renegociar|renegociacao|negociar|negociar divida|como renegociar|mensagem pronta)$/.test(t)) {
    return { out: renegotiateOut(profile, now), session: null, event: 'tool:renegociar' };
  }
  if (t === 'gastos:anotar') return { out: [GASTOS_HELP], session: null };
  if (t === 'gastos:entrada') return { out: [ENTRADA_HELP], session: null };
  if (t === 'job:anotar' || /^(anotar|como anoto|como anotar|como registro)$/.test(t)) return { out: [anotarHelp(input.faturaEnabled)], session: null, event: 'tool:anotar' };
  if (t.startsWith('job:')) {
    const jm = jobMenu(t.slice(4), input.faturaEnabled);
    if (jm) return { out: jm, session: null, event: `job:${t.slice(4)}` };
  }
  if (t === 'menu:diag') return startDiag(name, undefined, input.history);
  if (t === 'menu:rapido') return startQuick(name, input.history);
  if (t === 'menu:13o') return startExtra(profile);
  if (t === 'menu:vazamentos') return startLeaks();
  if (t === 'menu:direitos') return { out: rightsList(profile, now), session: null };
  if (t === 'menu:calc') return { out: calcMenu(), session: null };
  if (t === 'menu:mais') return { out: maisMenu(), session: null };
  if (t === 'mais:feedback') return startFreeFeedback();
  if (t === 'menu:checkin') return startCheckin(profile);
  if (t === 'calc:compra') return startCompra(profile, undefined, input.balance, now);
  if (t === 'calc:meta') return startMeta();
  if (t === 'calc:longo') return startLongo(profile);
  if (t === 'calc:emprestimo') return startEmprestimo();
  if (t === 'calc:dividas') return startDividas(profile);
  if (t === 'calc:novadivida') return startAddDebt(profile);
  if (t === 'calc:apagardivida') return startRemoveDebt(profile);
  if (t === 'mais:selos') return withMenuHint({ out: selosOut(profile), session: null });
  if (t === 'mais:frase') return { out: fraseOut(null, now), session: null };
  if (t.startsWith('frase:')) return { out: fraseOut(Number(t.slice(6)), now), session: null };
  if (t === 'menu:fatura') {
    return {
      out: [txt('🧾 Mande aqui o *PDF ou a foto* da fatura do cartão (ou do extrato) e eu procuro assinaturas, tarifas e juros escondidos.')],
      session: null,
    };
  }

  // palavras exatas trocam de assunto, mesmo no meio de outra conversa
  const shortcut = shortcutStart(t, profile, now, name, input.balance, input.history);
  if (shortcut) return withMenuHint(shortcut);

  if (session && session.flow === 'fatura') {
    // só vale pros botões da leitura da fatura; qualquer outra coisa segue o fluxo normal
    if (t === 'fatura:add') {
      const found = (session.data.leaks as LeakSelection | undefined) ?? {};
      const merged = { ...leaksFrom(profile), ...found };
      return {
        out: [txt(`✅ Adicionei *${brl(leaksMonthlyTotal(found))}/mês* ao seu caça-vazamentos. Mande *vazamentos* pra ver como resolver cada um.`)],
        session: null,
        profile: { ...profile, 'selos-leaks': JSON.stringify(merged) },
      };
    }
    if (t === 'fatura:skip') return { out: [txt('Beleza! Mande *menu* quando quiser algo mais.')], session: null };
  } else if (session) {
    // conversa em andamento: toda resposta vai pra ela (um "3000" aqui é resposta, não gasto)
    if (session.flow === 'erase') {
      if (t === 'erase:yes') {
        return { out: [txt('Pronto. Apaguei tudo o que eu tinha sobre você aqui. 🧹 Se um dia quiser recomeçar, é só mandar *oi*.')], session: null, erase: true };
      }
      return { out: [txt('Combinado, não apaguei nada. 🙂')], session: null };
    }
    if (session.flow === 'feedback') {
      const note = /^(pular|nada|nao|depois)$/.test(t) ? undefined : text.trim().slice(0, 600);
      const kind = session.data.kind === 'up' || session.data.kind === 'note' ? session.data.kind : 'down';
      const out = [txt(note ? 'Anotado, de coração. Isso me ajuda a melhorar. 🙏' : 'Tudo bem. Obrigado mesmo assim. 🙏')];
      if (kind === 'note' && !note) return { out, session: null }; // mensagem livre sem texto: não há o que registrar
      return { out, session: null, event: `feedback:${kind}:${String(session.data.tool ?? 'geral')}`, note };
    }
    if (session.flow === 'diag') return stepDiag(session, text, profile, now, name);
    if (session.flow === 'extra') return stepExtra(session, text, profile, now, name);
    if (session.flow === 'leaks') return stepLeaks(session, text, profile, now);
    const tool = toolStep(session, text, profile, now);
    if (tool) return withMenuHint(tool);
  }

  // o objetivo escrito com as próprias palavras ("quero sair das dívidas"): o link da ferramenta certa no site
  if (!session) {
    const g = goalFromText(t);
    if (g === 'menu') return { out: simpleMenu(name), session: null };
    if (g === 'gastos') return { out: [gastosMenu()], session: null, event: 'tool:gastos' };
    if (g) return { out: toSite(`goal:${g}`) ?? siteToolsOut(), session: null, event: 'site_link' };
  }

  // botões antigos, de uma conversa que já terminou
  if (/^(menu|dir|extra|diag|calc|mais|frase|fatura|plan|fb|erase|pre|job|next):\S+$/.test(t)) return { out: [EXPIRED], session: null };

  return null;
}
