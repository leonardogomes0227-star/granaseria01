import { parseMessage, categoryEmoji } from './parse.js';
import type { Expense } from './db.js';
import { needsSmart, type SmartContext, type SmartResult } from './smart.js';

// Funções de banco recebidas por parâmetro: facilita testar a lógica sem Supabase de verdade.
export interface BotDeps {
  insertExpense: (e: { phone: string; amount: number; category: string; description: string; waMessageId: string; createdAt?: string }) => Promise<boolean>;
  listExpensesSince: (phone: string, since: Date) => Promise<Expense[]>;
  deleteLastExpense: (phone: string) => Promise<Expense | null>;
  updateLastExpense?: (
    phone: string,
    patch: { amount?: number; description?: string; category?: string }
  ) => Promise<{ before: Expense; after: Expense } | null>;
  // IA opcional: sem ela o bot usa só as regras
  smart?: (text: string, ctx: SmartContext) => Promise<SmartResult | null>;
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

  if (deps.smart && needsSmart(msg.text, cmd)) {
    try {
      const out = await handleSmart(msg, deps, now);
      if (out.handled) return out.text;
    } catch (err) {
      console.error('WhatsApp: a IA falhou, seguindo só com as regras', err); // não derruba o registro
    }
  }

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


const DAY_MS = 24 * 60 * 60 * 1000;

function dayLabel(created: Date, now: Date): string {
  const days = Math.round((startOfDayBRT(now).getTime() - startOfDayBRT(created).getTime()) / DAY_MS);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  return created.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
}

async function buildSmartContext(phone: string, deps: BotDeps, now: Date): Promise<SmartContext> {
  const rows = await deps.listExpensesSince(phone, startOfMonthBRT(now));
  const todayStart = startOfDayBRT(now).getTime();
  const weekStart = startOfWeekBRT(now).getTime();
  const at = (r: Expense) => new Date(r.created_at).getTime();
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.category, (totals.get(r.category) ?? 0) + r.amount);
  return {
    today: now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }),
    totals: {
      today: sum(rows.filter((r) => at(r) >= todayStart)),
      week: sum(rows.filter((r) => at(r) >= weekStart)),
      month: sum(rows),
    },
    byCategory: [...totals.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
    recent: [...rows]
      .sort((a, b) => at(b) - at(a))
      .slice(0, 40)
      .map((r) => ({ when: dayLabel(new Date(r.created_at), now), amount: r.amount, category: r.category, description: r.description })),
  };
}

const UNDERSTOOD_NOTHING =
  'Não entendi. 🤔 Mande o gasto com o valor, tipo *"gastei 35 no mercado"*, ou *ajuda* pra ver os comandos.';

/** Mensagens mais complexas: a IA entende, o código registra e confirma com os números reais. */
async function handleSmart(
  msg: { id: string; phone: string; text: string },
  deps: BotDeps,
  now: Date
): Promise<{ handled: boolean; text: string | null }> {
  if (!deps.smart) return { handled: false, text: null };
  const ctx = await buildSmartContext(msg.phone, deps, now);
  const result = await deps.smart(msg.text, ctx);
  if (!result) return { handled: false, text: null };

  if (result.undoLast) {
    const removed = await deps.deleteLastExpense(msg.phone);
    return { handled: true, text: removed ? `🗑️ Apaguei: ${brl(removed.amount)} — ${removed.description}` : 'Não encontrei nenhum gasto pra apagar.' };
  }

  if (result.fix && deps.updateLastExpense) {
    const done = await deps.updateLastExpense(msg.phone, result.fix);
    if (!done) return { handled: true, text: 'Não encontrei nenhum gasto pra corrigir.' };
    const { before, after } = done;
    const changes = [
      after.amount !== before.amount ? `${brl(before.amount)} → ${brl(after.amount)}` : null,
      after.category !== before.category ? `${categoryEmoji(before.category)} ${before.category} → ${categoryEmoji(after.category)} ${after.category}` : null,
      after.description !== before.description ? `"${before.description}" → "${after.description}"` : null,
    ].filter(Boolean);
    return { handled: true, text: `✏️ Corrigi o último gasto:\n${changes.join('\n')}` };
  }

  if (result.expenses.length > 0) {
    const today = startOfDayBRT(now).getTime();
    let saved = 0;
    const lines: string[] = [];
    for (const [i, e] of result.expenses.entries()) {
      const created = e.daysAgo > 0 ? new Date(today - e.daysAgo * DAY_MS + 12 * 60 * 60 * 1000).toISOString() : undefined;
      // um id por gasto: a mesma mensagem pode registrar vários, e a Meta às vezes reenvia
      const inserted = await deps.insertExpense({
        phone: msg.phone,
        amount: e.amount,
        category: e.category,
        description: e.description,
        waMessageId: `${msg.id}#${i}`,
        createdAt: created,
      });
      if (!inserted) {
        if (i === 0) return { handled: true, text: null }; // reenvio da Meta: já respondemos antes
        continue;
      }
      saved++;
      const when = e.daysAgo > 0 ? ` _(${e.daysAgo === 1 ? 'ontem' : `há ${e.daysAgo} dias`})_` : '';
      lines.push(`• ${brl(e.amount)} ${categoryEmoji(e.category)} *${e.category}* — ${e.description}${when}`);
    }
    if (saved === 0) return { handled: true, text: null };
    const monthRows = await deps.listExpensesSince(msg.phone, startOfMonthBRT(now));
    const todayTotal = sum(monthRows.filter((r) => new Date(r.created_at).getTime() >= today));
    return {
      handled: true,
      text: [
        saved === 1 ? '✅ Registrei:' : `✅ Registrei ${saved} gastos:`,
        ...lines,
        '',
        `Hoje: ${brl(todayTotal)} · Mês: ${brl(sum(monthRows))}`,
        result.reply ? `\n${result.reply}` : '',
      ]
        .join('\n')
        .trim(),
    };
  }

  return { handled: true, text: result.reply || UNDERSTOOD_NOTHING };
}
