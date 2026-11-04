// Dinheiro extra: o efeito de cada parte, o histórico e as conquistas. Pura, com teste.

import { arred, brl0, mesCurto } from './datas';
import { gastoMensalMedio, patrimonioGuardado, reservaMeta } from './selectores';
import { situacaoAtrasos, type Atraso } from './atrasosLogica';
import { jogoDaReserva } from './reservaLogica';
import { saldoAtual } from './dividas';
import { ordenar, simular, type DividaSim } from './dividas';
import type { Estado, Estrategia } from './tipos';

export interface RegistroExtra {
  data: string;
  origem: string;
  valor: number;
  divida: number;
  reserva: number;
  lazer: number;
}

export function lerHistorico(bruto: unknown): RegistroExtra[] {
  try {
    const v = JSON.parse(String(bruto ?? '[]')) as RegistroExtra[];
    return Array.isArray(v) ? v.filter((r) => r && typeof r.data === 'string' && Number(r.valor) > 0).slice(-12) : [];
  } catch {
    return [];
  }
}
export const guardarHistorico = (h: RegistroExtra[], novo: RegistroExtra) => JSON.stringify([...h, novo].slice(-12));
export const totalComDestino = (h: RegistroExtra[]) => arred(h.reduce((t, r) => t + r.valor, 0));

/** O que abater `valor` das dívidas (na ordem da estratégia) muda: meses e juros a menos. */
export function efeitoNaDivida(ds: DividaSim[], pagamento: number, estrategia: Estrategia, valor: number): { meses: number; economia: number } | null {
  if (ds.length === 0 || valor <= 0) return null;
  const antes = simular(ds, pagamento, estrategia);
  let resta = valor;
  const depoisDs = ordenar(ds, estrategia).map((d) => {
    const abate = Math.min(resta, d.saldo);
    resta -= abate;
    return { ...d, saldo: arred(d.saldo - abate) };
  }).filter((d) => d.saldo > 0);
  if (!antes.quita) return null;
  const depois = depoisDs.length ? simular(depoisDs, pagamento, estrategia) : { meses: 0, totalJuros: 0, quita: true };
  if (!depois.quita) return null;
  return { meses: antes.meses - depois.meses, economia: arred(antes.totalJuros - depois.totalJuros) };
}

export const mesesDeProtecao = (valor: number, gastoMensal: number) => (gastoMensal > 0 ? valor / gastoMensal : 0);

export function conquistasExtras(h: RegistroExtra[]): string[] {
  const c: string[] = [];
  if (h.length >= 1) c.push('Primeiro extra com destino');
  if (h.length >= 3) c.push('3 extras com destino');
  if (totalComDestino(h) >= 1000) c.push('R$ 1.000 bem usados');
  return c;
}

/* ---------- o rumo do dinheiro extra: em cascata, do que mais pesa pro que pode render ---------- */
export const JURO_CARO = 1.5; // % ao mês: acima disso, a dívida cobra mais do que a renda fixa rende

export type TipoDestino = 'atraso' | 'separar-atraso' | 'divida' | 'reserva' | 'investir' | 'voce';
export interface Destino {
  tipo: TipoDestino;
  titulo: string;
  valor: number;
  resultado: string;
  refId?: string;
  atraso?: Atraso;
}
export interface RumoExtra {
  destinos: Destino[];
  manchete: string; // o que esse dinheiro faz, numa frase
}
const desce10 = (n: number) => Math.floor(n / 10) * 10;

/** 1) contas atrasadas, 2) dívidas caras (juro mais alto primeiro), 3) reserva até a meta, 4) o resto pode render.
 *  Antes de tudo, uma parte fica pra pessoa aproveitar (pctVoce). */
