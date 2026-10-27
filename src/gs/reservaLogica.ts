// Lógica da reserva de emergência: meses de proteção, meta do mês, o que fazer agora e conquistas. Pura, com teste.

import { arred, brl0, diasEntre, vencimentoNoMes } from './datas';
import { gastoMensalMedio, guardadoNoMes, patrimonioGuardado, reservaMeta } from './selectores';
import { maiorJuroMensal } from './dividas';
import type { Estado } from './tipos';

export const MESES_RESERVA = [3, 6, 12] as const;

export const mesesProtegido = (e: Estado, mes: string) => {
  const gasto = gastoMensalMedio(e, mes);
  return gasto > 0 ? Math.max(0, patrimonioGuardado(e)) / gasto : 0;
};

/** Quanto a pessoa pretende guardar por mês: o que ela escolheu, senão o percentual da renda. */
export const planoMensalReserva = (e: Estado) => (e.config.reservaMensal && e.config.reservaMensal > 0 ? e.config.reservaMensal : Math.round((e.config.renda * e.config.reservaPct) / 100));

const anterior = (m: string) => {
  const [a, n] = m.split('-').map(Number);
  return n === 1 ? `${a - 1}-12` : `${a}-${String(n - 1).padStart(2, '0')}`;
};
/** Meses seguidos em que guardou alguma coisa. O mês atual ainda em aberto não quebra a sequência. */
export function mesesGuardando(e: Estado, mes: string): number {
  const guardou = (m: string) => guardadoNoMes(e, m) > 0;
  let m = guardou(mes) ? mes : anterior(mes);
  let n = 0;
  while (n < 120 && guardou(m)) {
    n++;
    m = anterior(m);
  }
  return n;
}

export interface AcaoReserva {
  tipo: 'sem-dados' | 'completa' | 'comecar' | 'faltam' | 'cumprida' | 'divida';
  texto: string;
  valor: number;
}
export function acaoReserva(e: Estado, mes: string, hoje: string): AcaoReserva {
  const meta = reservaMeta(e, mes);
  if (meta <= 0) return { tipo: 'sem-dados', texto: 'Cadastre suas contas fixas e anote seus gastos. Com eles eu calculo a sua meta.', valor: 0 };
  const guardado = patrimonioGuardado(e);
  if (guardado >= meta) return { tipo: 'completa', texto: 'Reserva completa. Agora é só manter.', valor: 0 };
  const plano = planoMensalReserva(e);
  const feito = guardadoNoMes(e, mes);
  if (maiorJuroMensal(e.dividas) >= 3 && mesesProtegido(e, mes) >= 1)
    return { tipo: 'divida', texto: 'Você já tem 1 mês de segurança e uma dívida com juro alto. Pagar a dívida rende mais do que guardar.', valor: 0 };
  if (feito <= 0) {
    const dia = e.config.diaSalario;
    const quando = dia ? (diasEntre(hoje, vencimentoNoMes(mes, dia)) > 0 ? `O salário cai dia ${dia}: separe ${brl0(plano)} antes de gastar.` : `Guarde ${brl0(plano)} agora, antes de gastar o resto do salário.`) : `Guarde ${brl0(plano)} agora, antes de gastar o resto.`;
    return { tipo: 'comecar', texto: quando, valor: plano };
  }
  if (plano > 0 && feito < plano - 0.005) return { tipo: 'faltam', texto: `Faltam ${brl0(plano - feito)} pra bater a meta do mês.`, valor: arred(plano - feito) };
  return { tipo: 'cumprida', texto: `Meta do mês cumprida: você guardou ${brl0(feito)}.`, valor: 0 };
}

export interface ConquistaReserva {
  id: string;
  nome: string;
  feita: boolean;
}
export function conquistasReserva(protegido: number, sequencia: number, completa: boolean): ConquistaReserva[] {
  return [
    { id: 'sem', nome: '1 semana de segurança', feita: protegido >= 0.25 },
    { id: 'm1', nome: '1 mês protegido', feita: protegido >= 1 },
    { id: 'm3', nome: '3 meses protegido', feita: protegido >= 3 },
    { id: 's3', nome: '3 meses guardando', feita: sequencia >= 3 },
    { id: 'm6', nome: '6 meses protegido', feita: protegido >= 6 },
    { id: 'ok', nome: 'Reserva completa', feita: completa },
  ];
}

/** Em quantos meses a meta é atingida guardando `porMes`. Nulo se não dá pra saber. */
export function mesesParaMeta(falta: number, porMes: number): number | null {
  if (falta <= 0) return 0;
  return porMes > 0 ? Math.ceil(falta / porMes) : null;
}
