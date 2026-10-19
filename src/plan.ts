import type { WizardData, DebtItem, DebtKind } from './types.js';
import { formatBRL, computeProjection, idealShares } from './calculations.js';
import type { ToolId } from './tools.js';

// Plano de ação de verdade: o que fazer, quanto, onde e até quando.
// Tudo sai dos números que a pessoa já digitou no diagnóstico — nada de "revise seus gastos".

/* ---------- tipos de dívida e taxas típicas ---------- */

export interface DebtKindInfo {
  id: DebtKind;
  label: string;
  typicalRate: number; // % ao mês — referência de mercado quando a pessoa não sabe a taxa
}

// Médias aproximadas do mercado brasileiro (Banco Central). Servem só de ponto de partida:
// a pessoa pode (e deve) trocar pela taxa do contrato dela.
export const DEBT_KINDS: DebtKindInfo[] = [
  { id: 'cartao', label: 'Cartão de crédito', typicalRate: 14 },
  { id: 'cheque', label: 'Cheque especial', typicalRate: 8 },
  { id: 'emprestimo', label: 'Empréstimo pessoal', typicalRate: 5 },
  { id: 'consignado', label: 'Consignado', typicalRate: 1.8 },
  { id: 'financiamento', label: 'Financiamento', typicalRate: 1.5 },
  { id: 'outro', label: 'Outra (carnê, loja…)', typicalRate: 4 },
];

// Taxa de referência pra quem trocar dívida cara por um empréstimo pessoal mais barato
const SWAP_RATE = 4.5;
// Rendimento mensal aproximado de um CDB de liquidez diária / Tesouro Selic, já descontado o IR
const RESERVE_RATE = 0.008;
const MAX_MONTHS = 240;

export function getDebtKind(id: DebtKind): DebtKindInfo {
  return DEBT_KINDS.find((k) => k.id === id) ?? DEBT_KINDS[DEBT_KINDS.length - 1];
}

// Dívidas salvas antes de existir o campo "tipo": tenta adivinhar pela descrição
export function resolveKind(debt: DebtItem): DebtKind {
  if (debt.kind) return debt.kind;
  const d = debt.description.toLowerCase();
  if (d.includes('cart')) return 'cartao';
  if (d.includes('cheque') || d.includes('especial')) return 'cheque';
  if (d.includes('consig')) return 'consignado';
  if (d.includes('financ') || d.includes('carro') || d.includes('casa') || d.includes('imóvel') || d.includes('imovel')) return 'financiamento';
  if (d.includes('empr')) return 'emprestimo';
  return 'outro';
}

export function effectiveRate(debt: DebtItem): { rate: number; assumed: boolean } {
  if (debt.interestRate && debt.interestRate > 0) return { rate: debt.interestRate, assumed: false };
  return { rate: getDebtKind(resolveKind(debt)).typicalRate, assumed: true };
}

/* ---------- datas ---------- */

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// mês 1 do plano = mês que vem (o primeiro pagamento já com o plano em mãos)
function monthAt(start: Date, n: number): { m: number; y: number } {
  const total = start.getFullYear() * 12 + start.getMonth() + n;
  return { m: total % 12, y: Math.floor(total / 12) };
}

export function monthShort(start: Date, n: number): string {
  const { m, y } = monthAt(start, n);
  return `${MONTHS_SHORT[m]}/${String(y).slice(2)}`;
}

export function monthLong(start: Date, n: number): string {
  const { m, y } = monthAt(start, n);
  return `${MONTHS_LONG[m]} de ${y}`;
}

/* ---------- simulação de quitação ---------- */

interface SimDebt {
  id: string;
  balance: number;
  rate: number; // fração ao mês
  min: number;
}

interface SimResult {
  months: number | null; // null = não quita dentro do horizonte
  interest: number;
  payoffMonth: Record<string, number>;
  schedule: { payments: Record<string, number>; leftover: number; debtLeft: number }[];
}

