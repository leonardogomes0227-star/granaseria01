// Estado das conversas e dos perfis do WhatsApp (tabelas de supabase/whatsapp-hub.sql).

import { createHash, randomBytes } from 'node:crypto';
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

/* ---------- Site → WhatsApp sem cadastro ---------- */
// O site guarda o diagnóstico por 24h com um código curto; a pessoa manda o código no WhatsApp e o bot importa.
// Fica na wa_sessions (chave "handoff:<código>") pra não precisar de tabela nova.

const HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;
export const HANDOFF_KEYS = ['selos-wizard-progress', 'selos-tracking', 'selos-leaks', 'selos-checkins', 'selos-diagnosis-completed', 'gs-nome', 'gs-resultados', 'gs-metas', 'gs-reset', 'gs-perfil', 'gs-tarefas', 'gs-contas', 'gs-conselheiros'];

export async function saveHandoff(code: string, state: StateSnapshot): Promise<void> {
  await check(
    await upsert('wa_sessions', 'phone', { phone: `handoff:${code}`, flow: 'handoff', step: 'pending', data: { state }, updated_at: new Date().toISOString() }),
    'upsert'
  );
}

/** Lê e apaga (o código vale uma vez só). null se não existe ou passou de 24h. */
export async function takeHandoff(code: string): Promise<StateSnapshot | null> {
  const key = `handoff:${code}`;
  const res = await rest(`wa_sessions?${new URLSearchParams({ phone: `eq.${key}`, select: 'data,updated_at', limit: '1' })}`);
  await check(res, 'select');
  const [row] = (await res.json()) as { data: { state?: StateSnapshot }; updated_at: string }[];
  if (!row) return null;
  await check(await rest(`wa_sessions?${new URLSearchParams({ phone: `eq.${key}` })}`, { method: 'DELETE' }), 'delete');
  if (Date.now() - new Date(row.updated_at).getTime() > HANDOFF_TTL_MS) return null;
  const state: StateSnapshot = {};
  for (const k of HANDOFF_KEYS) {
    const v = row.data?.state?.[k];
    if (typeof v === 'string') state[k] = v;
  }
  return state;
}

/* ---------- Painel no site: o WhatsApp é o login ---------- */
// O bot manda um link pessoal (granaseria.com.br/painel?t=…). O token fica só no navegador da pessoa; aqui guardamos
// o hash dele, ligado ao número, na wa_sessions (chave "weblink:<hash>"). Vale 180 dias desde o último uso.

const WEBLINK_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createWebLink(phone: string): Promise<string> {
  const token = randomBytes(24).toString('base64url');
  await check(
    await upsert('wa_sessions', 'phone', { phone: `weblink:${tokenHash(token)}`, flow: 'weblink', step: 'active', data: { phone }, updated_at: new Date().toISOString() }),
    'upsert'
  );
  return token;
}

/** O número dono do token, ou null se não existe ou expirou. Renova o prazo uma vez por dia. */
export async function phoneFromWebLink(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const key = `weblink:${tokenHash(token)}`;
  const res = await rest(`wa_sessions?${new URLSearchParams({ phone: `eq.${key}`, select: 'data,updated_at', limit: '1' })}`);
  await check(res, 'select');
  const [row] = (await res.json()) as { data: { phone?: string }; updated_at: string }[];
  const phone = row?.data?.phone;
  if (!row || !phone) return null;
  const age = Date.now() - new Date(row.updated_at).getTime();
  if (age > WEBLINK_TTL_MS) return null;
  if (age > 24 * 60 * 60 * 1000) {
    await upsert('wa_sessions', 'phone', { phone: key, flow: 'weblink', step: 'active', data: { phone }, updated_at: new Date().toISOString() }).catch(() => undefined);
  }
  return phone;
}

/** Desconecta todos os navegadores ligados a este número. */
export async function deleteWebLinks(phone: string): Promise<void> {
  await check(await rest(`wa_sessions?${new URLSearchParams({ flow: 'eq.weblink', 'data->>phone': `eq.${phone}` })}`, { method: 'DELETE' }), 'delete');
}

/** Quando o perfil deste número foi gravado pela última vez (pra o site saber se a versão de lá é mais nova). */
export async function getProfileWithDate(phone: string): Promise<{ state: StateSnapshot; updated_at: string | null }> {
  const res = await rest(`wa_profiles?${new URLSearchParams({ phone: `eq.${phone}`, select: 'state,updated_at', limit: '1' })}`);
  await check(res, 'select');
  const [row] = (await res.json()) as { state: StateSnapshot; updated_at: string }[];
  return { state: row?.state ?? {}, updated_at: row?.updated_at ?? null };
}

