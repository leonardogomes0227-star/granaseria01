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
  origem?: 'site' | 'whatsapp' | null; // só depois de supabase/fundacao.sql
}

export interface Income {
  id: number;
  phone: string;
  amount: number;
  source: string;
  description: string;
  method?: string | null;
  created_at: string;
  origem?: 'site' | 'whatsapp' | null; // só depois de supabase/fundacao.sql
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

/* ---------- apagar com "Desfazer" (soft delete, spec v2 seção 8) ----------
 * supabase/fundacao.sql cria deleted_at, origem, missao_id e updated_at em expenses e incomes. Enquanto ele não roda,
 * tudo funciona como antes (apagar é DELETE de verdade). Depois, apagar só marca deleted_at e todo select ignora as
 * linhas marcadas. A detecção é por tabela: "sim" fica guardado; "não" é conferido de novo a cada 5 minutos.
 */
type EntryTable = 'expenses' | 'incomes';
const softSeen = new Map<EntryTable, { on: boolean; at: number }>();

export async function hasSoftDelete(table: EntryTable): Promise<boolean> {
  const seen = softSeen.get(table);
  if (seen && (seen.on || Date.now() - seen.at < 5 * 60 * 1000)) return seen.on;
  const res = await rest(`${table}?select=deleted_at&limit=1`).catch(() => null);
  const on = Boolean(res?.ok);
  softSeen.set(table, { on, at: Date.now() });
  return on;
}

/** O filtro "não apagado" pra juntar nos selects (vazio enquanto a coluna não existe). */
async function alive(table: EntryTable): Promise<Record<string, string>> {
  return (await hasSoftDelete(table)) ? { deleted_at: 'is.null' } : {};
}

/** Apaga uma linha: marca deleted_at quando dá (pra poder desfazer), senão DELETE. */
async function removeRow(table: EntryTable, phone: string, id: number): Promise<{ soft: boolean }> {
  const soft = await hasSoftDelete(table);
  const res = soft
    ? await rest(`${table}?id=eq.${id}&phone=eq.${phone}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ deleted_at: new Date().toISOString() }) })
    : await rest(`${table}?id=eq.${id}&phone=eq.${phone}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Supabase delete ${table} ${res.status}: ${await res.text()}`);
  return { soft };
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
    alive('expenses').then((a) => rest(`expenses?${new URLSearchParams({ phone: `eq.${phone}`, created_at: `gte.${since.toISOString()}`, ...a, select, order: 'created_at.asc' })}`));
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
    ...(await alive('expenses')),
    select: 'id,phone,amount,category,description,created_at',
    order: 'created_at.desc',
    limit: '1',
  });
  const res = await rest(`expenses?${q}`);
  if (!res.ok) throw new Error(`Supabase select ${res.status}: ${await res.text()}`);
  const [last] = (await res.json()) as Expense[];
  if (!last) return null;
  await removeRow('expenses', phone, last.id);
  return { ...last, amount: Number(last.amount) };
}

/** Corrige o gasto mais recente (valor, descrição e/ou categoria). Devolve como era e como ficou. */
export async function updateLastExpense(
  phone: string,
  patch: { amount?: number; description?: string; category?: string }
): Promise<{ before: Expense; after: Expense } | null> {
  const q = new URLSearchParams({
    phone: `eq.${phone}`,
    ...(await alive('expenses')),
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
    ...(await alive('incomes')),
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
  const q = new URLSearchParams({ phone: `eq.${phone}`, ...(await alive('incomes')), select: 'id,phone,amount,source,description,method,created_at', order: 'created_at.desc', limit: '1' });
  const res = await rest(`incomes?${q}`);
  if (!res.ok) throw new Error(`Supabase select incomes ${res.status}: ${await res.text()}`);
  const [last] = (await res.json()) as Income[];
  if (!last) return null;
  await removeRow('incomes', phone, last.id);
  return { ...last, amount: Number(last.amount) };
}

/* ---------- lançamentos pelo site (spec v2, 7.2 e 8): listar, anotar, editar, apagar e desfazer ---------- */

export type EntryKind = 'out' | 'in';
const tableOf = (kind: EntryKind): EntryTable => (kind === 'out' ? 'expenses' : 'incomes');

export interface SiteEntry {
  id: number;
  kind: EntryKind;
  amount: number;
  category: string; // gasto: categoria · entrada: de onde veio
  description: string;
  method: string | null;
  created_at: string;
  origem: 'site' | 'whatsapp';
}

/** Gastos e entradas de um intervalo, com id e origem (o site precisa do id pra editar e apagar). */
export async function listEntriesBetween(phone: string, from: Date, to: Date): Promise<SiteEntry[]> {
  const range = (extra: Record<string, string>, select: string, table: EntryTable) =>
    rest(`${table}?${new URLSearchParams({ phone: `eq.${phone}`, and: `(created_at.gte.${from.toISOString()},created_at.lt.${to.toISOString()})`, ...extra, select, order: 'created_at.desc' })}`);
  const soft = { out: await hasSoftDelete('expenses'), in: await hasSoftDelete('incomes') };
  const ex = await range(soft.out ? { deleted_at: 'is.null' } : {}, `id,amount,category,description,payment_method,created_at${soft.out ? ',origem' : ''}`, 'expenses');
  const exRes = ex.ok ? ex : await range(soft.out ? { deleted_at: 'is.null' } : {}, `id,amount,category,description,created_at${soft.out ? ',origem' : ''}`, 'expenses');
  if (!exRes.ok) throw new Error(`Supabase select ${exRes.status}: ${await exRes.text()}`);
  const inc = await range(soft.in ? { deleted_at: 'is.null' } : {}, `id,amount,source,description,method,created_at${soft.in ? ',origem' : ''}`, 'incomes');
  const exRows = (await exRes.json()) as (Expense & { origem?: string })[];
  const inRows = inc.ok ? ((await inc.json()) as (Income & { origem?: string })[]) : [];
  return [
    ...exRows.map((r) => ({ id: r.id, kind: 'out' as const, amount: Number(r.amount), category: r.category, description: r.description, method: r.payment_method ?? null, created_at: r.created_at, origem: r.origem === 'site' ? ('site' as const) : ('whatsapp' as const) })),
    ...inRows.map((r) => ({ id: r.id, kind: 'in' as const, amount: Number(r.amount), category: r.source, description: r.description, method: r.method ?? null, created_at: r.created_at, origem: r.origem === 'site' ? ('site' as const) : ('whatsapp' as const) })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Anota pelo site. Devolve o lançamento gravado (com id). */
export async function insertSiteEntry(
  phone: string,
  e: { kind: EntryKind; amount: number; category: string; description: string; method?: string | null; createdAt: string; missaoId?: string | null }
): Promise<SiteEntry> {
  const table = tableOf(e.kind);
  const soft = await hasSoftDelete(table);
  const base: Record<string, unknown> = {
    phone,
    amount: e.amount,
    description: e.description,
    created_at: e.createdAt,
    ...(e.kind === 'out' ? { category: e.category } : { source: e.category }),
    ...(soft ? { origem: 'site', ...(e.missaoId ? { missao_id: e.missaoId } : {}) } : {}),
  };
  const post = (withMethod: boolean) =>
    rest(table, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ ...base, ...(withMethod && e.method ? { [e.kind === 'out' ? 'payment_method' : 'method']: e.method } : {}) }),
    });
  let res = await post(true);
  if (res.status === 400 && e.method) res = await post(false); // coluna da forma de pagamento ainda não criada
  if (!res.ok) throw new Error(`Supabase insert ${table} ${res.status}: ${await res.text()}`);
  const [row] = (await res.json()) as Record<string, unknown>[];
  return {
    id: Number(row.id),
    kind: e.kind,
    amount: Number(row.amount),
    category: String(e.kind === 'out' ? row.category : row.source),
    description: String(row.description ?? ''),
    method: (row.payment_method ?? row.method ?? null) as string | null,
    created_at: String(row.created_at),
    origem: 'site',
  };
}

/** Corrige um lançamento (de qualquer origem) pelo id. */
export async function updateEntry(phone: string, kind: EntryKind, id: number, patch: { amount?: number; category?: string; description?: string; createdAt?: string }): Promise<void> {
  const table = tableOf(kind);
  const body: Record<string, unknown> = {};
  if (patch.amount !== undefined) body.amount = patch.amount;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.createdAt !== undefined) body.created_at = patch.createdAt;
  if (patch.category !== undefined) body[kind === 'out' ? 'category' : 'source'] = patch.category;
  if (await hasSoftDelete(table)) body.updated_at = new Date().toISOString();
  const res = await rest(`${table}?id=eq.${id}&phone=eq.${phone}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Supabase update ${table} ${res.status}: ${await res.text()}`);
}

/** Apaga pelo id. soft=true: dá pra desfazer com restoreEntry. */
export const deleteEntry = (phone: string, kind: EntryKind, id: number) => removeRow(tableOf(kind), phone, id);

/** Desfaz o apagar (só quando o apagar foi soft). */
export async function restoreEntry(phone: string, kind: EntryKind, id: number): Promise<boolean> {
  const table = tableOf(kind);
  if (!(await hasSoftDelete(table))) return false;
  const res = await rest(`${table}?id=eq.${id}&phone=eq.${phone}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ deleted_at: null }) });
  if (!res.ok) throw new Error(`Supabase restore ${table} ${res.status}: ${await res.text()}`);
  return true;
}
