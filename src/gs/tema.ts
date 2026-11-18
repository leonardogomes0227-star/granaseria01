// Tema claro (creme e dourado) ou escuro: escolha da pessoa, guardada no aparelho. O padrão é o claro.
import { useSyncExternalStore } from 'react';

export type Tema = 'claro' | 'escuro';
const CHAVE = 'gs-tema';
const ouvintes = new Set<() => void>();
const ler = (): Tema => { try { return localStorage.getItem(CHAVE) === 'escuro' ? 'escuro' : 'claro'; } catch { return 'claro'; } };
let atual: Tema = ler();

const aplicar = (t: Tema) => {
  if (typeof document === 'undefined') return;
  if (t === 'escuro') document.documentElement.dataset.tema = 'escuro';
  else delete document.documentElement.dataset.tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'escuro' ? '#07060A' : '#100E12');
};
aplicar(atual); // já no carregamento, para não piscar o tema errado

export function definirTema(t: Tema) {
  atual = t;
  try { localStorage.setItem(CHAVE, t); } catch { /* sem armazenamento: vale só nesta sessão */ }
  aplicar(t);
  ouvintes.forEach((f) => f());
}
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
export const useTema = (): Tema => useSyncExternalStore(assinar, () => atual, () => 'claro');
