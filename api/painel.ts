// Painel no site, com o WhatsApp como login. O navegador manda o token do link pessoal
// ("Authorization: Bearer <token>") e recebe o que está guardado pelo número: diagnóstico, plano e vazamentos (o mesmo
// estado que o bot usa) e os gastos e entradas do mês. O que a pessoa muda no site volta por aqui (PUT).

import { phoneFromWebLink, getProfileWithDate, saveProfile, trackEvent, eraseWhatsAppData, clearWhatsAppData, HANDOFF_KEYS } from '../server/whatsapp/hubdb.js';
import { listExpensesSince, listIncomesSince } from '../server/whatsapp/db.js';
import { startOfMonthBRT } from '../server/whatsapp/bot.js';
import { accountsConfigured, findUserByPhone, saveState, type StateSnapshot } from '../server/account/db.js';
import { PLAN_KEYS, RESET_ID, RESET_KEY, resetIfOld } from '../src/reset.js';
import { limparMesesFuturos } from '../src/lib/mesesFuturos.js';

const MAX_BYTES = 500_000; // o estado do app novo cresce com lançamentos e conversa de investimentos

async function auth(request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  return token ? phoneFromWebLink(token).catch(() => null) : null;
}

/** Quem vinculou a conta do site guarda o estado na conta; quem não vinculou, no perfil do número. */
async function loadState(phone: string): Promise<{ state: StateSnapshot; updatedAt: string | null; userId: string | null }> {
  const user = accountsConfigured() ? await findUserByPhone(phone).catch(() => null) : null;
  const loaded = user
    ? { state: user.state ?? {}, updatedAt: user.updated_at, userId: user.user_id }
    : await getProfileWithDate(phone).then((p) => ({ state: p.state, updatedAt: p.updated_at, userId: null }));
  // recomeço do plano (src/reset.ts): uma vez por pessoa, o plano antigo sai
  const reset = resetIfOld(loaded.state);
  // e nunca mês futuro (src/lib/mesesFuturos.ts): o que foi fechado antes da hora sai, com backup no próprio estado
  const clean = limparMesesFuturos(reset.state);
  if (!reset.changed && !clean.changed) return loaded;
  await (loaded.userId ? saveState(loaded.userId, clean.state) : saveProfile(phone, clean.state));
  return { state: clean.state, updatedAt: new Date().toISOString(), userId: loaded.userId };
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
  // o id vai junto pra o site poder editar e apagar (api/lancamentos.ts)
  const pick = (r: { id: number; amount: number; created_at: string; description: string }) => ({ id: r.id, amount: r.amount, created_at: r.created_at, description: r.description });
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
  // navegador que ainda não passou pelo recomeço não devolve o plano antigo
  const stale = body.state?.[RESET_KEY] !== RESET_ID;
  for (const k of HANDOFF_KEYS) {
    if (stale && (PLAN_KEYS.includes(k) || k === RESET_KEY)) continue;
    const v = body.state?.[k];
    if (typeof v === 'string') next[k] = v;
    else if (v === null) delete next[k];
  }
  await (userId ? saveState(userId, next) : saveProfile(phone, next));
  return Response.json({ updatedAt: new Date().toISOString() });
}

/**
 * O que a pessoa faz no site, pro painel do dono (mesma tabela de eventos do WhatsApp, só com o hash do número):
 * { event: "tool:site-debts" } quando abre uma ferramenta, e { feedback: { tool, kind: "up"|"down", note? } }.
 */
export async function POST(request: Request): Promise<Response> {
  const phone = await auth(request);
  if (!phone) return Response.json({ error: 'link inválido ou expirado' }, { status: 401 });
  let body: { event?: unknown; feedback?: { tool?: unknown; kind?: unknown; note?: unknown } };
  try {
    body = JSON.parse((await request.text()).slice(0, 4000));
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const safe = (v: unknown) => (typeof v === 'string' && /^[a-z0-9:_-]{1,48}$/.test(v) ? v : null);
  const event = safe(body.event);
  if (event) await trackEvent(phone, event);
  const fb = body.feedback;
  const tool = safe(fb?.tool);
  if (tool && (fb?.kind === 'up' || fb?.kind === 'down')) {
    const note = typeof fb.note === 'string' && fb.note.trim() ? fb.note.trim().slice(0, 600) : undefined;
    await trackEvent(phone, `feedback:${fb.kind}:site-${tool}`, note);
  }
  return Response.json({ ok: true });
}

/** "Limpar tudo" (?manter=1) e "Apagar conta e desconectar" do site (Meus dados): remove a cópia guardada pelo número (LGPD) e esvazia o estado da conta vinculada, se houver. */
export async function DELETE(request: Request): Promise<Response> {
  const phone = await auth(request);
  if (!phone) return Response.json({ error: 'link inválido ou expirado' }, { status: 401 });
  try {
    const user = accountsConfigured() ? await findUserByPhone(phone) : null;
    if (user) await saveState(user.user_id, {});
    // ?manter=1 ("Limpar tudo"): esvazia os dados e mantém o acesso (link do painel e conta). Sem isso: apaga também o acesso.
    if (new URL(request.url).searchParams.get('manter') === '1') await clearWhatsAppData(phone);
    else await eraseWhatsAppData(phone);
  } catch (err) {
    console.error('painel: não consegui apagar', err);
    return Response.json({ error: 'não consegui apagar agora' }, { status: 502 });
  }
  return new Response(null, { status: 204 });
}
