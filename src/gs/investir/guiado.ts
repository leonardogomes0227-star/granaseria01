// Modo guiado: respostas prontas, com os números do app, quando o chat inteligente não está configurado.

import { brl0 } from '../datas';
import { patrimonioGuardado, reservaMeta, livreParaGastar } from '../selectores';
import { totalDividas } from '../dividas';
import { prioridadeAntesDeInvestir } from './calculos';
import { lerCdiMensal } from '../mercadoCache';
import type { Estado } from '../tipos';

export const PERGUNTAS_RAPIDAS = ['Quanto devo investir por mês?', 'Onde colocar minha reserva?', 'Quero arriscar um pouco', 'O que é mercado futuro?'];

export function respostaGuiada(pergunta: string, e: Estado, mes: string): string {
  const p = pergunta.toLowerCase();
  const prio = prioridadeAntesDeInvestir(e, mes, lerCdiMensal());
  const renda = e.config.renda;
  if (p.includes('quanto')) {
    const base = Math.round((e.investir.aporteMensalPlanejado ?? renda * 0.1) || 0);
    return renda > 0 ? `Comece por 10% da renda: cerca de ${brl0(renda * 0.1)} por mês${base && base !== Math.round(renda * 0.1) ? ` (você planejou ${brl0(base)})` : ''}. ${prio.passo === 'investir' ? 'Sua reserva está pronta, então esse valor pode ir pra investimentos.' : prio.frase + ' Abra o Meu caminho pra ver o próximo passo.'}` : 'Informe sua renda em Meus dados e eu calculo. A regra de partida é guardar ao menos 10% do que entra.';
  }
  if (p.includes('reserva')) return `Reserva fica em liquidez diária (poupança, Tesouro Selic ou CDB com liquidez diária), porque você precisa do dinheiro rápido e sem susto. A sua meta é ${brl0(reservaMeta(e, mes))} (6 meses de gastos) e você tem ${brl0(patrimonioGuardado(e))}. Confira as regras vigentes de cada produto.`;
  if (p.includes('arriscar')) return `Dá pra arriscar um pouco, com regra: só dinheiro que você pode perder, nunca com dívida ou reserva, e uma parcela pequena (referência educativa: até 5% a 10% do que você investe). ${totalDividas(e.dividas) > 0 ? 'Você tem dívidas abertas, então quitar vem antes.' : ''} Treine antes na aba Treinar, sem dinheiro de verdade.`;
  if (p.includes('futuro') || p.includes('day trade')) return 'Mercado futuro é apostar na direção de um preço com alavancagem: um movimento pequeno vira ganho ou perda grande, e dá pra perder mais do que colocou. Estudos com dados da B3 indicam que a grande maioria de quem faz day trade em futuros perde dinheiro. Treine na aba Treinar, sem risco.';
  if (p.includes('onde')) return `${prio.frase} ${prio.detalhe}`;
  return `${prio.frase} ${livreParaGastar(e, mes) > 0 ? `Você tem ${brl0(livreParaGastar(e, mes))} livres este mês.` : ''} Escolha uma pergunta rápida abaixo ou abra o Meu caminho. Conteúdo educativo, não é recomendação de investimento.`;
}
