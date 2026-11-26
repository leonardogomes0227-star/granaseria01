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

export type TipoLancamento = 'out' | 'in';

export function apagarNoServidor(serverId: number, kind: TipoLancamento = 'out') {
  if (!painelToken()) return;
  void fetch('/api/lancamentos', { method: 'DELETE', headers: cab(), body: JSON.stringify({ kind, id: serverId }) }).catch(() => undefined);
}
export function restaurarNoServidor(serverId: number, kind: TipoLancamento = 'out') {
  if (!painelToken()) return;
  void fetch('/api/lancamentos', { method: 'POST', headers: cab(), body: JSON.stringify({ action: 'restaurar', kind, id: serverId }) }).catch(() => undefined);
}

export interface DadosLancamento { valor: number; categoria: string; descricao: string; data: string; forma?: string }

/** O que a pessoa anota no site também vai para o WhatsApp: é a mesma tabela, então o "mês" do bot soma tudo. Devolve o id lá, ou null. */
export async function enviarAoServidor(kind: TipoLancamento, d: DadosLancamento): Promise<number | null> {
  if (!painelToken()) return null;
  try {
    const r = await fetch('/api/lancamentos', { method: 'POST', headers: cab(), body: JSON.stringify({ kind, amount: d.valor, category: d.categoria, description: d.descricao, date: d.data, method: d.forma }) });
    if (!r.ok) return null;
    const j = (await r.json()) as { entry?: { id?: number } };
    return typeof j.entry?.id === 'number' ? j.entry.id : null;
  } catch {
    return null; // sem rede: fica só no site, e continua valendo lá
  }
}

export function editarNoServidor(kind: TipoLancamento, serverId: number, d: Partial<DadosLancamento>) {
  if (!painelToken()) return;
  const corpo: Record<string, unknown> = { kind, id: serverId };
  if (d.valor !== undefined) corpo.amount = d.valor;
  if (d.categoria !== undefined) corpo.category = d.categoria;
  if (d.descricao !== undefined) corpo.description = d.descricao;
  if (d.data !== undefined) corpo.date = d.data;
  void fetch('/api/lancamentos', { method: 'PATCH', headers: cab(), body: JSON.stringify(corpo) }).catch(() => undefined);
}
