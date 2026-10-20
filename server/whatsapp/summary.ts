// Resumo da semana e do mês: o assistente manda sozinho, pra pessoa voltar sem precisar lembrar.
// Funções puras: recebem os registros e devolvem o texto do chat (quando a pessoa pede "resumo semanal")
// e os parâmetros do modelo aprovado na Meta (quando o cron manda fora da janela de 24h).
// Parâmetros de modelo não podem ter quebra de linha: cada um é uma frase.

import type { Expense, Income } from './db.js';
import { siteLink } from './site.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sum = (rows: { amount: number }[]) => rows.reduce((t, r) => t + r.amount, 0);
const at = (r: { created_at: string }) => new Date(r.created_at).getTime();
const ddmm = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function topCategory(rows: Expense[]): { name: string; total: number } | null {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.category, (totals.get(r.category) ?? 0) + r.amount);
  const [best] = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  return best ? { name: best[0], total: best[1] } : null;
}

function daysLeftInMonth(now: Date): number {
  const local = new Date(now.getTime() - BRT_OFFSET_MS);
  const lastDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  return Math.max(1, lastDay - local.getUTCDate() + 1);
}

export interface WeeklyInput {
  recent: Expense[]; // gastos dos últimos 14 dias (semana atual + a anterior, pra comparar)
  monthExpenses: Expense[];
  monthIncomes: Income[];
  now: Date;
}

export interface Summary {
  text: string; // pro chat
  params: string[]; // pro modelo da Meta, na ordem {{1}}, {{2}}…
}

/** Uma frase só, a mais útil pro que aconteceu. Sem nada especial, o link do plano. Tom calmo: sem alarme. */
function weeklyTip(week: Expense[], top: { name: string; total: number } | null, left: number | null): string {
  const total = sum(week);
  if (left !== null && left < 0) return `Este mês saiu mais do que entrou. Antes da próxima compra, veja o que cabe: ${siteLink('compra')}`;
  if (top && total > 0 && top.total / total >= 0.4 && top.name !== 'Moradia') {
    return `${top.name} foi ${Math.round((top.total / total) * 100)}% da semana. Veja o limite de cada coisa: mande *quanto ainda posso gastar*.`;
  }
  if (week.some((r) => /netflix|spotify|prime|disney|hbo|assinatura|anuidade|tarifa/i.test(r.description))) {
    return `Teve assinatura ou tarifa na semana. Veja se alguma não vale: ${siteLink('vazamentos')}`;
  }
  return `Seu plano: ${siteLink('plano')}`;
}

export function weeklySummary({ recent, monthExpenses, monthIncomes, now }: WeeklyInput): Summary | null {
  const weekStart = now.getTime() - 7 * DAY_MS;
  const week = recent.filter((r) => at(r) >= weekStart);
  const before = recent.filter((r) => at(r) < weekStart && at(r) >= weekStart - 7 * DAY_MS);
  if (week.length === 0) return null;

  const total = sum(week);
  const prev = sum(before);
  const top = topCategory(week);
  const income = sum(monthIncomes);
  const left = income > 0 ? income - sum(monthExpenses) : null;
  const perDay = left !== null && left > 0 ? Math.floor(left / daysLeftInMonth(now)) : null;

  const compare = prev > 0 ? (total <= prev ? `${Math.round(((prev - total) / prev) * 100)}% a menos que na semana anterior` : `${Math.round(((total - prev) / prev) * 100)}% a mais que na semana anterior`) : '';
  const spentLine = `${brl(total)}${compare ? `, ${compare}` : ''}`;
  const topLine = top ? `${top.name}, ${brl(top.total)}` : 'nada em especial';
  const monthLine =
    left === null
      ? 'anote o que entrou (ex.: recebi 3000 salário) pra eu mostrar o saldo'
      : left > 0
        ? `pode gastar uns ${brl(perDay ?? 0)} por dia até o fim do mês`
        : left === 0
          ? 'tudo o que entrou já foi usado'
          : `o que entrou já foi usado, e saíram mais ${brl(-left)}`;
  const tip = weeklyTip(week, top, left);

  const text = [
    `*Sua semana* (${ddmm(new Date(weekStart))} a ${ddmm(now)})`,
    '',
    `Gastou ${spentLine}.`,
    ...(top ? [`Mais pesou: ${topLine}.`] : []),
    `No mês: ${monthLine}.`,
    '',
    tip,
  ].join('\n');

  return { text, params: [spentLine, topLine, monthLine, tip] };
}

export interface MonthlyInput {
  expenses: Expense[]; // do mês que fechou
  incomes: Income[];
  monthIndex: number; // 0 = janeiro
}

export function monthlySummary({ expenses, incomes, monthIndex }: MonthlyInput): Summary | null {
  if (expenses.length === 0 && incomes.length === 0) return null;
  const out = sum(expenses);
  const inc = sum(incomes);
  const top = topCategory(expenses);
  const month = MONTHS[monthIndex];
  const result =
    inc === 0
      ? 'sem entradas anotadas, não dá pra saber quanto sobrou'
      : inc >= out
        ? `sobraram ${brl(inc - out)} (${Math.round(((inc - out) / inc) * 100)}% do que entrou)`
        : `saíram ${brl(out - inc)} a mais do que entrou`;
  const tip =
    inc > 0 && inc - out >= inc * 0.1
      ? 'Você guardou pelo menos 10%. No próximo mês, separe esse valor assim que o salário cair.'
      : `No próximo mês, tente separar 10% assim que o salário cair. Seu plano: ${siteLink('plano')}`;
  const topLine = top ? `${brl(out)}, mais em ${top.name} (${brl(top.total)})` : brl(out);
  const text = [
    `*Seu ${month}*`,
    '',
    `Entrou ${brl(inc)} e saiu ${topLine}.`,
    `Resultado: ${result}.`,
    '',
    tip,
  ].join('\n');
  return { text, params: [month, brl(inc), topLine, `${result}. ${tip}`] };
}
