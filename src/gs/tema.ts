// Visual único: branco areia e dourado.
import { useSyncExternalStore } from 'react';

export type Tema = 'claro' | 'escuro';
// Chave nova: todo mundo entra no escuro (o padrão) e pode voltar ao claro no botão do topo.
const CHAVE = 'gs-tema-v4';
const ouvintes = new Set<() => void>();
// Visual único: branco areia e dourado, sem preto. O tema escuro não é oferecido.
const ler = (): Tema => 'claro';
let atual: Tema = ler();

const aplicar = (t: Tema) => {
  if (typeof document === 'undefined') return;
  if (t === 'escuro') document.documentElement.dataset.tema = 'escuro';
  else delete document.documentElement.dataset.tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#F4EEE0');
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
