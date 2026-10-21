// Limite por categoria (spec v2, 7.2 "Quanto ainda dá em cada coisa"): quanto a pessoa topa gastar por mês em cada
// coisa. Fica no estado sincronizado ('gs-limites', src/sync.ts): o site e o WhatsApp leem o mesmo.
// Quem vale, nessa ordem: o que a pessoa definiu aqui → o teto da missão do Nomasir → o do plano do diagnóstico.
// Sem nenhum: "Sem limite · Definir", e a barra nunca aparece cheia.

import { gravarJSON, lerJSON } from './armazem';
import { categoriaPorNome } from './categorias';

export const LIMITES_KEY = 'gs-limites';

/** categoria (nome gravado, ex.: 'Alimentação') → limite por mês, em reais. */
export type Limites = Record<string, number>;

/** Só o que é limite de verdade: nome com texto e valor positivo. */
export function limparLimites(v: unknown): Limites {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Limites = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    const valor = Number(n);
    if (k.trim() && Number.isFinite(valor) && valor > 0) out[k] = Math.round(valor * 100) / 100;
  }
  return out;
}

export const lerLimites = (): Limites => limparLimites(lerJSON<unknown>(LIMITES_KEY, {}));

/** Muda o limite de uma categoria aqui (puro). valor <= 0 ou null tira o limite. */
export function comLimite(atual: Limites, categoria: string, valor: number | null): Limites {
  const next = { ...atual };
  if (valor === null || !(valor > 0)) delete next[categoria];
  else next[categoria] = Math.round(valor * 100) / 100;
  return next;
}

/** Grava o limite de uma categoria e devolve todos. valor <= 0 ou null tira o limite. */
export function gravarLimite(categoria: string, valor: number | null): Limites {
  const next = comLimite(lerLimites(), categoria, valor);
  gravarJSON(LIMITES_KEY, Object.keys(next).length ? next : null);
  return next;
}

// Os tetos do Nomasir têm os nomes do chat ("Saídas", "Compras online"). Só viram padrão de uma categoria quando
// falam da mesma coisa: "Delivery" não vale pra Comida inteira (o mercado também está lá), nem "Transporte por app"
// pra todo o Transporte (a gasolina também).
const DO_NOMASIR: Record<string, string> = { Saídas: 'Lazer', 'Compras online': 'Compras' };

/**
 * Os tetos da missão de gastos (tipo 'gastos', missoes.limites) que batem com uma categoria. Teto zero ("cortar de
 * vez") não vira limite da categoria inteira. Dois tetos na mesma categoria somam.
 */
export function limitesDaMissao(tetos: Record<string, number> | undefined | null): Limites {
  const out: Limites = {};
  for (const [rotulo, teto] of Object.entries(tetos ?? {})) {
    const cat = DO_NOMASIR[rotulo] ?? categoriaPorNome(rotulo);
    if (!cat || !(Number(teto) > 0)) continue;
    out[cat] = Math.round(((out[cat] ?? 0) + Number(teto)) * 100) / 100;
  }
  return out;
}

export type OrigemLimite = 'proprio' | 'missao' | 'diagnostico';

/** O limite que vale pra uma categoria, e de onde ele veio. null: sem limite. */
export function limiteDe(categoria: string, fontes: { proprios: Limites; missao?: Limites; diagnostico?: Limites }): { valor: number; origem: OrigemLimite } | null {
  const p = fontes.proprios[categoria];
  if (p > 0) return { valor: p, origem: 'proprio' };
  const m = fontes.missao?.[categoria];
  if (m && m > 0) return { valor: m, origem: 'missao' };
  const d = fontes.diagnostico?.[categoria];
  if (d && d > 0) return { valor: d, origem: 'diagnostico' };
  return null;
}

export type TomBarra = 'normal' | 'atencao' | 'estourou' | 'sem';

export interface Barra {
  pct: number; // 0 a 100, a largura da barra
  tom: TomBarra; // < 80% normal · 80–100% âmbar · > 100% tijolo · sem limite
  resta: number; // quanto ainda dá (0 se passou)
  passou: number; // quanto passou do limite (0 se não passou)
}

/** A barra de uma categoria. Sem limite, fica vazia (nunca cheia). */
export function barra(usado: number, limite: number | null | undefined): Barra {
  const u = Math.max(0, Number.isFinite(usado) ? usado : 0);
  if (!limite || !(limite > 0)) return { pct: 0, tom: 'sem', resta: 0, passou: 0 };
  const r = u / limite;
  const tom: TomBarra = r > 1 ? 'estourou' : r >= 0.8 ? 'atencao' : 'normal';
  return {
    pct: Math.min(100, Math.round(r * 1000) / 10),
    tom,
    resta: Math.max(0, Math.round((limite - u) * 100) / 100),
    passou: Math.max(0, Math.round((u - limite) * 100) / 100),
  };
}
