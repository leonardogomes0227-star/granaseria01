// Calculadoras e acompanhamento do site, em conversa pelo WhatsApp:
// vale a pena comprar, meta, longo prazo, comparar empréstimos, avalanche × bola de neve,
// check-in do mês, selos e frase do dia. Funções puras, no mesmo estilo do hub.ts.

import type { Outgoing } from './meta.js';
import type { StateSnapshot } from '../account/db.js';
import { computeProjection, computeRequiredContribution, computeLoanInstallment, checkinActionPlan, calculateDiagnosis, inTodaysMoney, INFLATION_PCT } from '../../src/calculations.js';
import { effectiveRate } from '../../src/plan.js';
import { QUOTES, dailyQuoteIndex } from '../../src/quotes.js';
import { getArchetype } from '../../src/archetypes.js';
import { trackingView, type Tracking } from '../../src/tracking.js';
import { leaksMonthlyTotal } from '../../src/leaks.js';
import type { CheckinEntry, DebtItem, WizardData } from '../../src/types.js';
import type { FaturaResult } from '../fatura.js';
import { categoryEmoji } from './parse.js';
import { parseAmount } from './parse.js';
import { brl, buttons, diagnosisFrom, leaksFrom, normalize, parseDebt, parseMoney, txt, type HubResult, type Session } from './hubcore.js';
import type { LeakSelection } from '../../src/leaks.js';

