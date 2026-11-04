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

/* ---------- a reserva como um jogo: fases até a meta, cada uma com o que ela protege e quando chega ---------- */
export interface Fase {
  n: number;
  nome: string;
  meses: number; // meses de gasto que essa fase cobre
  alvo: number; // quanto precisa ter guardado
  porque: string; // o que essa fase te protege
  feita: boolean;
  quando: string | null; // 'AAAA-MM' previsto no ritmo de agora (null se já feita ou sem ritmo)
}
export interface Jogo {
  fases: Fase[];
  nivel: number; // fases feitas
  proxima: Fase | null;
  falta: number; // pra próxima fase
  pct: number; // progresso dentro da fase atual (0 a 100)
}
const somaMesesStr = (mes: string, n: number) => {
  const [y, m] = mes.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};

export function jogoDaReserva(e: Estado, mes: string): Jogo {
  const gasto = gastoMensalMedio(e, mes);
  const metaMeses = e.config.reservaMeses ?? 6;
  const guardado = Math.max(0, patrimonioGuardado(e));
  const plano = planoMensalReserva(e);
  const base: [number, string, string][] = [
    [0.25, 'Escudo de 1 semana', 'Um imprevisto pequeno (conserto, remédio, uma conta que veio alta) não vira dívida.'],
    [1, '1 mês de fôlego', 'Se a renda falhar um mês, as contas continuam pagas.'],
    [3, '3 meses de calma', 'Tempo pra resolver um problema grande sem pânico e sem empréstimo.'],
    [6, '6 meses de segurança', 'Dá pra procurar outro trabalho com calma se perder o emprego.'],
    [12, '1 ano de liberdade', 'Pra quem é autônomo ou tem renda que varia: um ano inteiro coberto.'],
  ];
  const escolhidas = base.filter(([m]) => m < metaMeses);
  const final = base.find(([m]) => m === metaMeses) ?? [metaMeses, `${metaMeses} meses`, 'A sua meta.'];
  const fases = [...escolhidas, final].map(([meses, nome, porque], i) => {
    const alvo = arred(gasto * meses);
    const feita = gasto > 0 && guardado >= alvo;
    const m = feita ? null : mesesParaMeta(alvo - guardado, plano);
    return { n: i + 1, nome: i === escolhidas.length ? `Reserva completa: ${nome.toLowerCase()}` : nome, meses, alvo, porque, feita, quando: m === null ? null : somaMesesStr(mes, m) };
  });
  const nivel = fases.filter((f) => f.feita).length;
  const proxima = fases.find((f) => !f.feita) ?? null;
  const anterior = nivel > 0 ? fases[nivel - 1].alvo : 0;
  const falta = proxima ? Math.max(0, arred(proxima.alvo - guardado)) : 0;
  const pct = proxima && proxima.alvo > anterior ? Math.min(100, Math.max(0, ((guardado - anterior) / (proxima.alvo - anterior)) * 100)) : 100;
  return { fases, nivel, proxima, falta, pct };
}
