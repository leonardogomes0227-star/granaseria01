// Painel no site, com o WhatsApp como login. O navegador manda o token do link pessoal
// ("Authorization: Bearer <token>") e recebe o que está guardado pelo número: diagnóstico, plano e vazamentos (o mesmo
// estado que o bot usa) e os gastos e entradas do mês. O que a pessoa muda no site volta por aqui (PUT).

import { phoneFromWebLink, getProfileWithDate, saveProfile, HANDOFF_KEYS } from '../server/whatsapp/hubdb.js';
import { listExpensesSince, listIncomesSince } from '../server/whatsapp/db.js';
import { startOfMonthBRT } from '../server/whatsapp/bot.js';
import { accountsConfigured, findUserByPhone, saveState, type StateSnapshot } from '../server/account/db.js';

const MAX_BYTES = 60_000;

async function auth(request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  return token ? phoneFromWebLink(token).catch(() => null) : null;
}

/** Quem vinculou a conta do site guarda o estado na conta; quem não vinculou, no perfil do número. */
async function loadState(phone: string): Promise<{ state: StateSnapshot; updatedAt: string | null; userId: string | null }> {
  const user = accountsConfigured() ? await findUserByPhone(phone).catch(() => null) : null;
  if (user) return { state: user.state ?? {}, updatedAt: user.updated_at, userId: user.user_id };
  const p = await getProfileWithDate(phone);
  return { state: p.state, updatedAt: p.updated_at, userId: null };
}

const masked = (phone: string) => `(${phone.slice(2, 4)}) •••••-${phone.slice(-4)}`;

export async function GET(request: Request): Promise<Response> {
  const phone = await auth(request);
  if (!phone) return Response.json({ error: 'link inválido ou expirado' }, { status: 401 });
  const now = new Date();
  const since = startOfMonthBRT(now);
  const [{ state, updatedAt }, expenses, incomes] = await Promise.all([
    loadState(phone),
    listExpensesSince(phone, since),
    listIncomesSince(phone, since).catch(() => []),
  ]);
  const pick = (r: { amount: number; created_at: string; description: string }) => ({ amount: r.amount, created_at: r.created_at, description: r.description });
  return Response.json({
    phone: masked(phone),
    state,
    updatedAt,
    month: {
      expenses: expenses.map((e) => ({ ...pick(e), category: e.category, method: e.payment_method ?? null })),
      incomes: incomes.map((i) => ({ ...pick(i), source: i.source, method: i.method ?? null })),
    },
  });
}

export async function PUT(request: Request): Promise<Response> {
  const phone = await auth(request);
  if (!phone) return Response.json({ error: 'link inválido ou expirado' }, { status: 401 });
  const raw = await request.text();
  if (raw.length > MAX_BYTES) return Response.json({ error: 'grande demais' }, { status: 413 });
  let body: { state?: Record<string, unknown> };
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const { state, userId } = await loadState(phone);
  // só as chaves do site, só texto; o resto do perfil (coisas do bot) fica como está
  const next: StateSnapshot = { ...state };
  for (const k of HANDOFF_KEYS) {
    const v = body.state?.[k];
    if (typeof v === 'string') next[k] = v;
    else if (v === null) delete next[k];
  }
  await (userId ? saveState(userId, next) : saveProfile(phone, next));
  return Response.json({ updatedAt: new Date().toISOString() });
}
