// "Mensagem da semana" (spec v2, 7.1 item 7): o agente principal comenta o progresso real, por regras.
// Sem IA: a primeira regra que bate vence, na ordem de quanto ela importa pra pessoa agora.

import { brl } from '../chat/engine';

export interface FatosDaSemana {
  guardadoMes: number;
  guardadoMesPassado: number;
  sequencia: number; // meses seguidos guardando
  estourou: boolean;
  passou: number;
  quaseLa?: { titulo: string; falta: number } | null; // missão com 80% ou mais
  cumpridas: number; // missões cumpridas no total
  temMissao: boolean;
  /** quando o agente principal cuida das dívidas, ele fala delas primeiro */
  dividas?: { pagoMes: number; falta: number } | null;
}

/** A frase, ou null quando não há nada de real pra comentar (aí entra a dica do agente). */
export function mensagemDaSemana(f: FatosDaSemana): string | null {
  if (f.estourou && f.passou > 0) return `O mês apertou: passou ${brl(f.passou)} do limite. Até o fim do mês, cada real conta.`;
  if (f.quaseLa && f.quaseLa.falta > 0) return `Falta só ${brl(f.quaseLa.falta)} pra ${f.quaseLa.titulo.toLowerCase()}. Dá pra ver a linha de chegada.`;
  if (f.dividas && f.dividas.falta > 0) {
    if (f.dividas.pagoMes > 0) return `Você já pagou ${brl(f.dividas.pagoMes)} das dívidas este mês. Uma de cada vez.`;
    return `Faltam ${brl(f.dividas.falta)} pra sair das dívidas. Uma parcela de cada vez.`;
  }
  const diferenca = f.guardadoMes - f.guardadoMesPassado;
  if (f.guardadoMesPassado > 0 && diferenca >= 10) return `Você guardou ${brl(diferenca)} a mais que no mês passado. Isso é Babilônia pura.`;
  if (f.sequencia >= 2) return `${f.sequencia} meses seguidos guardando. Mês a mês, a bolsa enche.`;
  if (f.guardadoMes > 0) return `Você já guardou ${brl(f.guardadoMes)} este mês. Primeiro você, depois o resto.`;
  if (f.cumpridas > 0) return f.cumpridas === 1 ? 'Uma missão já foi cumprida. A próxima fica mais fácil.' : `${f.cumpridas} missões cumpridas. A próxima fica mais fácil.`;
  if (f.temMissao) return 'Ainda não guardou nada este mês. Um pouco hoje já conta.';
  return null;
}
