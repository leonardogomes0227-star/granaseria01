// Contas dos dados de mercado (sem rede): alinhar séries de datas diferentes, poupança, juro real.

export interface Ponto {
  data: string; // AAAA-MM-DD
  valor: number;
}

/** '16/10/2026' -> '2026-10-16' (formato do SGS do Banco Central). */
export const dataBCB = (s: string) => `${s.slice(6, 10)}-${s.slice(3, 5)}-${s.slice(0, 2)}`;

/** Último valor de cada mês ('AAAA-MM'). */
export function ultimoDeCadaMes(pontos: Ponto[]): Map<string, number> {
  const m = new Map<string, { data: string; valor: number }>();
  for (const p of [...pontos].filter((x) => Number.isFinite(x.valor)).sort((a, b) => a.data.localeCompare(b.data))) m.set(p.data.slice(0, 7), p);
  return new Map([...m.entries()].map(([k, v]) => [k, v.valor]));
}

export const somaMes = (mes: string, n: number) => {
  const [y, m] = mes.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};

/** Os 13 fins de mês (o atual e os 12 anteriores): 12 meses de retorno. */
export const mesesDaJanela = (hojeMes: string) => Array.from({ length: 13 }, (_, i) => somaMes(hojeMes, i - 12));

/** Taxas mensais (%) viram uma série base 100. `taxas[i]` é a do mês i+1 da janela. */
export function baseCemDeTaxas(taxasMensaisPct: number[]): number[] {
  let v = 100;
  return [100, ...taxasMensaisPct.map((t) => (v = v * (1 + t / 100)))];
}

/** Preços de fim de mês viram uma série base 100 (null se faltar algum mês). */
export function baseCemDePrecos(precoPorMes: Map<string, number>, meses: string[]): number[] | null {
  const base = precoPorMes.get(meses[0]);
  if (!base || base <= 0) return null;
  const out: number[] = [];
  let ultimo = base;
  for (const m of meses) {
    const p = precoPorMes.get(m) ?? ultimo;
    ultimo = p;
    out.push((p / base) * 100);
  }
  return out;
}

/** Poupança: selic meta > 8,5% a.a. => 0,5% ao mês; senão 70% da Selic (mensal). TR = 0. */
export function poupancaMensalPct(selicAnualPct: number): number {
  if (selicAnualPct > 8.5) return 0.5;
  return 0.7 * ((1 + selicAnualPct / 100) ** (1 / 12) - 1) * 100;
}
export const poupancaAnualPct = (selicAnualPct: number) => ((1 + poupancaMensalPct(selicAnualPct) / 100) ** 12 - 1) * 100;

/** Taxa anual plausível pra Selic/CDI no Brasil (5% a 25%). Fora disso, a série é descartada. */
export const taxaAnualPlausivel = (v: number) => Number.isFinite(v) && v >= 5 && v <= 25;
export const inflacaoPlausivel = (v: number) => Number.isFinite(v) && v >= -2 && v <= 30;
export const taxaMensalPlausivel = (v: number) => Number.isFinite(v) && v >= -1 && v <= 3;

export const jurosReal = (cdiAnualPct: number, ipca12mPct: number) => Math.round((cdiAnualPct - ipca12mPct) * 100) / 100;

export const retornoFinal = (serie: number[]) => (serie.length > 1 ? Math.round((serie[serie.length - 1] / serie[0] - 1) * 10000) / 100 : null);
