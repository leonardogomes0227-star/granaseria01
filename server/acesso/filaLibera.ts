// A fila é uma etapa curta de experiência: depois de FILA_LIBERA_EM_SEGUNDOS a pessoa fica convidada.
// Isso não grava assinatura. Plano pago só entra pelo webhook da Cakto (gravarAcesso).

export const FILA_LIBERA_PADRAO_SEGUNDOS = 20;
export const FILA_LIBERA_TETO_SEGUNDOS = 60 * 60;
export const DIAS_DO_CONVITE = 7;

/** Segundos até a fila liberar o convite. Vazio ou inválido usa o padrão curto. Zero libera na hora. */
export function segundosParaLiberar(bruto: string | undefined): number {
  if (bruto === undefined || bruto.trim() === '') return FILA_LIBERA_PADRAO_SEGUNDOS;
  const n = Number(bruto);
  if (!Number.isFinite(n) || n < 0) return FILA_LIBERA_PADRAO_SEGUNDOS;
  return Math.min(FILA_LIBERA_TETO_SEGUNDOS, Math.floor(n));
}

export function instanteLiberacao(criadoEm: string, segundos: number): number | null {
  const t = Date.parse(criadoEm);
  if (!Number.isFinite(t)) return null;
  return t + segundos * 1000;
}

/** Só quem ainda está em espera, e só depois do tempo. Convidado, ativo e recusado não mudam. */
export function deveLiberarFila(status: string, criadoEm: string, agora: number, segundos: number): boolean {
  if (status !== 'espera') return false;
  const quando = instanteLiberacao(criadoEm, segundos);
  return quando !== null && agora >= quando;
}

export interface RespostaFila {
  status: string;
  nome: string;
  conviteAte: string | null;
  liberaEm: string | null;
  esperaSegundos: number;
  liberado: boolean;
}

/** O que a página pode mostrar. Sem posição, sem total, sem contagem de gente. */
export function respostaDaFila(
  row: { status: string; nome: string; convite_ate: string | null; criado_em: string },
  agora: number,
  segundos: number,
): RespostaFila {
  const liberado = row.status === 'convidado' || row.status === 'ativo';
  const quando = instanteLiberacao(row.criado_em, segundos);
  return {
    status: row.status,
    nome: row.nome,
    conviteAte: row.convite_ate,
    liberaEm: liberado || quando === null ? null : new Date(quando).toISOString(),
    esperaSegundos: segundos,
    liberado,
  };
}
