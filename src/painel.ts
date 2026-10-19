import { SYNC_KEYS, applySnapshot, snapshot } from './sync';

// Painel ligado ao WhatsApp. O link pessoal que o bot manda (/painel?t=…) deixa o token neste navegador;
// com ele, o site lê e grava o mesmo estado que o bot usa (diagnóstico, plano, vazamentos, check-ins).
// Simples como o sync da conta: o estado inteiro vai num JSON só. Na primeira conexão, se os dois lados têm
// diagnósticos diferentes, a pessoa escolhe; depois disso, ganha a versão mais nova.

const TOKEN_KEY = 'gs-painel-token';
const SEEN_KEY = 'gs-painel-seen'; // updatedAt da última versão do WhatsApp que este navegador viu/mandou

type Snapshot = Record<string, string>;

export interface PainelEntry {
  amount: number;
  created_at: string;
  description: string;
  method: string | null;
}
export interface PainelData {
  phone: string;
  state: Snapshot;
  updatedAt: string | null;
  month: { expenses: (PainelEntry & { category: string })[]; incomes: (PainelEntry & { source: string })[] };
}

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

export const painelToken = () => read(TOKEN_KEY);
export function setPainelToken(token: string) {
  write(TOKEN_KEY, token);
  write(SEEN_KEY, null);
}
export function clearPainelToken() {
  write(TOKEN_KEY, null);
  write(SEEN_KEY, null);
  stopPainelSync();
}

/** O que está guardado pelo número. null: sem link, ou link que não vale mais (aí o token é esquecido). */
export async function fetchPainel(): Promise<PainelData | null> {
  const token = painelToken();
  if (!token) return null;
  const res = await fetch('/api/painel', { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    clearPainelToken();
    return null;
  }
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as PainelData;
}

const onlySynced = (s: Snapshot) => Object.fromEntries(SYNC_KEYS.filter((k) => typeof s[k] === 'string').map((k) => [k, s[k]]));
const json = (s: Snapshot) => JSON.stringify(s, Object.keys(s).sort());
const diagOf = (s: Snapshot) => {
  try {
    return (JSON.parse(s['selos-wizard-progress'] ?? 'null') as { data?: { monthlyIncome?: number } } | null)?.data ?? null;
  } catch {
    return null;
  }
};

let timer: number | undefined;
let lastPushed = '';

async function push(force = false) {
  const token = painelToken();
  if (!token) return;
  const local = snapshot();
  const body = json(local);
  if (!force && body === lastPushed) return;
  // chave que sumiu daqui (ex.: refez o diagnóstico do zero) também some lá
  const state: Record<string, string | null> = Object.fromEntries(SYNC_KEYS.map((k) => [k, local[k] ?? null]));
  const res = await fetch('/api/painel', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ state }) });
  if (res.status === 401) return clearPainelToken();
  if (!res.ok) return;
  lastPushed = body;
  write(SEEN_KEY, ((await res.json()) as { updatedAt: string }).updatedAt);
}

/** Puxa a versão do WhatsApp; se ela ganhar, aplica e recarrega a página. Devolve os dados do painel. */
export async function pullPainel(): Promise<PainelData | null> {
  const data = await fetchPainel();
  if (!data) return null;
  const remote = onlySynced(data.state);
  const local = snapshot();
  if (json(remote) === json(local)) {
    lastPushed = json(local);
    if (data.updatedAt) write(SEEN_KEY, data.updatedAt);
    return data;
  }
  const seen = read(SEEN_KEY);
  const localDiag = diagOf(local);
  const remoteDiag = diagOf(remote);
  let useRemote: boolean;
  if (Object.keys(local).length === 0) useRemote = true;
  else if (!seen) {
    // primeira conexão neste navegador
    if (!remoteDiag) useRemote = false;
    else if (!localDiag) useRemote = true;
    else useRemote = window.confirm('Seu WhatsApp e este navegador têm diagnósticos diferentes. OK = usar o do WhatsApp · Cancelar = usar o deste navegador');
  } else {
    const unsent = lastPushed !== '' && json(local) !== lastPushed;
    useRemote = !unsent && !!data.updatedAt && data.updatedAt > seen;
  }
  if (useRemote) {
    applySnapshot(remote);
    if (data.updatedAt) write(SEEN_KEY, data.updatedAt);
    lastPushed = json(snapshot());
    window.location.reload();
    return data;
  }
  await push(true);
  return data;
}

const onVisible = () => {
  if (document.visibilityState === 'visible') void pullPainel().catch(() => undefined);
  else void push().catch(() => undefined);
};

/** Liga a sincronização com o WhatsApp neste navegador (só se ele tiver o link pessoal). */
export async function startPainelSync(): Promise<PainelData | null> {
  stopPainelSync();
  if (!painelToken()) return null;
  const data = await pullPainel();
  timer = window.setInterval(() => void push().catch(() => undefined), 4000);
  document.addEventListener('visibilitychange', onVisible);
  return data;
}

export function stopPainelSync() {
  if (timer) window.clearInterval(timer);
  timer = undefined;
  document.removeEventListener('visibilitychange', onVisible);
  lastPushed = '';
}
