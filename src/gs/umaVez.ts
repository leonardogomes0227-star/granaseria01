import { useCallback, useMemo, useRef, useState } from 'react';

/** O segundo toque no mesmo envio não grava de novo. Enquanto grava, o botão fica desligado. Se a ação não concluiu, o próximo toque vale. */
export function useUmaVez() {
  const travado = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const soltar = useCallback(() => {
    travado.current = false;
    setOcupado(false);
  }, []);
  const tentar = useCallback((concluiu: () => boolean) => {
    if (travado.current) return;
    travado.current = true;
    setOcupado(true);
    if (!concluiu()) {
      travado.current = false;
      setOcupado(false);
    }
  }, []);
  return useMemo(() => ({ soltar, tentar, ocupado }), [soltar, tentar, ocupado]);
}
