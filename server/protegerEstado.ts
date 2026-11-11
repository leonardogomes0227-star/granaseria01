// Proteção do estado salvo no servidor (PUT /api/painel). Um aparelho novo, ou uma versão antiga do site guardada no
// celular, pode mandar um estado em branco: ele NÃO pode apagar um estado com dados. E toda troca que diminui os dados
// guarda o anterior numa cópia de segurança, para dar para recuperar.

import { pesoDoEstado } from '../src/gs/pesoEstado.js';
import type { StateSnapshot } from './account/db.js';

export const CHAVE = 'grana-seria:v1';
export const BACKUPS = ['grana-seria:v1:backup1', 'grana-seria:v1:backup2', 'grana-seria:v1:backup3'] as const;

export function protegerEstado(antes: StateSnapshot, depois: StateSnapshot, agora = new Date()): StateSnapshot {
  const velho = antes[CHAVE];
  const novo = depois[CHAVE];
  const pv = pesoDoEstado(velho);
  const pn = pesoDoEstado(novo);
  const out: StateSnapshot = { ...depois };
  for (const k of BACKUPS) if (antes[k] !== undefined && out[k] === undefined) out[k] = antes[k];
  if (pv > 0 && pn === 0) {
    out[CHAVE] = velho!; // em branco não substitui o que tem dados
    return out;
  }
  if (velho && novo !== velho && pn < pv) {
    // guarda o anterior (até 3 cópias, a mais nova primeiro), com a data
    const copia = JSON.stringify({ salvoEm: agora.toISOString(), peso: pv, estado: velho });
    out[BACKUPS[2]] = out[BACKUPS[1]] ?? '';
    out[BACKUPS[1]] = out[BACKUPS[0]] ?? '';
    out[BACKUPS[0]] = copia;
    for (const k of BACKUPS) if (!out[k]) delete out[k];
  }
  return out;
}
