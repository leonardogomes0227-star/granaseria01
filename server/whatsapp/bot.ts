import { parseMessage, categoryEmoji, detectIncomeSource, detectCategory, normalize as normalizeText, SAVED_CATEGORY, OTHER_CATEGORY, CATEGORIES } from './parse.js';
import type { Expense, Income } from './db.js';
import { SUMMARY_OFFER, type Offer } from './offers.js';
import { weeklySummary } from './summary.js';
import { needsSmart, type SmartContext, type SmartResult } from './smart.js';
import { siteLink } from './site.js';

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
  // true na primeira vez do mês que este tipo de oferta é feito pra pessoa (sem isso, não há ofertas)
  offerOnce?: (phone: string, key: string) => Promise<boolean>;
  // resumo semanal: liga, desliga e diz se está ligado
  setSummary?: (phone: string, on: boolean) => Promise<void>;
  summaryOn?: (phone: string) => Promise<boolean>;
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

/** A oferta como linha final da resposta, só se ainda não foi feita neste mês. */
async function offerLine(phone: string, offer: Offer | null, deps: BotDeps): Promise<string> {
  if (!offer || !deps.offerOnce) return '';
  return (await deps.offerOnce(phone, offer.key).catch(() => false)) ? `\n\n${offer.text}` : '';
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
    return `Pra eu mostrar quanto ainda dá pra gastar em cada coisa, preciso saber quanto você planejou pra cada uma. 🙂 Faça o diagnóstico no site (uns 10 minutos) e depois me pergunte de novo:\n${siteLink('diag')}`;
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
  '• *resumo semanal* — um resumo da semana todo domingo',
  '• *painel* — seu painel no site (seu mês, seu plano e as ferramentas)',
].join('\n');

/** "ontem" vira meio-dia de ontem no horário de Brasília (assim cai no dia certo em qualquer resumo). */
function daysAgoISO(daysAgo: number | undefined, now: Date): string | undefined {
  if (!daysAgo) return undefined;
  return new Date(startOfDayBRT(now).getTime() - daysAgo * DAY_MS + 12 * 60 * 60 * 1000).toISOString();
}

export interface NewExpense {
  amount: number;
  category: string;
  description: string;
  method?: string;
  createdAt?: string; // ISO; sem isso vale a hora do registro
}

/** Grava o gasto e monta a confirmação (total do dia e do mês, saldo, orçamento, dicas e uma oferta). null = reenvio da Meta. */
export async function recordExpense(phone: string, e: NewExpense, waMessageId: string, deps: BotDeps, now: Date, intro?: string): Promise<string | null> {
  const inserted = await deps.insertExpense({ phone, amount: e.amount, category: e.category, description: e.description, waMessageId, method: e.method, createdAt: e.createdAt });
  if (!inserted) return null; // mensagem repetida pela Meta — já respondemos antes
  const monthRows = await deps.listExpensesSince(phone, startOfMonthBRT(now));
  const todayStart = startOfDayBRT(now).getTime();
  const today = sum(monthRows.filter((r) => new Date(r.created_at).getTime() >= todayStart));
  // quem anota entradas vê, a cada gasto, o saldo e quanto ainda dá por dia
  const incomes = await deps.listIncomesSince?.(phone, startOfMonthBRT(now)).catch(() => [] as Income[]);
  const when = e.createdAt && new Date(e.createdAt).getTime() < todayStart ? ` _(${dayLabel(new Date(e.createdAt), now)})_` : '';
  return [
    ...(intro ? [intro] : []),
    `✅ ${brl(e.amount)} em ${categoryEmoji(e.category)} *${e.category}*${e.method ? ` · ${METHOD_EMOJI[e.method] ?? ''} ${e.method}` : ''}${when}`,
    `_${e.description}_`,
    '',
    `Hoje: ${brl(today)} · Mês: ${brl(sum(monthRows))}`,
    ...(incomes?.length ? balanceLines(monthRows, incomes, now).slice(2) : []),
    ...(budgetLine(e.category, monthRows, deps.budgets) ? [budgetLine(e.category, monthRows, deps.budgets) as string] : []),
    ...(e.category === 'Outros' ? ['\nDica: inclua o que foi (ex.: "mercado", "uber") pra eu categorizar.'] : []),
    ...(e.category === SAVED_CATEGORY ? ['\n👏 Guardar antes de gastar é o primeiro hábito do livro. Isso sai do saldo do mês, mas é dinheiro seu.'] : []),
    // quem nunca disse como pagou neste mês ganha a dica, até experimentar
    ...(!e.method && !monthRows.some((r) => r.payment_method) && e.category !== SAVED_CATEGORY ? ['\n_Dica: diga como pagou (pix, débito, crédito, dinheiro) e eu separo por forma de pagamento._'] : []),
  ]
    .join('\n')
    .trim()
    .concat(await offerLine(phone, await summaryOffer(phone, monthRows.length, deps), deps));
}

