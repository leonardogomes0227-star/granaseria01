// Tema escuro (grafite e dourado, como o painel de referência) ou claro (creme e dourado): escolha da pessoa, guardada no aparelho.
// O padrão é o escuro. O botão de sol e lua fica na barra do topo.
import { useSyncExternalStore } from 'react';

export type Tema = 'claro' | 'escuro';
// Chave nova: todo mundo entra no escuro (o padrão) e pode voltar ao claro no botão do topo.
const CHAVE = 'gs-tema-v4';
const ouvintes = new Set<() => void>();
const ler = (): Tema => {
  try { return localStorage.getItem(CHAVE) === 'claro' ? 'claro' : 'escuro'; } catch { return 'escuro'; }
};
let atual: Tema = ler();

const aplicar = (t: Tema) => {
  if (typeof document === 'undefined') return;
  if (t === 'escuro') document.documentElement.dataset.tema = 'escuro';
  else delete document.documentElement.dataset.tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'escuro' ? '#0C0B09' : '#F6F0E4');
};
aplicar(atual); // já no carregamento, para não piscar o tema errado

export function definirTema(t: Tema) {
  atual = t;
  try { localStorage.setItem(CHAVE, t); } catch { /* sem armazenamento: vale só nesta sessão */ }
  aplicar(t);
  ouvintes.forEach((f) => f());
}
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
export const useTema = (): Tema => useSyncExternalStore(assinar, () => atual, () => 'escuro');
