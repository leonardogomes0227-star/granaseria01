// Tema claro (creme e dourado) ou escuro: escolha da pessoa, guardada no aparelho. O padrão é o claro (areia e dourado).
import { useSyncExternalStore } from 'react';

export type Tema = 'claro' | 'escuro';
// Chave nova: todo mundo volta ao claro (o padrão) e escolhe o escuro de novo em Perfil, se quiser.
const CHAVE = 'gs-tema-v3';
const ouvintes = new Set<() => void>();
// Visual único: areia, dourado e verde. O seletor de tema saiu do Perfil.
const ler = (): Tema => 'claro';
let atual: Tema = ler();

const aplicar = (t: Tema) => {
  if (typeof document === 'undefined') return;
  if (t === 'escuro') document.documentElement.dataset.tema = 'escuro';
  else delete document.documentElement.dataset.tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#14120E');
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