/** Última mensagem que a pessoa mandou (em minutos desde 1970), pra saber se a janela de 24h da Meta está aberta. */
export async function setLastInbound(phone: string): Promise<void> {
  await check(await upsert('wa_usage', 'phone,period', { phone, period: 'ultima:msg', count: Math.floor(Date.now() / 60000) }), 'upsert');
}

export async function getLastInbound(phone: string): Promise<Date | null> {
  const res = await rest(`wa_usage?${new URLSearchParams({ phone: `eq.${phone}`, period: 'eq.ultima:msg', select: 'count', limit: '1' })}`);
  await check(res, 'select');
  const [row] = (await res.json()) as { count: number }[];
  return row ? new Date(row.count * 60000) : null;
}

/** Aviso de que as ferramentas foram pro site: uma vez por pessoa (no chat ou pelo modelo da Meta). */
export const NOTICE_FLAG = 'aviso:site-v1';

/** Todos os números que já usaram o bot (perfil salvo ou algum gasto/entrada), pra avisos e pro painel do dono. */
export async function listKnownPhones(): Promise<string[]> {
  const phones = new Set<string>();
  for (const [table, extra] of [['wa_profiles', ''], ['expenses', ''], ['incomes', '']] as const) {
    const res = await rest(`${table}?${new URLSearchParams({ select: 'phone', limit: '10000' })}${extra}`);
    if (res.ok) for (const r of (await res.json()) as { phone: string }[]) if (/^\d{10,15}$/.test(r.phone)) phones.add(r.phone);
  }
  return [...phones];
}

/** Perfis com nome (o nome que a pessoa deu ao entrar no site), pro painel do dono. */
export async function listProfiles(): Promise<{ phone: string; state: StateSnapshot; updated_at: string }[]> {
  const res = await rest(`wa_profiles?${new URLSearchParams({ select: 'phone,state,updated_at', limit: '10000' })}`);
  await check(res, 'select');
  return (await res.json()) as { phone: string; state: StateSnapshot; updated_at: string }[];
}

/** Liga/desliga uma preferência da pessoa (ex.: receber o resumo semanal). Fica na wa_usage: count 1 = ligado. */
export async function setFlag(phone: string, key: string, on: boolean): Promise<void> {
  await check(await upsert('wa_usage', 'phone,period', { phone, period: key, count: on ? 1 : 0 }), 'upsert');
}

export async function getFlag(phone: string, key: string): Promise<boolean> {
  const res = await rest(`wa_usage?${new URLSearchParams({ phone: `eq.${phone}`, period: `eq.${key}`, select: 'count', limit: '1' })}`);
  await check(res, 'select');
  const [row] = (await res.json()) as { count: number }[];
  return (row?.count ?? 0) > 0;
}

/** Todos os números com a preferência ligada (ex.: quem pediu o resumo semanal). */
export async function listFlagged(key: string): Promise<string[]> {
  const res = await rest(`wa_usage?${new URLSearchParams({ period: `eq.${key}`, count: 'gt.0', select: 'phone' })}`);
  await check(res, 'select');
  return ((await res.json()) as { phone: string }[]).map((r) => r.phone);
}

/** Impressão digital do telefone: dá pra contar pessoas distintas sem guardar o número nas métricas. */
export function personHash(phone: string): string {
  return createHash('sha256').update(`${process.env.METRICS_SALT ?? 'grana-seria'}:${phone}`).digest('hex').slice(0, 24);
}

/** Registra um evento de uso. Nunca derruba a conversa: falha em silêncio (a tabela pode nem existir ainda). */
export async function trackEvent(phone: string, event: string, note?: string): Promise<void> {
  try {
    const res = await rest('wa_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ person: personHash(phone), event, ...(note ? { note: note.slice(0, 600) } : {}) }),
    });
    if (!res.ok) console.warn(`WhatsApp: evento não registrado (${res.status})`);
  } catch (err) {
    console.warn('WhatsApp: evento não registrado', err);
  }
}

/** "Apagar meus dados" (LGPD): gastos, perfil, conversa em andamento, contadores e métricas deste número. */
export async function eraseWhatsAppData(phone: string): Promise<void> {
  const targets = [`expenses?phone=eq.${phone}`, `incomes?phone=eq.${phone}`, `wa_profiles?phone=eq.${phone}`, `wa_sessions?phone=eq.${phone}`, `wa_usage?phone=eq.${phone}`, `wa_events?person=eq.${personHash(phone)}`];
  await deleteWebLinks(phone).catch(() => undefined); // links do painel no site
  for (const t of targets) {
    const res = await rest(t, { method: 'DELETE' });
    // wa_events e incomes podem não existir ainda (SQL não rodado): não é motivo pra deixar de apagar o resto
    if (!res.ok && !t.startsWith('wa_events') && !t.startsWith('incomes')) throw new Error(`Supabase delete ${res.status}: ${await res.text()}`);
  }
}
