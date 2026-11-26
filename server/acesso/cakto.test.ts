import { describe, expect, it } from 'vitest';
import { interpretarAviso, planoDoItem, valorEmReais } from './cakto';

// Forma do modelo "Agrupado" que a própria Cakto mostra: `data` é uma lista (venda principal + extras).
const modelo = (evento: string, link: string, extra: Record<string, unknown> = {}) => ({
  event: evento,
  data: [
    { id: 'abc-1', refId: 'r1', customer: { name: 'Ana', email: 'Ana@Exemplo.com', phone: '67999991234' }, offer: { id: 'o1', name: 'Oferta', price: 20 }, offer_type: 'main', checkoutUrl: `https://pay.cakto.com.br/${link}`, status: 'paid', baseAmount: 20, amount: 20, paidAt: '2026-12-01T12:00:00.000000+00:00', ...extra },
    { id: 'abc-2', customer: { name: 'Ana', email: 'ana@exemplo.com', phone: '67999991234' }, offer: { id: 'o2', name: 'E-book Bônus', price: 27 }, offer_type: 'orderbump', checkoutUrl: 'https://pay.cakto.com.br/EXEMPLO', amount: 27 },
  ],
});
const AGORA = Date.parse('2026-12-02T00:00:00Z');

describe('aviso da Cakto (modelo agrupado)', () => {
  it('compra aprovada do fundador mensal: lê a lista, o cliente e o plano pelo link', () => {
    const a = interpretarAviso(modelo('purchase_approved', 'hquo3d7'), AGORA);
    expect(a).toMatchObject({ aprovado: true, encerrado: false, email: 'ana@exemplo.com', fone: '5567999991234', plano: 'mensal', fundador: true, ref: 'abc-1' });
    // vale 35 dias a partir do pagamento (1º de dezembro)
    expect(a.validoAte?.slice(0, 10)).toBe('2027-01-05');
  });
  it('os quatro links do Grana Séria', () => {
    expect(planoDoItem({ checkoutUrl: 'https://pay.cakto.com.br/3dj7dj5' })).toEqual({ plano: 'anual', fundador: true });
    expect(planoDoItem({ checkoutUrl: 'https://pay.cakto.com.br/32p9p4s' })).toEqual({ plano: 'anual', fundador: false });
    expect(planoDoItem({ checkoutUrl: 'https://pay.cakto.com.br/dkukzez_1373243' })).toEqual({ plano: 'mensal', fundador: false });
  });
  it('link novo: pelo preço de tabela, não pelo valor pago com cupom', () => {
    expect(planoDoItem({ checkoutUrl: 'https://pay.cakto.com.br/novo', offer: { price: 200 }, amount: 140 })).toEqual({ plano: 'anual', fundador: true });
    expect(planoDoItem({ checkoutUrl: 'https://pay.cakto.com.br/novo', offer: { price: 30 } })).toEqual({ plano: 'mensal', fundador: false });
  });
  it('cancelamento, reembolso e chargeback encerram', () => {
    for (const ev of ['subscription_canceled', 'refund', 'chargeback']) {
      const a = interpretarAviso(modelo(ev, 'hquo3d7'), AGORA);
      expect(a.encerrado, ev).toBe(true);
      expect(a.aprovado, ev).toBe(false);
      expect(a.validoAte).toBeNull();
    }
  });
  it('renovação conta como pagamento', () => {
    expect(interpretarAviso(modelo('subscription_renewed', '32p9p4s'), AGORA).aprovado).toBe(true);
  });
  it('compra recusada, boleto e pix gerados não liberam nada', () => {
    for (const ev of ['purchase_refused', 'boleto_gerado', 'pix_gerado']) {
      const a = interpretarAviso(modelo(ev, 'hquo3d7'), AGORA);
      expect(a.aprovado || a.encerrado, ev).toBe(false);
    }
  });
  it('formato simples (um item só, sem lista) também funciona', () => {
    const a = interpretarAviso({ event: 'purchase_approved', data: { id: 'x', customer: { email: 'b@b.com' }, checkoutUrl: 'https://pay.cakto.com.br/32p9p4s' } }, AGORA);
    expect(a).toMatchObject({ aprovado: true, email: 'b@b.com', plano: 'anual', fundador: false });
  });
  it('valor em centavos ou reais', () => {
    expect(valorEmReais(30)).toBe(30);
    expect(valorEmReais(3000)).toBe(30);
    expect(valorEmReais('20,00')).toBe(20);
  });
});
