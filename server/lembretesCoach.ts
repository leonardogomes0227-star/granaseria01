// A volta combinada com o Coach ("daqui a 7 dias eu te pergunto como foi") também chega pelo WhatsApp,
// para quem ligou os lembretes. Usa o mesmo modelo aprovado pela Meta do lembrete do plano (um texto, sem quebra de linha).

import { migrar } from '../src/gs/migracao.js';
import type { StateSnapshot } from './account/db.js';

const sem = (t: string) => t.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

/** O texto do combinado que vence hoje, ou null. Só o que a pessoa combinou com o Coach e ainda não resolveu. */
export function combinadoParaHoje(state: StateSnapshot, hojeISO: string): string | null {
  let bruto: unknown = null;
  try {
    bruto = state['grana-seria:v1'] ? JSON.parse(state['grana-seria:v1']) : null;
  } catch {
    return null;
  }
  if (!bruto) return null;
  const hoje = migrar(bruto).caminho.passos.filter((p) => p.origem === 'coach' && p.lembrarEm === hojeISO && !p.feitoEm);
  if (hoje.length === 0) return null;
  const titulos = hoje.map((p) => sem(p.titulo)).slice(0, 2).join('; ');
  return sem(`Combinamos de conversar hoje: ${titulos}. Como foi? Abra o seu caminho no app e marque como resolvido, ou me conte aqui.`).slice(0, 300);
}
