// Acesso ao Supabase pela API REST (PostgREST), só com fetch — sem SDK no servidor.
// Usa a service role key, que NUNCA vai pro navegador: só existe nas variáveis de ambiente da Vercel.

export interface Expense {
  id: number;
  phone: string;
  amount: number;
  category: string;
  description: string;
  payment_method?: string | null; // Pix, Débito, Crédito… (só existe depois de rodar supabase/entradas.sql)
  created_at: string;
}

export interface Income {
  id: number;
  phone: string;
  amount: number;
  source: string;
  description: string;
  method?: string | null;
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

export async function rest(path: string, init: RequestInit = {}): Promise<Response> {
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
  createdAt?: string; // ISO; sem isso vale a hora do registro (gasto de "ontem" passa a data)
  method?: string; // forma de pagamento
}): Promise<boolean> {
  const post = (withMethod: boolean) =>
    rest('expenses', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        phone: e.phone,
        amount: e.amount,
        category: e.category,
        description: e.description,
        wa_message_id: e.waMessageId,
        ...(e.createdAt ? { created_at: e.createdAt } : {}),
        ...(withMethod && e.method ? { payment_method: e.method } : {}),
      }),
    });
  let res = await post(true);
  // coluna ainda não criada (supabase/entradas.sql não rodado): grava o gasto sem a forma de pagamento
  if (res.status === 400 && e.method && (await res.clone().text()).includes('payment_method')) res = await post(false);
  if (res.status === 409) return false;
  if (!res.ok) throw new Error(`Supabase insert ${res.status}: ${await res.text()}`);
  return true;
}

export async function listExpensesSince(phone: string, since: Date): Promise<Expense[]> {
  const get = (select: string) =>
    rest(`expenses?${new URLSearchParams({ phone: `eq.${phone}`, created_at: `gte.${since.toISOString()}`, select, order: 'created_at.asc' })}`);
  let res = await get('id,phone,amount,category,description,payment_method,created_at');
  if (res.status === 400) res = await get('id,phone,amount,category,description,created_at'); // sem a coluna ainda
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

/** Corrige o gasto mais recente (valor, descrição e/ou categoria). Devolve como era e como ficou. */
export async function updateLastExpense(
  phone: string,
  patch: { amount?: number; description?: string; category?: string }
): Promise<{ before: Expense; after: Expense } | null> {
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
  const upd = await rest(`expenses?id=eq.${last.id}&phone=eq.${phone}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (!upd.ok) throw new Error(`Supabase update ${upd.status}: ${await upd.text()}`);
  const before = { ...last, amount: Number(last.amount) };
  return { before, after: { ...before, ...patch } };
}

/** Grava uma entrada de dinheiro. Retorna false se essa mensagem já tinha sido gravada. */
export async function insertIncome(i: { phone: string; amount: number; source: string; description: string; method?: string; waMessageId: string }): Promise<boolean> {
  const res = await rest('incomes', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      phone: i.phone,
      amount: i.amount,
      source: i.source,
      description: i.description,
      wa_message_id: i.waMessageId,
      ...(i.method ? { method: i.method } : {}),
    }),
  });
  if (res.status === 409) return false;
  if (!res.ok) throw new Error(`Supabase insert income ${res.status}: ${await res.text()}`);
  return true;
}

export async function listIncomesSince(phone: string, since: Date): Promise<Income[]> {
  const q = new URLSearchParams({
    phone: `eq.${phone}`,
    created_at: `gte.${since.toISOString()}`,
    select: 'id,phone,amount,source,description,method,created_at',
    order: 'created_at.asc',
  });
  const res = await rest(`incomes?${q}`);
  if (!res.ok) throw new Error(`Supabase select incomes ${res.status}: ${await res.text()}`);
  const rows = (await res.json()) as Income[];
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

/** Apaga a entrada mais recente da pessoa e devolve o que foi apagado. */
export async function deleteLastIncome(phone: string): Promise<Income | null> {
  const q = new URLSearchParams({ phone: `eq.${phone}`, select: 'id,phone,amount,source,description,method,created_at', order: 'created_at.desc', limit: '1' });
  const res = await rest(`incomes?${q}`);
  if (!res.ok) throw new Error(`Supabase select incomes ${res.status}: ${await res.text()}`);
  const [last] = (await res.json()) as Income[];
  if (!last) return null;
  const del = await rest(`incomes?id=eq.${last.id}&phone=eq.${phone}`, { method: 'DELETE' });
  if (!del.ok) throw new Error(`Supabase delete income ${del.status}: ${await del.text()}`);
  return { ...last, amount: Number(last.amount) };
}
