// A decisão de acesso, pura e testada: quem entra, quem tem prazo e quem fica de fora.
// Na dúvida, libera: só bloqueia quando há certeza (data de corte definida e nenhuma assinatura valendo).

import type { AcessoRow } from './db.js';

export interface Entrada {
  acesso: Pick<AcessoRow, 'tipo' | 'status' | 'valido_ate' | 'fundador'> | null;
  /** quando a conta foi criada (só contas por e-mail têm; a do WhatsApp não) */
  criadoEm: string | null;
  novosDesde: string | undefined; // ACESSO_NOVOS_DESDE
  corte: string | undefined; // ACESSO_CORTE
  agora: number;
}
export type Decisao =
  | { estado: 'liberado' }
  | { estado: 'ativo'; ate?: string | null; fundador?: boolean; cancelada?: boolean }
  | { estado: 'carencia'; ate: string; dias: number }
  | { estado: 'bloqueado'; novo?: boolean };

const DIA = 86_400_000;

export function decidirAcesso({ acesso, criadoEm, novosDesde, corte, agora }: Entrada): Decisao {
  const a = acesso;
  if (a?.tipo === 'cortesia') return { estado: 'ativo' };
  const ate = a?.valido_ate ? Date.parse(a.valido_ate) : NaN;
  if (a && a.status === 'ativo' && (!a.valido_ate || ate > agora)) return { estado: 'ativo', ate: a.valido_ate, fundador: a.fundador };
  // assinatura cancelada: vale até o fim do período já pago
  if (a && Number.isFinite(ate) && ate > agora) return { estado: 'ativo', ate: a.valido_ate, fundador: a.fundador, cancelada: true };
  // conta criada depois de ACESSO_NOVOS_DESDE é de quem chegou agora: não ganha o prazo de quem já usava
  const desde = novosDesde ? Date.parse(novosDesde) : NaN;
  if (Number.isFinite(desde) && criadoEm && Date.parse(criadoEm) > desde) return { estado: 'bloqueado', novo: true };
  const fim = corte ? Date.parse(corte) : NaN;
  if (Number.isFinite(fim) && fim > agora) return { estado: 'carencia', ate: new Date(fim).toISOString(), dias: Math.max(0, Math.ceil((fim - agora) / DIA)) };
  return Number.isFinite(fim) ? { estado: 'bloqueado' } : { estado: 'liberado' };
}
