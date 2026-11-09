// Sugestões ao anotar: categoria pela descrição e atalhos dos lançamentos mais frequentes. Puro.

import { detectarCategoria, detectarForma, normalizar } from '../lib/categorias';
import { somaDias } from './datas';
import type { Estado } from './tipos';

/** O nome da lib (Alimentação, Moradia…) para o nome usado no dia a dia do app (Comida, Casa…). */
const PARA_DIA: Record<string, string> = { Alimentação: 'Comida', Moradia: 'Casa', Educação: 'Outros', Pets: 'Outros', Beleza: 'Compras' };

const REGRAS: [RegExp, string][] = [
  [/\b(netflix|spotify|disney|hbo|max|prime video|youtube premium|deezer|globoplay|icloud|assinatura)\b/, 'Assinaturas'],
  [/\b(mercado|supermercado|atacadao|atacado|feira|hortifruti|sacolao|acougue|padaria)\b/, 'Mercado'],
  [/\b(farmacia|drogaria|remedio|consulta|dentista|exame)\b/, 'Saúde'],
  [/\b(combustivel|gasolina|etanol|posto|uber|99|onibus|metro|estacionamento|pedagio)\b/, 'Transporte'],
];

/** A categoria sugerida pela descrição, entre as categorias que o app usa. null: sem palavra conhecida (mantém a escolha da pessoa). */
export function sugerirCategoria(descricao: string, categorias: string[]): string | null {
  const t = normalizar(descricao);
  if (!t) return null;
  for (const [re, cat] of REGRAS) if (re.test(t) && categorias.includes(cat)) return cat;
  const lib = detectarCategoria(descricao);
  if (!lib) return null;
  const nome = PARA_DIA[lib] ?? lib;
  return categorias.includes(nome) ? nome : null;
}

export const sugerirForma = (descricao: string): string | null => detectarForma(descricao);

export interface Atalho {
  descricao: string;
  categoria: string;
  valor: number; // o último valor usado
  vezes: number;
}
/** Os gastos que mais se repetem nos últimos 90 dias (pelo menos 2 vezes), pra lançar com um toque. */
export function atalhosFrequentes(e: Estado, hoje: string, max = 4): Atalho[] {
  const desde = somaDias(hoje, -90);
  const mapa = new Map<string, Atalho & { ultima: string }>();
  for (const l of e.lancamentos) {
    if (l.data < desde || !l.descricao.trim() || l.descricao === l.categoria) continue;
    const k = normalizar(l.descricao);
    const a = mapa.get(k);
    if (!a) mapa.set(k, { descricao: l.descricao, categoria: l.categoria, valor: l.valor, vezes: 1, ultima: l.data });
    else {
      a.vezes++;
      if (l.data >= a.ultima) Object.assign(a, { ultima: l.data, valor: l.valor, categoria: l.categoria, descricao: l.descricao });
    }
  }
  return [...mapa.values()].filter((a) => a.vezes >= 2).sort((a, b) => b.vezes - a.vezes || b.ultima.localeCompare(a.ultima)).slice(0, max).map((a) => ({ descricao: a.descricao, categoria: a.categoria, valor: a.valor, vezes: a.vezes }));
}