/** Quem já anotou uns gastos no mês e ainda não recebe o resumo semanal é convidado a ligar (uma vez por mês). */
async function summaryOffer(phone: string, monthCount: number, deps: BotDeps): Promise<Offer | null> {
  if (monthCount < 5 || !deps.summaryOn || !deps.setSummary) return null;
  return (await deps.summaryOn(phone).catch(() => true)) ? null : SUMMARY_OFFER;
}

/** Grava a entrada e responde com o saldo do mês e quanto dá por dia. null = reenvio da Meta. */
export async function recordIncome(
  phone: string,
  i: { amount: number; source: string; description: string; method?: string },
  waMessageId: string,
  deps: BotDeps,
  now: Date,
  intro?: string
): Promise<string | null> {
  if (!deps.insertIncome || !deps.listIncomesSince) return INCOMES_OFF;
  try {
    const inserted = await deps.insertIncome({ phone, amount: i.amount, source: i.source, description: i.description, method: i.method, waMessageId });
    if (!inserted) return null; // mensagem repetida pela Meta
    const since = startOfMonthBRT(now);
    const [incomes, expenses] = await Promise.all([deps.listIncomesSince(phone, since), deps.listExpensesSince(phone, since)]);
    return [
      ...(intro ? [intro] : []),
      `💰 Entrada anotada: ${brl(i.amount)} · *${i.source}*${i.method ? ` · ${i.method}` : ''}`,
      ...(i.description !== i.source ? [`_${i.description}_`] : []),
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

/**
 * Foto/PDF de cupom ou comprovante já lido pela IA: vira gasto (ou entrada, se o pix foi recebido).
 * Devolve null quando não é um pagamento (aí quem chama tenta ler como fatura).
 */
export async function recordReceipt(
  phone: string,
  r: { tipo: string; valor: number; descricao: string; categoria: string; forma_pagamento: string; data: string },
  waMessageId: string,
  deps: BotDeps,
  now: Date
): Promise<string | null | 'not-receipt'> {
  if (r.tipo !== 'pagamento' && r.tipo !== 'recebimento') return 'not-receipt';
  if (r.valor <= 0) return 'Li o documento, mas não achei o valor. 🤔 Me manda por escrito, ex.: *mercado 45,90 no pix*.';
  // data do documento: só vale se for dos últimos 31 dias (meio-dia, horário de Brasília)
  let createdAt: string | undefined;
  if (r.data) {
    const at = new Date(`${r.data}T15:00:00Z`);
    const age = startOfDayBRT(now).getTime() - startOfDayBRT(at).getTime();
    if (age > 0 && age <= 31 * DAY_MS) createdAt = at.toISOString();
  }
  const method = r.forma_pagamento || undefined;
  if (r.tipo === 'recebimento') {
    return recordIncome(phone, { amount: r.valor, source: detectIncomeSource(r.descricao), description: r.descricao, method }, waMessageId, deps, now, '📸 Li o comprovante:');
  }
  return recordExpense(phone, { amount: r.valor, category: r.categoria, description: r.descricao, method, createdAt }, waMessageId, deps, now, '📸 Li o comprovante:');
}

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

    case 'expense':
      return recordExpense(msg.phone, { ...cmd, createdAt: daysAgoISO(cmd.daysAgo, now) }, msg.id, deps, now);

    case 'multi': {
      // um id por gasto: a Meta às vezes reenvia a mesma mensagem
      const createdAt = daysAgoISO(cmd.daysAgo, now);
      const lines: string[] = [];
      for (const [i, it] of cmd.items.entries()) {
        const ok = await deps.insertExpense({ phone: msg.phone, amount: it.amount, category: it.category, description: it.description, waMessageId: `${msg.id}#${i}`, method: it.method, createdAt });
        if (!ok && i === 0) return null;
        if (ok) lines.push(`• ${brl(it.amount)} ${categoryEmoji(it.category)} *${it.category}* — ${it.description}${it.method ? ` · ${it.method}` : ''}`);
      }
      const monthRows = await deps.listExpensesSince(msg.phone, startOfMonthBRT(now));
      const todayStart = startOfDayBRT(now).getTime();
      const incomes = await deps.listIncomesSince?.(msg.phone, startOfMonthBRT(now)).catch(() => [] as Income[]);
      return [
        `✅ Anotei ${lines.length} gastos${cmd.daysAgo ? ` (${cmd.daysAgo === 1 ? 'ontem' : 'anteontem'})` : ''}:`,
        ...lines,
        '',
        `Hoje: ${brl(sum(monthRows.filter((r) => new Date(r.created_at).getTime() >= todayStart)))} · Mês: ${brl(sum(monthRows))}`,
        ...(incomes?.length ? balanceLines(monthRows, incomes, now).slice(2) : []),
      ].join('\n');
    }

    case 'categoryQuery': {
      const rows = await deps.listExpensesSince(msg.phone, startOfMonthBRT(now));
      const term = normalizeText(cmd.term);
      // pelo nome da categoria ("alimentação", "transporte") ou por uma palavra dela ("mercado", "uber")
      const byName = [...CATEGORIES, OTHER_CATEGORY].find((c) => normalizeText(c.name).startsWith(term) || term.startsWith(normalizeText(c.name)));
      const cat = byName?.name ?? detectCategory(cmd.term);
      const hits = cat !== OTHER_CATEGORY.name ? rows.filter((r) => r.category === cat) : rows.filter((r) => normalizeText(r.description).includes(term));
      const label = cat !== OTHER_CATEGORY.name ? `${categoryEmoji(cat)} *${cat}*` : `*${cmd.term}*`;
      if (hits.length === 0) return `Neste mês não tem nada anotado em ${label}. 🙂`;
      const top = [...hits].sort((a, b) => b.amount - a.amount).slice(0, 5);
      return [
        `${label} neste mês: *${brl(sum(hits))}* em ${hits.length} ${hits.length === 1 ? 'anotação' : 'anotações'} (${Math.round((sum(hits) / (sum(rows) || 1)) * 100)}% dos seus gastos)`,
        '',
        ...top.map((r) => `• ${dayLabel(new Date(r.created_at), now)} · ${brl(r.amount)} — ${r.description}`),
        ...(budgetLine(cat, rows, deps.budgets) ? ['', budgetLine(cat, rows, deps.budgets) as string] : []),
      ].join('\n');
    }

    case 'thanks':
      return 'Por nada! 🙂 Tô por aqui. É só mandar o próximo gasto (ex.: *mercado 80 no pix*) ou *saldo* pra ver como está o mês.';

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

    case 'income':
      return recordIncome(msg.phone, cmd, msg.id, deps, now);

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

    case 'weekly': {
      if (!deps.setSummary) return 'O resumo semanal ainda não está ativo por aqui. 🙏';
      const since = new Date(now.getTime() - 14 * DAY_MS);
      const monthStart = startOfMonthBRT(now);
      const [recent, monthExpenses, monthIncomes] = await Promise.all([
        deps.listExpensesSince(msg.phone, since < monthStart ? since : monthStart),
        deps.listExpensesSince(msg.phone, monthStart),
        deps.listIncomesSince?.(msg.phone, monthStart).catch(() => [] as Income[]) ?? Promise.resolve([] as Income[]),
      ]);
      await deps.setSummary(msg.phone, true);
      const summary = weeklySummary({ recent, monthExpenses, monthIncomes, now });
      return [
        summary?.text ?? 'Ainda não tem gasto anotado nos últimos 7 dias. Anote os próximos (ex.: *mercado 80 no pix*) e no domingo eu te mostro como foi.',
        '',
        '✅ Combinado: todo *domingo de manhã* eu te mando o resumo da semana, e no *dia 1* o do mês que fechou. Pra parar, mande *parar resumo*.',
      ].join('\n');
    }

    case 'weeklyOff': {
      if (!deps.setSummary) return 'O resumo semanal ainda não está ativo por aqui. 🙏';
      await deps.setSummary(msg.phone, false);
      return 'Pronto, desliguei os resumos. 🙂 Pra voltar, mande *resumo semanal*.';
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

    default: {
      // fala de um gasto sem dizer o valor ("mercado", "paguei a luz"): pergunta quanto foi
      const cat = detectCategory(msg.text);
      if (cat !== OTHER_CATEGORY.name && !/\d/.test(msg.text) && !msg.text.includes('?')) {
        return `Quanto foi? 🙂 Mande com o valor, por exemplo: *${msg.text.trim().slice(0, 30)} 50*.`;
      }
      return [
        'Não entendi. 🤔 Me mande assim:',
        '• um gasto: *mercado 80 no pix*',
        '• uma entrada: *recebi 3000 salário*',
        '• ou *saldo*, *hoje*, *mês*, *quanto posso gastar*',
        '',
        'Mande *menu* pra ver tudo.',
      ].join('\n');
    }
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
