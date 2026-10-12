import type { WizardData } from './types.js';

export interface Diagnosis {
  savingsRate: number;
  savingsGoalRate: number;
  totalExpenses: number;
  idealExpenses: {
    moradia: number;
    alimentacao: number;
    transporte: number;
    lazer: number;
  };
  totalDebt: number;
  emergencyTarget: number;
  emergencyProgress: number;
  projection10y: number;
}

const IDEAL_PCT = {
  moradia: 0.3,
  alimentacao: 0.15,
  transporte: 0.1,
  lazer: 0.1,
};

export function calculateDiagnosis(data: WizardData): Diagnosis {
  const income = data.monthlyIncome || 0;
  const savingsRate = income > 0 ? (data.currentSavings / income) * 100 : 0;

  const totalExpenses = Object.values(data.expenses).reduce((a, b) => a + b, 0);

  const idealExpenses = {
    moradia: income * IDEAL_PCT.moradia,
    alimentacao: income * IDEAL_PCT.alimentacao,
    transporte: income * IDEAL_PCT.transporte,
    lazer: income * IDEAL_PCT.lazer,
  };

  const totalDebt = data.debts.reduce((sum, d) => sum + (d.value || 0), 0);

  const emergencyTarget = totalExpenses * 6;
  const emergencyProgress =
    emergencyTarget > 0 ? Math.min((data.emergencyFund / emergencyTarget) * 100, 100) : 0;

  // Projeção de juros compostos: aporte mensal de 10% da renda, 10 anos, ~10% a.a. (0,8% a.m.)
  const monthlyRate = 0.008;
  const months = 120;
  const monthlyContribution = income * 0.1;
  const projection10y =
    monthlyContribution > 0
      ? monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
      : 0;

  return {
    savingsRate,
    savingsGoalRate: 10,
    totalExpenses,
    idealExpenses,
    totalDebt,
    emergencyTarget,
    emergencyProgress,
    projection10y,
  };
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

// Projeção genérica de juros compostos — usada no diagnóstico (10 anos fixos) e
// no simulador de longo prazo (prazo e taxa configuráveis).
// A taxa anual é a taxa efetiva (a que banco e Tesouro divulgam): 10% ao ano = 0,797% ao mês, não 10%÷12.
export const monthlyRateFromAnnual = (annualRatePct: number): number => Math.pow(1 + annualRatePct / 100, 1 / 12) - 1;

// Inflação anual média que usamos pra mostrar quanto o dinheiro de amanhã vale em reais de hoje (meta do IPCA ~3% + folga).
export const INFLATION_PCT = 4.5;

/** Quanto um valor futuro vale em reais de hoje. */
export function inTodaysMoney(futureValue: number, years: number, inflationPct = INFLATION_PCT): number {
  return futureValue / Math.pow(1 + inflationPct / 100, years);
}

export function computeProjection(monthlyContribution: number, annualRatePct: number, years: number): number {
  if (monthlyContribution <= 0) return 0;
  const monthlyRate = monthlyRateFromAnnual(annualRatePct);
  const months = years * 12;
  if (monthlyRate === 0) return monthlyContribution * months;
  return monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

// Inverso da projeção: dado um valor-alvo, quanto precisa guardar por mês pra chegar lá.
export function computeRequiredContribution(target: number, annualRatePct: number, years: number): number {
  if (target <= 0 || years <= 0) return 0;
  const monthlyRate = monthlyRateFromAnnual(annualRatePct);
  const months = years * 12;
  if (monthlyRate === 0) return target / months;
  return (target * monthlyRate) / (Math.pow(1 + monthlyRate, months) - 1);
}

// Tabela Price (parcela fixa) — usada pra comparar propostas de empréstimo/financiamento.
export function computeLoanInstallment(
  principal: number,
  monthlyRatePct: number,
  installments: number
): { installment: number; total: number; totalInterest: number } {
  if (principal <= 0 || installments <= 0) return { installment: 0, total: 0, totalInterest: 0 };
  const i = monthlyRatePct / 100;
  const installment = i === 0 ? principal / installments : (principal * i) / (1 - Math.pow(1 + i, -installments));
  const total = installment * installments;
  return { installment, total, totalInterest: total - principal };
}

// Plano de ação simplificado pro check-in mensal (não tem a quebra por categoria
// que o diagnóstico completo tem, só renda/poupança/gastos/dívida).
export function checkinActionPlan(entry: { monthlyIncome: number; currentSavings: number; totalDebt: number }): string[] {
  const plan: string[] = [];
  const rate = entry.monthlyIncome > 0 ? (entry.currentSavings / entry.monthlyIncome) * 100 : 0;
  if (rate < 10) {
    plan.push(`Aumente sua poupança mensal até 10% da renda — hoje está em ${rate.toFixed(0)}%.`);
  }
  if (entry.totalDebt > 0) {
    plan.push(`Priorize quitar suas dívidas, que hoje somam ${formatBRL(entry.totalDebt)}.`);
  }
  if (plan.length === 0) {
    plan.push('Você está em dia com pague-se primeiro e proteja-se de perdas — continue assim.');
  }
  return plan;
}

// Nota de 0 a 100 que resume o diagnóstico numa frase — o "e aí, estou bem?" que a pessoa quer saber.
// Pesos: poupança 35, reserva 25, dívidas 20, gastos dentro do teto 20.
export interface HealthScore {
  score: number;
  label: string;
  tone: 'good' | 'warn' | 'bad';
  parts: { label: string; points: number; max: number }[];
}

export function calculateHealthScore(data: WizardData, d: Diagnosis): HealthScore {
  const income = data.monthlyIncome || 0;
  const savings = Math.min(d.savingsRate / d.savingsGoalRate, 1) * 35;
  const emergency = (d.emergencyProgress / 100) * 25;
  // dívida de 5 rendas mensais ou mais zera essa parte
  const debt = d.totalDebt <= 0 ? 20 : income > 0 ? Math.max(0, 20 - (d.totalDebt / income) * 4) : 0;
  const keys = Object.keys(d.idealExpenses) as (keyof typeof d.idealExpenses)[];
  const within = keys.filter((k) => data.expenses[k] <= d.idealExpenses[k]).length;
  const expenses = (within / keys.length) * 20;

  const score = Math.round(savings + emergency + debt + expenses);
  const tone = score >= 70 ? 'good' : score >= 40 ? 'warn' : 'bad';
  const label = score >= 70 ? 'Saúde financeira forte' : score >= 40 ? 'No caminho, com ajustes' : 'Precisa de atenção agora';

  return {
    score,
    label,
    tone,
    parts: [
      { label: 'Poupança', points: Math.round(savings), max: 35 },
      { label: 'Reserva', points: Math.round(emergency), max: 25 },
      { label: 'Dívidas', points: Math.round(debt), max: 20 },
      { label: 'Gastos', points: Math.round(expenses), max: 20 },
    ],
  };
}
