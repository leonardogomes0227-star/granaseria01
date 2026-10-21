// O CDI mensal vem do cache dos dados de mercado (aba Investir). Sem dado real, ninguém inventa número: devolve null.

const KEY = 'grana-seria:mercado';

export interface MercadoSalvo {
  atualizadoEm: number;
  cdiAnualPct?: number;
  selicAnualPct?: number;
  ipca12mPct?: number;
}

export function lerMercadoSalvo(): MercadoSalvo | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') as MercadoSalvo | null;
    return v && typeof v.atualizadoEm === 'number' ? v : null;
  } catch {
    return null;
  }
}
export function guardarMercado(m: MercadoSalvo) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    // sem espaço
  }
}
/** CDI mensal em %, a partir do anual. */
export function lerCdiMensal(): number | null {
  const m = lerMercadoSalvo();
  return m?.cdiAnualPct && m.cdiAnualPct > 0 ? ((1 + m.cdiAnualPct / 100) ** (1 / 12) - 1) * 100 : null;
}
