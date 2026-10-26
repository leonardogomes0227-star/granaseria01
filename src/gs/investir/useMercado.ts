import { useCallback, useEffect, useState } from 'react';
import type { Mercado } from './tipos';
import { guardarMercado } from '../mercadoCache';

const num = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const item = <T extends { valor?: unknown; fonte?: unknown; atualizadoEm?: unknown }>(i: T | undefined): T | undefined => (i && num(i.valor) && typeof i.fonte === 'string' && typeof i.atualizadoEm === 'string' && !Number.isNaN(Date.parse(i.atualizadoEm)) ? i : undefined);

/** Descarta o que veio fora do formato: melhor não mostrar do que quebrar a tela. */
export function limparMercado(d: Mercado): Mercado {
  const meses = Array.isArray(d.meses) ? d.meses.filter((m) => typeof m === 'string' && /^\d{4}-\d{2}/.test(m)) : undefined;
  return {
    ...d,
    selic: item(d.selic),
    cdi: item(d.cdi),
    ipca12m: item(d.ipca12m),
    poupanca: item(d.poupanca),
    dolar: item(d.dolar),
    bitcoin: item(d.bitcoin),
    ibovespa: item(d.ibovespa),
    jurosReal: d.jurosReal && num(d.jurosReal.valor) ? d.jurosReal : undefined,
    meses: meses && meses.length === d.meses?.length ? meses : undefined,
    ranking: Array.isArray(d.ranking) ? d.ranking.filter((r) => r && typeof r.id === 'string' && num(r.retorno12m)) : undefined,
    cripto: Array.isArray(d.cripto) ? d.cripto.filter((c) => c && typeof c.simbolo === 'string' && num(c.preco)) : undefined,
    b3: d.b3 && Array.isArray(d.b3.altas) ? { altas: d.b3.altas.filter((a) => a && typeof a.simbolo === 'string' && num(a.preco) && num(a.var)), baixas: [] } : undefined,
    avisos: Array.isArray(d.avisos) ? d.avisos : [],
  };
}

type Estado = { carregando: boolean; dados: Mercado | null; erro: boolean };

/** Dados reais de mercado (/api/mercado). Nunca devolve número inventado: sem rede, `dados` fica nulo. */
export function useMercado(): Estado & { recarregar: () => void } {
  const [s, setS] = useState<Estado>({ carregando: true, dados: null, erro: false });
  const carregar = useCallback(() => {
    setS((x) => ({ ...x, carregando: true }));
    fetch('/api/mercado')
      .then((r) => (r.ok ? (r.json() as Promise<Mercado>) : Promise.reject(new Error(String(r.status)))))
      .then((bruto) => {
        const d = limparMercado(bruto);
        setS({ carregando: false, dados: d, erro: false });
        guardarMercado({ atualizadoEm: Date.now(), cdiAnualPct: d.cdi?.valor, selicAnualPct: d.selic?.valor, ipca12mPct: d.ipca12m?.valor });
      })
      .catch(() => setS((x) => ({ carregando: false, dados: x.dados, erro: true })));
  }, []);
  useEffect(carregar, [carregar]);
  return { ...s, recarregar: carregar };
}

export const haQuanto = (iso: string, agora = Date.now()) => {
  const min = Math.max(0, Math.round((agora - Date.parse(iso)) / 60000));
  return min < 1 ? 'agora' : min < 60 ? `há ${min} min` : `há ${Math.round(min / 60)} h`;
};
