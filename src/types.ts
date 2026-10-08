// Tipo da dívida — define a taxa típica usada quando a pessoa não sabe os juros
export type DebtKind = 'cartao' | 'cheque' | 'emprestimo' | 'consignado' | 'financiamento' | 'outro';

export interface DebtItem {
  id: string;
  description: string;
  value: number;
  interestRate?: number; // % ao mês, opcional — sem ele o plano usa a taxa típica do tipo
  kind?: DebtKind; // opcional pra não quebrar dívidas salvas antes desse campo existir
  installment?: number; // parcela (ou mínimo) que a pessoa já paga por mês
}

export interface CheckinEntry {
  date: string; // ISO
  monthlyIncome: number;
  currentSavings: number;
  totalExpenses: number;
  totalDebt: number;
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
