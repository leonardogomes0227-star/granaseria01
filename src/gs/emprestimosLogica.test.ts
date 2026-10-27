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