const brl2 = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number, digits = 1) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`;
const num = (n: number, digits = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: digits });
const DEFAULT_RATE = 10; // % ao ano, como no site

const BAD_NUMBER = 'Não entendi o valor. 🤔 Responda só o número, ex.: *2000* (ou *cancelar*).';

const isOk = (t: string) => /^(ok|padrao|pode ser|pode|isso|mesmo|igual|manter|sim)$/.test(t);

/** "5", "5 anos", "18 meses" → anos. */
export function parseYears(raw: string): number | null {
  const t = normalize(raw);
  const m = t.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  let y = parseAmount(m[1]);
  if (y === null) return null;
  if (/\bmes(es)?\b/.test(t)) y /= 12;
  return y >= 0.5 && y <= 50 ? y : null;
}

/** "10", "10%", "ok" (usa o padrão). Taxa ao ano. */
function parseAnnualRate(raw: string): number | null {
  const t = normalize(raw);
  if (isOk(t)) return DEFAULT_RATE;
  const m = t.match(/(\d+(?:[.,]\d+)?)/);
  const r = m ? parseAmount(m[1]) : t === '0' || t === 'zero' ? 0 : null;
  return r !== null && r >= 0 && r <= 60 ? r : t === '0' || t === 'zero' ? 0 : null;
}

/* ---------- menus ---------- */

export function calcMenu(): Outgoing[] {
  return [
    {
      kind: 'list',
      text: '🧮 *Calculadoras.* Escolha uma:',
      button: 'Ver calculadoras',
      rows: [
        { id: 'calc:compra', title: '🛍️ Vale a pena comprar?', description: 'Quanto a compra custa em dias de trabalho' },
        { id: 'calc:meta', title: '🎯 Calculadora de meta', description: 'Quanto guardar por mês pra chegar lá' },
        { id: 'calc:longo', title: '📈 Longo prazo', description: 'Quanto seu aporte vira com os anos' },
        { id: 'calc:emprestimo', title: '💳 Comparar empréstimos', description: 'Qual proposta sai mais barata' },
        { id: 'calc:dividas', title: '❄️ Qual dívida pagar 1º', description: 'Avalanche × bola de neve' },
      ],
    },
  ];
}

export function maisMenu(): Outgoing[] {
  return [
    {
      kind: 'list',
      text: '✨ *Mais:*',
      button: 'Ver opções',
      rows: [
        { id: 'menu:checkin', title: '📅 Check-in do mês', description: 'Veja como foi seu mês, em 1 minuto' },
        { id: 'mais:selos', title: '🏅 Meus selos', description: 'Suas conquistas e seu perfil' },
        { id: 'mais:frase', title: '✨ Frase do dia', description: 'Uma frase pra começar o dia' },
        { id: 'mais:feedback', title: '💬 Dar feedback', description: 'Conte o que gostou ou o que melhorar' },
      ],
    },
  ];
}

/* ---------- vale a pena comprar ---------- */

export function startCompra(profile: StateSnapshot, firstPrice?: number): HubResult {
  const income = diagnosisFrom(profile)?.monthlyIncome ?? 0;
  if (income > 0) {
    if (firstPrice) return { out: compraResult(income, firstPrice), session: null };
    return {
      out: [txt('🛍️ *Vale a pena comprar?* Quanto custa o que você quer comprar? Responda só o valor, ex.: *2000*')],
      session: { flow: 'compra', step: 'price', data: { income } },
    };
  }
  return {
    out: [txt('🛍️ *Vale a pena comprar?* Primeiro: quanto você recebe por mês (o que cai na sua conta)? Ex.: *3500*')],
    session: { flow: 'compra', step: 'income', data: firstPrice ? { price: firstPrice } : {} },
  };
}

function compraResult(income: number, price: number): Outgoing[] {
  const share = (price / income) * 100;
  const workdays = price / (income / 22); // 22 dias úteis num mês
  const hours = price / (income / 22 / 8);
  const goal = income * 0.1;
  const delay = goal > 0 ? price / goal : 0;
  const verdict =
    share >= 30
      ? '🔴 *Compra pesada.* Pense pelo menos 7 dias antes de decidir.'
      : share >= 10
        ? '🟡 *Vale esperar 48 horas* e ver se a vontade continua.'
        : '🟢 *Cabe no orçamento*, se não sair da sua poupança.';
  return [
    txt(
      [
        `🛍️ *${brl(price)} são ${workdays < 1 ? 'menos de 1 dia' : `${num(workdays)} dias`} de trabalho* (${num(hours, 0)} horas)`,
        '',
        `• ${pct(share)} da sua renda mensal`,
        `• Equivale a ${delay < 1 ? 'menos de 1 mês' : `${num(delay)} meses`} guardando 10% da sua renda (${brl(goal)} por mês)`,
        '',
        verdict,
        '',
        'Se for parcelar no cartão, lembre: se você não pagar a fatura inteira, o cartão cobra juros (o rotativo), em média 14% ao mês. A regra é simples: gaste menos do que ganha e deixe a vontade esfriar antes de decidir. 🪙',
      ].join('\n')
    ),
  ];
}

function stepCompra(session: Session, text: string): HubResult {
  const v = parseMoney(text);
  if (v === null || v <= 0) return { out: [txt(BAD_NUMBER)], session };
  if (session.step === 'income') {
    const price = session.data.price as number | undefined;
    if (price) return { out: compraResult(v, price), session: null };
    return { out: [txt('E quanto custa o que você quer comprar? Ex.: *2000*')], session: { ...session, step: 'price', data: { income: v } } };
  }
  return { out: compraResult(session.data.income as number, v), session: null };
}

/* ---------- calculadora de meta ---------- */

export function startMeta(): HubResult {
  return {
    out: [txt('🎯 *Calculadora de meta.* Quanto você quer juntar? Ex.: *20000*')],
    session: { flow: 'meta', step: 'target', data: {} },
  };
}

function stepMeta(session: Session, text: string): HubResult {
  const t = normalize(text);
  if (session.step === 'target') {
    const v = parseMoney(text);
    if (v === null || v <= 0) return { out: [txt(BAD_NUMBER)], session };
    return { out: [txt('Em quanto tempo? Ex.: *2 anos* (ou *18 meses*)')], session: { ...session, step: 'years', data: { target: v } } };
  }
  if (session.step === 'years') {
    const y = parseYears(text);
    if (y === null) return { out: [txt('Não entendi o prazo. 🤔 Ex.: *2 anos* ou *18 meses* (até 50 anos).')], session };
    return {
      out: [txt(`Quanto seu dinheiro rende por ano? Se você não sabe, mande *ok* que eu uso *${DEFAULT_RATE}% ao ano*, um valor parecido com o de aplicações seguras (Tesouro ou CDB). Ou me diga o seu.`)],
      session: { ...session, step: 'rate', data: { ...session.data, years: y } },
    };
  }
  const rate = parseAnnualRate(t);
  if (rate === null) return { out: [txt('Não entendi. 🤔 Mande *ok* pra usar 10% ao ano, ou um número, ex.: *12*')], session };
  const { target, years } = session.data as { target: number; years: number };
  const required = computeRequiredContribution(target, rate, years);
  const own = required * years * 12;
  const interest = Math.max(target - own, 0);
  return {
    out: [
      txt(
        [
          `🎯 *Pra juntar ${brl(target)} em ${num(years)} ${years === 1 ? 'ano' : 'anos'}*, guarde por mês:`,
          `*${brl(required)}*`,
          '',
          `• Do seu bolso: ${brl(own)}`,
          `• Vem do rendimento (juros): ${brl(interest)}, a ${pct(rate)} ao ano`,
          ...(years >= 2 ? ['', `⚠️ Os preços sobem uns ${num(INFLATION_PCT)}% ao ano (é a inflação). Por isso ${brl(target)} daqui a ${num(years)} anos compram só o que ${brl(inTodaysMoney(target, years))} compram hoje. Se você quer comprar o mesmo que compraria hoje, aumente a meta.`] : []),
          '',
          'Dica: separe esse valor no dia em que o salário cai, antes de gastar com qualquer outra coisa. 🪙',
        ].join('\n')
      ),
    ],
    session: null,
  };
}

/* ---------- longo prazo ---------- */

export function startLongo(profile: StateSnapshot): HubResult {
  const income = diagnosisFrom(profile)?.monthlyIncome ?? 0;
  const hint = income > 0 ? ` (10% da sua renda seria *${brl(Math.round(income * 0.1))}*)` : '';
  return {
    out: [txt(`📈 *Simulador de longo prazo.* Quanto você consegue guardar por mês?${hint} Ex.: *300*`)],
    session: { flow: 'longo', step: 'contribution', data: {} },
  };
}

function stepLongo(session: Session, text: string): HubResult {
  const t = normalize(text);
  if (session.step === 'contribution') {
    const v = parseMoney(text);
    if (v === null || v <= 0) return { out: [txt(BAD_NUMBER)], session };
    return { out: [txt('Por quantos anos? Ex.: *20*')], session: { ...session, step: 'years', data: { contribution: v } } };
  }
  if (session.step === 'years') {
    const y = parseYears(text);
    if (y === null) return { out: [txt('Não entendi o prazo. 🤔 Ex.: *20* (até 50 anos).')], session };
    return {
      out: [txt(`Quanto o dinheiro rende por ano? Mande *ok* pra usar *${DEFAULT_RATE}%* (valor típico de aplicações seguras) ou me diga o seu.`)],
      session: { ...session, step: 'rate', data: { ...session.data, years: y } },
    };
  }
  const rate = parseAnnualRate(t);
  if (rate === null) return { out: [txt('Não entendi. 🤔 Mande *ok* pra usar 10% ao ano, ou um número, ex.: *12*')], session };
  const { contribution, years } = session.data as { contribution: number; years: number };
  const total = computeProjection(contribution, rate, years);
  const own = contribution * years * 12;
  return {
    out: [
      txt(
        [
          `📈 *Em ${num(years)} ${years === 1 ? 'ano' : 'anos'}, guardando ${brl(contribution)} por mês, você teria:*`,
          `*${brl(total)}*`,
          '',
          `• Do seu bolso: ${brl(own)}`,
          `• Só de rendimento (juros): ${brl(Math.max(total - own, 0))}, a ${pct(rate)} ao ano`,
          '',
          `Como os preços sobem uns ${num(INFLATION_PCT)}% ao ano (inflação), esse dinheiro compraria só o que *${brl(inTodaysMoney(total, years))}* compram hoje.`,
          '',
          'O tempo faz mais que o valor: quanto antes você começa, menos precisa guardar.',
        ].join('\n')
      ),
    ],
    session: null,
  };
}

/* ---------- comparar empréstimos ---------- */

export interface Loan {
  principal: number;
  n: number;
  rate: number; // % ao mês
  derived: boolean; // a taxa foi calculada a partir da parcela
}

/** Taxa mensal (%) que faz a parcela fixa (Price) bater com a informada. null se a parcela não cobre nem o principal. */
export function monthlyRateFromInstallment(principal: number, n: number, installment: number): number | null {
  if (installment * n < principal - 0.01) return null;
  if (installment * n - principal < 0.01) return 0;
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    const pmt = (principal * mid) / (1 - Math.pow(1 + mid, -n));
    if (pmt > installment) hi = mid;
    else lo = mid;
  }
  return Math.round(((lo + hi) / 2) * 100 * 100) / 100;
}

/** "5000, 3,5%, 12" · "5000 em 12x de 520" · "5000 3,5 12". Em caso de erro, devolve o motivo quando dá pra explicar. */
export function parseLoan(raw: string): Loan | null {
  const r = parseLoanDetailed(raw);
  return 'error' in r ? null : r;
}

export function parseLoanDetailed(raw: string): Loan | { error: string } {
  const generic = { error: '' };
  let t = normalize(raw);
  const take = (re: RegExp) => {
    const m = t.match(re);
    if (m) t = t.replace(m[0], ' ');
    return m;
  };
  const rateM = take(/(\d+(?:[.,]\d+)?)\s*%/);
  const instM = take(/(?:\d{1,3}\s*(?:x|vezes)\s*(?:de)?|parcelas?\s*(?:de)?)\s*(?:r\$)?\s*(\d[\d.,]*)/);
  // a parcela já saiu; agora o nº de parcelas ("12x", "12 parcelas", "12 meses")
  const nM = instM ? raw.match(/(\d{1,3})\s*(?:x|vezes)/i) : null;
  const nWord = take(/(\d{1,3})\s*(?:x|vezes|parcelas?|meses|mes)\b/);

  let n: number | null = nM ? Number(nM[1]) : nWord ? Number(nWord[1]) : null;
  let rate: number | null = rateM ? parseAmount(rateM[1]) : null;
  const inst: number | null = instM ? parseAmount(instM[1]) : null;

  const rest = (t.match(/\d[\d.,]*(?:\s*(?:mil|k)\b)?/g) ?? []).map((x) => parseMoney(x)).filter((x): x is number => x !== null && x > 0);
  if (rest.length === 0) return generic;
  const principal = rest[0];
  if (n === null && rest.length >= 2) n = Math.round(rest[rest.length - 1]);
  if (rate === null && inst === null && rest.length >= 3) rate = rest[1];
  if (n === null || !Number.isInteger(n) || n < 1 || n > 600) return generic;

  if (rate !== null) return rate >= 0 && rate <= 100 ? { principal, n, rate, derived: false } : generic;
  if (inst !== null) {
    const derived = monthlyRateFromInstallment(principal, n, inst);
    if (derived === null) {
      return { error: `Confere os números: ${n} parcelas de ${brl2(inst)} somam ${brl2(inst * n)}, menos que os ${brl(principal)} do empréstimo.` };
    }
    return { principal, n, rate: derived, derived: true };
  }
  return generic;
}

const LOAN_FORMATS =
  'Mande valor, juros ao mês e parcelas:\n• *5000, 3,5%, 12*\n\nOu, se você só sabe a parcela:\n• *5000 em 12x de 520*';

function loanLine(label: string, l: Loan): string {
  const r = computeLoanInstallment(l.principal, l.rate, l.n);
  return `*${label}:* ${brl(l.principal)} em ${l.n}x de ${brl2(r.installment)} · juros ${pct(l.rate, 2)} ao mês${l.derived ? ' (calculado pela parcela)' : ''}`;
}

export function startEmprestimo(): HubResult {
  return {
    out: [txt(`💳 *Comparar empréstimos.* Vamos à *Proposta A*.\n\n${LOAN_FORMATS}`)],
    session: { flow: 'emprestimo', step: 'a', data: {} },
  };
}

function loanReport(a: Loan, b: Loan | null): string {
  const ra = computeLoanInstallment(a.principal, a.rate, a.n);
  if (!b) {
    const extra = (ra.totalInterest / a.principal) * 100;
    return [
      '💳 *Quanto esse empréstimo custa*',
      '',
      loanLine('Proposta', a),
      `• Você paga no total: *${brl(ra.total)}*`,
      `• Só de juros: *${brl(ra.totalInterest)}* (${pct(extra, 0)} a mais do que pegou)`,
      a.rate >= 8 ? '\n⚠️ Taxa muito alta. Antes de assinar, pergunte em pelo menos 2 bancos e veja se vale trocar de banco levando a dívida (a portabilidade; mande *direitos* pra saber mais).' : '',
    ]
      .join('\n')
      .trim();
  }
  const rb = computeLoanInstallment(b.principal, b.rate, b.n);
  const tie = Math.abs(ra.total - rb.total) < 0.5;
  const cheaper = ra.total <= rb.total ? 'A' : 'B';
  return [
    '💳 *Comparação das propostas*',
    '',
    loanLine('A', a),
    `   Total pago ${brl(ra.total)} · juros ${brl(ra.totalInterest)}`,
    '',
    loanLine('B', b),
    `   Total pago ${brl(rb.total)} · juros ${brl(rb.totalInterest)}`,
    '',
    tie ? '✅ As duas custam praticamente o mesmo no total.' : `✅ *A proposta ${cheaper} sai mais barata*: ${brl(Math.abs(ra.total - rb.total))} a menos no total pago.`,
    a.principal !== b.principal || a.n !== b.n ? 'Obs.: os valores ou prazos são diferentes, compare também a parcela que cabe no seu mês.' : '',
  ]
    .join('\n')
    .trim();
}

function stepEmprestimo(session: Session, text: string): HubResult {
  const t = normalize(text);
  const a = session.data.a as Loan | undefined;

  if (session.step === 'b' && a && /^(so essa|so a|so uma|nenhuma|so isso|so ela)$/.test(t)) {
    return { out: [txt(loanReport(a, null))], session: null };
  }
  const parsed = parseLoanDetailed(text);
  if ('error' in parsed) {
    return { out: [txt(parsed.error ? `${parsed.error} 🤔\n\n${LOAN_FORMATS}` : `Não consegui ler essa proposta. 🤔\n\n${LOAN_FORMATS}`)], session };
  }
  const loan = parsed;
  if (session.step === 'a') {
    return {
      out: [
        txt(`✅ ${loanLine('A', loan)}`),
        txt('Agora a *Proposta B*, no mesmo formato. Ou mande *só essa* pra ver quanto a A custa de verdade.'),
      ],
      session: { ...session, step: 'b', data: { a: loan } },
    };
  }
  return { out: [txt(loanReport(a!, loan))], session: null };
}

/* ---------- avalanche × bola de neve ---------- */

function debtLine(d: DebtItem, i: number): string {
  const { rate, assumed } = effectiveRate(d);
  return `${i + 1}. ${d.description || 'Dívida'} — ${brl(d.value)} (juros de ${num(rate)}% ao mês${assumed ? ', típicos' : ''})`;
}

function dividasResult(debts: DebtItem[]): Outgoing[] {
  const avalanche = [...debts].sort((a, b) => effectiveRate(b).rate - effectiveRate(a).rate);
  const snowball = [...debts].sort((a, b) => a.value - b.value);
  const same = avalanche.map((d) => d.id).join() === snowball.map((d) => d.id).join();
  const assumed = debts.some((d) => effectiveRate(d).assumed);
  return [
    txt(
      [
        '❄️ *Qual dívida pagar primeiro?* Pague o mínimo de todas e jogue o que sobrar na primeira da lista.',
        '',
        '🏔️ *Avalanche* — começa pela dívida com os juros mais altos (você gasta menos no total):',
        ...avalanche.map(debtLine),
        '',
        '⛄ *Bola de neve* — começa pela menor dívida (você quita mais rápido e se motiva):',
        ...snowball.map(debtLine),
        '',
        same ? 'Nas suas dívidas, as duas ordens coincidem: sem dúvida, começa por aí. 👏' : 'Se os juros são bem diferentes, escolha a avalanche. Se você precisa de motivação, escolha a bola de neve.',
        assumed ? '\nOnde você não informou os juros, usei a taxa típica do tipo de dívida.' : '',
      ]
        .join('\n')
        .trim()
    ),
  ];
}

export function startDividas(profile: StateSnapshot): HubResult {
  const debts = (diagnosisFrom(profile)?.debts ?? []).filter((d) => d.value > 0);
  if (debts.length > 0) return { out: dividasResult(debts), session: null };
  return {
    out: [
      txt(
        '❄️ *Qual dívida pagar primeiro?* Me conte suas dívidas, uma por mensagem: o tipo e o valor.\n\nEx.: *cartão 4500*\nEx.: *empréstimo 3000 juros 5*\n\nQuando acabar, mande *pronto*.'
      ),
    ],
    session: { flow: 'dividas', step: 'debts', data: { debts: [] } },
  };
}

function stepDividas(session: Session, text: string): HubResult {
  const t = normalize(text);
  const debts = (session.data.debts as DebtItem[] | undefined) ?? [];
  if (/^(pronto|acabou|so isso|so essas|fim|ok)$/.test(t)) {
    if (debts.length === 0) return { out: [txt('Você ainda não me contou nenhuma dívida. Ex.: *cartão 4500*. Ou *cancelar*.')], session };
    return { out: dividasResult(debts), session: null };
  }
  const debt = debts.length < 8 ? parseDebt(text, `d-${debts.length + 1}`) : null;
  if (!debt) return { out: [txt('Não entendi. 🤔 Mande o tipo e o valor, ex.: *cartão 4500*. Ou *pronto* se acabou.')], session };
  return {
    out: [txt(`✅ Anotei: *${debt.description}* — ${brl(debt.value)}. Tem outra? Mande agora, ou *pronto*.`)],
    session: { ...session, data: { debts: [...debts, debt] } },
  };
}

/* ---------- check-in do mês ---------- */

function checkinsFrom(profile: StateSnapshot): CheckinEntry[] {
  try {
    const list = profile['selos-checkins'] ? (JSON.parse(profile['selos-checkins']) as CheckinEntry[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const rateOf = (e: CheckinEntry) => (e.monthlyIncome > 0 ? (e.currentSavings / e.monthlyIncome) * 100 : 0);

export function startCheckin(profile: StateSnapshot): HubResult {
  const last = checkinsFrom(profile).at(-1);
  const def = last?.monthlyIncome ?? diagnosisFrom(profile)?.monthlyIncome ?? 0;
  const hint = def > 0 ? ` (*ok* pra manter ${brl(def)})` : '';
  return {
    out: [txt(`📅 *Check-in do mês.* Leva 1 minuto, 4 números.\n\n💰 Quanto você recebe por mês?${hint}`)],
    session: { flow: 'checkin', step: 'income', data: { defIncome: def, defDebt: last?.totalDebt ?? 0 } },
  };
}

function stepCheckin(session: Session, text: string, profile: StateSnapshot, now: Date): HubResult {
  const t = normalize(text);
  const d = session.data as { income?: number; savings?: number; expenses?: number; defIncome?: number; defDebt?: number };
  const value = (def?: number): number | null => (isOk(t) && def && def > 0 ? def : parseMoney(text));

  if (session.step === 'income') {
    const v = value(d.defIncome);
    if (v === null || v <= 0) return { out: [txt(BAD_NUMBER)], session };
    return { out: [txt('🐖 Quanto você guardou esse mês? (se nada, *0*)')], session: { ...session, step: 'savings', data: { ...d, income: v } } };
  }
  if (session.step === 'savings') {
    const v = parseMoney(text);
    if (v === null) return { out: [txt(BAD_NUMBER)], session };
    return { out: [txt('🧾 E o total de gastos do mês?')], session: { ...session, step: 'expenses', data: { ...d, savings: v } } };
  }
  if (session.step === 'expenses') {
    const v = parseMoney(text);
    if (v === null) return { out: [txt(BAD_NUMBER)], session };
    const hint = d.defDebt && d.defDebt > 0 ? ` (*ok* pra manter ${brl(d.defDebt)})` : '';
    return { out: [txt(`💳 Por último: quanto você deve hoje, somando todas as dívidas? (se nenhuma, *0*)${hint}`)], session: { ...session, step: 'debt', data: { ...d, expenses: v } } };
  }

  // debt: salva
  const v = value(d.defDebt);
  if (v === null) return { out: [txt(BAD_NUMBER)], session };
  const entry: CheckinEntry = { date: now.toISOString(), monthlyIncome: d.income ?? 0, currentSavings: d.savings ?? 0, totalExpenses: d.expenses ?? 0, totalDebt: v };
  const all = [...checkinsFrom(profile), entry];
  const prev = all.length > 1 ? all[all.length - 2] : null;
  const rateNow = rateOf(entry);
  const lines = ['✅ *Check-in salvo!*', '', `🐖 Você guardou *${num(rateNow, 0)}%* da sua renda`];
  if (prev) {
    const diff = rateNow - rateOf(prev);
    lines[2] += ` (${diff >= 0 ? '▲' : '▼'} ${num(Math.abs(diff), 0)} ponto${Math.round(Math.abs(diff)) === 1 ? '' : 's'} ${diff >= 0 ? 'a mais' : 'a menos'} que no mês passado)`;
    lines.splice(3, 0, diff > 0 ? '👏 Subiu! É assim que a riqueza cresce: devagar e sempre.' : diff < 0 ? 'Caiu um pouco, e tudo bem. O importante é entender o que mudou neste mês.' : 'Ficou igual: constância também é conquista.');
  }
  if (all.length > 1) {
    const max = Math.max(10, ...all.map(rateOf));
    lines.push('', '📈 *Quanto você guardou nos últimos meses*');
    for (const e of all.slice(-6)) {
      const label = new Date(e.date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'America/Sao_Paulo' }).replace('.', '');
      lines.push(`${label} ${'█'.repeat(Math.max(0, Math.round((rateOf(e) / max) * 8)))} ${num(rateOf(e), 0)}%`);
    }
    if (all.some((e) => e.totalDebt > 0)) lines.push('', `💳 Dívidas: ${prev ? `${brl(prev.totalDebt)} → ` : ''}${brl(entry.totalDebt)}`);
  }
  lines.push('', '*Seu plano pra esse mês:*', ...checkinActionPlan(entry).map((x, i) => `${i + 1}. ${x}`));
  return { out: [txt(lines.join('\n'))], session: null, profile: { ...profile, 'selos-checkins': JSON.stringify(all) } };
}

/* ---------- selos e perfil ---------- */

const SELOS = [
  ['I', 'Pague-se primeiro'],
  ['II', 'Controle os gastos'],
  ['III', 'Construa sua reserva'],
  ['IV', 'Proteja-se de perdas'],
] as const;

export function selosOut(profile: StateSnapshot): Outgoing[] {
  const earned = profile['selos-diagnosis-completed'] === 'true';
  const lines = ['🏅 *Seus selos*', earned ? 'Você completou o diagnóstico e conquistou os quatro selos das leis do livro:' : 'Complete o diagnóstico (mande *diagnóstico*) pra desbloquear os quatro selos das leis do livro:', ''];
  for (const [numeral, label] of SELOS) lines.push(`${earned ? '✅' : '🔒'} ${numeral} — ${label}`);

  const diag = diagnosisFrom(profile);
  if (diag) {
    const a = getArchetype(diag, calculateDiagnosis(diag));
    lines.push('', `🎭 *Seu perfil:* ${a.name}`, `_${a.tagline}_`, `Seu poder: ${a.power}`, `Sua próxima missão: ${a.quest}`);
  }
  try {
    const tracking = profile['selos-tracking'] ? (JSON.parse(profile['selos-tracking']) as Tracking) : null;
    if (tracking) {
      const view = trackingView(tracking, leaksMonthlyTotal(leaksFrom(profile)));
      lines.push('', '🎖️ *Conquistas do plano*');
      for (const b of view.badges) lines.push(`${b.earned ? '✅' : '🔒'} ${b.label}`);
      if (view.streak > 0) lines.push(`🔥 ${view.streak} ${view.streak === 1 ? 'mês seguido' : 'meses seguidos'} cumprindo o plano`);
    }
  } catch {
    // plano ilegível: mostra só os selos
  }
  return [txt(lines.join('\n'))];
}

/* ---------- frase do dia ---------- */

export function fraseOut(index: number | null, now: Date): Outgoing[] {
  const i = index !== null && index >= 0 && index < QUOTES.length ? index : dailyQuoteIndex(now);
  return [
    buttons(`✨ *Frase do dia*\n\n"${QUOTES[i]}"`, [
      [`frase:${(i + 1) % QUOTES.length}`, 'Outra frase'],
      ['menu:menu', 'Voltar ao menu'],
    ]),
  ];
}

/* ---------- leitor de fatura (o resultado da leitura, mandado pelo WhatsApp) ---------- */

const FATURA_TYPE_LABEL: Record<FaturaResult['cobrancas'][number]['tipo'], string> = {
  assinatura: 'Assinatura',
  seguro: 'Seguro',
  tarifa: 'Tarifa',
  anuidade: 'Anuidade',
  juros_multa: 'Juros/multa',
  outro: 'Outro',
};

// tipo de cobrança → item do caça-vazamentos
const FATURA_TYPE_TO_LEAK: Partial<Record<FaturaResult['cobrancas'][number]['tipo'], string>> = {
  assinatura: 'assinaturas',
  seguro: 'seguros',
  tarifa: 'tarifa',
  anuidade: 'anuidade',
  juros_multa: 'atraso',
};

// categorias da fatura que existem no diagnóstico, pra comparar o estimado com o real
const FATURA_DIAG_CATEGORY: Record<string, keyof WizardData['expenses']> = {
  Alimentação: 'alimentacao',
  Transporte: 'transporte',
  Moradia: 'moradia',
  Lazer: 'lazer',
};

export function faturaOut(r: FaturaResult, profile: StateSnapshot): { out: Outgoing[]; session: Session | null } {
  if (!r.e_documento_financeiro) {
    return { out: [txt('Esse arquivo não parece uma fatura de cartão nem um extrato. 🤔 Tenta com outro (PDF ou foto nítida).')], session: null };
  }
  const leaks: LeakSelection = {};
  for (const c of r.cobrancas) {
    const id = FATURA_TYPE_TO_LEAK[c.tipo];
    if (id) leaks[id] = Math.round(((leaks[id] ?? 0) + c.valor) * 100) / 100;
  }
  const leakSum = leaksMonthlyTotal(leaks);

  const head = [`🧾 *${r.periodo ? `Gastos de ${r.periodo}` : 'Gastos do período'}:* ${brl(r.total)}`];
  if (leakSum > 0) head.push(`Achei *${brl(leakSum)}/mês* em cobranças que dá pra cortar ou contestar: ${brl(leakSum * 12)} por ano.`);
  if (r.cobrancas.length > 0) {
    head.push('', '🔎 *Cobranças pra revisar:*');
    for (const c of r.cobrancas.slice(0, 12)) head.push(`• ${FATURA_TYPE_LABEL[c.tipo]} — ${c.descricao}: *${brl2(c.valor)}*\n  ${c.dica}`);
  } else head.push('', 'Não achei cobranças suspeitas. 👏');

  const out: Outgoing[] = [txt(head.join('\n'))];

  const diag = diagnosisFrom(profile);
  const more: string[] = [];
  if (r.categorias.length > 0) {
    more.push('*Por categoria:*');
    for (const c of [...r.categorias].sort((a, b) => b.total - a.total).slice(0, 9)) {
      const key = FATURA_DIAG_CATEGORY[c.nome];
      const said = diag && key ? diag.expenses[key] : 0;
      more.push(`${categoryEmoji(c.nome)} ${c.nome}: ${brl(c.total)}${said > 0 && c.total > said * 1.15 ? ` (no diagnóstico você disse ${brl(said)})` : ''}`);
    }
  }
  if (r.parcelados.length > 0) {
    more.push('', '*Parcelas em andamento:*');
    for (const p of r.parcelados.slice(0, 8)) more.push(`• ${p.descricao}: ${brl2(p.parcela)}${p.parcelas_restantes > 0 ? ` · faltam ${p.parcelas_restantes}` : ''}`);
  }
  if (r.alertas.length > 0) more.push('', ...r.alertas.slice(0, 3).map((a) => `⚠️ ${a}`));
  if (more.length > 0) out.push(txt(more.join('\n')));

  if (leakSum > 0) {
    out.push(buttons('Quer que eu coloque esse valor no seu caça-vazamentos? Ele entra no seu plano e eu mando como cancelar cada cobrança.', [['fatura:add', 'Sim, adicionar'], ['fatura:skip', 'Agora não']]));
    return { out, session: { flow: 'fatura', step: 'add', data: { leaks } } };
  }
  return { out, session: null };
}

/* ---------- despacho das conversas ---------- */

export function toolStep(session: Session, text: string, profile: StateSnapshot, now: Date): HubResult | null {
  switch (session.flow) {
    case 'compra':
      return stepCompra(session, text);
    case 'meta':
      return stepMeta(session, text);
    case 'longo':
      return stepLongo(session, text);
    case 'emprestimo':
      return stepEmprestimo(session, text);
    case 'dividas':
      return stepDividas(session, text);
    case 'checkin':
      return stepCheckin(session, text, profile, now);
    default:
      return null;
  }
}
