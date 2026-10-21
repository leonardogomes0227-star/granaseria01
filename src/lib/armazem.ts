// Leitura e gravação das chaves do estado sincronizado (localStorage → src/sync.ts e src/painel.ts levam pro
// servidor e pro WhatsApp). Toda gravação avisa a tela com o evento 'gs-dados', pra quem estiver usando atualizar.

import { useEffect, useState } from 'react';

export const EVENTO = 'gs-dados';

export function lerJSON<T>(key: string, padrao: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return padrao;
    const v = JSON.parse(raw) as T;
    return v ?? padrao;
  } catch {
    return padrao;
  }
}

export function gravarJSON(key: string, valor: unknown | null): void {
  try {
    if (valor === null || valor === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(valor));
  } catch {
    // segue sem salvar neste navegador
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: key }));
  } catch {
    // fora do navegador (testes)
  }
}

/** Lê uma chave e acompanha as mudanças (desta aba, de outra aba e as que chegam do servidor). */
export function useArmazem<T>(ler: () => T): T {
  const [v, setV] = useState(ler);
  useEffect(() => {
    const on = () => setV(ler());
    window.addEventListener(EVENTO, on);
    window.addEventListener('storage', on);
    window.addEventListener('gs-contas', on);
    window.addEventListener('gs-agentes', on);
    window.addEventListener('gs-tarefas', on);
    // o painel puxa o estado do servidor a cada visita: relê quando a aba volta
    document.addEventListener('visibilitychange', on);
    return () => {
      window.removeEventListener(EVENTO, on);
      window.removeEventListener('storage', on);
      window.removeEventListener('gs-contas', on);
      window.removeEventListener('gs-agentes', on);
      window.removeEventListener('gs-tarefas', on);
      document.removeEventListener('visibilitychange', on);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ler é estável por chamada
  }, []);
  return v;
}

/** Id curto e único o bastante pra itens do estado. */
export const novoId = (prefixo: string) => `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
