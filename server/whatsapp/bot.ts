import { parseMessage, categoryEmoji } from './parse.js';
import type { Expense, Income } from './db.js';
import { needsSmart, type SmartContext, type SmartResult } from './smart.js';

// Funções de banco recebidas por parâmetro: facilita testar a lógica sem Supabase de verdade.
export interface BotDeps {
  insertExpense: (e: { phone: string; amount: number; category: string; description: string; waMessageId: string; createdAt?: string; method?: string }) => Promise<boolean>;
  listExpensesSince: (phone: string, since: Date) => Promise<Expense[]>;
  deleteLastExpense: (phone: string) => Promise<Expense | null>;
  updateLastExpense?: (
    phone: string,
    patch: { amount?: number; description?: string; category?: string }
  ) => Promise<{ before: Expense; after: Expense } | null>;
  // entradas de dinheiro: sem elas (SQL de supabase/entradas.sql não rodado) o bot segue só com gastos
  insertIncome?: (i: { phone: string; amount: number; source: string; description: string; method?: string; waMessageId: string }) => Promise<boolean>;
  listIncomesSince?: (phone: string, since: Date) => Promise<Income[]>;
  deleteLastIncome?: (phone: string) => Promise<Income | null>;
  // quanto a pessoa disse que gasta por mês em cada categoria (do diagnóstico): vira o orçamento do dia a dia
  budgets?: Record<string, number>;
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

const METHOD_EMOJI: Record<string, string> = { Pix: '⚡', Débito: '💳', Crédito: '💳', Dinheiro: '💵', Boleto: '🧾', Vale: '🎫', Cartão: '💳' };
const methodTag = (r: { payment_method?: string | null }) => (r.payment_method ? ` · ${r.payment_method}` : '');

/** Gastos separados por como foram pagos. Quem não disse a forma entra em "Não informado". */
function byMethod(rows: Expense[]): string {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const k = r.payment_method || 'Não informado';
    totals.set(k, (totals.get(k) ?? 0) + r.amount);
  }
  const total = sum(rows) || 1;
  return [...totals.entries()]
    .sort((a, b) => (a[0] === 'Não informado' ? 1 : b[0] === 'Não informado' ? -1 : b[1] - a[1]))
    .map(([m, v]) => `${METHOD_EMOJI[m] ?? '▫️'} ${m}: ${brl(v)} (${Math.round((v / total) * 100)}%)`)
    .join('\n');
}

function bySource(rows: Income[]): string {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.source, (totals.get(r.source) ?? 0) + r.amount);
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([src, v]) => `💰 ${src}: ${brl(v)}`).join('\n');
}

const sumIncome = (rows: Income[]) => rows.reduce((t, r) => t + r.amount, 0);

/** "Entrou X, saiu Y, sobrou Z": a conta do mês em uma linha por item. */
function balanceLines(expenses: Expense[], incomes: Income[], now: Date): string[] {
  const inc = sumIncome(incomes);
  const out = sum(expenses);
  const left = inc - out;
  const local = new Date(now.getTime() - BRT_OFFSET_MS);
  const lastDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  const daysLeft = Math.max(1, lastDay - local.getUTCDate() + 1); // conta hoje
  return [
    `📥 Entrou: ${brl(inc)}`,
    `📤 Saiu: ${brl(out)}`,
    left >= 0 ? `🟢 Saldo do mês: ${brl(left)}` : `🔴 Saldo do mês: -${brl(-left)} (saiu mais do que entrou)`,
    ...(left > 0 ? [`🎯 Dá pra gastar uns ${brl(Math.floor(left / daysLeft))} por dia até o fim do mês.`] : []),
  ];
}

const INCOMES_OFF = 'As entradas de dinheiro ainda não estão ativas por aqui. Tente de novo daqui a pouco. 🙏';

