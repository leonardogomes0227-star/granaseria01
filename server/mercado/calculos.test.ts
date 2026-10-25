import { describe, expect, it } from 'vitest';
import { baseCemDePrecos, baseCemDeTaxas, dataBCB, jurosReal, mesesDaJanela, poupancaAnualPct, poupancaMensalPct, retornoFinal, taxaAnualPlausivel, ultimoDeCadaMes } from './calculos';

describe('dados de mercado', () => {
  it('data do Banco Central', () => expect(dataBCB('16/10/2026')).toBe('2026-10-16'));
  it('janela de 13 fins de mês', () => {
    const j = mesesDaJanela('2026-10');
    expect(j).toHaveLength(13);
    expect(j[0]).toBe('2025-10');
    expect(j[12]).toBe('2026-10');
  });
  it('último valor de cada mês, mesmo com séries diárias e mensais misturadas', () => {
    const m = ultimoDeCadaMes([{ data: '2026-09-01', valor: 5 }, { data: '2026-09-30', valor: 5.4 }, { data: '2026-10-15', valor: 5.5 }, { data: '2026-10-02', valor: 5.2 }]);
    expect(m.get('2026-09')).toBe(5.4);
    expect(m.get('2026-10')).toBe(5.5);
  });
  it('taxas mensais viram base 100', () => {
    const s = baseCemDeTaxas([1, 1]);
    expect(s[0]).toBe(100);
    expect(s[2]).toBeCloseTo(102.01, 2);
    expect(retornoFinal(s)).toBe(2.01);
  });
  it('preços de fim de mês viram base 100; mês sem dado repete o anterior', () => {
    const p = new Map([['2025-10', 50], ['2025-12', 75]]);
    expect(baseCemDePrecos(p, ['2025-10', '2025-11', '2025-12'])).toEqual([100, 100, 150]);
    expect(baseCemDePrecos(new Map(), ['2025-10'])).toBeNull();
  });
  it('poupança: 0,5% ao mês com Selic alta; 70% da Selic com Selic baixa', () => {
    expect(poupancaMensalPct(14.75)).toBe(0.5);
    expect(poupancaAnualPct(14.75)).toBeCloseTo(6.17, 1);
    expect(poupancaMensalPct(8)).toBeCloseTo(0.7 * 0.6434, 2);
  });
  it('juro real e plausibilidade', () => {
    expect(jurosReal(14.9, 4.8)).toBe(10.1);
    expect(taxaAnualPlausivel(14.9)).toBe(true);
    expect(taxaAnualPlausivel(0.149)).toBe(false);
    expect(taxaAnualPlausivel(149)).toBe(false);
  });
});
