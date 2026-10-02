import { parseMessage, categoryEmoji } from './parse.js';
import type { Expense } from './db.js';

// Funções de banco recebidas por parâmetro: facilita testar a lógica sem Supabase de verdade.
export interface BotDeps {
  insertExpense: (e: { phone: string; amount: number; category: string; description: string; waMessageId: string }) => Promise<boolean>;
  listExpensesSince: (phone: string, since: Date) => Promise<Expense[]>;
  deleteLastExpense: (phone: string) => Promise<Expense | null>;
  now?: () => Date;
}

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Horário de Brasília (UTC-3, sem horário de verão desde 2019).
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

export function startOfDayBRT(now: Date): Date {
  const local = new Date(now.getTime() - BRT_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + BRT_OFFSET_MS);
}

export function startOfWeekBRT(now: Date): Date {
  const day = startOfDayBRT(now);
  const weekday = new Date(day.getTime() - BRT_OFFSET_MS).getUTCDay(); // 0 = domingo
  const sinceMonday = (weekday + 6) % 7;
  return new Date(day.getTime() - sinceMonday * 24 * 60 * 60 * 1000);
}

export function startOfMonthBRT(now: Date): Date {
  const local = new Date(now.getTime() - BRT_OFFSET_MS);
  local.setUTCDate(1);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + BRT_OFFSET_MS);
}

function sum(rows: Expense[]): number {
  return rows.reduce((s, r) => s + r.amount, 0);
}

function byCategory(rows: Expense[]): string {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.category, (totals.get(r.category) ?? 0) + r.amount);
  const total = sum(rows) || 1;
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, v]) => `${categoryEmoji(cat)} ${cat}: ${brl(v)} (${Math.round((v / total) * 100)}%)`)
    .join('\n');
}

export const HELP_TEXT = [
  '👋 *Assistente de gastos Grana Séria*',
  '',
  'Pra registrar, é só mandar o gasto:',
  '• gastei 35 no mercado',
  '• uber 18,50',
  '• farmácia 42',
  '',
  'Comandos:',
  '• *hoje* — gastos de hoje',
  '• *semana* — total da semana',
  '• *mês* — resumo do mês por categoria',
  '• *apagar* — desfaz o último registro',
].join('\n');

export async function handleText(
  msg: { id: string; phone: string; text: string },
  deps: BotDeps
): Promise<string | null> {
  const now = deps.now?.() ?? new Date();
  const cmd = parseMessage(msg.text);

  switch (cmd.kind) {
    case 'help':
      return HELP_TEXT;

    case 'expense': {
      const inserted = await deps.insertExpense({
        phone: msg.phone,
        amount: cmd.amount,
        category: cmd.category,
        description: cmd.description,
        waMessageId: msg.id,
      });
      if (!inserted) return null; // mensagem repetida pela Meta — já respondemos antes
      const monthRows = await deps.listExpensesSince(msg.phone, startOfMonthBRT(now));
      const todayStart = startOfDayBRT(now).getTime();
      const today = sum(monthRows.filter((r) => new Date(r.created_at).getTime() >= todayStart));
      return [
        `✅ ${brl(cmd.amount)} em ${categoryEmoji(cmd.category)} *${cmd.category}*`,
        `_${cmd.description}_`,
        '',
        `Hoje: ${brl(today)} · Mês: ${brl(sum(monthRows))}`,
        cmd.category === 'Outros' ? '\nDica: inclua o que foi (ex.: "mercado", "uber") pra eu categorizar.' : '',
      ]
        .join('\n')
        .trim();
    }

    case 'today': {
      const rows = await deps.listExpensesSince(msg.phone, startOfDayBRT(now));
      if (rows.length === 0) return 'Nenhum gasto registrado hoje. 🙌';
      const lines = rows.map((r) => `• ${brl(r.amount)} — ${r.description}`);
      return [`📅 *Hoje*: ${brl(sum(rows))}`, '', ...lines].join('\n');
    }

    case 'week': {
      const rows = await deps.listExpensesSince(msg.phone, startOfWeekBRT(now));
      if (rows.length === 0) return 'Nenhum gasto registrado nesta semana.';
      return [`🗓️ *Semana* (desde segunda): ${brl(sum(rows))}`, '', byCategory(rows)].join('\n');
    }

    case 'month': {
      const rows = await deps.listExpensesSince(msg.phone, startOfMonthBRT(now));
      if (rows.length === 0) return 'Nenhum gasto registrado neste mês ainda.';
      return [`📊 *Mês*: ${brl(sum(rows))} em ${rows.length} registro(s)`, '', byCategory(rows)].join('\n');
    }

    case 'undo': {
      const removed = await deps.deleteLastExpense(msg.phone);
      if (!removed) return 'Não encontrei nenhum gasto pra apagar.';
      return `🗑️ Apaguei: ${brl(removed.amount)} — ${removed.description}`;
    }

    default:
      return 'Não entendi. 🤔 Mande o gasto com o valor, tipo *"gastei 35 no mercado"*, ou *ajuda* pra ver os comandos.';
  }
}
