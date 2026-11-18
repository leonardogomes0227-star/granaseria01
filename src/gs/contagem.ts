import { useEffect, useRef, useState } from 'react';

/** Número que conta até o valor ao abrir (parado para quem pediu menos movimento). */
export function useContagem(alvo: number, ms = 700): number {
  const reduz = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [v, setV] = useState(() => (reduz || !Number.isFinite(alvo) ? alvo : 0));
  const fromRef = useRef(reduz ? alvo : 0);
  useEffect(() => {
    if (reduz || !Number.isFinite(alvo)) { setV(alvo); fromRef.current = alvo; return; }
    const from = fromRef.current;
    const t0 = performance.now();
    const dur = from === 0 ? ms : Math.min(ms, 480);
    let id = 0;
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setV(from + (alvo - from) * (1 - (1 - k) ** 3));
      if (k < 1) id = requestAnimationFrame(passo);
      else fromRef.current = alvo;
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [alvo, ms, reduz]);
  return v;
}
