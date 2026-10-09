// Acesso ao Supabase pela API REST (PostgREST), só com fetch — sem SDK no servidor.
// Usa a service role key, que NUNCA vai pro navegador: só existe nas variáveis de ambiente da Vercel.

export interface Expense {
  id: number;
  phone: string;
  amount: number;
  category: string;
  description: string;
  created_at: string;
}

/**
 * Chave antiga (service_role, um JWT "eyJ…") vai também no Authorization.
 * Chave nova (sb_secret_…) vai só no apikey — no Authorization ela é recusada.
 */
export function supabaseKeyHeaders(key: string): Record<string, string> {
  return key.startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

function env(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v.trim();
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return fetch(`${env('SUPABASE_URL').replace(/\/$/, '')}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...supabaseKeyHeaders(key),
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

/** Grava o gasto. Retorna false se essa mensagem já tinha sido gravada (a Meta às vezes reenvia). */
export async function insertExpense(e: {
  phone: string;
  amount: number;
  category: string;
  description: string;
  waMessageId: string;
}): Promise<boolean> {
  const res = await rest('expenses', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      phone: e.phone,
      amount: e.amount,
      category: e.category,
      description: e.description,
      wa_message_id: e.waMessageId,
    }),
  });
  if (res.status === 409) return false;
  if (!res.ok) throw new Error(`Supabase insert ${res.status}: ${await res.text()}`);
  return true;
}

export async function listExpensesSince(phone: string, since: Date): Promise<Expense[]> {
  const q = new URLSearchParams({
    phone: `eq.${phone}`,
    created_at: `gte.${since.toISOString()}`,
    select: 'id,phone,amount,category,description,created_at',
    order: 'created_at.asc',
  });
  const res = await rest(`expenses?${q}`);
  if (!res.ok) throw new Error(`Supabase select ${res.status}: ${await res.text()}`);
  const rows = (await res.json()) as Expense[];
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

/** Apaga o gasto mais recente da pessoa e devolve o que foi apagado. */
export async function deleteLastExpense(phone: string): Promise<Expense | null> {
  const q = new URLSearchParams({
    phone: `eq.${phone}`,
    select: 'id,phone,amount,category,description,created_at',
    order: 'created_at.desc',
    limit: '1',
  });
  const res = await rest(`expenses?${q}`);
  if (!res.ok) throw new Error(`Supabase select ${res.status}: ${await res.text()}`);
  const [last] = (await res.json()) as Expense[];
  if (!last) return null;
  const del = await rest(`expenses?id=eq.${last.id}&phone=eq.${phone}`, { method: 'DELETE' });
  if (!del.ok) throw new Error(`Supabase delete ${del.status}: ${await del.text()}`);
  return { ...last, amount: Number(last.amount) };
}
