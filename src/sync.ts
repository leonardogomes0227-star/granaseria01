import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Sincroniza o que fica no navegador (diagnóstico, plano, vazamentos, check-ins) com a conta.
// Simples de propósito: o estado inteiro vai como um JSON só. Ganha a versão mais nova.
// O assistente do WhatsApp também escreve aqui (ex.: "paguei" fecha o mês do plano).

export const SYNC_KEYS = [
  'selos-wizard-progress',
  'selos-tracking',
  'selos-leaks',
  'selos-checkins',
  'selos-diagnosis-completed',
  'gs-nome', // o nome que a pessoa dá ao entrar (login obrigatório nas ferramentas)
  'gs-resultados', // o que cada ferramenta deixou salvo (src/results.ts)
  'gs-metas', // metas da calculadora de meta, que entram no plano
  'gs-reset', // marca do recomeço do plano (src/reset.ts)
  'gs-perfil', // respostas das perguntas da entrada (src/profile.ts)
  'gs-tarefas', // próximos passos do coach (src/coach.ts)
  'gs-contas', // minhas contas e dívidas (src/bills.ts)
  'gs-conselheiros', // conselheiros que a pessoa criou (src/agents.ts)
];
const SYNCED_AT_KEY = 'selos-sync-at'; // updated_at da última versão que este aparelho viu/mandou

type Snapshot = Record<string, string>;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // segue sem persistir
  }
}

export function snapshot(): Snapshot {
  const s: Snapshot = {};
  for (const k of SYNC_KEYS) {
    const v = read(k);
    if (v !== null) s[k] = v;
  }
  return s;
}

export function applySnapshot(s: Snapshot) {
  for (const k of SYNC_KEYS) write(k, s[k] ?? null);
}

const same = (a: Snapshot, b: Snapshot) => JSON.stringify(a, Object.keys(a).sort()) === JSON.stringify(b, Object.keys(b).sort());

let timer: number | undefined;
let lastPushed = '';
let userId: string | null = null;

async function push(force = false) {
  if (!supabase || !userId) return;
  const snap = snapshot();
  const json = JSON.stringify(snap);
  if (!force && json === lastPushed) return;
  const updated_at = new Date().toISOString();
  const { error } = await supabase.from('user_state').upsert({ user_id: userId, state: snap, updated_at });
  if (!error) {
    lastPushed = json;
    write(SYNCED_AT_KEY, updated_at);
  }
}

/** Puxa a versão da conta. Se ela for mais nova que a deste aparelho, aplica e recarrega a página. */
async function pull(): Promise<void> {
  if (!supabase || !userId) return;
  const { data, error } = await supabase.from('user_state').select('state, updated_at').eq('user_id', userId).maybeSingle();
  if (error) return;
  const local = snapshot();
  if (!data) {
    await push(true);
    return;
  }
  const remote = (data.state ?? {}) as Snapshot;
  if (same(local, remote)) {
    lastPushed = JSON.stringify(local);
    write(SYNCED_AT_KEY, data.updated_at);
    return;
  }
  const seenAt = read(SYNCED_AT_KEY);
  const localEmpty = Object.keys(local).length === 0;
  const unsent = JSON.stringify(local) !== lastPushed && lastPushed !== '';
  // primeiro login neste aparelho, com dados aqui e na conta: a pessoa escolhe qual fica
  const useRemote =
    localEmpty ||
    (!seenAt
      ? window.confirm('Sua conta já tem dados salvos de outro aparelho. OK = usar os da conta · Cancelar = manter os deste aparelho')
      : !unsent && data.updated_at > seenAt);
  if (useRemote) {
    applySnapshot(remote);
    write(SYNCED_AT_KEY, data.updated_at);
    lastPushed = JSON.stringify(snapshot());
    window.location.reload();
    return;
  }
  await push(true);
}

const onVisible = () => {
  if (document.visibilityState === 'visible') void pull();
  else void push();
};

export async function startSync(session: Session | null) {
  stopSync();
  if (!supabase || !session) return;
  userId = session.user.id;
  await pull();
  timer = window.setInterval(() => void push(), 4000);
  document.addEventListener('visibilitychange', onVisible);
}

export function stopSync() {
  if (timer) window.clearInterval(timer);
  timer = undefined;
  document.removeEventListener('visibilitychange', onVisible);
  userId = null;
  lastPushed = '';
}

/** Ao sair da conta, os dados continuam neste aparelho — quem quiser limpar usa "apagar meus dados". */
export function clearLocalData() {
  for (const k of [...SYNC_KEYS, SYNCED_AT_KEY]) write(k, null);
}
