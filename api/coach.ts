// O coach em chat: perfil (qual coach), progresso das conversas, plano e aportes mensais.
// Login pelo token do link do WhatsApp, como no painel. As tabelas são as de supabase/coach.sql.

import { phoneFromWebLink } from '../server/whatsapp/hubdb.js';
import { rest } from '../server/whatsapp/db.js';
import { currentMonth, isMonth } from '../src/coachChat/months.js';

const MAX_BYTES = 40_000;
const COACHES = ['arkad', 'nomasir', 'sharru'];

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function auth(request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  return token ? phoneFromWebLink(token).catch(() => null) : null;
}

const upsert = (table: string, onConflict: string, row: unknown) =>
  rest(`${table}?on_conflict=${onConflict}`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) });

const select = async <T>(table: string, phone: string, extra: Record<string, string> = {}): Promise<T[]> => {
  const res = await rest(`${table}?${new URLSearchParams({ phone: `eq.${phone}`, select: '*', ...extra })}`);
  if (!res.ok) throw new Error(`Supabase ${table} ${res.status}: ${await res.text()}`);
  return (await res.json()) as T[];
};

export async function GET(request: Request): Promise<Response> {
  const phone = await auth(request);
  if (!phone) return json({ error: 'link inválido ou expirado' }, 401);
  try {
    const [perfil, chats, plano, aportes] = await Promise.all([
      select<{ coach: string }>('coach_perfil', phone),
      select<{ script: string; history: unknown[] }>('coach_chat', phone),
      select<{ respostas: unknown; plano: unknown }>('coach_plano', phone),
      select<{ mes: string; valor: number; origem: string }>('coach_aportes', phone, { order: 'mes.asc' }),
    ]);
    return json({
      coach: perfil[0]?.coach ?? null,
      chats: Object.fromEntries(chats.map((c) => [c.script, c.history])),
      plano: plano[0]?.plano && Object.keys(plano[0].plano as object).length ? plano[0].plano : null,
      aportes: aportes.map((a) => ({ mes: a.mes, valor: Number(a.valor), origem: a.origem })),
    });
  } catch (err) {
    console.error('Coach: erro ao ler', err);
    return json({ error: 'tabelas do coach indisponíveis' }, 503);
  }
}

type Body = { action?: string; coach?: string; script?: string; history?: unknown; respostas?: unknown; plano?: unknown; mes?: string; valor?: number };

export async function POST(request: Request): Promise<Response> {
  const phone = await auth(request);
  if (!phone) return json({ error: 'link inválido ou expirado' }, 401);
  const raw = await request.text();
  if (raw.length > MAX_BYTES) return json({ error: 'grande demais' }, 413);
  let b: Body;
  try {
    b = JSON.parse(raw) as Body;
  } catch {
    return json({ error: 'pedido inválido' }, 400);
  }
  const now = new Date().toISOString();
  try {
    if (b.action === 'coach') {
      if (!b.coach || !COACHES.includes(b.coach)) return json({ error: 'coach inválido' }, 400);
      await upsert('coach_perfil', 'phone', { phone, coach: b.coach, updated_at: now });
    } else if (b.action === 'chat') {
      if (!b.script || !/^[a-z]+(:\d{4}-\d{2})?$/.test(b.script) || !Array.isArray(b.history)) return json({ error: 'conversa inválida' }, 400);
      await upsert('coach_chat', 'phone,script', { phone, script: b.script, history: b.history, updated_at: now });
    } else if (b.action === 'plano') {
      if (typeof b.plano !== 'object' || !b.plano) return json({ error: 'plano inválido' }, 400);
      await upsert('coach_plano', 'phone', { phone, respostas: b.respostas ?? {}, plano: b.plano, updated_at: now });
    } else if (b.action === 'aporte') {
      const valor = Number(b.valor);
      if (!isMonth(b.mes) || !Number.isFinite(valor) || valor < 0 || valor > 10_000_000) return json({ error: 'aporte inválido' }, 400);
      if (b.mes > currentMonth()) return json({ error: 'não dá pra registrar mês que ainda não chegou' }, 400);
      await upsert('coach_aportes', 'phone,mes', { phone, mes: b.mes, valor: Math.round(valor * 100) / 100, origem: 'site' });
    } else return json({ error: 'ação desconhecida' }, 400);
    return json({ ok: true });
  } catch (err) {
    console.error('Coach: erro ao gravar', err);
    return json({ error: 'não consegui salvar agora' }, 502);
  }
}