/** "🟡 Alimentação: R$ 320 de R$ 400 no mês (80%)": liga o gasto do dia ao que a pessoa planejou no diagnóstico. */
export function budgetLine(category: string, rows: Expense[], budgets?: Record<string, number>): string | null {
  const budget = budgets?.[category];
  if (!budget || budget <= 0) return null;
  const spent = sum(rows.filter((r) => r.category === category));
  const pct = Math.round((spent / budget) * 100);
  const dot = pct >= 100 ? '🔴' : pct >= 70 ? '🟡' : '🟢';
  const tail = pct >= 100 ? ' Passou do que você planejou. Sem drama: respira e segura o resto do mês.' : pct >= 70 ? ' Já está chegando perto do que você planejou.' : '';
  return `${dot} ${categoryEmoji(category)} ${category}: ${brl(spent)} de ${brl(budget)} no mês (${pct}%).${tail}`;
}

/** "Quanto ainda dá pra gastar": o que a pessoa planejou no diagnóstico, o que já gastou e quanto sobra por dia até o fim do mês. */
function budgetText(rows: Expense[], budgets: Record<string, number> | undefined, now: Date): string {
  const entries = Object.entries(budgets ?? {}).filter(([, v]) => v > 0);
  if (entries.length === 0) {
    return 'Pra eu mostrar quanto ainda dá pra gastar, preciso saber quanto você planejou gastar em cada coisa. 🙂 Mande *diagnóstico* (leva uns 2 minutos) e depois me pergunte de novo.';
  }
  const local = new Date(now.getTime() - BRT_OFFSET_MS);
  const lastDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  const daysLeft = Math.max(1, lastDay - local.getUTCDate() + 1); // conta hoje
  const lines = [`🎯 *Quanto ainda dá pra gastar neste mês* (faltam ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}, contando hoje)`, ''];
  for (const [category, budget] of entries) {
    const spent = sum(rows.filter((r) => r.category === category));
    const left = budget - spent;
    const pct = Math.round((spent / budget) * 100);
    const dot = pct >= 100 ? '🔴' : pct >= 70 ? '🟡' : '🟢';
    const head = `${dot} ${categoryEmoji(category)} *${category}*: gastou ${brl(spent)} de ${brl(budget)}`;
    if (left <= 0) lines.push(`${head}. Passou ${brl(-left)}.`);
    else if (category === 'Moradia') lines.push(`${head}. Ainda faltam ${brl(left)} (contas fixas, como aluguel e luz).`);
    else lines.push(`${head}. Ainda dá pra gastar ${brl(left)}, uns ${brl(Math.floor(left / daysLeft))} por dia.`);
  }
  lines.push('', '_Esses limites são o que você me contou no diagnóstico._');
  return lines.join('\n');
}

