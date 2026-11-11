// Proteção do estado salvo no servidor (PUT /api/painel). Um aparelho novo, ou uma versão antiga do site guardada no
// celular, pode mandar um estado em branco: ele NÃO pode apagar um estado com dados. E toda troca que diminui os dados
// guarda o anterior numa cópia de segurança, para dar para recuperar.

import { pesoDoEstado, reducaoBrusca } from '../src/gs/pesoEstado.js';
import type { StateSnapshot } from './account/db.js';

export const CHAVE = 'grana-seria:v1';
export const BACKUPS = ['grana-seria:v1:backup1', 'grana-seria:v1:backup2', 'grana-seria:v1:backup3'] as const;

export function protegerEstado(antes: StateSnapshot, depois: StateSnapshot, agora = new Date(), permitirReducao = false): StateSnapshot {
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
  // queda brusca (menos da metade): é um aparelho com poucos dados passando por cima do completo, não a pessoa apagando.
  // Fica o que estava; só passa quando a pessoa pediu de propósito (importar ou restaurar um backup).
  if (!permitirReducao && velho && reducaoBrusca(pv, pn)) {
    out[CHAVE] = velho;
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

/** O servidor ficou com o estado que já tinha, em vez do que o aparelho mandou? (o aparelho então busca o da conta) */
export const foiMantido = (antes: StateSnapshot, pedido: StateSnapshot, salvo: StateSnapshot) => pedido[CHAVE] !== undefined && pedido[CHAVE] !== antes[CHAVE] && salvo[CHAVE] === antes[CHAVE];

/** As cópias de segurança guardadas, da mais nova para a mais antiga, para a tela de recuperar. */
export function listarCopias(state: StateSnapshot): { salvoEm: string; peso: number; estado: string }[] {
  const out: { salvoEm: string; peso: number; estado: string }[] = [];
  for (const k of BACKUPS) {
    try {
      const c = JSON.parse(state[k] ?? 'null') as { salvoEm?: string; peso?: number; estado?: string } | null;
      if (c && typeof c.estado === 'string' && pesoDoEstado(c.estado) > 0) out.push({ salvoEm: String(c.salvoEm ?? ''), peso: pesoDoEstado(c.estado), estado: c.estado });
    } catch { /* cópia ilegível: ignora */ }
  }
  return out;
}