// Avalanche: todo mês paga o mínimo de cada dívida e joga o resto na de maior juros.
// Quando uma dívida acaba, o que ia pra ela continua no plano (o valor mensal é fixo).
function simulateAvalanche(debts: SimDebt[], monthlyPower: number): SimResult {
  const list = debts.map((d) => ({ ...d })).sort((a, b) => b.rate - a.rate);
  const payoffMonth: Record<string, number> = {};
  const schedule: SimResult['schedule'] = [];
  let interest = 0;

  for (let month = 1; month <= MAX_MONTHS; month++) {
    const open = list.filter((d) => d.balance > 0.005);
    if (open.length === 0) return { months: month - 1, interest, payoffMonth, schedule };

    for (const d of open) {
      const j = d.balance * d.rate;
      d.balance += j;
      interest += j;
    }

    let available = monthlyPower;
    const payments: Record<string, number> = {};
    const pay = (d: (typeof list)[number], amount: number) => {
      const p = Math.min(amount, d.balance, available);
      if (p <= 0) return;
      d.balance -= p;
      available -= p;
      payments[d.id] = (payments[d.id] || 0) + p;
    };

    for (const d of open) pay(d, d.min);
    for (const d of open) pay(d, Infinity);

    for (const d of open) if (d.balance <= 0.005 && !payoffMonth[d.id]) payoffMonth[d.id] = month;
    const debtLeft = list.reduce((s, d) => s + Math.max(d.balance, 0), 0);
    schedule.push({ payments, leftover: available, debtLeft });
    if (debtLeft <= 0.005) return { months: month, interest, payoffMonth, schedule };
  }
  return { months: null, interest, payoffMonth, schedule };
}

// Cenário "sem plano": cada dívida só com a própria parcela, sem redirecionar nada
function simulateMinimumsOnly(debts: SimDebt[]): { months: number | null; interest: number } {
  let worst = 0;
  let interest = 0;
  for (const d of debts) {
    let balance = d.balance;
    let m = 0;
    while (balance > 0.005 && m < MAX_MONTHS) {
      const j = balance * d.rate;
      interest += j;
      balance = balance + j - d.min;
      m++;
    }
    if (balance > 0.005) return { months: null, interest };
    worst = Math.max(worst, m);
  }
  return { months: worst, interest };
}

/* ---------- plano ---------- */

export interface PlanCut {
  key: keyof WizardData['expenses'];
  label: string;
  current: number;
  ceiling: number;
  amount: number;
}

export interface PlanDebt {
  id: string;
  name: string;
  kind: DebtKind;
  balance: number;
  rate: number; // % ao mês
  rateAssumed: boolean;
  installment: number;
  payoffMonth: number | null;
  firstPayment: number;
}

export interface PlanStep {
  title: string;
  detail: string; // "como fazer": fica recolhido no site
  tone: 'bad' | 'warn' | 'good' | 'info';
  why?: string; // pra que serve esse passo, numa frase simples
  amount?: string; // "R$ 300 por mês"
  when?: string; // "agora", "até mar/27", "a partir de jan/28"
  tool?: ToolId; // a ferramenta do site que ajuda a cumprir o passo
}

export interface PlanPhase {
  id: 'debts' | 'reserve' | 'invest';
  title: string;
  from: number; // mês do plano
  to: number | null; // null = sem fim (investir) ou não fecha no horizonte
  amount: number;
  note: string;
}

export interface ScheduleRow {
  month: number;
  label: string;
  payments: { id: string; name: string; amount: number }[];
  toReserve: number;
  debtLeft: number;
}

