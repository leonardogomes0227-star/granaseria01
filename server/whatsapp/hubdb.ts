// Estado das conversas e dos perfis do WhatsApp (tabelas de supabase/whatsapp-hub.sql).

import { rest } from './db.js';
import type { Session } from './hub.js';
import type { StateSnapshot } from '../account/db.js';

const SESSION_TTL_MS = 30 * 60 * 1000; // conversa parada há mais de 30 min recomeça do zero

async function check(res: Response, what: string) {
  if (!res.ok) throw new Error(`Supabase ${what} ${res.status}: ${await res.text()}`);
}

const upsert = (table: string, onConflict: string, row: unknown) =>
  rest(`${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });

export async function getSession(phone: string): Promise<Session | null> {
  const res = await rest(`wa_sessions?${new URLSearchParams({ phone: `eq.${phone}`, select: 'flow,step,data,updated_at', limit: '1' })}`);
  await check(res, 'select');
  const [row] = (await res.json()) as { flow: Session['flow']; step: string; data: Session['data']; updated_at: string }[];
  if (!row) return null;
  if (Date.now() - new Date(row.updated_at).getTime() > SESSION_TTL_MS) return null;
  return { flow: row.flow, step: row.step, data: row.data ?? {} };
}

export async function saveSession(phone: string, s: Session): Promise<void> {
  await check(await upsert('wa_sessions', 'phone', { phone, flow: s.flow, step: s.step, data: s.data, updated_at: new Date().toISOString() }), 'upsert');
}

export async function clearSession(phone: string): Promise<void> {
  await check(await rest(`wa_sessions?phone=eq.${phone}`, { method: 'DELETE' }), 'delete');
}

export async function getProfile(phone: string): Promise<StateSnapshot> {
  const res = await rest(`wa_profiles?${new URLSearchParams({ phone: `eq.${phone}`, select: 'state', limit: '1' })}`);
  await check(res, 'select');
  const [row] = (await res.json()) as { state: StateSnapshot }[];
  return row?.state ?? {};
}

export async function saveProfile(phone: string, state: StateSnapshot): Promise<void> {
  await check(await upsert('wa_profiles', 'phone', { phone, state, updated_at: new Date().toISOString() }), 'upsert');
}

/** Conta um uso. Devolve false se o limite do período já foi atingido (nesse caso não conta). */
export async function bumpUsage(phone: string, period: string, limit: number): Promise<boolean> {
  const res = await rest(`wa_usage?${new URLSearchParams({ phone: `eq.${phone}`, period: `eq.${period}`, select: 'count', limit: '1' })}`);
  await check(res, 'select');
  const [row] = (await res.json()) as { count: number }[];
  const count = row?.count ?? 0;
  if (count >= limit) return false;
  await check(await upsert('wa_usage', 'phone,period', { phone, period, count: count + 1 }), 'upsert');
  return true;
}

/** Desfaz uma contagem (a leitura falhou por culpa nossa, então não gasta o limite da pessoa). */
export async function refundUsage(phone: string, period: string): Promise<void> {
  const res = await rest(`wa_usage?${new URLSearchParams({ phone: `eq.${phone}`, period: `eq.${period}`, select: 'count', limit: '1' })}`);
  await check(res, 'select');
  const [row] = (await res.json()) as { count: number }[];
  if (row && row.count > 0) await check(await upsert('wa_usage', 'phone,period', { phone, period, count: row.count - 1 }), 'upsert');
}
