import { describe, expect, it } from 'vitest';
import { barra, comLimite, limiteDe, limitesDaMissao, limparLimites } from './limites';

describe('limites por categoria', () => {
  it('limpa o que veio do estado: só nome com texto e valor positivo', () => {
    expect(limparLimites({ Alimentação: 600, Lazer: '200', Outros: 0, '': 50, Saúde: -3, Pets: 'x' })).toEqual({ Alimentação: 600, Lazer: 200 });
    expect(limparLimites(null)).toEqual({});
    expect(limparLimites([1, 2])).toEqual({});
    expect(limparLimites('{}')).toEqual({});
  });

  it('definir, trocar e tirar um limite', () => {
    const a = comLimite({}, 'Alimentação', 600);
    expect(a).toEqual({ Alimentação: 600 });
    expect(comLimite(a, 'Alimentação', 750.555)).toEqual({ Alimentação: 750.56 });
    expect(comLimite(a, 'Alimentação', 0)).toEqual({});
    expect(comLimite(a, 'Alimentação', null)).toEqual({});
    expect(a).toEqual({ Alimentação: 600 }); // não muda o original
  });

  it('os tetos do Nomasir viram padrão só quando falam da mesma categoria', () => {
    expect(limitesDaMissao({ Delivery: 200, Saídas: 300, 'Compras online': 250, 'Transporte por app': 150 })).toEqual({ Lazer: 300, Compras: 250 });
    // "outro" com o nome de uma categoria vale pra ela; teto zero (cortar de vez) não vira limite
    expect(limitesDaMissao({ Transporte: 400, Lazer: 0, Comida: 900 })).toEqual({ Transporte: 400, Alimentação: 900 });
    // dois tetos na mesma categoria somam
    expect(limitesDaMissao({ Saídas: 300, Lazer: 100 })).toEqual({ Lazer: 400 });
    expect(limitesDaMissao(undefined)).toEqual({});
  });

  it('quem vale: o da pessoa, depois o do Nomasir, depois o do diagnóstico', () => {
    const fontes = { proprios: { Lazer: 500 }, missao: { Lazer: 300, Compras: 250 }, diagnostico: { Lazer: 400, Alimentação: 900, Compras: 100 } };
    expect(limiteDe('Lazer', fontes)).toEqual({ valor: 500, origem: 'proprio' });
    expect(limiteDe('Compras', fontes)).toEqual({ valor: 250, origem: 'missao' });
    expect(limiteDe('Alimentação', fontes)).toEqual({ valor: 900, origem: 'diagnostico' });
    expect(limiteDe('Outros', fontes)).toBeNull();
    expect(limiteDe('Outros', { proprios: {} })).toBeNull();
  });

  it('cores da barra: < 80% normal, 80–100% âmbar, > 100% tijolo', () => {
    expect(barra(0, 600)).toEqual({ pct: 0, tom: 'normal', resta: 600, passou: 0 });
    expect(barra(479, 600).tom).toBe('normal');
    expect(barra(480, 600)).toEqual({ pct: 80, tom: 'atencao', resta: 120, passou: 0 });
    expect(barra(600, 600)).toEqual({ pct: 100, tom: 'atencao', resta: 0, passou: 0 });
    expect(barra(650, 600)).toEqual({ pct: 100, tom: 'estourou', resta: 0, passou: 50 });
  });

  it('sem limite a barra nunca fica cheia (o "Outros" de antes)', () => {
    expect(barra(1200, null)).toEqual({ pct: 0, tom: 'sem', resta: 0, passou: 0 });
    expect(barra(1200, 0).pct).toBe(0);
    expect(barra(1200, undefined).tom).toBe('sem');
  });

  it('valores pequenos e enormes não quebram a conta', () => {
    expect(barra(0.5, 1_000_000)).toEqual({ pct: 0, tom: 'normal', resta: 999_999.5, passou: 0 });
    expect(barra(1_000_000, 0.5).tom).toBe('estourou');
    expect(barra(Number.NaN, 100).pct).toBe(0);
  });
});
