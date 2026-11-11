// Store central: um único objeto no localStorage ('grana-seria:v1'), com versão, migração e leitura segura.
// Os componentes leem com useEstado(seletor); quem muda usa as ações (sempre validam e salvam na hora).

import { useSyncExternalStore } from 'react';
import { ESTADO_INICIAL, SCHEMA_VERSION, type Estado } from './tipos';
import { migrar } from './migracao';

export const STORE_KEY = 'grana-seria:v1';

let estado: Estado | null = null;
/** O texto exato que este app gravou por último. Se o que está guardado for outro, alguém de fora gravou (a sincronização
 *  trazendo os dados da conta, ou "restaurar cópia"): a memória está velha e NÃO pode ser gravada por cima. */
let ultimoGravado: string | null = null;
const lerBruto = (): string | null => { try { return localStorage.getItem(STORE_KEY); } catch { return null; } };
const ouvintes = new Set<() => void>();

function ler(): Estado {
  try {
    const bruto = localStorage.getItem(STORE_KEY);
    if (bruto) return migrar(JSON.parse(bruto));
  } catch {
    // dado quebrado ou sem localStorage: segue do zero
  }
  try {
    return migrar(null, lerLegado());
  } catch {
    return ESTADO_INICIAL();
  }
}

/** Dados do app antigo (chaves gs-*), lidos uma vez pra migrar. */
function lerLegado(): Record<string, string | null> {
  const chaves = ['gs-nome', 'gs-eu', 'gs-contas', 'gs-guardado', 'gs-agentes', 'gs-missoes'];
  const out: Record<string, string | null> = {};
  for (const k of chaves) out[k] = localStorage.getItem(k);
  return out;
}

export function getEstado(): Estado {
  if (!estado) {
    estado = ler();
    persistir(estado, false);
  }
  return estado;
}

function persistir(e: Estado, avisar = true) {
  try {
    const bruto = JSON.stringify(e);
    localStorage.setItem(STORE_KEY, bruto);
    ultimoGravado = bruto;
    espelharParaOBot(e);
  } catch {
    // sem espaço ou sem localStorage: o app segue com o estado em memória
  }
  if (avisar) ouvintes.forEach((f) => f());
}

/** O WhatsApp lê as contas e o guardado nas chaves antigas: mantém uma cópia só de leitura (uma via). */
function espelharParaOBot(e: Estado) {
  const contas = e.gastosFixos.map((g) => ({
    id: g.id,
    name: g.nome,
    amount: g.valor,
    dueDay: g.diaVencimento,
    startMonth: Object.keys(g.pagamentos).sort()[0] ?? new Date().toISOString().slice(0, 7),
    payments: Object.entries(g.pagamentos).map(([month, p]) => ({ month, paidOn: p.pagoEm, amount: p.valorPago })),
  }));
  const guardado = e.aportes.filter((a) => a.valor > 0).map((a) => ({ on: a.data, amount: a.valor }));
  localStorage.setItem('gs-contas', JSON.stringify(contas));
  localStorage.setItem('gs-guardado', JSON.stringify(guardado));
  if (e.config.nome) localStorage.setItem('gs-nome', e.config.nome);
}

/** Muda o estado com uma função pura e salva. */
export function atualizar(fn: (e: Estado) => Estado): Estado {
  // os dados guardados mudaram por fora desde a última gravação: parte deles, nunca da memória velha.
  // (Era assim que um aparelho devolvia o estado antigo por cima do que tinha acabado de chegar da conta.)
  if (estado && ultimoGravado !== null && lerBruto() !== ultimoGravado) estado = null;
  const prox = fn(getEstado());
  estado = { ...prox, schemaVersion: SCHEMA_VERSION };
  persistir(estado);
  return estado;
}

export function substituir(novo: unknown): Estado {
  estado = migrar(novo);
  persistir(estado);
  return estado;
}

export function apagarTudo() {
  estado = ESTADO_INICIAL();
  persistir(estado);
}

function assinar(f: () => void) {
  ouvintes.add(f);
  const outraAba = (ev: StorageEvent) => {
    if (ev.key === STORE_KEY) {
      estado = null;
      f();
    }
  };
  window.addEventListener('storage', outraAba);
  return () => {
    ouvintes.delete(f);
    window.removeEventListener('storage', outraAba);
  };
}

/** O estado inteiro (re-renderiza quando muda). Derive com seletores puros, com useMemo. */
export function useEstado(): Estado {
  return useSyncExternalStore(assinar, getEstado, getEstado);
}

/** Só pra teste. */
export function _resetarMemoria() {
  estado = null;
}
