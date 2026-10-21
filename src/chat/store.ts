// As conversas com os agentes (spec v2, "conversas" e "conversa_respostas"): uma por agente e roteiro, guardada no
// estado sincronizado ('gs-conversas'). O progresso é salvo a cada resposta, então dá pra sair e voltar dias depois.
// Editar uma resposta corta a lista ali (as de ordem maior saem); recomeçar zera a lista, e a missão antiga continua
// valendo até a nova conversa terminar.

import { gravarJSON, lerJSON } from '../lib/armazem';
import type { AgenteId, RespostaDada } from './engine';

export const CONVERSAS_KEY = 'gs-conversas';

export type StatusConversa = 'em_andamento' | 'concluida' | 'abandonada';

export interface Conversa {
  id: string; // `${agente}:${roteiro}`
  agente: AgenteId;
  roteiro: string;
  status: StatusConversa;
  respostas: RespostaDada[];
  missoes?: string[]; // as missões que esta conversa criou
  createdAt: string;
  updatedAt: string;
  concluidaEm?: string | null;
}

export const conversaId = (agente: AgenteId, roteiro: string) => `${agente}:${roteiro}`;

export function lerConversas(): Record<string, Conversa> {
  const v = lerJSON<Record<string, Conversa>>(CONVERSAS_KEY, {});
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

export const lerConversa = (id: string): Conversa | null => lerConversas()[id] ?? null;

function gravar(all: Record<string, Conversa>) {
  gravarJSON(CONVERSAS_KEY, all);
}

/** Salva as respostas (a cada resposta nova ou editada). */
export function salvarRespostas(agente: AgenteId, roteiro: string, respostas: RespostaDada[]): Conversa {
  const all = lerConversas();
  const id = conversaId(agente, roteiro);
  const agora = new Date().toISOString();
  const antes = all[id];
  const c: Conversa = {
    id,
    agente,
    roteiro,
    // mudou qualquer resposta: a conversa volta a andar (a missão antiga segue valendo até o novo fim)
    status: antes?.status === 'concluida' && JSON.stringify(respostas) === JSON.stringify(antes.respostas) ? 'concluida' : 'em_andamento',
    respostas,
    missoes: antes?.missoes,
    createdAt: antes?.createdAt ?? agora,
    updatedAt: agora,
    concluidaEm: antes?.concluidaEm ?? null,
  };
  all[id] = c;
  gravar(all);
  return c;
}

export function concluirConversa(id: string, missoes: string[]): void {
  const all = lerConversas();
  const c = all[id];
  if (!c) return;
  const agora = new Date().toISOString();
  all[id] = { ...c, status: 'concluida', missoes, updatedAt: agora, concluidaEm: agora };
  gravar(all);
}

/** Recomeçar: as respostas saem; a missão que já existe continua valendo. */
export function recomecarConversa(id: string): Conversa | null {
  const all = lerConversas();
  const c = all[id];
  if (!c) return null;
  all[id] = { ...c, respostas: [], status: 'em_andamento', updatedAt: new Date().toISOString() };
  gravar(all);
  return all[id];
}

/** Apaga a conversa (as missões continuam). Devolve a conversa apagada, pro "Desfazer". */
export function apagarConversa(id: string): Conversa | null {
  const all = lerConversas();
  const c = all[id] ?? null;
  if (!c) return null;
  delete all[id];
  gravar(all);
  return c;
}

export function restaurarConversa(c: Conversa) {
  const all = lerConversas();
  all[c.id] = c;
  gravar(all);
}
