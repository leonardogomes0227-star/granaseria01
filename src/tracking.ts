import type { WizardData } from './types';
import { buildPlan, effectiveRate, type ActionPlan } from './plan.js';
import { leaksMonthlyTotal } from './leaks.js';

// Acompanhamento do plano: a pessoa fecha cada mês dizendo quanto pagou de verdade.
// O plano é sempre recalculado a partir do saldo real — atrasou, a data muda; adiantou, também.
// Versão localStorage; quando a conta (Supabase) entrar, migra sem mudar a interface.

export interface TrackedMonth {
  paid: Record<string, number>; // id da dívida → valor pago; 'reserve' → guardado na reserva
}

export interface Tracking {
  createdAt: string; // ISO
  baseline: WizardData; // números do diagnóstico no dia em que a pessoa começou
  months: TrackedMonth[]; // meses fechados, em ordem (mês 1, 2, …)
}

const KEY = 'selos-tracking';

export function getTracking(): Tracking | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Tracking) : null;
  } catch {
    return null;
  }
}

export function saveTracking(t: Tracking | null): void {
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t));
    else localStorage.removeItem(KEY);
  } catch {
    // segue sem persistir
  }
}

export function startTracking(data: WizardData): Tracking {
  const t: Tracking = { createdAt: new Date().toISOString(), baseline: data, months: [] };
  saveTracking(t);
  return t;
}

// Data-base do plano: o mês 1 é o mês seguinte a ela (mesma convenção do buildPlan)
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

// Saldo real depois dos meses fechados: juros do mês e, em seguida, o que foi pago
export function currentState(t: Tracking): WizardData {
  const debts = t.baseline.debts.map((d) => ({ ...d }));
  let emergencyFund = t.baseline.emergencyFund;
  for (const m of t.months) {
    for (const d of debts) {
      if (d.value <= 0) continue;
      const r = effectiveRate(d).rate / 100;
      d.value = Math.max(0, d.value * (1 + r) - (m.paid[d.id] || 0));
      if (d.value < 0.5) d.value = 0;
    }
    emergencyFund += m.paid.reserve || 0;
  }
  return { ...t.baseline, debts, emergencyFund };
}

export interface TrackingView {
  original: ActionPlan; // plano do dia em que começou
  current: ActionPlan; // replanejado a partir do saldo real; mês 1 = mês em aberto
  openMonth: number; // número do mês em aberto (1, 2, …)
  tasks: { id: string; label: string; suggested: number }[];
  // quanto a data de sair das dívidas mudou: > 0 adiantado, < 0 atrasado
  debtShift: number | null;
  debtFreeAbs: number | null; // mês do plano original em que fica livre, no cenário atual
  streak: number; // meses seguidos (até o último) pagando pelo menos 95% do combinado
  badges: { id: string; label: string; earned: boolean }[];
}

// extraMonthly: vazamentos achados. No navegador vem do localStorage; no servidor (WhatsApp), do estado salvo.
export function trackingView(t: Tracking, extraMonthly: number = leaksMonthlyTotal()): TrackingView {
  const start = new Date(t.createdAt);
  const original = buildPlan(t.baseline, { start, extraMonthly });
  const done = t.months.length;
  const state = currentState(t);
  const current = buildPlan(state, { start: addMonths(start, done), extraMonthly });
  const openMonth = done + 1;

  const row = current.schedule[0];
  const tasks: TrackingView['tasks'] = [];
  if (row) {
    for (const d of current.debts) {
      const v = row.payments.find((p) => p.id === d.id)?.amount ?? 0;
      if (v > 0) tasks.push({ id: d.id, label: `Pagar ${d.name}`, suggested: v });
    }
    if (row.toReserve >= 1) tasks.push({ id: 'reserve', label: 'Guardar na reserva', suggested: row.toReserve });
  } else if (current.debts.length === 0 && current.monthlyPower > 0) {
    tasks.push({
      id: 'reserve',
      label: current.reserve.alreadyDone ? 'Investir' : 'Guardar na reserva',
      suggested: current.monthlyPower,
    });
  }

  const debtFreeAbs = current.debtFreeMonth === null ? null : current.debts.length === 0 ? done : done + current.debtFreeMonth;
  const debtShift =
    original.debts.length > 0 && original.debtFreeMonth !== null && debtFreeAbs !== null ? original.debtFreeMonth - debtFreeAbs : null;

  // sequência: compara o pago com o valor mensal do plano (que não muda)
  let streak = 0;
  for (let i = t.months.length - 1; i >= 0; i--) {
    const paid = Object.values(t.months[i].paid).reduce((s, v) => s + v, 0);
    if (paid >= original.monthlyPower * 0.95) streak++;
    else break;
  }

  const baselineDebts = t.baseline.debts.filter((d) => d.value > 0);
  const paidOff = baselineDebts.filter((d) => (state.debts.find((x) => x.id === d.id)?.value ?? 0) <= 0).length;
  const badges = [
    { id: 'start', label: 'Primeiro mês fechado', earned: done >= 1 },
    { id: 'streak3', label: '3 meses seguidos no plano', earned: streak >= 3 },
    { id: 'firstdebt', label: 'Primeira dívida quitada', earned: baselineDebts.length > 0 && paidOff >= 1 },
    { id: 'debtfree', label: 'Livre de dívidas', earned: baselineDebts.length > 0 && paidOff === baselineDebts.length },
    {
      id: 'reserve',
      label: 'Reserva completa',
      earned: current.reserve.target > 0 && state.emergencyFund >= current.reserve.target,
    },
  ];

  return { original, current, openMonth, tasks, debtShift, debtFreeAbs, streak, badges };
}

export function closeMonth(t: Tracking, paid: Record<string, number>): Tracking {
  const next = { ...t, months: [...t.months, { paid }] };
  saveTracking(next);
  return next;
}

export function undoLastMonth(t: Tracking): Tracking {
  const next = { ...t, months: t.months.slice(0, -1) };
  saveTracking(next);
  return next;
}
