import { WizardData } from './types';

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
  actionPlan: string[];
}

const IDEAL_PCT = {
  moradia: 0.3,
  alimentacao: 0.15,
  transporte: 0.1,
  lazer: 0.1,
};

const CATEGORY_LABELS: Record<keyof WizardData['expenses'], string> = {
  moradia: 'moradia',
  alimentacao: 'alimentação',
  transporte: 'transporte',
  lazer: 'lazer',
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

  const actionPlan: string[] = [];

  if (savingsRate < 10) {
    actionPlan.push(
      `Aumente sua poupança mensal até 10% da renda — hoje está em ${savingsRate.toFixed(0)}%.`
    );
  }
  if (totalDebt > 0) {
    actionPlan.push(
      `Priorize quitar suas dívidas, que hoje somam ${formatBRL(totalDebt)}.`
    );
  }
  if (emergencyProgress < 100) {
    actionPlan.push(
      `Construa sua reserva de emergência até alcançar ${formatBRL(emergencyTarget)} (6 meses de gastos).`
    );
  }
  (Object.keys(idealExpenses) as (keyof typeof idealExpenses)[]).forEach((key) => {
    if (data.expenses[key] > idealExpenses[key]) {
      actionPlan.push(`Revise os gastos com ${CATEGORY_LABELS[key]} — estão acima do ideal recomendado.`);
    }
  });

  return {
    savingsRate,
    savingsGoalRate: 10,
    totalExpenses,
    idealExpenses,
    totalDebt,
    emergencyTarget,
    emergencyProgress,
    projection10y,
    actionPlan: actionPlan.slice(0, 4),
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
export function computeProjection(monthlyContribution: number, annualRatePct: number, years: number): number {
  if (monthlyContribution <= 0) return 0;
  const monthlyRate = annualRatePct / 100 / 12;
  const months = years * 12;
  if (monthlyRate === 0) return monthlyContribution * months;
  return monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

// Inverso da projeção: dado um valor-alvo, quanto precisa guardar por mês pra chegar lá.
export function computeRequiredContribution(target: number, annualRatePct: number, years: number): number {
  if (target <= 0 || years <= 0) return 0;
  const monthlyRate = annualRatePct / 100 / 12;
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
