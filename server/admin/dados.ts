// Painel do dono: alguém perdeu dados? Para cada conta, compara o que está salvo agora com a maior cópia de segurança
// guardada (server/protegerEstado.ts). Quem tem uma cópia com mais que o dobro do atual perdeu dados e dá para devolver.
// Puro, com teste: recebe os estados e devolve o resumo; a restauração devolve o estado novo, sem gravar nada.

import { pesoDoEstado, reducaoBrusca } from '../../src/gs/pesoEstado.js';
import { BACKUPS, CHAVE, listarCopias } from '../protegerEstado.js';
import type { StateSnapshot } from '../account/db.js';

export interface ContaGuardada { id: string; onde: 'whatsapp' | 'conta'; nome: string | null; rotulo: string; state: StateSnapshot; atualizadoEm: string | null }
export interface ContaQuePerdeu { id: string; onde: 'whatsapp' | 'conta'; nome: string | null; rotulo: string; atual: number; copia: number; copiaEm: string; atualizadoEm: string | null }
export interface AuditoriaDados { total: number; comDados: number; emBranco: number; comCopia: number; perderam: ContaQuePerdeu[] }

/** A maior cópia guardada que tem bem mais dados que o estado de agora (null: nada a recuperar). */
export function copiaARecuperar(state: StateSnapshot): { salvoEm: string; peso: number; estado: string } | null {
  const atual = pesoDoEstado(state[CHAVE]);
  const maior = listarCopias(state).sort((a, b) => b.peso - a.peso)[0];
  return maior && reducaoBrusca(maior.peso, atual) ? maior : null;
}

export function auditarDados(contas: ContaGuardada[]): AuditoriaDados {
  const perderam: ContaQuePerdeu[] = [];
  let comDados = 0, comCopia = 0;
  for (const c of contas) {
    const atual = pesoDoEstado(c.state[CHAVE]);
    if (atual > 0) comDados++;
    if (listarCopias(c.state).length > 0) comCopia++;
    const copia = copiaARecuperar(c.state);
    if (copia) perderam.push({ id: c.id, onde: c.onde, nome: c.nome, rotulo: c.rotulo, atual, copia: copia.peso, copiaEm: copia.salvoEm, atualizadoEm: c.atualizadoEm });
  }
  return { total: contas.length, comDados, emBranco: contas.length - comDados, comCopia, perderam: perderam.sort((a, b) => b.copia - b.atual - (a.copia - a.atual)) };
}

/** Devolve o estado com a maior cópia no lugar do atual. O atual não some: vira a cópia mais nova (dá para desfazer). */
export function restaurarMaiorCopia(state: StateSnapshot, agora = new Date()): StateSnapshot | null {
  const copia = copiaARecuperar(state);
  if (!copia) return null;
  const out: StateSnapshot = { ...state, [CHAVE]: copia.estado };
  const atual = state[CHAVE];
  if (pesoDoEstado(atual) > 0) {
    out[BACKUPS[2]] = state[BACKUPS[1]] ?? '';
    out[BACKUPS[1]] = state[BACKUPS[0]] ?? '';
    out[BACKUPS[0]] = JSON.stringify({ salvoEm: agora.toISOString(), peso: pesoDoEstado(atual), estado: atual });
    for (const k of BACKUPS) if (!out[k]) delete out[k];
  }
  return out;
}
