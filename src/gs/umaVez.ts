import { useCallback, useMemo, useRef } from 'react';

/** O segundo toque no mesmo envio não grava de novo. Se a ação não concluiu (faltou um campo, ou pediu confirmação), o próximo toque vale. */
export function useUmaVez() {
  const travado = useRef(false);
  const soltar = useCallback(() => {
    travado.current = false;
  }, []);
  const tentar = useCallback((concluiu: () => boolean) => {
    if (travado.current) return;
    travado.current = true;
    if (!concluiu()) travado.current = false;
  }, []);
  return useMemo(() => ({ soltar, tentar }), [soltar, tentar]);
}
