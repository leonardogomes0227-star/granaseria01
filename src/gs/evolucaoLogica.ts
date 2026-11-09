// Evolução: séries e comparações honestas. Cada função só devolve algo quando há dados suficientes
// (a tela mostra "ainda não dá pra comparar" em vez de inventar). Puro, com teste.

import { arred, brl0, mesCurto, mesDe, somaDias, somaMes } from './datas';
import { saldoAtual } from './dividas';
import { fixosPagos, guardadoNoMes, receitasDoMes, totalVariaveis } from './selectores';
import { resumoDaSemana } from './insights';
import type { Estado } from './tipos';

export interface MesSerie {
  mes: string;
  receitas: number;
  receitaEstimada: boolean; // sem receita registrada: usa a renda informada
  despesas: number; // dia a dia + contas fixas pagas
  fixas: number;
  variaveis: number;
  guardado: number;
  dividasPagas: number;
  temDados: boolean;
}

export function mesSerie(e: Estado, mes: string, primeiroMes: string): MesSerie {
  const registradas = arred(receitasDoMes(e, mes).reduce((t, r) => t + r.valor, 0));
  const fixas = fixosPagos(e, mes);
  const variaveis = totalVariaveis(e, mes);
  const guardado = guardadoNoMes(e, mes);
  const dividasPagas = arred(e.dividas.flatMap((d) => d.pagamentos.filter((p) => mesDe(p.data) === mes)).reduce((t, p) => t + p.valor, 0));
  const receitaEstimada = registradas === 0 && e.config.renda > 0 && mes >= primeiroMes;
  return { mes, receitas: registradas > 0 ? registradas : receitaEstimada ? e.config.renda : 0, receitaEstimada, despesas: arred(fixas + variaveis), fixas, variaveis, guardado, dividasPagas, temDados: fixas + variaveis + guardado + dividasPagas + registradas > 0 };
}

/** Os últimos `n` meses (do mais antigo ao atual), cortando os meses anteriores ao primeiro registro. */
export function serieMensal(e: Estado, hoje: string, n = 6): MesSerie[] {
  const mes = mesDe(hoje);
  const datas = [...e.lancamentos.map((l) => l.data), ...e.receitas.map((r) => r.data), ...e.aportes.map((a) => a.data), ...e.gastosFixos.flatMap((g) => Object.values(g.pagamentos).map((p) => p.pagoEm))].sort();
  const primeiro = datas[0] ? mesDe(datas[0]) : mes;
  return Array.from({ length: n }, (_, i) => somaMes(mes, i - (n - 1))).filter((m) => m >= primeiro).map((m) => mesSerie(e, m, primeiro));
}

export interface CategoriaTotal {
  categoria: string;
  valor: number;
  anterior: number;
  pct: number; // do total do mês
}
export function gastosPorCategoria(e: Estado, mes: string): CategoriaTotal[] {
  const soma = (m: string) => {
    const r = new Map<string, number>();
    for (const l of e.lancamentos) if (mesDe(l.data) === m) r.set(l.categoria, (r.get(l.categoria) ?? 0) + l.valor);
    return r;
  };
  const atual = soma(mes);
  const antes = soma(somaMes(mes, -1));
  const total = [...atual.values()].reduce((t, v) => t + v, 0);
  return [...atual.entries()].map(([categoria, valor]) => ({ categoria, valor: arred(valor), anterior: arred(antes.get(categoria) ?? 0), pct: total > 0 ? (valor / total) * 100 : 0 })).sort((a, b) => b.valor - a.valor);
}

export interface PlanejadoRealizado {
  categoria: string;
  planejado: number;
  realizado: number;
}
/** Só categorias em que a própria pessoa definiu um limite (o "planejado" é sempre dela). */
export function planejadoXRealizado(e: Estado, mes: string): PlanejadoRealizado[] {
  const real = new Map(gastosPorCategoria(e, mes).map((c) => [c.categoria, c.valor]));
  return Object.entries(e.limites).filter(([, v]) => v > 0).map(([categoria, planejado]) => ({ categoria, planejado, realizado: real.get(categoria) ?? 0 })).sort((a, b) => b.realizado / b.planejado - a.realizado / a.planejado);
}

