import { useEffect, useState } from 'react';
import { hoje } from './datas';

/** Hoje em São Paulo, atualizado sozinho na virada do dia (a cada minuto e ao voltar pra aba). */
export function useHoje(): string {
  const [h, setH] = useState(() => hoje());
  useEffect(() => {
    const checar = () => setH(hoje());
    const t = window.setInterval(checar, 60_000);
    document.addEventListener('visibilitychange', checar);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', checar);
    };
  }, []);
  return h;
}
