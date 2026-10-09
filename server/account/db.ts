// Conta da pessoa no Supabase (tabela user_state), acessada pelo servidor com a service role.
// Mesma abordagem do whatsapp/db.ts: REST (PostgREST) com fetch, sem SDK.

import { supabaseKeyHeaders } from '../whatsapp/db.js';

export type StateSnapshot = Record<string, string>; // chave do localStorage → valor (texto)

export interface UserRow {
  user_id: string;
  phone: string | null;
  state: StateSnapshot;
  updated_at: string;
  reminder_day: number | null;
  reminders: boolean;
  last_reminder: string | null;
  fatura_month: string | null;
  fatura_count: number;
}

const COLS = 'user_id,phone,state,updated_at,reminder_day,reminders,last_reminder,fatura_month,fatura_count';

function env(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v.trim();
}

export const accountsConfigured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return fetch(`${env('SUPABASE_URL').replace(/\/$/, '')}/rest/v1/${path}`, {
    ...init,
    headers: { ...supabaseKeyHeaders(key), 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}

async function ok(res: Response, what: string) {
  if (!res.ok) throw new Error(`Supabase ${what} ${res.status}: ${await res.text()}`);
}

export async function findUserByPhone(phone: string): Promise<UserRow | null> {
  const res = await rest(`user_state?${new URLSearchParams({ phone: `eq.${phone}`, select: COLS, limit: '1' })}`);
  await ok(res, 'select');
  const [row] = (await res.json()) as UserRow[];
  return row ?? null;
}

export async function findUserById(userId: string): Promise<UserRow | null> {
  const res = await rest(`user_state?${new URLSearchParams({ user_id: `eq.${userId}`, select: COLS, limit: '1' })}`);
  await ok(res, 'select');
  const [row] = (await res.json()) as UserRow[];
  return row ?? null;
}

/** Vincula o número a quem gerou o código no site. O número vem do próprio WhatsApp: não dá pra vincular o de outra pessoa. */
export async function linkPhoneByCode(code: string, phone: string): Promise<boolean> {
  const q = new URLSearchParams({ link_code: `eq.${code}`, link_code_expires: `gt.${new Date().toISOString()}`, select: 'user_id', limit: '1' });
  const res = await rest(`user_state?${q}`);
  await ok(res, 'select');
  const [row] = (await res.json()) as { user_id: string }[];
  if (!row) return false;
  // um número só pode estar em uma conta
  await ok(await rest(`user_state?phone=eq.${phone}`, { method: 'PATCH', body: JSON.stringify({ phone: null }) }), 'unlink');
  await ok(
    await rest(`user_state?user_id=eq.${row.user_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ phone, link_code: null, link_code_expires: null }),
    }),
    'link'
  );
  return true;
}

export async function updateUser(userId: string, patch: Partial<Omit<UserRow, 'user_id'>>): Promise<void> {
  await ok(await rest(`user_state?user_id=eq.${userId}`, { method: 'PATCH', body: JSON.stringify(patch) }), 'update');
}

/** Grava o estado mudado pelo WhatsApp; o site puxa a versão nova na próxima vez que abrir. */
export async function saveState(userId: string, state: StateSnapshot): Promise<void> {
  await updateUser(userId, { state, updated_at: new Date().toISOString() });
}

export async function listReminderCandidates(): Promise<UserRow[]> {
  const q = new URLSearchParams({ phone: 'not.is.null', reminders: 'is.true', reminder_day: 'not.is.null', select: COLS });
  const res = await rest(`user_state?${q}`);
  await ok(res, 'select');
  return (await res.json()) as UserRow[];
}

/** true se a mensagem é nova; false se a Meta já tinha mandado essa antes. */
export async function markProcessed(messageId: string): Promise<boolean> {
  const res = await rest('wa_processed', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ id: messageId }) });
  if (res.status === 409) return false;
  await ok(res, 'insert');
  return true;
}

/** Confere o token de login que o navegador manda e devolve o id da pessoa. */
export async function userIdFromToken(token: string): Promise<string | null> {
  const res = await fetch(`${env('SUPABASE_URL').replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user.id ?? null;
}
