import type { DebtItem, WizardData } from './types';

// As dívidas e os números do diagnóstico salvos neste aparelho (pra Início e agentes mostrarem sem abrir o diagnóstico).

export function loadSavedData(): WizardData | null {
  try {
    const raw = localStorage.getItem('selos-wizard-progress');
    const v = raw ? (JSON.parse(raw) as { data?: WizardData }) : null;
    return v?.data ?? null;
  } catch {
    return null;
  }
}

export const openDebts = (data: WizardData | null): DebtItem[] => (data?.debts ?? []).filter((d) => d.value > 0 && !d.paidOff);
