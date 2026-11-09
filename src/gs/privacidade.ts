// Ocultar valores: preferência do aparelho (localStorage), sem ir pro servidor.
import { useSyncExternalStore } from 'react';

const CHAVE = 'gs-ocultar-valores';
const ouvintes = new Set<() => void>();
const ler = () => { try { return localStorage.getItem(CHAVE) === '1'; } catch { return false; } };
let oculto = ler();

export const definirOculto = (v: boolean) => {
  oculto = v;
  try { localStorage.setItem(CHAVE, v ? '1' : '0'); } catch { /* sem armazenamento: vale só nesta sessão */ }
  ouvintes.forEach((f) => f());
};
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
export const useOculto = () => useSyncExternalStore(assinar, () => oculto, () => false);
/** Texto do valor, ou pontinhos quando a pessoa pediu pra esconder. */
export const mascarar = (texto: string, escondido: boolean) => (escondido ? 'R$ ••••' : texto);
