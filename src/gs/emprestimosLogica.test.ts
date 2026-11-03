import { describe, expect, it } from 'vitest';
import { avaliarOferta, ofertaComoDivida } from './emprestimosLogica';
import { custoDaOferta } from './ferramentas';

describe('empréstimos', () => {
  const c = custoDaOferta({ valor: 5000, parcelas: 12, parcela: 520 });
  it('avalia peso na renda, bolso, troca e horas de trabalho', () => {
    const a = avaliarOferta(c, { renda: 5000, capacidade: 1000, horasMes: 200, maiorJuroDivida: 9 });
    expect(a.pesoRenda).toBeCloseTo(10.4, 1);
    expect(a.cabe).toBe(true);
    expect(a.trocaCompensa).toBe(true);
    expect(a.juroDeTrabalho).toBeGreaterThan(0);
    const b = avaliarOferta(c, { renda: 0, capacidade: 0, horasMes: 200, maiorJuroDivida: 0 });
    expect(b).toEqual({ pesoRenda: null, cabe: null, trocaCompensa: null, juroDeTrabalho: null });
  });
  it('vira dívida', () => {
    const d = ofertaComoDivida(c, 'Empréstimo 1');
    expect(d).toMatchObject({ nome: 'Empréstimo 1', saldo: 5000, parcelaMinima: 520 });
    expect(d.jurosMensal).toBeGreaterThan(0);
  });
});

import { custoDoEmprestimo, parcelaPorTaxa, porPrazo, taxaAnualDeMensal } from './emprestimosLogica';

describe('quanto custa o empréstimo', () => {
  it('pela taxa: R$ 5.000 em 24x a 4% ao mês', () => {
    expect(parcelaPorTaxa(5000, 24, 4)).toBe(327.93);
    const c = custoDoEmprestimo({ valor: 5000, parcelas: 24, taxaMensalPct: 4 })!;
    expect(c.total).toBe(7870.32);
    expect(c.juros).toBe(2870.32);
    expect(c.pctJuros).toBe(57.4);
    expect(c.taxaMensal).toBeCloseTo(4, 1);
    expect(c.taxaAnual).toBeCloseTo(60.1, 0);
  });
  it('pela parcela: descobre a taxa', () => {
    const c = custoDoEmprestimo({ valor: 5000, parcelas: 12, parcela: 520 })!;
    expect(c.juros).toBe(1240);
    expect(c.taxaMensal).toBeGreaterThan(3);
  });
  it('sem juro e entradas faltando', () => {
    expect(custoDoEmprestimo({ valor: 1200, parcelas: 12, taxaMensalPct: 0 })).toMatchObject({ parcela: 100, juros: 0 });
    expect(custoDoEmprestimo({ valor: 0, parcelas: 12, taxaMensalPct: 3 })).toBeNull();
    expect(custoDoEmprestimo({ valor: 1000, parcelas: 12 })).toBeNull();
  });
  it('prazo maior, mais juro; taxa ao ano é juro sobre juro', () => {
    const t = porPrazo(5000, 4, [12, 24, 48]);
    expect(t[0].juros).toBeLessThan(t[1].juros);
    expect(t[1].juros).toBeLessThan(t[2].juros);
    expect(Math.round(taxaAnualDeMensal(4))).toBe(60);
  });
});
