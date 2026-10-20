// Estado do coach neste navegador + sincronização com o Supabase (api/coach.ts).
// Sem login, tudo fica só aqui e funciona igual; com login (link do WhatsApp), cada mudança também vai pro servidor,
// e ao abrir o site o que está no servidor vence (a pessoa continua de onde parou em qualquer aparelho).

import { useEffect, useSyncExternalStore } from 'react';
import { painelToken } from '../painel';
import type { CoachId } from './coaches';
import type { HistoryEntry } from './engine';
import type { Aporte, Plan } from './plan';
import { currentMonth } from './months';

const KEY = 'gs-coach';

export interface CoachData {
  coach: CoachId | null;
  chats: Record<string, HistoryEntry[]>;
  plano: Plan | null;
  respostas: Record<string, number | string> | null;
  aportes: Aporte[];
}

export interface CoachView extends CoachData {
  status: 'loading' | 'ready' | 'offline'; // offline: sem login ou tabelas fora do ar; segue só neste navegador
}

const EMPTY: CoachData = { coach: null, chats: {}, plano: null, respostas: null, aportes: [] };

function readLocal(): CoachData {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<CoachData> | null;
    if (!v) return { ...EMPTY };
    // nunca mês futuro, mesmo que algo antigo tenha ficado guardado
    const now = currentMonth();
    return { ...EMPTY, ...v, aportes: (v.aportes ?? []).filter((a) => a.mes <= now) };
  } catch {
    return { ...EMPTY };
  }
}
function writeLocal(d: CoachData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // segue sem salvar neste navegador
  }
}

let view: CoachView = { ...readLocal(), status: painelToken() ? 'loading' : 'offline' };
const listeners = new Set<() => void>();
const set = (next: CoachView) => {
  view = next;
  const { status: _s, ...data } = next;
  void _s;
  writeLocal(data);
  listeners.forEach((l) => l());
};

async function call(method: 'GET' | 'POST', body?: unknown): Promise<Response | null> {
  const token = painelToken();
  if (!token) return null;
  try {
    return await fetch('/api/coach', { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch {
    return null;
  }
}
const post = (body: unknown) => void call('POST', body);

interface Remote {
  coach: CoachId | null;
  chats: Record<string, HistoryEntry[]>;
  plano: Plan | null;
  aportes: Aporte[];
}

let loading: Promise<void> | null = null;
/** Lê o servidor uma vez por abertura do site e junta com o que já estava aqui. */
export function loadCoach(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    const res = await call('GET');
    if (!res || !res.ok) {
      set({ ...view, status: 'offline' });
      return;
    }
    const remote = (await res.json()) as Remote;
    const local = view;
    const aportes = new Map<string, Aporte>();
    for (const a of local.aportes) aportes.set(a.mes, a);
    for (const a of remote.aportes) aportes.set(a.mes, a);
    const merged: CoachView = {
      coach: remote.coach ?? local.coach,
      chats: { ...local.chats, ...remote.chats },
      plano: remote.plano ?? local.plano,
      respostas: local.respostas,
      aportes: [...aportes.values()].sort((a, b) => a.mes.localeCompare(b.mes)),
      status: 'ready',
    };
    set(merged);
    // o que só existia neste navegador (feito antes do login) sobe pro servidor
    if (!remote.coach && merged.coach) post({ action: 'coach', coach: merged.coach });
    if (!remote.plano && merged.plano) post({ action: 'plano', plano: merged.plano, respostas: merged.respostas ?? {} });
    for (const a of local.aportes) if (!remote.aportes.some((r) => r.mes === a.mes)) post({ action: 'aporte', mes: a.mes, valor: a.valor });
  })().catch(() => set({ ...view, status: 'offline' }));
  return loading;
}

export const coachActions = {
  setCoach(coach: CoachId) {
    set({ ...view, coach });
    post({ action: 'coach', coach });
  },
  saveChat(script: string, history: HistoryEntry[]) {
    set({ ...view, chats: { ...view.chats, [script]: history } });
    post({ action: 'chat', script, history });
  },
  savePlano(plano: Plan, respostas: Record<string, number | string>) {
    set({ ...view, plano, respostas });
    post({ action: 'plano', plano, respostas });
  },
  saveAporte(mes: string, valor: number) {
    if (mes > currentMonth()) return; // nunca mês futuro
    const rest = view.aportes.filter((a) => a.mes !== mes);
    set({ ...view, aportes: [...rest, { mes, valor, origem: 'site' as const }].sort((a, b) => a.mes.localeCompare(b.mes)) });
    post({ action: 'aporte', mes, valor });
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useCoach(): CoachView {
  const v = useSyncExternalStore(subscribe, () => view);
  useEffect(() => {
    void loadCoach();
  }, []);
  return v;
}
