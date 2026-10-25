import { useCallback, useEffect, useState } from 'react';
import type { Mercado } from './tipos';
import { guardarMercado } from '../mercadoCache';

type Estado = { carregando: boolean; dados: Mercado | null; erro: boolean };

/** Dados reais de mercado (/api/mercado). Nunca devolve número inventado: sem rede, `dados` fica nulo. */
export function useMercado(): Estado & { recarregar: () => void } {
  const [s, setS] = useState<Estado>({ carregando: true, dados: null, erro: false });
  const carregar = useCallback(() => {
    setS((x) => ({ ...x, carregando: true }));
    fetch('/api/mercado')
      .then((r) => (r.ok ? (r.json() as Promise<Mercado>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
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
