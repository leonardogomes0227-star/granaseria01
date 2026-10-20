// Recomeço do plano: o dono pediu pra zerar o que todo mundo já tinha feito (diagnóstico, plano, vazamentos,
// check-ins, metas e resultados das ferramentas) quando as contas do plano foram corrigidas.
// Ficam o nome e os gastos e entradas do WhatsApp (outra tabela). Vale no navegador, no painel e no bot:
// quem ainda não tem a marca do recomeço tem essas chaves apagadas uma vez.

export const RESET_KEY = 'gs-reset';
export const RESET_ID = '2026-10-plano-v2';
export const PLAN_KEYS = [
  'selos-wizard-progress',
  'selos-tracking',
  'selos-leaks',
  'selos-checkins',
  'selos-diagnosis-completed',
  'gs-resultados',
  'gs-metas',
  'gs-tarefas',
];

/** O estado já passou pelo recomeço? Se não, devolve uma cópia sem as chaves do plano e com a marca. */
export function resetIfOld<T extends Record<string, string>>(state: T): { state: T; changed: boolean } {
  if (state[RESET_KEY] === RESET_ID) return { state, changed: false };
  const next: Record<string, string> = { ...state };
  for (const k of PLAN_KEYS) delete next[k];
  next[RESET_KEY] = RESET_ID;
  return { state: next as T, changed: true };
}