export interface ActionPlan {
  start: Date;
  monthlyPower: number; // quanto vai pro plano por mês: o que já guarda + parcelas + vazamentos + cortes
  savingNow: number; // o que a pessoa disse que já guarda (pode ser 0)
  goals: PlanGoal[]; // metas salvas na calculadora de meta
  powerAssumed: boolean; // a pessoa não tinha sobra declarada: o plano assume 10% da renda
  sources: { savings: number; cuts: number; installments: number; leaks: number };
  unaccounted: number; // renda que não aparece em nenhuma categoria
  cuts: PlanCut[];
  debts: PlanDebt[]; // na ordem de ataque
  debtFreeMonth: number | null; // 0 = sem dívidas; null = não quita no horizonte
  stuck: boolean; // o valor mensal não cobre nem os juros
  monthlyInterestNow: number;
  totalInterest: number;
  baseline: { months: number | null; interest: number } | null;
  swap: { names: string[]; saving: number; months: number | null } | null;
  reserve: { target: number; current: number; doneMonth: number | null; alreadyDone: boolean };
  investFrom: number | null;
  invest10y: number;
  phases: PlanPhase[];
  schedule: ScheduleRow[];
  steps: PlanStep[];
  negotiation: { debtName: string; message: string } | null;
}

// o teto de cada um depende da renda (idealShares, em calculations.ts)
const CEILINGS: { key: keyof WizardData['expenses']; label: string }[] = [
  { key: 'moradia', label: 'Moradia' },
  { key: 'alimentacao', label: 'Alimentação' },
  { key: 'transporte', label: 'Transporte' },
  { key: 'lazer', label: 'Lazer' },
];

const fmtRate = (r: number) => `${r.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% ao mês`;

export interface PlanGoal {
  name: string;
  target: number;
  monthly: number;
  months: number;
}

export interface PlanOptions {
  start?: Date;
  extraMonthly?: number; // dinheiro achado no caça-vazamentos, somado ao valor mensal do plano
  goals?: PlanGoal[]; // metas da calculadora de meta: entram no plano depois da reserva
}

// Corte realista: no máximo 30% do que a categoria custa hoje, mesmo que o teto ideal esteja mais longe.
// Pedir pra cortar metade do transporte num mês não acontece, e o plano não pode contar com dinheiro que não vem.
const MAX_CUT_SHARE = 0.3;

