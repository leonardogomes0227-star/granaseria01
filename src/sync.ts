import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { pesoDoEstado, quemFica } from './gs/pesoEstado';

// Sincroniza o que fica no navegador (diagnóstico, plano, vazamentos, check-ins) com a conta.
// Simples de propósito: o estado inteiro vai como um JSON só. Ganha a versão mais nova.
// O assistente do WhatsApp também escreve aqui (ex.: "paguei" fecha o mês do plano).

export const SYNC_KEYS = [
  'grana-seria:v1', // o app novo: renda, contas, gastos, dívidas, assistentes (src/gs/store.ts)
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
  'gs-guardado', // o que a pessoa separou no pague-se primeiro (src/bills.ts)
  'gs-plano-fora', // partes do plano que a pessoa tirou do plano (ActionPlanView)
  'gs-agentes', // os agentes que a pessoa escolheu ter no app (src/agents.ts)
  'gs-mes-feito', // o que já foi feito no mês, no plano (ActionPlanView)
  // spec v2 (docs/spec-v2.md): as entidades novas moram no mesmo estado, pro site e o WhatsApp lerem igual
  'gs-eu', // perfil: renda, dia do salário, agente principal, onboarding (src/eu.ts)
  'gs-missoes', // missões com passos e o que foi guardado/pago (src/missoes.ts)
  'gs-conversas', // conversas com os agentes (src/chat/store.ts)
  'gs-limites', // limite por categoria (Meu mês)
  'gs-selos-v2', // selos conquistados e a data (src/selos.ts)
  'gs-agentes-meta', // quando cada agente foi ativado, pausado, lembretes
];
const SYNCED_AT_KEY = 'selos-sync-at'; // updated_at da última versão que este aparelho viu/mandou

type Snapshot = Record<string, string>;

const CHAVE_APP = 'grana-seria:v1';
/** A pessoa pediu de propósito para trocar os dados por outros (importar ou restaurar um backup): vale uma vez. */
export const CHAVE_PERMITIR = 'gs-permitir-reducao';
/** Cópias guardadas NESTE aparelho logo antes de a sincronização trocar os dados daqui pelos da conta (até 3). */
export const CHAVE_COPIAS_LOCAIS = 'gs-copias-locais';
export interface CopiaDeDados { salvoEm: string; peso: number; estado: string }


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

export function lerCopiasLocais(): CopiaDeDados[] {
  try {
    const l = JSON.parse(read(CHAVE_COPIAS_LOCAIS) ?? '[]') as CopiaDeDados[];
    return Array.isArray(l) ? l.filter((c) => c && typeof c.estado === 'string') : [];
  } catch {
    return [];
  }
}
/** Guarda o estado deste aparelho antes de ele ser trocado. Sem dados, ou igual à última cópia, não guarda. */
export function guardarCopiaLocal(estado: string | null | undefined, agora = new Date()) {
  const peso = pesoDoEstado(estado);
  if (!estado || peso === 0) return;
  const antes = lerCopiasLocais();
  if (antes[0]?.estado === estado) return;
  const novas = [{ salvoEm: agora.toISOString(), peso, estado }, ...antes].slice(0, 3);
  write(CHAVE_COPIAS_LOCAIS, JSON.stringify(novas));
  // sem espaço para 3: fica pelo menos a mais nova
  if (read(CHAVE_COPIAS_LOCAIS) === null) write(CHAVE_COPIAS_LOCAIS, JSON.stringify(novas.slice(0, 1)));
}

export function applySnapshot(s: Snapshot) {
  guardarCopiaLocal(read(CHAVE_APP));
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
    write(CHAVE_PERMITIR, null);
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
  // dados nunca são trocados por (quase) nada: em branco ou com menos da metade perde sem perguntar (src/gs/pesoEstado.ts)
  const pl = pesoDoEstado(local[CHAVE_APP]);
  const pr = pesoDoEstado(remote[CHAVE_APP]);
  const regra = read(CHAVE_PERMITIR) === '1' ? 'local' : quemFica(pl, pr, !seenAt);
  const useRemote =
    regra === 'remoto' ? true
    : regra === 'local' ? false
    : regra === 'perguntar' ? window.confirm(`Achei dados seus em dois lugares.\n\nNa sua conta: ${pr} registros.\nNeste aparelho: ${pl} registros.\n\nOK = usar os da sua conta · Cancelar = usar os deste aparelho`)
    : localEmpty ||
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

/** "Apagar tudo": remove a cópia da conta de e-mail e sai. true = não sobrou cópia (ou não há conta). */
export async function apagarCopiaDaConta(): Promise<boolean> {
  if (!supabase) return true;
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) return true;
  stopSync();
  const { error } = await supabase.from('user_state').delete().eq('user_id', id);
  if (error) return false;
  await supabase.auth.signOut();
  return true;
}

/** "Limpar tudo": esvazia a cópia guardada na conta de e-mail, mas mantém a conta e a sessão. */
export async function limparCopiaDaConta(): Promise<boolean> {
  if (!supabase) return true;
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) return true;
  const { error } = await supabase.from('user_state').update({ state: {}, updated_at: new Date().toISOString() }).eq('user_id', id);
  return !error;
}

/** Ao sair da conta, os dados continuam neste aparelho — quem quiser limpar usa "apagar meus dados". */
export function clearLocalData() {
  // as cópias locais saem junto: quem limpa ou apaga tudo não deixa nada para trás neste aparelho
  for (const k of [...SYNC_KEYS, SYNCED_AT_KEY, CHAVE_COPIAS_LOCAIS, CHAVE_PERMITIR]) write(k, null);
}
