// Lançamentos (gastos e entradas) pelo site: listar um mês, anotar, editar, apagar e desfazer (spec v2, 7.2 e 8).
// São as mesmas tabelas do WhatsApp (expenses e incomes): o que muda aqui aparece no bot e vice-versa.
// Login pelo token do link do WhatsApp, como no painel. Nunca mês futuro (fuso de Brasília).

import { phoneFromWebLink } from '../server/whatsapp/hubdb.js';
import { deleteEntry, insertSiteEntry, listEntriesBetween, restoreEntry, updateEntry, type EntryKind } from '../server/whatsapp/db.js';
import { addMonths, currentMonth, isMonth, todaySP } from '../src/coachChat/months.js';

const MAX_BYTES = 4_000;
const json = (body: unknown, status = 200) => Response.json(body, { status });

async function auth(request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  return token ? phoneFromWebLink(token).catch(() => null) : null;
}

// Brasília é UTC-3 o ano todo (sem horário de verão desde 2019)
const monthStart = (mes: string) => new Date(`${mes}-01T03:00:00Z`);
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T12:00:00Z`).getTime());

/** created_at de um dia: hoje vale a hora de agora (fica na ordem certa); outro dia, meio-dia em Brasília. */
function createdAtFor(day: string): string {
  return day === todaySP() ? new Date().toISOString() : `${day}T15:00:00.000Z`;
}

type Body = { action?: string; kind?: string; id?: number; amount?: number; category?: string; description?: string; method?: string; date?: string; missaoId?: string };

async function readBody(request: Request): Promise<Body | null> {
  const raw = await request.text();
  if (raw.length > MAX_BYTES) return null;
  try {
    return JSON.parse(raw) as Body;
  } catch {
    return null;
  }
}

const kindOf = (v: unknown): EntryKind | null => (v === 'out' || v === 'in' ? v : null);
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function checkAmount(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0.01 && n <= 10_000_000 ? Math.round(n * 100) / 100 : null;
}

/** Data de um lançamento: hoje ou antes (até um ano e pouco atrás). */
function checkDay(v: unknown): string | null | 'futuro' {
  if (v === undefined) return todaySP();
  if (!isDay(v)) return null;
  if (v > todaySP()) return 'futuro';
  if (v < addMonths(currentMonth(), -13)) return null;
  return v;
}

export async function GET(request: Request): Promise<Response> {
  const phone = await auth(request);
  if (!phone) return json({ error: 'Entre pelo link do WhatsApp para ver seus lançamentos.' }, 401);
  const mes = new URL(request.url).searchParams.get('mes') ?? currentMonth();
  if (!isMonth(mes)) return json({ error: 'Mês inválido.' }, 400);
  if (mes > currentMonth()) return json({ error: 'Esse mês ainda não chegou.' }, 400);
  try {
    const entries = await listEntriesBetween(phone, monthStart(mes), monthStart(addMonths(mes, 1)));
    return json({ mes, entries });
  } catch (err) {
    console.error('Lançamentos: erro ao ler', err);
    return json({ error: 'Não consegui carregar agora.' }, 502);
  }
}

export async function POST(request: Request): Promise<Response> {
  const phone = await auth(request);
  if (!phone) return json({ error: 'Entre pelo link do WhatsApp para anotar.' }, 401);
  const b = await readBody(request);
  if (!b) return json({ error: 'Não entendi o pedido. Tente de novo.' }, 400);
  const kind = kindOf(b.kind);
  if (!kind) return json({ error: 'Tipo de lançamento inválido.' }, 400);
  try {
    // desfazer um apagar
    if (b.action === 'restaurar') {
      const id = Number(b.id);
      if (!Number.isInteger(id) || id <= 0) return json({ error: 'Não encontrei esse lançamento.' }, 400);
      const ok = await restoreEntry(phone, kind, id);
      return ok ? json({ ok: true }) : json({ error: 'Não dá pra desfazer este (rode supabase/fundacao.sql).' }, 409);
    }
    const amount = checkAmount(b.amount);
    if (amount === null) return json({ error: 'Valor inválido.' }, 400);
    const day = checkDay(b.date);
    if (day === 'futuro') return json({ error: 'Não dá pra anotar num dia que ainda não chegou.' }, 400);
    if (day === null) return json({ error: 'Data inválida.' }, 400);
    const category = text(b.category, 40) || (kind === 'out' ? 'Outros' : 'Outros');
    const entry = await insertSiteEntry(phone, {
      kind,
      amount,
      category,
      description: text(b.description, 80),
      method: text(b.method, 30) || null,
      createdAt: createdAtFor(day),
      missaoId: text(b.missaoId, 64) || null,
    });
    return json({ entry });
  } catch (err) {
    console.error('Lançamentos: erro ao gravar', err);
    return json({ error: 'Não consegui salvar agora. Tente de novo.' }, 502);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const phone = await auth(request);
  if (!phone) return json({ error: 'Entre pelo link do WhatsApp para editar.' }, 401);
  const b = await readBody(request);
  const kind = kindOf(b?.kind);
  const id = Number(b?.id);
  if (!b || !kind || !Number.isInteger(id) || id <= 0) return json({ error: 'Não entendi o pedido. Tente de novo.' }, 400);
  const patch: { amount?: number; category?: string; description?: string; createdAt?: string } = {};
  if (b.amount !== undefined) {
    const a = checkAmount(b.amount);
    if (a === null) return json({ error: 'Valor inválido.' }, 400);
    patch.amount = a;
  }
  if (b.category !== undefined) patch.category = text(b.category, 40) || 'Outros';
  if (b.description !== undefined) patch.description = text(b.description, 80);
  if (b.date !== undefined) {
    const day = checkDay(b.date);
    if (day === 'futuro') return json({ error: 'Não dá pra mudar pra um dia que ainda não chegou.' }, 400);
    if (day === null) return json({ error: 'Data inválida.' }, 400);
    patch.createdAt = createdAtFor(day);
  }
  try {
    await updateEntry(phone, kind, id, patch);
    return json({ ok: true });
  } catch (err) {
    console.error('Lançamentos: erro ao editar', err);
    return json({ error: 'Não consegui salvar agora.' }, 502);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const phone = await auth(request);
  if (!phone) return json({ error: 'Entre pelo link do WhatsApp.' }, 401);
  const b = await readBody(request);
  const kind = kindOf(b?.kind);
  const id = Number(b?.id);
  if (!kind || !Number.isInteger(id) || id <= 0) return json({ error: 'Não entendi o pedido. Tente de novo.' }, 400);
  try {
    const { soft } = await deleteEntry(phone, kind, id);
    return json({ ok: true, soft });
  } catch (err) {
    console.error('Lançamentos: erro ao apagar', err);
    return json({ error: 'Não consegui apagar agora.' }, 502);
  }
}
