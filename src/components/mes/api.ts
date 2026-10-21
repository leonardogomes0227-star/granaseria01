// Lançamentos pelo site (api/lancamentos.ts): listar um mês, anotar, editar, apagar e desfazer.
// Login = o token do link do WhatsApp (painelToken). As mensagens de erro são as do servidor, ou uma gentil.

import { painelToken } from '../../painel';
import { todaySP } from '../../coachChat/months';
import type { Lancamento } from '../../lib/anotar';

export class ErroLancamento extends Error {
  status: number;
  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.status = status;
  }
}

async function chamar<T>(metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE', corpo?: unknown, busca = ''): Promise<T> {
  const token = painelToken();
  if (!token) throw new ErroLancamento('Entre pelo link do WhatsApp para anotar.', 401);
  let res: Response;
  try {
    res = await fetch(`/api/lancamentos${busca}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
      ...(corpo ? { body: JSON.stringify(corpo) } : {}),
    });
  } catch {
    throw new ErroLancamento('Sem conexão agora. Confira a internet e tente de novo.', 0);
  }
  const dados = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ErroLancamento(typeof dados.error === 'string' && dados.error ? dados.error : 'Não consegui agora. Tente de novo em instantes.', res.status);
  return dados;
}

const valido = (e: Partial<Lancamento>): e is Lancamento =>
  typeof e.id === 'number' && (e.kind === 'out' || e.kind === 'in') && typeof e.amount === 'number' && typeof e.created_at === 'string';

/** Os lançamentos de um mês ('AAAA-MM'), do mais novo pro mais velho. */
export async function listarMes(mes: string): Promise<Lancamento[]> {
  const r = await chamar<{ entries?: Partial<Lancamento>[] }>('GET', undefined, `?mes=${encodeURIComponent(mes)}`);
  return (r.entries ?? [])
    .filter(valido)
    .map((e) => ({ ...e, amount: Number(e.amount), category: e.category || 'Outros', description: e.description ?? '', method: e.method ?? null }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export interface NovoLancamento {
  kind: 'out' | 'in';
  amount: number;
  category: string;
  description: string;
  method?: string | null;
  date: string; // 'AAAA-MM-DD' (hoje ou antes)
  missaoId?: string;
}

export async function anotar(n: NovoLancamento): Promise<Lancamento> {
  const r = await chamar<{ entry: Lancamento }>('POST', { ...n, method: n.method ?? undefined });
  return r.entry;
}

export async function editar(kind: 'out' | 'in', id: number, patch: { amount?: number; category?: string; description?: string; date?: string }): Promise<void> {
  await chamar('PATCH', { kind, id, ...patch });
}

/** Apaga (soft delete quando o banco já tem a coluna). soft=false: não dá pra restaurar, só anotar de novo. */
export async function apagar(kind: 'out' | 'in', id: number): Promise<{ soft: boolean }> {
  const r = await chamar<{ soft?: boolean }>('DELETE', { kind, id });
  return { soft: r.soft !== false };
}

/** Desfaz o apagar. Quando o banco não deixa (sem soft delete), anota de novo com os mesmos dados. */
export async function restaurar(l: Lancamento): Promise<void> {
  try {
    await chamar('POST', { action: 'restaurar', kind: l.kind, id: l.id });
  } catch (err) {
    if (!(err instanceof ErroLancamento) || err.status !== 409) throw err;
    await anotar({ kind: l.kind, amount: l.amount, category: l.category, description: l.description, method: l.method, date: todaySP(new Date(l.created_at)) });
  }
}
