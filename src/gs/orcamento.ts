// Orçamento: o quanto de cada categoria já foi e a regra 50/30/20 com os números da pessoa. Pura, com teste.

import { COR_CATEGORIA, GRUPO } from './categorias';
import { arred } from './datas';
import { lancamentosDoMes, totalFixos } from './selectores';
import type { Estado } from './tipos';

export interface LinhaCategoria {
  categoria: string;
  gasto: number;
  limite: number | null;
  pct: number | null;
  tom: 'ok' | 'aviso' | 'perigo' | 'sem';
}

export function gastoPorCategoria(e: Estado, mes: string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const l of lancamentosDoMes(e, mes)) m[l.categoria] = arred((m[l.categoria] ?? 0) + l.valor);
  return m;
}

/** Normal abaixo de 80%, âmbar de 80% a 100%, vermelho acima. Sem limite: nunca mostra barra cheia. */
export function linhasDeCategoria(e: Estado, mes: string): LinhaCategoria[] {
  const g = gastoPorCategoria(e, mes);
  const nomes = [...new Set([...Object.keys(COR_CATEGORIA), ...Object.keys(g)])].filter((c) => c !== 'Casa' || (g.Casa ?? 0) > 0 || e.limites.Casa);
  return nomes
    .map((categoria) => {
      const gasto = g[categoria] ?? 0;
      const limite = e.limites[categoria] ?? null;
      const pct = limite ? (gasto / limite) * 100 : null;
      const tom: LinhaCategoria['tom'] = pct === null ? 'sem' : pct > 100 ? 'perigo' : pct >= 80 ? 'aviso' : 'ok';
      return { categoria, gasto, limite, pct, tom };
    })
    .sort((a, b) => b.gasto - a.gasto);
}

export interface Regra {
  nome: string;
  pct: number;
  ideal: number;
  menorMelhor: boolean;
  ok: boolean;
}
export function regra503020(e: Estado, mes: string): Regra[] {
  const renda = e.config.renda;
  if (renda <= 0) return [];
  const g = gastoPorCategoria(e, mes);
  const fixas = totalFixos(e, mes);
  let nec = fixas;
  let des = 0;
  for (const [c, v] of Object.entries(g)) {
    if (GRUPO[c] === 'desejos') des += v;
    else nec += v;
  }
  const guardar = Math.max(0, renda - nec - des);
  const mk = (nome: string, valor: number, ideal: number, menorMelhor: boolean): Regra => {
    const pct = (valor / renda) * 100;
    return { nome, pct, ideal, menorMelhor, ok: menorMelhor ? pct <= ideal : pct >= ideal };
  };
  return [mk('Necessidades', nec, 50, true), mk('Desejos', des, 30, true), mk('Guardar', guardar, 20, false)];
}
