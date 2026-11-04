import { describe, expect, it } from 'vitest';
import { analisarParcelado } from './parcelado';

describe('à vista ou parcelado', () => {
  it('parcelado sem juros: mesmo valor', () => {
    const r = analisarParcelado({ avista: 1200, parcelas: 12, parcela: 100 });
    expect(r.semJuros).toBe(true);
    expect(r.jurosPagos).toBe(0);
    expect(r.taxaMensalPct).toBe(0);
  });
  it('acha o juro escondido', () => {
    const r = analisarParcelado({ avista: 1800, parcelas: 10, parcela: 210 });
    expect(r.total).toBe(2100);
    expect(r.jurosPagos).toBe(300);
    expect(r.taxaMensalPct).toBeCloseTo(2.91, 1);
    expect(r.semJuros).toBe(false);
  });
  it('desconto à vista de 7%', () => {
    const r = analisarParcelado({ avista: 1000, parcelas: 10, parcela: 120 });
    expect(r.comDescontoAvista).toBe(930);
    expect(r.economiaComDesconto).toBe(270);
  });
});

import { duelo } from './parcelado';

describe('duelo à vista × parcelado', () => {
  it('juro alto: à vista ganha', () => {
    const d = duelo({ avista: 1000, parcelas: 10, parcela: 120, descontoAvistaPct: 0, rendeMensalPct: 0.9 });
    expect(d.vencedor).toBe('avista');
    expect(d.diferenca).toBe(200);
    expect(d.taxaContraDesconto).toBeGreaterThan(3);
  });
  it('"sem juros" mas com desconto à vista: o juro está escondido no desconto', () => {
    const d = duelo({ avista: 1000, parcelas: 10, parcela: 100, descontoAvistaPct: 10, rendeMensalPct: 0.9 });
    expect(d.vencedor).toBe('avista');
    expect(d.diferenca).toBe(100);
  });
  it('sem juros e sem desconto: empate (parcele e deixe rendendo)', () => {
    expect(duelo({ avista: 1000, parcelas: 10, parcela: 100, descontoAvistaPct: 0, rendeMensalPct: 0.9 }).vencedor).toBe('empate');
  });
  it('juro menor que o rendimento: parcelado ganha', () => {
    expect(duelo({ avista: 1000, parcelas: 10, parcela: 101, descontoAvistaPct: 0, rendeMensalPct: 0.9 }).vencedor).toBe('parcelado');
  });
});
