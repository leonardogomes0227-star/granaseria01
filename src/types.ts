export interface DebtItem {
  id: string;
  description: string;
  value: number;
  interestRate?: number; // % ao mês, opcional — usado pelo simulador avalanche
}

export interface WizardData {
  monthlyIncome: number;
  currentSavings: number;
  expenses: {
    moradia: number;
    alimentacao: number;
    transporte: number;
    lazer: number;
  };
  debts: DebtItem[];
  emergencyFund: number;
}

export const INITIAL_DATA: WizardData = {
  monthlyIncome: 0,
  currentSavings: 0,
  expenses: { moradia: 0, alimentacao: 0, transporte: 0, lazer: 0 },
  debts: [],
  emergencyFund: 0,
};