export const HELP_TEXT = [
  '👋 *Assistente de gastos Grana Séria*',
  '',
  'Pra registrar, é só mandar o gasto:',
  '• gastei 35 no mercado',
  '• uber 18,50',
  '• farmácia 42',
  '• mercado 80 no pix (ou débito, crédito, dinheiro)',
  '',
  'Dinheiro que entrou:',
  '• recebi 200 de freela',
  '• caiu 3000 salário',
  '',
  'Comandos:',
  '• *hoje* — gastos de hoje',
  '• *ontem* — gastos de ontem',
  '• *semana* — total da semana',
  '• *mês* — resumo do mês por categoria',
  '• *últimos* — os últimos gastos anotados',
  '• *entradas* — o dinheiro que entrou no mês',
  '• *saldo* — o que entrou menos o que saiu',
  '• *formas de pagamento* — como você pagou (pix, cartão…)',
  '• *quanto ainda posso gastar* — o que sobra do que você planejou',
  '• *apagar* — desfaz o último gasto (*apagar entrada* desfaz a última entrada)',
  '• *menu* — tudo o que eu sei fazer',
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
        method: cmd.method,
      });
      if (!inserted) return null; // mensagem repetida pela Meta — já respondemos antes
      const monthRows = await deps.listExpensesSince(msg.phone, startOfMonthBRT(now));
      const todayStart = startOfDayBRT(now).getTime();
      const today = sum(monthRows.filter((r) => new Date(r.created_at).getTime() >= todayStart));
      // quem anota entradas vê, a cada gasto, o saldo e quanto ainda dá por dia
      const incomes = await deps.listIncomesSince?.(msg.phone, startOfMonthBRT(now)).catch(() => [] as Income[]);
      return [
        `✅ ${brl(cmd.amount)} em ${categoryEmoji(cmd.category)} *${cmd.category}*${cmd.method ? ` · ${METHOD_EMOJI[cmd.method] ?? ''} ${cmd.method}` : ''}`,
        `_${cmd.description}_`,
        '',
        `Hoje: ${brl(today)} · Mês: ${brl(sum(monthRows))}`,
        ...(incomes?.length ? balanceLines(monthRows, incomes, now).slice(2) : []),
        ...(budgetLine(cmd.category, monthRows, deps.budgets) ? [budgetLine(cmd.category, monthRows, deps.budgets) as string] : []),
        cmd.category === 'Outros' ? '\nDica: inclua o que foi (ex.: "mercado", "uber") pra eu categorizar.' : '',
        // quem nunca disse como pagou neste mês ganha a dica uma vez por gasto novo, até experimentar
        !cmd.method && !monthRows.some((r) => r.payment_method) ? '\n_Dica: diga como pagou (pix, débito, crédito, dinheiro) e eu separo por forma de pagamento._' : '',
      ]
        .join('\n')
        .trim();
    }

    case 'today': {
      const rows = await deps.listExpensesSince(msg.phone, startOfDayBRT(now));
      if (rows.length === 0) return 'Nenhum gasto registrado hoje. 🙌';
      const lines = rows.map((r) => `• ${brl(r.amount)} — ${r.description}${methodTag(r)}`);
      return [`📅 *Hoje*: ${brl(sum(rows))}`, '', ...lines].join('\n');
    }

    case 'yesterday': {
      const todayStart = startOfDayBRT(now);
      const rows = (await deps.listExpensesSince(msg.phone, new Date(todayStart.getTime() - DAY_MS))).filter((r) => new Date(r.created_at).getTime() < todayStart.getTime());
      if (rows.length === 0) return 'Nenhum gasto registrado ontem.';
      return [`📅 *Ontem*: ${brl(sum(rows))}`, '', ...rows.map((r) => `• ${brl(r.amount)} — ${r.description}${methodTag(r)}`)].join('\n');
    }

    case 'recent': {
      const rows = [...(await deps.listExpensesSince(msg.phone, startOfMonthBRT(now)))].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10);
      if (rows.length === 0) return 'Nenhum gasto registrado neste mês ainda. Pra anotar, mande por exemplo *gastei 35 no mercado*.';
      return ['🧾 *Seus últimos gastos*', '', ...rows.map((r) => `• ${dayLabel(new Date(r.created_at), now)} · ${brl(r.amount)} — ${r.description}${methodTag(r)}`), '', 'Errou um? Mande *apagar* pra desfazer o último.'].join('\n');
    }

    case 'budget':
      return budgetText(await deps.listExpensesSince(msg.phone, startOfMonthBRT(now)), deps.budgets, now);

    case 'week': {
      const rows = await deps.listExpensesSince(msg.phone, startOfWeekBRT(now));
      if (rows.length === 0) return 'Nenhum gasto registrado nesta semana.';
      return [`🗓️ *Semana* (desde segunda): ${brl(sum(rows))}`, '', byCategory(rows)].join('\n');
    }

    case 'month': {
      const rows = await deps.listExpensesSince(msg.phone, startOfMonthBRT(now));
      if (rows.length === 0) return 'Nenhum gasto registrado neste mês ainda.';
      return [
        `📊 *Mês*: ${brl(sum(rows))} em ${rows.length} registro(s)`,
        '',
        byCategory(rows),
        ...(rows.some((r) => r.payment_method) ? ['', '*Como você pagou*', byMethod(rows)] : []),
      ].join('\n');
    }

    case 'methods': {
      const rows = await deps.listExpensesSince(msg.phone, startOfMonthBRT(now));
      if (rows.length === 0) return 'Nenhum gasto registrado neste mês ainda.';
      if (!rows.some((r) => r.payment_method)) {
        return 'Ainda não tenho a forma de pagamento de nenhum gasto deste mês. 🙂 Ao anotar, diga como pagou, por exemplo: *mercado 80 no pix*, *uber 18,50 débito*, *tênis 250 crédito* ou *padaria 12 dinheiro*.';
      }
      return [`💳 *Como você pagou neste mês*: ${brl(sum(rows))}`, '', byMethod(rows)].join('\n');
    }

    case 'income': {
      if (!deps.insertIncome || !deps.listIncomesSince) return INCOMES_OFF;
      try {
        const inserted = await deps.insertIncome({ phone: msg.phone, amount: cmd.amount, source: cmd.source, description: cmd.description, method: cmd.method, waMessageId: msg.id });
        if (!inserted) return null; // mensagem repetida pela Meta
        const since = startOfMonthBRT(now);
        const [incomes, expenses] = await Promise.all([deps.listIncomesSince(msg.phone, since), deps.listExpensesSince(msg.phone, since)]);
        return [
          `💰 Entrada anotada: ${brl(cmd.amount)} · *${cmd.source}*${cmd.method ? ` · ${cmd.method}` : ''}`,
          ...(cmd.description !== cmd.source ? [`_${cmd.description}_`] : []),
          '',
          ...balanceLines(expenses, incomes, now),
          '',
          'Errou? Mande *apagar entrada*.',
        ].join('\n');
      } catch (err) {
        console.error('WhatsApp: entradas indisponíveis (rodou supabase/entradas.sql?)', err);
        return INCOMES_OFF;
      }
    }

    case 'incomes': {
      if (!deps.listIncomesSince) return INCOMES_OFF;
      try {
        const rows = await deps.listIncomesSince(msg.phone, startOfMonthBRT(now));
        if (rows.length === 0) return 'Nenhuma entrada anotada neste mês. Pra anotar, mande por exemplo *recebi 200 de freela* ou *caiu 3000 salário*.';
        const last = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10);
        return [
          `📥 *Entradas do mês*: ${brl(sumIncome(rows))} em ${rows.length} registro(s)`,
          '',
          bySource(rows),
          '',
          '*Últimas*',
          ...last.map((r) => `• ${dayLabel(new Date(r.created_at), now)} · ${brl(r.amount)} — ${r.description}${r.method ? ` · ${r.method}` : ''}`),
        ].join('\n');
      } catch (err) {
        console.error('WhatsApp: entradas indisponíveis', err);
        return INCOMES_OFF;
      }
    }

    case 'balance': {
      if (!deps.listIncomesSince) return INCOMES_OFF;
      try {
        const since = startOfMonthBRT(now);
        const [incomes, expenses] = await Promise.all([deps.listIncomesSince(msg.phone, since), deps.listExpensesSince(msg.phone, since)]);
        if (incomes.length === 0 && expenses.length === 0) return 'Ainda não tem nada anotado neste mês. Mande, por exemplo, *recebi 200 de freela* ou *gastei 35 no mercado*.';
        return [
          '⚖️ *Saldo do mês*',
          '',
          ...balanceLines(expenses, incomes, now),
          ...(incomes.length === 0 ? ['', '_Ainda não anotou nenhuma entrada. Mande por exemplo *recebi 200 de freela* pra conta ficar completa._'] : []),
        ].join('\n');
      } catch (err) {
        console.error('WhatsApp: entradas indisponíveis', err);
        return INCOMES_OFF;
      }
    }

    case 'undoIncome': {
      if (!deps.deleteLastIncome) return INCOMES_OFF;
      try {
        const removed = await deps.deleteLastIncome(msg.phone);
        return removed ? `🗑️ Apaguei a entrada: ${brl(removed.amount)} — ${removed.description}` : 'Não encontrei nenhuma entrada pra apagar.';
      } catch (err) {
        console.error('WhatsApp: entradas indisponíveis', err);
        return INCOMES_OFF;
      }
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
        method: e.method,
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
        ...[...new Set(result.expenses.map((e) => e.category))].flatMap((c) => budgetLine(c, monthRows, deps.budgets) ?? []),
        result.reply ? `\n${result.reply}` : '',
      ]
        .join('\n')
        .trim(),
    };
  }

  return { handled: true, text: result.reply || UNDERSTOOD_NOTHING };
}
