import { SYNC_KEYS, applySnapshot, snapshot } from './sync';
import { resetIfOld } from './reset';

// Painel ligado ao WhatsApp. O link pessoal que o bot manda (/painel?t=…) deixa o token neste navegador;
// com ele, o site lê e grava o mesmo estado que o bot usa (diagnóstico, plano, vazamentos, check-ins).
// Simples como o sync da conta: o estado inteiro vai num JSON só. Na primeira conexão, se os dois lados têm
// diagnósticos diferentes, a pessoa escolhe; depois disso, ganha a versão mais nova.

const TOKEN_KEY = 'gs-painel-token';
const NAME_KEY = 'gs-nome';
const AFTER_LOGIN_KEY = 'gs-depois-do-login'; // a ferramenta que a pessoa queria abrir antes de entrar
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

export const getName = () => read(NAME_KEY);
export const setName = (name: string) => write(NAME_KEY, name.trim().slice(0, 40));
export const rememberAfterLogin = (path: string) => write(AFTER_LOGIN_KEY, path);

/**
 * Chamado uma vez ao abrir o site, antes do roteador: o ?t= do link do WhatsApp vira login, some da barra de
 * endereço, e quem tinha tentado abrir uma ferramenta volta direto pra ela.
 */
export function captureLoginFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    const t = url.searchParams.get('t');
    if (!t || !/^[A-Za-z0-9_-]{20,64}$/.test(t)) return;
    if (t !== painelToken()) setPainelToken(t);
    url.searchParams.delete('t');
    let path = url.pathname + url.search + url.hash;
    const after = read(AFTER_LOGIN_KEY);
    if (after && (url.pathname === '/painel' || url.pathname === '/')) {
      path = after;
      write(AFTER_LOGIN_KEY, null);
    }
    window.history.replaceState(null, '', path);
    void siteEvent('site_login');
  } catch {
    // navegador sem URL/localStorage: segue sem login
  }
}

async function post(body: unknown): Promise<void> {
  const token = painelToken();
  if (!token) return;
  await fetch('/api/painel', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => undefined);
}

/** Registra no painel do dono o que a pessoa fez no site (ex.: "tool:site-debts"). */
export const siteEvent = (event: string) => post({ event });

/** 👍 / 👎 de uma ferramenta, com o texto opcional do 👎. */
export const sendFeedback = (tool: string, kind: 'up' | 'down', note?: string) => post({ feedback: { tool, kind, note } });

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
  // plano antigo vindo do servidor (antes do recomeço, src/reset.ts) também não volta
  const remote = onlySynced(resetIfOld(data.state).state);
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
  // fica o deste navegador, mas o que só existe lá (ex.: o nome guardado pelo WhatsApp) vem junto
  for (const [k, v] of Object.entries(remote)) if (local[k] === undefined) write(k, v);
  await push(true);
  return data;
}

const onVisible = () => {
  if (document.visibilityState === 'visible') void pullPainel().catch(() => undefined);
  else void push().catch(() => undefined);
};

/** Manda agora o que mudou aqui (antes de recarregar a página, pra o que foi apagado não voltar do servidor). */
export const pushNow = () => push(true).catch(() => undefined);

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
