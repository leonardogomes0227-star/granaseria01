import { supabase } from './supabase';

export interface Gasto {
  id: string;
  user_id: string;
  valor: number;
  categoria: string;
  descricao: string | null;
  data: string; // yyyy-mm-dd
  origem: string;
  criado_em: string;
}

// Mesmas categorias do assistente do WhatsApp (server/whatsapp/parse.ts), pra os dois lados baterem.
export const CATEGORIAS = [
  { name: 'Alimentação', emoji: '🍽️' },
  { name: 'Transporte', emoji: '🚗' },
  { name: 'Moradia', emoji: '🏠' },
  { name: 'Saúde', emoji: '💊' },
  { name: 'Lazer', emoji: '🎉' },
  { name: 'Compras', emoji: '🛍️' },
  { name: 'Educação', emoji: '📚' },
  { name: 'Outros', emoji: '📌' },
] as const;

export function categoriaEmoji(name: string): string {
  return CATEGORIAS.find((c) => c.name === name)?.emoji ?? '📌';
}

/** Data local (não UTC) no formato do Postgres: yyyy-mm-dd. */
export function localISODate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthRange(d = new Date()): { start: string; end: string } {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: localISODate(start), end: localISODate(end) };
}

/** valor numeric pode voltar como string do PostgREST — normaliza pra number. */
function normalize(row: Record<string, unknown>): Gasto {
  return { ...(row as unknown as Gasto), valor: Number(row.valor) };
}

export async function fetchGastosDoMes(userId: string, ref = new Date()): Promise<Gasto[]> {
  const { start, end } = monthRange(ref);
  const { data, error } = await supabase
    .from('gastos')
    .select('id, user_id, valor, categoria, descricao, data, origem, criado_em')
    .eq('user_id', userId)
    .gte('data', start)
    .lte('data', end)
    .order('data', { ascending: false })
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

export async function addGasto(
  userId: string,
  g: { valor: number; categoria: string; descricao: string; data: string }
): Promise<Gasto> {
  const { data, error } = await supabase
    .from('gastos')
    .insert({
      user_id: userId,
      valor: g.valor,
      categoria: g.categoria,
      descricao: g.descricao.trim() || null,
      data: g.data,
      origem: 'site',
    })
    .select('id, user_id, valor, categoria, descricao, data, origem, criado_em')
    .single();
  if (error) throw error;
  return normalize(data as Record<string, unknown>);
}