export function buildPlan(data: WizardData, opts: PlanOptions = {}): ActionPlan {
  const start = opts.start ?? new Date();
  const extraMonthly = Math.max(0, opts.extraMonthly ?? 0);
  const income = data.monthlyIncome || 0;
  const totalExpenses = Object.values(data.expenses).reduce((a, b) => a + b, 0);

  // 1. Cortes: o que passa do teto de cada categoria vira dinheiro pro plano.
  // Moradia não entra no corte automático: mudar de casa não é coisa de um mês.
  const share = idealShares(income);
  const cuts: PlanCut[] = CEILINGS.filter((c) => c.key !== 'moradia')
    .map((c) => ({
      key: c.key,
      label: c.label,
      current: data.expenses[c.key],
      ceiling: Math.round(income * share[c.key]),
      amount: Math.max(0, Math.min(Math.round(data.expenses[c.key] - income * share[c.key]), Math.round(data.expenses[c.key] * MAX_CUT_SHARE))),
    }))
    .map((c) => ({ ...c, ceiling: Math.max(c.ceiling, c.current - c.amount) }))
    .filter((c) => c.amount >= 1);
  const cutsTotal = cuts.reduce((s, c) => s + c.amount, 0);
  const moradiaOver = Math.max(0, Math.round(data.expenses.moradia - income * share.moradia));

  // 2. Dívidas com taxa (real ou típica) e parcela
  const debts = data.debts
    .filter((d) => d.value > 0)
    .map((d) => {
      const { rate, assumed } = effectiveRate(d);
      return {
        id: d.id,
        name: d.description.trim() || getDebtKind(resolveKind(d)).label.split(' (')[0],
        kind: resolveKind(d),
        balance: d.value,
        rate,
        rateAssumed: assumed,
        installment: d.installment || 0,
      };
    })
    .sort((a, b) => b.rate - a.rate);
  // inclui dívidas já zeradas (ex.: quitadas com o 13º): a parcela delas continua indo pro plano
  const installments = data.debts.reduce((s, d) => s + (d.installment || 0), 0);

  // 3. Quanto vai pro plano por mês: o que já guarda + parcelas que já paga + vazamentos achados + cortes.
  // O que a pessoa já guarda fica separado (savingNow): o resto só existe se ela fizer os passos do plano.
  const savingNow = Math.max(0, data.currentSavings);
  let monthlyPower = savingNow + cutsTotal + installments + extraMonthly;
  let powerAssumed = false;
  if (monthlyPower <= 0 && income > 0) {
    monthlyPower = Math.round(income * 0.1);
    powerAssumed = true;
  }
  const unaccounted = Math.max(0, income - totalExpenses - data.currentSavings - installments);

  // 4. Quitação
  const sim: SimDebt[] = debts.map((d) => ({ id: d.id, balance: d.balance, rate: d.rate / 100, min: d.installment }));
  const monthlyInterestNow = sim.reduce((s, d) => s + d.balance * d.rate, 0);
  const result = simulateAvalanche(sim, monthlyPower);
  const debtFreeMonth = debts.length === 0 ? 0 : result.months;
  const stuck = debts.length > 0 && result.months === null;

  const planDebts: PlanDebt[] = debts.map((d) => ({
    ...d,
    payoffMonth: result.payoffMonth[d.id] ?? null,
    firstPayment: result.schedule[0]?.payments[d.id] ?? 0,
  }));

  const baseline =
    debts.length > 0 && debts.every((d) => d.installment > 0) ? simulateMinimumsOnly(sim) : null;

  // 5. Trocar dívida cara (cartão, cheque especial…) por um empréstimo mais barato
  let swap: ActionPlan['swap'] = null;
  const expensive = debts.filter((d) => d.rate > SWAP_RATE + 1);
  if (expensive.length > 0) {
    const swapped = simulateAvalanche(
      sim.map((d) => (d.rate * 100 > SWAP_RATE + 1 ? { ...d, rate: SWAP_RATE / 100 } : d)),
      monthlyPower
    );
    const saving = stuck ? 0 : result.interest - swapped.interest;
    if (swapped.months !== null && (stuck || saving > 50)) {
      swap = { names: expensive.map((d) => d.name), saving, months: swapped.months };
    }
  }

  // 6. Reserva de emergência (6 meses de gastos), depois das dívidas
  const target = totalExpenses * 6;
  const reserveStart = debtFreeMonth ?? null;
  let reserveBalance = data.emergencyFund;
  const alreadyDone = target > 0 && reserveBalance >= target;
  let doneMonth: number | null = alreadyDone ? reserveStart : null;
  if (!alreadyDone && reserveStart !== null && target > 0 && monthlyPower > 0) {
    // o que sobrou no mês em que a última dívida acabou já entra na reserva
    reserveBalance += result.schedule[result.schedule.length - 1]?.leftover ?? 0;
    for (let m = 1; m <= MAX_MONTHS * 2; m++) {
      reserveBalance = reserveBalance * (1 + RESERVE_RATE) + monthlyPower;
      if (reserveBalance >= target) {
        doneMonth = reserveStart + m;
        break;
      }
    }
  }
  if (target === 0) doneMonth = reserveStart;

  const investFrom = doneMonth !== null ? doneMonth + 1 : null;
  const invest10y = computeProjection(monthlyPower, 10, 10);

  // 7. Fases
  const phases: PlanPhase[] = [];
  if (debts.length > 0) {
    phases.push({
      id: 'debts',
      title: 'Sair das dívidas',
      from: 1,
      to: debtFreeMonth,
      amount: monthlyPower,
      note: stuck
        ? 'Com o valor de hoje a dívida não fecha — renegociar vem antes de tudo.'
        : `Ordem de ataque: ${planDebts.map((d) => d.name).join(' → ')}.`,
    });
  }
  if (!alreadyDone && target > 0 && debtFreeMonth !== null) {
    phases.push({
      id: 'reserve',
      title: 'Guardar pra emergências',
      from: debtFreeMonth + 1,
      to: doneMonth,
      amount: monthlyPower,
      note: `Até juntar ${formatBRL(target)} (6 meses dos seus gastos) num lugar com resgate no mesmo dia.`,
    });
  }
  if (investFrom !== null) {
    phases.push({
      id: 'invest',
      title: 'Investir',
      from: investFrom,
      to: null,
      amount: monthlyPower,
      note: `Mantendo ${formatBRL(monthlyPower)} por mês, em 10 anos são cerca de ${formatBRL(invest10y)}.`,
    });
  }

  // 8. Calendário mês a mês (enquanto houver dívida)
  const names = Object.fromEntries(planDebts.map((d) => [d.id, d.name]));
  const schedule: ScheduleRow[] = (stuck ? [] : result.schedule).map((row, i) => ({
    month: i + 1,
    label: monthShort(start, i + 1),
    payments: planDebts.filter((d) => row.payments[d.id]).map((d) => ({ id: d.id, name: names[d.id], amount: row.payments[d.id] })),
    toReserve: row.leftover,
    debtLeft: row.debtLeft,
  }));

  // 9. Passos concretos, na ordem em que devem ser feitos. Cada um diz pra que serve, quanto, até quando
  // e qual ferramenta do site ajuda. O "detail" é o como fazer, sem jargão.
  const steps: PlanStep[] = [];
  const first = planDebts[0];
  const perMonth = (n: number) => `${formatBRL(n)} por mês`;
  const short = (n: number) => monthShort(start, n);

  if (powerAssumed) {
    steps.push({
      tone: 'warn',
      title: 'Separe 10% do que você ganha',
      why: 'Hoje não sobra nada. O primeiro hábito é guardar uma parte antes de gastar.',
      amount: perMonth(monthlyPower),
      when: 'todo dia de pagamento',
      tool: 'tracker',
      detail: `Você disse que hoje não guarda nada e os gastos já ocupam a renda. O plano começa com ${formatBRL(monthlyPower)} por mês (10% da renda). No dia em que o dinheiro cair, transfira esse valor pra outra conta antes de pagar qualquer coisa.`,
    });
  }

  if (stuck) {
    steps.push({
      tone: 'bad',
      title: 'Renegocie suas dívidas',
      why: 'Os juros crescem mais rápido do que você consegue pagar.',
      amount: `juros de ${perMonth(monthlyInterestNow)}`,
      when: 'agora',
      tool: 'rights',
      detail: `Suas dívidas geram cerca de ${formatBRL(monthlyInterestNow)} de juros por mês e o que dá pra pagar hoje é ${formatBRL(monthlyPower)}. Assim a dívida não para de crescer. Ligue ou mande mensagem pro banco pedindo desconto à vista ou parcelamento com juros menores (a mensagem pronta está em "Mais ajuda pro seu plano").`,
    });
  }

  if (cuts.length > 0) {
    steps.push({
      tone: 'warn',
      title: `Gaste menos em ${cuts.map((c) => c.label.toLowerCase()).join(' e ')}`,
      why: 'É de onde sai o dinheiro do plano.',
      amount: `${perMonth(cutsTotal)} a menos`,
      when: 'a partir deste mês',
      tool: 'leaks',
      detail: `${cuts.map((c) => `${c.label}: de ${formatBRL(c.current)} para ${formatBRL(c.ceiling)}`).join('; ')}. O corte é de no máximo 30% por vez, pra ser possível de verdade. Anote os gastos no WhatsApp pra ver se está conseguindo.`,
    });
  }

  if (swap) {
    steps.push({
      tone: 'warn',
      title: `Troque ${swap.names.join(' e ')} por uma dívida mais barata`,
      why: 'Juros menores: você paga menos e termina antes.',
      amount: stuck ? undefined : `economia de ${formatBRL(swap.saving)}`,
      when: 'antes de pagar a próxima parcela',
      tool: 'loan',
      detail: stuck
        ? `Com um empréstimo pessoal (perto de ${fmtRate(SWAP_RATE)}) no lugar, a dívida passa a fechar: você fica livre em ${monthLong(start, swap.months ?? 0)}. Consignado costuma ser ainda mais barato. Antes de assinar, compare o custo total no Comparador de empréstimo.`
        : `Um empréstimo pessoal (perto de ${fmtRate(SWAP_RATE)}) ou consignado pra quitar essas dívidas economiza cerca de ${formatBRL(swap.saving)} em juros. Antes de assinar, compare o custo total no Comparador de empréstimo.`,
    });
  }

  if (data.emergencyFund > 0 && first && first.rate >= 5 && totalExpenses > 0) {
    const usable = Math.min(data.emergencyFund - totalExpenses, first.balance);
    if (usable >= 100) {
      steps.push({
        tone: 'info',
        title: `Use ${formatBRL(usable)} do que está guardado pra abater ${first.name}`,
        why: 'Essa dívida cobra mais do que o seu dinheiro guardado rende.',
        amount: formatBRL(usable),
        when: 'agora',
        tool: 'debts',
        detail: `O dinheiro guardado rende perto de 1% ao mês; essa dívida cobra ${fmtRate(first.rate)}. Deixe 1 mês de gastos (${formatBRL(totalExpenses)}) guardado e use o resto pra quitar.`,
      });
    }
  }

  if (debts.length > 0 && !stuck && first) {
    const rest = planDebts.slice(1);
    steps.push({
      tone: 'bad',
      title: `Pague primeiro ${first.name}`,
      why: 'É a dívida de juros mais alto: atacar ela primeiro é o que mais economiza.',
      amount: perMonth(first.firstPayment),
      when: `até ${short(first.payoffMonth ?? 0)}`,
      tool: 'debts',
      detail: `Juros de ${fmtRate(first.rate)}${first.rateAssumed ? ' (taxa típica, confira no seu contrato)' : ''}. ${
        rest.length > 0 ? 'Nas outras, pague só a parcela mínima. ' : ''
      }Ela termina em ${monthLong(start, first.payoffMonth ?? 0)}.${
        rest.length > 0 ? ` Depois, o mesmo valor vai pra ${rest.map((d) => `${d.name} (quitada em ${monthLong(start, d.payoffMonth ?? 0)})`).join(', depois ')}.` : ''
      }`,
    });
    let livre = `Pagando ${formatBRL(result.interest)} de juros no total.`;
    if (baseline) {
      livre +=
        baseline.months === null
          ? ' Pagando só as parcelas mínimas, essa dívida não acabaria nunca.'
          : baseline.interest - result.interest > 50
            ? ` Pagando só as parcelas, seria em ${monthLong(start, baseline.months)} e com ${formatBRL(baseline.interest)} de juros: o plano economiza ${formatBRL(baseline.interest - result.interest)}.`
            : '';
    }
    steps.push({ tone: 'good', title: 'Fique livre das dívidas', why: 'A primeira grande meta do plano.', when: short(debtFreeMonth ?? 0), detail: livre });
  }

  if (target > 0) {
    if (alreadyDone) {
      steps.push({
        tone: 'good',
        title: 'Sua reserva de emergência já está pronta',
        why: 'Um imprevisto não vira dívida.',
        amount: formatBRL(data.emergencyFund),
        detail: 'Você tem mais que 6 meses de gastos guardados. Deixe num lugar que rende e deixa sacar no mesmo dia (CDB de liquidez diária ou Tesouro Selic, no app do seu banco). Nunca parado na conta.',
      });
    } else if (doneMonth !== null) {
      steps.push({
        tone: 'info',
        title: 'Guarde pra emergências',
        why: `Ter 6 meses de gastos guardados (${formatBRL(target)}) faz um imprevisto não virar dívida.`,
        amount: perMonth(monthlyPower),
        when: debts.length > 0 ? `de ${short((debtFreeMonth ?? 0) + 1)} até ${short(doneMonth)}` : `até ${short(doneMonth)}`,
        tool: 'tracker',
        detail: `Guarde num lugar que rende e deixa sacar no mesmo dia (CDB de liquidez diária ou Tesouro Selic, no app do seu banco). Programe a transferência pro dia em que o salário cai: primeiro você, depois as contas.${data.emergencyFund > 0 ? ` Você já tem ${formatBRL(data.emergencyFund)}.` : ''}`,
      });
    }
  }

  // metas da calculadora de meta: entram depois da reserva, com o valor que a pessoa definiu
  const goals = opts.goals ?? [];
  for (const g of goals) {
    steps.push({
      tone: 'info',
      title: `Junte pra ${g.name}`,
      why: 'A meta que você definiu na Calculadora de meta.',
      amount: perMonth(g.monthly),
      when: `em ${g.months} ${g.months === 1 ? 'mês' : 'meses'}`,
      tool: 'goal',
      detail: `Pra chegar em ${formatBRL(g.target)}, guarde ${formatBRL(g.monthly)} por mês numa conta separada da reserva de emergência. ${investFrom !== null ? `Se apertar, comece depois de ${monthLong(start, investFrom - 1)}, quando a reserva fica pronta.` : ''}`.trim(),
    });
  }

  if (investFrom !== null && monthlyPower > 0) {
    steps.push({
      tone: 'good',
      title: 'Comece a investir',
      why: 'Com a reserva pronta, o dinheiro passa a trabalhar pra você.',
      amount: perMonth(monthlyPower),
      when: `a partir de ${short(investFrom)}`,
      tool: 'longterm',
      detail: `Mantendo esse valor, em 10 anos você chega perto de ${formatBRL(invest10y)} (contando uns 10% ao ano). Pra começar, Tesouro IPCA+ ou um fundo que segue o índice da bolsa, no app do seu banco ou corretora.`,
    });
  }

  if (unaccounted >= Math.max(200, income * 0.1)) {
    steps.push({
      tone: 'info',
      title: 'Descubra pra onde vai o resto do dinheiro',
      why: `${formatBRL(unaccounted)} por mês da sua renda não aparecem em nenhum gasto.`,
      amount: perMonth(unaccounted),
      when: 'nos próximos 30 dias',
      detail: 'Anote tudo no WhatsApp da Grana Séria (ex.: "mercado 80 no pix"). Em um mês você vê pra onde esse dinheiro vai, e o que sobrar pode entrar no plano.',
    });
  }

  if (moradiaOver >= 1) {
    steps.push({
      tone: 'info',
      title: 'Reveja o valor da moradia',
      why: `Está ${formatBRL(moradiaOver)} acima do recomendado pra sua renda.`,
      when: 'na renovação do aluguel',
      detail: 'Não precisa mudar amanhã. Na renovação, negocie o valor ou pense em dividir ou trocar de imóvel.',
    });
  }

  // 10. Mensagem de renegociação pra dívida mais cara
  let negotiation: ActionPlan['negotiation'] = null;
  const target2 = planDebts.find((d) => d.kind !== 'consignado' && d.kind !== 'financiamento') ?? (stuck ? planDebts[0] : undefined);
  if (target2) {
    const canPay = stuck ? monthlyPower : target2.firstPayment;
    negotiation = {
      debtName: target2.name,
      message: [
        'Olá! Sou cliente e tenho uma dívida em aberto com vocês' +
          ` (${getDebtKind(target2.kind).label.split(' (')[0].toLowerCase()}), no valor de cerca de ${formatBRL(target2.balance)}.`,
        `Quero quitar, mas a taxa atual (${fmtRate(target2.rate)}) não cabe no meu orçamento. Consigo pagar ${formatBRL(canPay)} por mês.`,
        'Gostaria de saber:',
        '1) se existe desconto para pagamento à vista;',
        '2) uma proposta de parcelamento com juros menores;',
        '3) o Custo Efetivo Total (CET) de cada opção, por escrito.',
        'Obrigado!',
      ].join('\n'),
    };
  }

  return {
    start,
    monthlyPower,
    savingNow,
    goals: opts.goals ?? [],
    powerAssumed,
    sources: { savings: data.currentSavings, cuts: cutsTotal, installments, leaks: extraMonthly },
    unaccounted,
    cuts,
    debts: planDebts,
    debtFreeMonth,
    stuck,
    monthlyInterestNow,
    totalInterest: result.interest,
    baseline,
    swap,
    reserve: { target, current: data.emergencyFund, doneMonth, alreadyDone },
    investFrom,
    invest10y,
    phases,
    schedule,
    steps,
    negotiation,
  };
}