export interface Frase {
  id: string;
  tom: 'ok' | 'aviso' | 'info';
  texto: string;
}
/** Frases em linguagem simples, cada uma só com base real. Lista vazia = ainda não dá pra comparar. */
export function frasesDeEvolucao(e: Estado, hoje: string): Frase[] {
  const mes = mesDe(hoje);
  const dia = Number(hoje.slice(8, 10));
  const ant = somaMes(mes, -1);
  const f: Frase[] = [];
  const ate = (m: string) => e.lancamentos.filter((l) => mesDe(l.data) === m && Number(l.data.slice(8, 10)) <= dia).reduce((t, l) => t + l.valor, 0);
  const antes = ate(ant);
  const agora = ate(mes);
  if (antes >= 100 && dia >= 5) {
    const dif = Math.round((agora / antes - 1) * 100);
    if (dif <= -5) f.push({ id: 'mes-menos', tom: 'ok', texto: `Seus gastos do dia a dia estão ${Math.abs(dif)}% menores que no mesmo período de ${mesCurto(ant)}.` });
    else if (dif >= 5) f.push({ id: 'mes-mais', tom: 'aviso', texto: `Seus gastos do dia a dia estão ${dif}% maiores que no mesmo período de ${mesCurto(ant)} (${brl0(agora - antes)} a mais).` });
  }
  for (const c of gastosPorCategoria(e, mes)) {
    if (c.anterior >= 100 && c.valor - c.anterior >= 50 && dia >= 15) f.push({ id: `cat-${c.categoria}`, tom: 'aviso', texto: `Você gastou ${brl0(c.valor - c.anterior)} a mais com ${c.categoria.toLowerCase()} do que em todo o mês de ${mesCurto(ant)}.` });
  }
  const s = serieMensal(e, hoje, 2);
  const m = s.find((x) => x.mes === mes);
  if (m && m.receitas > 0 && m.guardado > 0) f.push({ id: 'guardou', tom: 'ok', texto: `Você guardou ${Math.round((m.guardado / m.receitas) * 100)}% da sua renda neste mês${m.receitaEstimada ? ' (com base na renda que você informou)' : ''}.` });
  const semana = resumoDaSemana(e, hoje, 0);
  const passada = resumoDaSemana(e, hoje, 1);
  if (passada.gasto >= 50 && semana.gasto > 0 && somaDias(semana.de, 0) <= hoje) {
    const diasPassados = Math.max(1, (Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${semana.de}T12:00:00Z`)) / 86400000 + 1);
    if (diasPassados >= 4) f.push({ id: 'semana', tom: 'info', texto: `Nesta semana você gastou ${brl0(semana.gasto)} em ${Math.round(diasPassados)} dias; a semana passada inteira foi ${brl0(passada.gasto)}.` });
  }
  return f;
}

export interface EvolucaoDividas {
  total: number;
  pago: number;
  porMes: { mes: string; pago: number }[];
}
export function evolucaoDividas(e: Estado, hoje: string, n = 6): EvolucaoDividas | null {
  const abertas = e.dividas.length;
  if (abertas === 0) return null;
  const mes = mesDe(hoje);
  const porMes = Array.from({ length: n }, (_, i) => somaMes(mes, i - (n - 1))).map((m) => ({ mes: m, pago: arred(e.dividas.flatMap((d) => d.pagamentos.filter((p) => mesDe(p.data) === m)).reduce((t, p) => t + p.valor, 0)) }));
  return { total: arred(e.dividas.reduce((t, d) => t + saldoAtual(d), 0)), pago: arred(e.dividas.flatMap((d) => d.pagamentos).reduce((t, p) => t + p.valor, 0)), porMes };
}

export const progressoMeta = (m: Estado['metas'][number]) => {
  const guardado = arred(m.guardados.reduce((t, g) => t + g.valor, 0));
  return { guardado, pct: Math.min(100, Math.round((guardado / m.alvo) * 100)), falta: Math.max(0, arred(m.alvo - guardado)) };
};

/** Patrimônio guardado ao fim de cada mês (aportes acumulados). Só com 2+ meses de dados. */
export function patrimonioPorMes(e: Estado, hoje: string, n = 6): { mes: string; valor: number }[] | null {
  const mes = mesDe(hoje);
  const meses = Array.from({ length: n }, (_, i) => somaMes(mes, i - (n - 1)));
  const pontos = meses.map((m) => ({ mes: m, valor: arred(e.aportes.filter((a) => mesDe(a.data) <= m).reduce((t, a) => t + a.valor, 0)) }));
  const comDado = pontos.filter((p) => p.valor !== 0);
  return comDado.length >= 2 ? pontos : null;
}
