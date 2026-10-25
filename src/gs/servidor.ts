// Lançamentos do WhatsApp (api/lancamentos): entram no app uma vez cada, e apagar aqui apaga lá (com desfazer).

import { useEffect } from 'react';
import { painelToken } from '../painel';
import { importarDoServidor } from './acoes';
import { mesAtual, somaMes } from './datas';

const cab = (): HeadersInit => ({ Authorization: `Bearer ${painelToken() ?? ''}`, 'Content-Type': 'application/json' });

export async function buscarMes(mes: string) {
  if (!painelToken()) return;
  try {
    const r = await fetch(`/api/lancamentos?mes=${mes}`, { headers: cab() });
    if (!r.ok) return;
    const j = (await r.json()) as { entries?: Parameters<typeof importarDoServidor>[0] };
    if (Array.isArray(j.entries)) importarDoServidor(j.entries);
  } catch {
    // sem rede: o app segue com o que tem
  }
}

/** Ao abrir o app (e ao voltar pra aba), traz o mês atual e o anterior. */
export function useImportarServidor() {
  useEffect(() => {
    const rodar = () => {
      const m = mesAtual();
      void buscarMes(m);
      void buscarMes(somaMes(m, -1));
    };
    rodar();
    const aoVoltar = () => document.visibilityState === 'visible' && rodar();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, []);
}

export function apagarNoServidor(serverId: number) {
  if (!painelToken()) return;
  void fetch('/api/lancamentos', { method: 'DELETE', headers: cab(), body: JSON.stringify({ kind: 'out', id: serverId }) }).catch(() => undefined);
}
export function restaurarNoServidor(serverId: number) {
  if (!painelToken()) return;
  void fetch('/api/lancamentos', { method: 'POST', headers: cab(), body: JSON.stringify({ action: 'restaurar', kind: 'out', id: serverId }) }).catch(() => undefined);
}
