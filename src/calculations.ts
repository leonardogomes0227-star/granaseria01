import { WizardData, EXPENSE_CATEGORIES } from './types';

export const fmtBRL = (value: number): string =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const fmtPct = (value: number): string =>
  `${(value * 100).toFixed(1).replace('.', ',')}%`;

export type Diagnosis = {
  savingsTarget: number;
  savingsDiff: number;
  savingsStatus: 'ok' | 'below' | 'above';
  totalExpenses: number;
  totalMonthlyOutflow: number;
  categoryAnalysis: {
    key: string;
    label: string;
    amount: number;
    pctOfIncome: number;
    idealPct: number;
    idealAmount: number;
    overBudget: boolean;
  }[];
  totalDebt: number;
  debtToIncomeRatio: number;
  emergencyTarget: number;
  emergencyProgress: number;
  emergencyRemaining: number;
  compoundProjection: {
    monthly: number;
    months: number;
    rate: number;
    finalAmount: number;
    totalContributed: number;
    totalInterest: number;
  };
  actionPlan: { title: string; detail: string }[];
};

export function calculateDiagnosis(data: WizardData): Diagnosis {
  const income = data.monthlyIncome || 0;
  const savingsTarget = income * 0.1;
  const savingsDiff = data.monthlySavings - savingsTarget;
  const savingsStatus =
    data.monthlySavings >= savingsTarget
      ? savingsDiff > savingsTarget * 0.5
        ? 'above'
        : 'ok'
      : 'below';

  const categoryAnalysis = EXPENSE_CATEGORIES.map((cat) => {
    const amount = data.expenses[cat.key] || 0;
    const pctOfIncome = income > 0 ? amount / income : 0;
    const idealAmount = income * cat.idealPct;
    return {
      key: cat.key,
      label: cat.label,
      amount,
      pctOfIncome,
      idealPct: cat.idealPct,
      idealAmount,
      overBudget: income > 0 && amount > idealAmount,
    };
  });

  const totalExpenses = categoryAnalysis.reduce((s, c) => s + c.amount, 0);
  const totalMonthlyOutflow = totalExpenses + data.monthlySavings;

  const totalDebt = data.debts.reduce((s, d) => s + (d.amount || 0), 0);
  const debtToIncomeRatio = income > 0 ? totalDebt / income : 0;

  const emergencyTarget = totalMonthlyOutflow * 4;
  const emergencyProgress =
    emergencyTarget > 0 ? Math.min(data.emergencyFund / emergencyTarget, 1) : 0;
  const emergencyRemaining = Math.max(emergencyTarget - data.emergencyFund, 0);

  const monthly = savingsTarget;
  const months = 120;
  const rate = 0.008;
  // FV = PMT * [((1+r)^n - 1) / r]
  const finalAmount =
    monthly * (((Math.pow(1 + rate, months) - 1) / rate) * (1 + rate));
  const totalContributed = monthly * months;
  const totalInterest = finalAmount - totalContributed;

  // Action plan — prioritized
  const actionPlan: { title: string; detail: string }[] = [];

  // 1. Quitar dívida mais cara
  if (totalDebt > 0) {
    const dearest = [...data.debts].sort((a, b) => b.amount - a.amount)[0];
    actionPlan.push({
      title: 'Quitar a dívida mais cara',
      detail:
        dearest.description.trim() || 'Sua maior dívida'
          ? `Comece pela dívida "${dearest.description.trim() || 'sem nome'}" de ${fmtBRL(
              dearest.amount,
            )}. Dedique o máximo de recursos possível até zerá-la.`
          : '',
    });
  }

  // 2. Construir reserva de emergência
  if (emergencyRemaining > 0) {
    actionPlan.push({
      title: 'Construir reserva de emergência',
      detail: `Sua meta é ${fmtBRL(emergencyTarget)} (4 meses de despesas). Você já tem ${fmtBRL(
        data.emergencyFund,
      )}. Falta ${fmtBRL(emergencyRemaining)}.`,
    });
  }

  // 3. Ajustar poupança para 10%
  if (savingsStatus === 'below') {
    actionPlan.push({
      title: 'Ajustar poupança para 10% da renda',
      detail: `Você guarda ${fmtBRL(data.monthlySavings)} por mês. A meta é ${fmtBRL(
        savingsTarget,
      )}. Aumente em ${fmtBRL(Math.abs(savingsDiff))} para chegar lá.`,
    });
  }

  // 4. Reduzir categoria acima do ideal
  const overCategories = categoryAnalysis.filter((c) => c.overBudget);
  if (overCategories.length > 0) {
    const worst = overCategories.sort(
      (a, b) => b.pctOfIncome - a.idealPct - (a.pctOfIncome - a.idealPct),
    )[0];
    actionPlan.push({
      title: `Reduzir gastos com ${worst.label}`,
      detail: `Você gasta ${fmtBRL(worst.amount)} (${fmtPct(
        worst.pctOfIncome,
      )} da renda). O ideal é até ${fmtPct(worst.idealPct)} (${fmtBRL(
        worst.idealAmount,
      )}).`,
    });
  }

  return {
    savingsTarget,
    savingsDiff,
    savingsStatus,
    totalExpenses,
    totalMonthlyOutflow,
    categoryAnalysis,
    totalDebt,
    debtToIncomeRatio,
    emergencyTarget,
    emergencyProgress,
    emergencyRemaining,
    compoundProjection: {
      monthly,
      months,
      rate,
      finalAmount,
      totalContributed,
      totalInterest,
    },
    actionPlan: actionPlan.slice(0, 4),
  };
}