/* ---------- dinheiro extra (13º, restituição, FGTS…) ---------- */

export interface LumpAllocation {
  label: string;
  amount: number;
  kind: 'debt' | 'reserve' | 'invest';
  why: string;
}

export interface LumpResult {
  allocation: LumpAllocation[];
  before: ActionPlan;
  after: ActionPlan;
  monthsSooner: number | null; // quanto antes sai das dívidas (null = não se aplica)
  interestSaved: number;
  unstuck: boolean; // a dívida não fechava e, com o extra, passa a fechar
}

// Ordem: dívidas caras (avalanche) → reserva de emergência → dívidas baratas → investir.
// Dívida a 3% ao mês ou mais custa muito mais do que qualquer aplicação rende.
export function simulateLumpSum(data: WizardData, amount: number, opts: PlanOptions = {}): LumpResult {
  const before = buildPlan(data, opts);
  let left = Math.max(0, amount);
  const allocation: LumpAllocation[] = [];
  const debts = data.debts.map((d) => ({ ...d }));
  const byRate = [...debts].filter((d) => d.value > 0).sort((a, b) => effectiveRate(b).rate - effectiveRate(a).rate);

  const payDebts = (filter: (rate: number) => boolean, why: (rate: number) => string) => {
    for (const d of byRate) {
      const { rate } = effectiveRate(d);
      if (left <= 0 || !filter(rate) || d.value <= 0) continue;
      const pay = Math.min(left, d.value);
      d.value -= pay;
      left -= pay;
      allocation.push({
        label: d.value <= 0.5 ? `Quitar ${before.debts.find((x) => x.id === d.id)?.name ?? 'dívida'}` : `Abater ${before.debts.find((x) => x.id === d.id)?.name ?? 'dívida'}`,
        amount: pay,
        kind: 'debt',
        why: why(rate),
      });
      if (d.value <= 0.5) d.value = 0;
    }
  };

  payDebts(
    (r) => r >= 3,
    (r) => `Cobra ${fmtRate(r)} — nenhum investimento rende isso.`
  );

  let emergencyFund = data.emergencyFund;
  const target = Object.values(data.expenses).reduce((a, b) => a + b, 0) * 6;
  if (left > 0 && emergencyFund < target) {
    const put = Math.min(left, target - emergencyFund);
    emergencyFund += put;
    left -= put;
    allocation.push({
      label: 'Reserva de emergência',
      amount: put,
      kind: 'reserve',
      why: 'Num CDB de liquidez diária ou Tesouro Selic — protege o plano de um imprevisto.',
    });
  }

  payDebts(
    () => true,
    (r) => `Juros de ${fmtRate(r)}: amortizar antes reduz o total pago.`
  );

  if (left > 0) {
    allocation.push({
      label: 'Investir',
      amount: left,
      kind: 'invest',
      why: 'Sem dívidas e com a reserva completa: Tesouro IPCA+ ou fundos de índice.',
    });
  }

  const after = buildPlan({ ...data, debts, emergencyFund }, { ...opts, start: before.start });
  const monthsSooner =
    before.debts.length > 0 && before.debtFreeMonth !== null && after.debtFreeMonth !== null
      ? before.debtFreeMonth - after.debtFreeMonth
      : null;
  const interestSaved = before.stuck ? 0 : Math.max(0, before.totalInterest - after.totalInterest);

  return { allocation, before, after, monthsSooner, interestSaved, unstuck: before.stuck && !after.stuck };
}

/** O limite de cada categoria no dia a dia: o teto do plano (depois do corte) ou, sem corte, o que a pessoa contou. */
export function planBudgets(data: WizardData): Record<'Moradia' | 'Alimentação' | 'Transporte' | 'Lazer', number> {
  const cuts = buildPlan(data).cuts;
  const limit = (key: keyof WizardData['expenses']) => cuts.find((c) => c.key === key)?.ceiling ?? data.expenses[key];
  return { Moradia: limit('moradia'), Alimentação: limit('alimentacao'), Transporte: limit('transporte'), Lazer: limit('lazer') };
}
