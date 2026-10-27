import { describe, expect, it } from 'vitest';
import { acaoCartao, aplicarCompra, aplicarPagamento, comprometidoTotal, proximaData, proximasFaturas } from './cartaoLogica';
import type { Cartao } from './tipos';

const c0 = (p: Partial<Cartao> = {}): Cartao => ({ limite: 5000, usado: 500, fechaDia: 20, venceDia: 28, ...p });

describe('cartão de crédito', () => {
  it('próxima data: neste mês ou no seguinte', () => {
    expect(proximaData(28, '2026-10-10')).toEqual({ data: '2026-10-28', dias: 18 });
    expect(proximaData(5, '2026-10-10').data).toBe('2026-11-05');
    expect(proximaData(10, '2026-10-10').dias).toBe(0);
    expect(proximaData(5, '2026-12-10').data).toBe('2027-01-05');
  });
  it('compra à vista soma; parcelada soma a 1ª e guarda o resto', () => {
    expect(aplicarCompra(c0(), { descricao: 'x', valor: 100, parcelas: 1 }, 'a').usado).toBe(600);
    const p = aplicarCompra(c0(), { descricao: 'Tênis', valor: 600, parcelas: 6 }, 'a');
    expect(p.usado).toBe(600);
    expect(p.parcelados).toEqual([{ id: 'a', descricao: 'Tênis', parcela: 100, restantes: 5 }]);
    expect(comprometidoTotal(p)).toBe(500);
    expect(proximasFaturas(p, 6)).toEqual([100, 100, 100, 100, 100, 0]);
  });
  it('pagar a fatura abre a próxima com as parcelas', () => {
    const p = aplicarCompra(c0({ usado: 0 }), { descricao: 'Tênis', valor: 300, parcelas: 3 }, 'a');
    const q = aplicarPagamento(p, '2026-10-28');
    expect(q.usado).toBe(100);
    expect(q.pagas).toEqual([{ data: '2026-10-28', valor: 100 }]);
    expect(q.parcelados?.[0].restantes).toBe(1);
    expect(aplicarPagamento(q, '2026-11-28').parcelados).toEqual([]);
  });
  it('ação: vencendo, uso alto, uso médio, tudo certo', () => {
    expect(acaoCartao(c0(), '2026-10-27').tom).toBe('aviso');
    expect(acaoCartao(c0({ usado: 4500 }), '2026-10-10').tom).toBe('perigo');
    expect(acaoCartao(c0({ usado: 2000 }), '2026-10-10').tom).toBe('aviso');
    const ok = acaoCartao(c0({ usado: 300 }), '2026-10-10');
    expect(ok.tom).toBe('ok');
    expect(ok.pagar).toBe(true);
  });
});
