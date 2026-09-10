export type Debt = {
  id: string;
  description: string;
  amount: number;
};

export type WizardData = {
  monthlyIncome: number;
  monthlySavings: number;
  expenses: {
    moradia: number;
    alimentacao: number;
    transporte: number;
    lazer: number;
  };
  debts: Debt[];
  emergencyFund: number;
};

export const EXPENSE_CATEGORIES = [
  { key: 'moradia', label: 'Moradia', idealPct: 0.3, icon: 'Home' },
  { key: 'alimentacao', label: 'Alimentação', idealPct: 0.15, icon: 'UtensilsCrossed' },
  { key: 'transporte', label: 'Transporte', idealPct: 0.15, icon: 'Car' },
  { key: 'lazer', label: 'Lazer', idealPct: 0.1, icon: 'Gamepad2' },
] as const;

export const TOTAL_STEPS = 7;

export const INITIAL_DATA: WizardData = {
  monthlyIncome: 0,
  monthlySavings: 0,
  expenses: {
    moradia: 0,
    alimentacao: 0,
    transporte: 0,
    lazer: 0,
  },
  debts: [],
  emergencyFund: 0,
};