export function rumoDoExtra(e: Estado, hoje: string, valor: number, pctVoce = 10): RumoExtra {
  const mes = hoje.slice(0, 7);
  const destinos: Destino[] = [];
  if (!(valor > 0)) return { destinos, manchete: '' };
  const voce = Math.min(valor, desce10((valor * Math.max(0, pctVoce)) / 100));
  let resta = arred(valor - voce);
  const feitos: string[] = [];

  // 1) atrasos, na ordem do plano (só paga inteira; o que não fecha fica separado pra ela)
  for (const a of situacaoAtrasos(e, hoje).atrasos) {
    if (resta <= 0.005) break;
    if (resta + 0.005 >= a.total) {
      destinos.push({ tipo: 'atraso', titulo: `Pôr em dia: ${a.nome} (${mesCurto(a.mes)})`, valor: a.total, resultado: 'Sai da bola de neve e para a multa.', atraso: a });
      resta = arred(resta - a.total);
      feitos.push(`põe ${a.nome} em dia`);
    } else {
      destinos.push({ tipo: 'separar-atraso', titulo: `Guardar pra ${a.nome} (${mesCurto(a.mes)})`, valor: resta, resultado: `Faltam ${brl0(a.total - resta)} pra pagar ela inteira.` });
      resta = 0;
    }
  }

  // 2) dívidas caras, da de juro mais alto pra mais baixo
  const caras = e.dividas.filter((d) => saldoAtual(d) > 0 && d.jurosMensal >= JURO_CARO).sort((a, b) => b.jurosMensal - a.jurosMensal || saldoAtual(a) - saldoAtual(b));
  for (const d of caras) {
    if (resta <= 0.005) break;
    const saldo = saldoAtual(d);
    const p = Math.min(resta, saldo);
    const quita = p >= saldo - 0.005;
    const juroMes = arred((p * d.jurosMensal) / 100);
    destinos.push({ tipo: 'divida', titulo: quita ? `Quitar: ${d.nome}` : `Abater: ${d.nome}`, valor: arred(p), refId: d.id, resultado: quita ? `Acabou essa dívida: ${d.parcelaMinima > 0 ? `some a parcela de ${brl0(d.parcelaMinima)} e ` : ''}${brl0(juroMes)} de juros por mês.` : `${brl0(juroMes)} a menos de juros todo mês.` });
    resta = arred(resta - p);
    feitos.push(quita ? `quita ${d.nome}` : `abate ${d.nome}`);
  }

  // 3) reserva até a meta
  const meta = reservaMeta(e, mes);
  const falta = Math.max(0, arred(meta - Math.max(0, patrimonioGuardado(e))));
  if (resta > 0.005 && falta > 0) {
    const r = Math.min(resta, falta);
    const antes = jogoDaReserva(e, mes);
    const depois = jogoDaReserva({ ...e, aportes: [...e.aportes, { id: 'sim', data: hoje, valor: r, origem: 'extra' }] }, mes);
    const subiu = depois.nivel > antes.nivel ? depois.fases[depois.nivel - 1] : null;
    const gasto = gastoMensalMedio(e, mes);
    const dias = gasto > 0 ? Math.round(((Math.max(0, patrimonioGuardado(e)) + r) / gasto) * 30) : 0;
    const aguenta = dias > 0 ? `você passa a aguentar ${dias >= 60 ? `${Math.round(dias / 30)} meses` : `${dias} dias`} sem renda` : '';
    destinos.push({ tipo: 'reserva', titulo: 'Reserva de emergência', valor: arred(r), resultado: r >= falta - 0.005 ? `Reserva completa: ${aguenta}.` : subiu ? `Conquista "${subiu.nome.toLowerCase()}": ${aguenta}.` : `Com isso, ${aguenta}. Faltam ${brl0(falta - r)} pra meta.` });
    resta = arred(resta - r);
    feitos.push(r >= falta - 0.005 ? 'completa a reserva' : 'reforça a reserva');
  }

  // 4) o que sobrar pode render
  if (resta > 0.005) {
    destinos.push({ tipo: 'investir', titulo: 'Investir', valor: resta, resultado: 'Com o básico em dia, esse dinheiro pode render. Veja onde em Investir.' });
    feitos.push('ainda sobra pra investir');
  }
  if (voce > 0) destinos.push({ tipo: 'voce', titulo: 'Pra você', valor: voce, resultado: 'Aproveite sem culpa: faz parte do plano.' });

  const manchete = feitos.length ? `Com esse dinheiro você ${feitos.slice(0, 3).join(', ').replace(/, ([^,]*)$/, ' e $1')}.` : 'Esse dinheiro é pra você aproveitar.';
  return { destinos, manchete };
}
