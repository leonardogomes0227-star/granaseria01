// Contas do plano do coach. Tudo em R$ por mês, sem juros: é uma estimativa, e o texto da tela diz isso.

import { addMonths, monthShort } from './months';

export interface PlanAnswers {
  renda: number;
  fixos: number;
  sobra: number;
  temDivida: boolean;
  dividaTotal: number;
  dividaParcela: number;
  guardado: number;
  aporte: number;
}

export interface Plan extends PlanAnswers {
  criadoEm: string; // 'AAAA-MM'
  meta: number; // reserva de emergência: 6x os gastos fixos
  limite: number; // quanto pode gastar por mês: renda - fixos - aporte - parcela da dívida
  previsao: string | null; // 'AAAA-MM' em que a reserva fica pronta (null: não chega)
}

export interface Aporte {
  mes: string;
  valor: number;
  origem: 'site' | 'whatsapp';
}

export const SAVE_SHARE = 0.1;
export const reserveGoal = (fixos: number) => Math.round(fixos * 6);
export const suggestedSave = (renda: number) => Math.round(renda * SAVE_SHARE);
/** O que sobra do mês depois dos fixos e da parcela da dívida: o teto do que dá pra guardar. */
export const freeMoney = (a: Pick<PlanAnswers, 'renda' | 'fixos' | 'dividaParcela' | 'temDivida'>) => a.renda - a.fixos - (a.temDivida ? a.dividaParcela : 0);

/** O valor esperado no check-in: com dívida, só o aporte; sem dívida (ou já quitada), o aporte mais a parcela que sobrou. */
export function expectedSaving(plan: Plan, debtLeft: number): number {
  return debtLeft > 0 ? plan.aporte : plan.aporte + (plan.temDivida ? plan.dividaParcela : 0);
}

export interface Projection {
  saved: number; // o que já está guardado (reserva)
  debtLeft: number; // o que falta da dívida
  forecast: string | null; // mês em que a reserva fica pronta
  expected: number; // quanto guardar no próximo mês
}

/**
 * Onde o plano está e quando termina.
 * - Meses fechados (anteriores ao atual, ou o atual se já tem aporte) contam o que foi guardado; sem registro, conta zero.
 * - O resto da conta segue o plano: com dívida, o aporte e a parcela vão pra ela primeiro; depois tudo vai pra reserva.
 */
export function project(plan: Plan, aportes: Aporte[], current: string): Projection {
  const byMonth = new Map(aportes.map((a) => [a.mes, a.valor]));
  let saved = plan.guardado;
  let debt = plan.temDivida ? plan.dividaTotal : 0;
  const parcela = plan.temDivida ? plan.dividaParcela : 0;

  const pay = (amount: number) => {
    // o que sobra depois de quitar a dívida vira reserva
    if (debt > 0) {
      const toDebt = Math.min(debt, amount);
      debt -= toDebt;
      saved += amount - toDebt;
    } else saved += amount;
  };

  let m = plan.criadoEm;
  for (; m < current || (m === current && byMonth.has(m)); m = addMonths(m, 1)) {
    const v = byMonth.get(m) ?? 0;
    if (debt > 0) pay(parcela + v);
    else saved += v;
  }

  // o retrato de hoje (antes de simular o futuro)
  const savedNow = saved;
  const debtNow = debt;

  let forecast: string | null = saved >= plan.meta && debt <= 0 ? current : null;
  for (let i = 0; forecast === null && i < 600; i++, m = addMonths(m, 1)) {
    pay(debt > 0 ? parcela + plan.aporte : plan.aporte + parcela);
    if (saved >= plan.meta && debt <= 0) forecast = m;
  }
  return { saved: savedNow, debtLeft: debtNow, forecast, expected: expectedSaving(plan, debtNow) };
}

/** Monta o plano a partir das respostas. A previsão original é a do mês em que o plano nasce, sem nenhum aporte ainda. */
export function buildPlan(a: PlanAnswers, month: string): Plan {
  const draft: Plan = { ...a, dividaTotal: a.temDivida ? a.dividaTotal : 0, dividaParcela: a.temDivida ? a.dividaParcela : 0, criadoEm: month, meta: reserveGoal(a.fixos), limite: 0, previsao: null };
  draft.limite = Math.max(0, a.renda - a.fixos - a.aporte - draft.dividaParcela);
  draft.previsao = project(draft, [], month).forecast;
  return draft;
}

export type Status = { ok: true } | { ok: false; novaPrevisao: string | null };

/** "Em dia" se a previsão atual não passou da original; senão a nova data. */
export function statusOf(plan: Plan, aportes: Aporte[], current: string): Status {
  const f = project(plan, aportes, current).forecast;
  if (plan.previsao && f && f <= plan.previsao) return { ok: true };
  if (plan.previsao === null && f === null) return { ok: true };
  return { ok: false, novaPrevisao: f };
}

export const whenText = (month: string | null) => (month ? monthShort(month) : 'sem data ainda');
