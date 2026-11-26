// Lê o aviso de pagamento da Cakto (modelo "Agrupado": `data` é uma lista com a venda principal e os extras).
// Puro e testado com o modelo de exemplo que a própria Cakto mostra.

import { normalizarFone } from './db.js';

export type Plano = 'mensal' | 'anual';
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

/** Os links de pagamento do Grana Séria na Cakto (o final do endereço) e o plano de cada um. */
export const LINKS_CAKTO: Record<string, { plano: Plano; fundador: boolean }> = {
  'dkukzez_1373243': { plano: 'mensal', fundador: false },
  '32p9p4s': { plano: 'anual', fundador: false },
  'hquo3d7': { plano: 'mensal', fundador: true },
  '3dj7dj5': { plano: 'anual', fundador: true },
};

/** O valor pode vir em reais (30) ou em centavos (3000). */
export function valorEmReais(v: unknown): number {
  const n = Number(typeof v === 'string' ? v.replace(',', '.') : v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1000 ? n / 100 : n;
}

/** Plano e preço de fundador: primeiro pelo link comprado; se for um link novo, pelo preço de tabela da oferta (não o pago, que pode ter cupom). */
export function planoDoItem(item: Obj): { plano: Plano; fundador: boolean } {
  const final = txt(item.checkoutUrl).split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? '';
  if (LINKS_CAKTO[final]) return LINKS_CAKTO[final];
  const preco = valorEmReais(obj(item.offer).price ?? item.baseAmount ?? item.amount);
  const anual = preco >= 150;
  return { plano: anual ? 'anual' : 'mensal', fundador: preco > 0 && (anual ? preco < 250 : preco <= 25) };
}

export interface AvisoCakto {
  evento: string;
  aprovado: boolean;
  encerrado: boolean;
  email: string | null;
  fone: string | null;
  plano: Plano;
  fundador: boolean;
  validoAte: string | null;
  ref: string | null;
}

export function interpretarAviso(corpo: unknown, agora = Date.now()): AvisoCakto {
  const c = obj(corpo);
  const evento = (txt(c.event) || txt(c.type)).toLowerCase();
  const lista = (Array.isArray(c.data) ? c.data : [c.data ?? c]).map(obj);
  // a venda principal; os extras (order bump) não mudam o plano
  const item = lista.find((i) => txt(i.offer_type) === 'main') ?? lista[0] ?? {};
  const cliente = obj(item.customer ?? lista.find((i) => i.customer)?.customer);
  const email = txt(cliente.email).toLowerCase() || null;
  const fone = normalizarFone(txt(cliente.phone ?? cliente.cellphone ?? cliente.whatsapp));
  const { plano, fundador } = planoDoItem(item);
  const aprovado = /(approved|aprovad|paid|pago|renew|renov)/.test(evento) && !/(cancel|refund|reembols|charge|expir|refus|recus)/.test(evento);
  const encerrado = /(cancel|refund|reembols|chargeback|expir)/.test(evento);
  // vale a partir do dia do pagamento (nunca no futuro), com uma folga de dias
  const pagoEm = Date.parse(txt(item.paidAt));
  const base = Number.isFinite(pagoEm) && pagoEm <= agora ? pagoEm : agora;
  const validoAte = aprovado ? new Date(base + (plano === 'anual' ? 372 : 35) * 86_400_000).toISOString() : null;
  return { evento, aprovado, encerrado, email, fone, plano, fundador, validoAte, ref: txt(item.id) || null };
}
