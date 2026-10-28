import { describe, expect, it } from 'vitest';
import { amortizacaoExtra, mesDaVirada, tabelaAmortizacao, totalJurosTabela } from './amortizacao';

describe('amortização', () => {
  it('tabela fecha no zero e separa juros e abatimento', () => {
    const t = tabelaAmortizacao(1000, 2, 300)!;
    expect(t[0]).toMatchObject({ mes: 1, juros: 20, amort: 280, saldo: 720 });
    expect(t[t.length - 1]).toMatchObject({ saldo: 0 });
    expect(t.length).toBe(4);
    expect(totalJurosTabela(t)).toBeGreaterThan(30);
  });
  it('parcela que não cobre os juros não amortiza', () => expect(tabelaAmortizacao(10000, 5, 400)).toBeNull());
  it('virada do juro pro abatimento', () => {
    const t = tabelaAmortizacao(50000, 1.5, 1270)!;
    expect(t[0].juros).toBeCloseTo(750, 0);
    expect(t[0].amort).toBeLessThan(t[0].juros); // começa pagando mais juro que abatimento
    expect(mesDaVirada(t)).toBeGreaterThan(1);
    expect(mesDaVirada(tabelaAmortizacao(1000, 2, 300)!)).toBeNull(); // já começa abatendo mais
  });
  it('extra: reduzir prazo e reduzir parcela economizam', () => {
    const r = amortizacaoExtra(50000, 1.5, 1270, 5000)!;
    expect(r.prazo!.mesesAntes).toBeGreaterThan(0);
    expect(r.prazo!.economia).toBeGreaterThan(0);
    expect(r.parcela!.nova).toBeLessThan(1270);
    expect(r.parcela!.economia).toBeGreaterThan(0);
    expect(amortizacaoExtra(50000, 1.5, 1270, 0)).toBeNull();
  });
  it('extra que quita tudo', () => expect(amortizacaoExtra(1000, 2, 300, 2000)!.prazo!.meses).toBe(0));
});
