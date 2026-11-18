// Comparação de segredo em tempo constante. O tamanho do segredo não encurta a comparação:
// os dois lados viram um hash do mesmo tamanho antes do timingSafeEqual.

import { createHash, timingSafeEqual } from 'node:crypto';

export function mesmoSegredo(enviado: string, esperado: string | undefined): boolean {
  if (!esperado) return false;
  const a = createHash('sha256').update(enviado).digest();
  const b = createHash('sha256').update(esperado).digest();
  return timingSafeEqual(a, b);
}
