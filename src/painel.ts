import { CHAVE_PERMITIR, SYNC_KEYS, applySnapshot, guardarCopiaLocal, snapshot, type CopiaDeDados } from './sync';
import { pesoDoEstado, quemFica } from './gs/pesoEstado';
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
  id?: number; // pra editar e apagar pelo site (api/lancamentos.ts)
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

/** "Apagar tudo": pede ao servidor pra apagar a cópia ligada ao número. true = não sobrou cópia (ou nunca houve). */
/** "Limpar tudo": esvazia o que está guardado pelo número, mas mantém o link de acesso (a pessoa segue conectada). */
export async function limparCopiaDoNumero(): Promise<boolean> {
  const token = painelToken();
  if (!token) return true;
  const res = await fetch('/api/painel?manter=1', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!res) return false;
  if (res.status === 401) {
    clearPainelToken(); // o link já não valia
    return true;
  }
  return res.ok;
}

export async function apagarCopiaDoNumero(): Promise<boolean> {
  const token = painelToken();
  if (!token) return true;
  const res = await fetch('/api/painel', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!res || (!res.ok && res.status !== 401)) return false; // 401: o link já não vale, não há o que apagar por ele
  clearPainelToken();
  return true;
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
let buscandoPorMantido = false;

async function push(force = false) {
  const token = painelToken();
  if (!token) return;
  const local = snapshot();
  const body = json(local);
  if (!force && body === lastPushed) return;
  // nunca manda um estado em branco antes de ter falado com o servidor (o aparelho novo ainda não buscou os dados)
  if (!read(SEEN_KEY) && pesoDoEstado(local['grana-seria:v1']) === 0) return;
  // chave que sumiu daqui (ex.: refez o diagnóstico do zero) também some lá
  const state: Record<string, string | null> = Object.fromEntries(SYNC_KEYS.map((k) => [k, local[k] ?? null]));
  const permitirReducao = read(CHAVE_PERMITIR) === '1';
  const res = await fetch('/api/painel', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ state, permitirReducao }) });
  if (res.status === 401) return clearPainelToken();
  if (!res.ok) return;
  const j = (await res.json()) as { updatedAt: string; mantido?: boolean };
  if (j.mantido) {
    // a conta tem bem mais dados que este aparelho e o servidor ficou com os dela: busca em vez de insistir
    lastPushed = body;
    if (!buscandoPorMantido) {
      buscandoPorMantido = true;
      try { await pullPainel(); } finally { buscandoPorMantido = false; }
    }
    return;
  }
  if (permitirReducao) write(CHAVE_PERMITIR, null);
  lastPushed = body;
  write(SEEN_KEY, j.updatedAt);
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
  const pesoLocal = pesoDoEstado(local['grana-seria:v1']);
  const pesoRemoto = pesoDoEstado(remote['grana-seria:v1']);
  // regra de ouro: dados nunca são trocados por (quase) nada. Em branco perde sempre; quem tem menos da metade perde sem
  // perguntar (o celular com meia dúzia de registros não passa por cima do computador completo, nem o contrário).
  const regra = read(CHAVE_PERMITIR) === '1' ? 'local' : quemFica(pesoLocal, pesoRemoto, !seen);
  if (regra === 'local') useRemote = false;
  else if (regra === 'remoto' || Object.keys(local).length === 0) useRemote = true;
  else if (!seen) {
    // primeira conexão neste navegador, com dados dos dois lados: a pessoa escolhe, vendo quanto tem em cada um
    if (pesoLocal > 0 && pesoRemoto > 0 && json(remote) !== json(local)) {
      useRemote = window.confirm(`Achei dados seus em dois lugares.\n\nNa sua conta: ${pesoRemoto} registros.\nNeste aparelho: ${pesoLocal} registros.\n\nOK = usar os da sua conta · Cancelar = usar os deste aparelho`);
    } else if (!remoteDiag) useRemote = false;
    // primeira conexão neste navegador
    else if (!localDiag) useRemote = true;
    else useRemote = window.confirm('Seu WhatsApp e este navegador têm diagnósticos diferentes. OK = usar o do WhatsApp · Cancelar = usar o deste navegador');
  } else {
    const unsent = lastPushed !== '' && json(local) !== lastPushed;
    useRemote = !unsent && !!data.updatedAt && data.updatedAt > seen;
  }
  if (useRemote) {
    applySnapshot(remote); // guarda antes uma cópia do que estava neste aparelho (src/sync.ts)
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

/** As cópias de segurança guardadas na conta (o servidor guarda o estado anterior sempre que os dados diminuem). */
export async function buscarCopias(): Promise<CopiaDeDados[]> {
  const token = painelToken();
  if (!token) return [];
  const res = await fetch('/api/painel?copias=1', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!res?.ok) return [];
  const j = (await res.json().catch(() => ({}))) as { copias?: CopiaDeDados[] };
  return Array.isArray(j.copias) ? j.copias : [];
}

/** Volta para uma cópia: o que está agora neste aparelho fica guardado como cópia local, e a escolhida sobe para a conta. */
export async function restaurarCopia(estado: string): Promise<void> {
  guardarCopiaLocal(read('grana-seria:v1'));
  write('grana-seria:v1', estado);
  write(CHAVE_PERMITIR, '1');
  await pushNow();
}
