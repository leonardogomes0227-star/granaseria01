// Acesso ao Supabase pela API REST (PostgREST), só com fetch — sem SDK no servidor.
// Usa a service role key, que NUNCA vai pro navegador: só existe nas variáveis de ambiente da Vercel.
//
// O bot grava na mesma tabela "gastos" do site. A pessoa é identificada pelo telefone salvo no
// cadastro (profiles.telefone, formato 5567999999999).

export interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string; // yyyy-mm-dd (dia do gasto, horário de Brasília)
  created_at: string;
}

interface GastoRow {
  id: string;
  valor: number | string;
  categoria: string;
  descricao: string | null;
  data: string;
  criado_em: string;
}

const SELECT = 'id,valor,categoria,descricao,data,criado_em';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return fetch(`${env('SUPABASE_URL').replace(/\/$/, '')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

function toExpense(r: GastoRow): Expense {
  return {
    id: r.id,
    amount: Number(r.valor),
    category: r.categoria,
    description: r.descricao || r.categoria,
    date: r.data,
    created_at: r.criado_em,
  };
}

/** Dono do número (id do usuário), ou null se ninguém se cadastrou no site com esse WhatsApp. */
export async function findUserByPhone(phone: string): Promise<string | null> {
  const q = new URLSearchParams({ telefone: `eq.${phone}`, select: 'id', limit: '1' });
  const res = await rest(`profiles?${q}`);
  if (!res.ok) throw new Error(`Supabase select profiles ${res.status}: ${await res.text()}`);
  const [row] = (await res.json()) as { id: string }[];
  return row?.id ?? null;
}

/** Grava o gasto. Retorna false se essa mensagem já tinha sido gravada (a Meta às vezes reenvia). */
export async function insertExpense(e: {
  userId: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  waMessageId: string;
}): Promise<boolean> {
  const res = await rest('gastos', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: e.userId,
      valor: e.amount,
      categoria: e.category,
      descricao: e.description,
      data: e.date,
      origem: 'whatsapp',
      wa_message_id: e.waMessageId,
    }),
  });
  if (res.status === 409) return false;
  if (!res.ok) throw new Error(`Supabase insert ${res.status}: ${await res.text()}`);
  return true;
}

/** Gastos com data (dia do gasto) a partir de sinceDate (yyyy-mm-dd), do mais antigo pro mais novo. */
export async function listExpensesSince(userId: string, sinceDate: string): Promise<Expense[]> {
  const q = new URLSearchParams({
    user_id: `eq.${userId}`,
    data: `gte.${sinceDate}`,
    select: SELECT,
    order: 'data.asc,criado_em.asc',
  });
  const res = await rest(`gastos?${q}`);
  if (!res.ok) throw new Error(`Supabase select ${res.status}: ${await res.text()}`);
  return ((await res.json()) as GastoRow[]).map(toExpense);
}

/** Apaga o gasto registrado por último (no site ou no WhatsApp) e devolve o que foi apagado. */
export async function deleteLastExpense(userId: string): Promise<Expense | null> {
  const q = new URLSearchParams({
    user_id: `eq.${userId}`,
    select: SELECT,
    order: 'criado_em.desc',
    limit: '1',
  });
  const res = await rest(`gastos?${q}`);
  if (!res.ok) throw new Error(`Supabase select ${res.status}: ${await res.text()}`);
  const [last] = (await res.json()) as GastoRow[];
  if (!last) return null;
  const del = await rest(`gastos?id=eq.${last.id}&user_id=eq.${userId}`, { method: 'DELETE' });
  if (!del.ok) throw new Error(`Supabase delete ${del.status}: ${await del.text()}`);
  return toExpense(last);
}
