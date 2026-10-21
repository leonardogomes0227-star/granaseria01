// Mudança de dia/mês com o app aberto (spec v2, seção 12): as missões recorrentes (contas) recomeçam no mês novo
// e as telas que dependem da data se redesenham. Roda ao abrir e a cada minuto.

import { gravarMissoes, lerTodasMissoes, virarMesRecorrente } from '../missoes';
import { EVENTO } from './armazem';
import { todaySP } from '../coachChat/months';

/** Aplica a virada do mês nas missões recorrentes. Devolve se mudou algo. */
export function virarMissoes(hoje = todaySP()): boolean {
  const todas = lerTodasMissoes();
  const viradas = todas.map((m) => (m.deletedAt ? m : virarMesRecorrente(m, hoje)));
  if (!viradas.some((m, i) => m !== todas[i])) return false;
  gravarMissoes(viradas);
  return true;
}

let diaVisto = '';

/** Uma checagem: no dia novo, vira o mês das missões e avisa as telas. */
export function checarVirada(hoje = todaySP()) {
  if (hoje === diaVisto) return;
  const primeira = diaVisto === '';
  diaVisto = hoje;
  try {
    const mudou = virarMissoes(hoje);
    // quem lê a data na hora de desenhar (Início, Meu mês, Missões) se atualiza
    if (!primeira && !mudou) window.dispatchEvent(new CustomEvent(EVENTO, { detail: 'virada' }));
  } catch {
    // sem localStorage
  }
}
