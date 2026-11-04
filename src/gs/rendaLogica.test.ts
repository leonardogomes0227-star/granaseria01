import { describe, expect, it } from 'vitest';
import { conquistasRenda, contasCobertas, coberturaPct, mesesAteMeta, rendimentoMensal } from './rendaLogica';

describe('viver de renda', () => {
  it('rendimento e cobertura', () => {
    expect(rendimentoMensal(10000, 0.7)).toBe(70);
    expect(coberturaPct(70, 2000)).toBeCloseTo(3.5, 5);
    expect(coberturaPct(70, 0)).toBe(0);
  });
  it('contas que o rendimento já paga, das menores pras maiores', () => {
    expect(contasCobertas([{ nome: 'Aluguel', valor: 1500 }, { nome: 'Internet', valor: 100 }, { nome: 'Luz', valor: 180 }], 300)).toEqual(['Internet', 'Luz']);
    expect(contasCobertas([{ nome: 'Aluguel', valor: 1500 }], 70)).toEqual([]);
  });
  it('conquistas por cobertura', () => {
    expect(conquistasRenda(0.5)).toEqual([]);
    expect(conquistasRenda(30)).toEqual(['1% dos gastos cobertos', '10% dos gastos cobertos', '25% dos gastos cobertos']);
  });
  it('meses até a meta', () => {
    expect(mesesAteMeta(0, 1200, 100, 0)).toBe(12);
    expect(mesesAteMeta(2000, 1000, 0, 0.7)).toBe(0);
    expect(mesesAteMeta(0, 1_000_000, 10, 0)).toBeNull();
  });
});

import { degrausDeRenda } from './rendaLogica';

describe('degraus até viver de renda', () => {
  it('cada conta (da menor pra maior) vira um degrau; o último paga tudo', () => {
    const fixas = [{ nome: 'Aluguel', valor: 1200 }, { nome: 'Internet', valor: 100 }, { nome: 'Luz', valor: 200 }];
    const d = degrausDeRenda(fixas, 2500, 20000, 0.5, 1000);
    expect(d.map((x) => [x.titulo, x.rendaMes, x.patrimonio, x.feito])).toEqual([
      ['Paga Internet', 100, 20000, true],
      ['Paga também Luz', 300, 60000, false],
      ['Paga também Aluguel', 1500, 300000, false],
      ['Paga tudo: você vive de renda', 2500, 500000, false],
    ]);
    expect(d[0].meses).toBe(0);
    expect(d[1].meses).toBeGreaterThan(30);
    expect(d[1].meses).toBeLessThan(d[2].meses!);
  });
  it('sem gasto ou sem taxa, não monta', () => {
    expect(degrausDeRenda([], 0, 0, 0.5, 100)).toEqual([]);
    expect(degrausDeRenda([], 1000, 0, 0, 100)).toEqual([]);
  });
});
