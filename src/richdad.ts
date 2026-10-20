import type { WizardData } from './types.js';

// Métricas do Pai Rico, Pai Pobre (Robert Kiyosaki), com os números do diagnóstico:
// - fluxo de caixa: o que sobra no mês depois de gastos e parcelas;
// - ativos x passivos: o que você tem (reserva + investimentos) menos o que deve;
// - riqueza em meses: quanto tempo você vive sem trabalhar, só com o que tem;
// - liberdade: quanto dos gastos a renda passiva já paga. Em 100%, você saiu da "corrida dos ratos".

const PASSIVE_RATE = 0.005; // renda passiva de um investimento conservador: uns 0,5% ao mês

export interface RichDad {
  cashflow: number;
  assets: number;
  liabilities: number;
  netWorth: number;
  monthsFree: number; // meses que dá pra viver só com o que tem
  passiveIncome: number;
  freedomPct: number; // renda passiva / gastos do mês
  costOfLiving: number; // gastos + parcelas
  freedomTarget: number; // quanto precisaria investido pra renda passiva pagar os gastos
  level: { id: 'rato' | 'saindo' | 'livre'; label: string; text: string };
}

export function richDad(data: WizardData): RichDad {
  const expenses = Object.values(data.expenses).reduce((a, b) => a + b, 0);
  const installments = data.debts.reduce((s, d) => s + (d.installment || 0), 0);
  const costOfLiving = expenses + installments;
  const passiveIncome = Math.max(0, data.passiveIncome ?? 0);
  const assets = Math.max(0, data.emergencyFund) + Math.max(0, data.investments ?? 0);
  const liabilities = data.debts.reduce((s, d) => s + Math.max(0, d.value), 0);
  const cashflow = data.monthlyIncome - costOfLiving;
  const freedomPct = costOfLiving > 0 ? Math.min(999, (passiveIncome / costOfLiving) * 100) : 0;
  const level: RichDad['level'] =
    freedomPct >= 100
      ? { id: 'livre', label: 'Livre', text: 'O dinheiro que entra sem você trabalhar já paga suas contas. Trabalhar virou escolha.' }
      : freedomPct >= 10 || (data.investments ?? 0) > 0
        ? { id: 'saindo', label: 'No caminho', text: 'Você já tem dinheiro trabalhando por você. Cada real guardado e rendendo aumenta o que entra sem você trabalhar.' }
        : { id: 'rato', label: 'Depende só do salário', text: 'Hoje todo o seu dinheiro vem do trabalho: se parar, para tudo. O plano é guardar e fazer o dinheiro render pra você.' };
  return {
    cashflow,
    assets,
    liabilities,
    netWorth: assets - liabilities,
    monthsFree: costOfLiving > 0 ? assets / costOfLiving : 0,
    passiveIncome,
    freedomPct,
    costOfLiving,
    freedomTarget: Math.round(costOfLiving / PASSIVE_RATE),
    level,
  };
}

/** Renda passiva que um valor investido gera por mês (uns 0,5% ao mês). */
export const passiveFrom = (invested: number) => invested * PASSIVE_RATE;
