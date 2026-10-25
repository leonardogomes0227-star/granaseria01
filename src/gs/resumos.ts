import type { Estado } from './tipos';
export const assinaturasTotal = (e: Estado) => e.assinaturas.filter((a) => a.ativa).reduce((t, a) => t + a.valor, 0);
