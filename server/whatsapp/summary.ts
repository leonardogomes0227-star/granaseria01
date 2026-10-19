// Resumo da semana e do mês: o assistente manda sozinho, pra pessoa voltar sem precisar lembrar.
// Funções puras: recebem os registros e devolvem o texto do chat (quando a pessoa pede "resumo semanal")
// e os parâmetros do modelo aprovado na Meta (quando o cron manda fora da janela de 24h).
// Parâmetros de modelo não podem ter quebra de linha: cada um é uma frase.

import type { Expense, Income } from './db.js';
import { categoryEmoji } from './parse.js';
import { QUOTES, dailyQuoteIndex } from '../../src/quotes.js';
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

/** Uma dica só, a mais útil pro que aconteceu na semana. Sem nada especial, a frase do dia. */
function weeklyTip(week: Expense[], top: { name: string; total: number } | null, left: number | null, now: Date): string {
  const total = sum(week);
  if (left !== null && left < 0) return 'Neste mês saiu mais do que entrou. Mande *posso comprar* antes da próxima compra grande e eu faço a conta com você.';
  if (top && total > 0 && top.total / total >= 0.4 && top.name !== 'Moradia') {
    return `${top.name} levou ${Math.round((top.total / total) * 100)}% da semana. Mande *quanto ainda posso gastar* pra ver o limite de cada coisa.`;
  }
  if (week.some((r) => /netflix|spotify|prime|disney|hbo|assinatura|anuidade|tarifa/i.test(r.description))) {
    return `Teve assinatura ou tarifa na semana. Veja quais costumam pesar: ${siteLink('vazamentos')}`;
  }
  return `Frase da semana: ${QUOTES[dailyQuoteIndex(now)]}`;
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

  const spentLine = `${brl(total)} em ${week.length} ${week.length === 1 ? 'anotação' : 'anotações'}`;
  const compare =
    prev > 0 ? (total <= prev ? `${Math.round(((prev - total) / prev) * 100)}% a menos que na semana anterior 👏` : `${Math.round(((total - prev) / prev) * 100)}% a mais que na semana anterior`) : '';
  const topLine = top ? `${top.name} (${brl(top.total)})` : '—';
  const monthLine =
    left === null
      ? 'ainda sem entradas anotadas neste mês (mande "recebi 3000 salário" pra eu calcular o saldo)'
      : left >= 0
        ? `saldo do mês ${brl(left)}${perDay !== null ? `, uns ${brl(perDay)} por dia até o fim do mês` : ''}`
        : `o mês está ${brl(-left)} no vermelho`;
  const tip = weeklyTip(week, top, left, now);

  const text = [
    `📊 *Sua semana* (${ddmm(new Date(weekStart))} a ${ddmm(now)})`,
    '',
    `💸 Gastou ${spentLine}${compare ? `, ${compare}` : ''}.`,
    ...(top ? [`${categoryEmoji(top.name)} O que mais pesou: ${topLine}.`] : []),
    `⚖️ No mês: ${monthLine}.`,
    '',
    `💡 ${tip}`,
  ].join('\n');

  return { text, params: [spentLine + (compare ? `, ${compare}` : ''), topLine, monthLine, tip] };
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
      ? 'sem entradas anotadas, então não dá pra saber quanto sobrou'
      : inc >= out
        ? `sobraram ${brl(inc - out)} (${Math.round(((inc - out) / inc) * 100)}% do que entrou)`
        : `faltaram ${brl(out - inc)}`;
  const tip =
    inc > 0 && inc - out >= inc * 0.1
      ? 'Você guardou pelo menos 10% do que entrou: o primeiro hábito do livro. Separe esse valor logo que o salário cair.'
      : 'Neste mês, tente separar 10% logo que o salário cair, antes de gastar. Pra saber quanto separar: ' + siteLink('diag');
  const text = [
    `🗓️ *Seu ${month}*`,
    '',
    `📥 Entrou: ${brl(inc)}`,
    `📤 Saiu: ${brl(out)}${top ? ` (mais em ${top.name}: ${brl(top.total)})` : ''}`,
    `⚖️ Resultado: ${result}.`,
    '',
    `💡 ${tip}`,
  ].join('\n');
  return { text, params: [month, brl(inc), `${brl(out)}${top ? `, mais em ${top.name}` : ''}`, `${result}. ${tip}`] };
}
