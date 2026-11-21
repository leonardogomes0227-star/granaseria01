import { beforeEach, describe, expect, it } from 'vitest';
import { agirPorFrase } from './midasAcoes';
import { _resetarMemoria, getEstado, substituir } from './store';
import { ESTADO_INICIAL } from './tipos';

const HOJE = '2026-01-10';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* sem armazenamento no teste */ }
  _resetarMemoria();
  const e = ESTADO_INICIAL();
  e.config.renda = 4000;
  e.config.onboardingFeito = true;
  substituir(e);
});

describe('Midas anota por frase', () => {
  it('"mercado 35" vira um gasto na categoria certa e dá para desfazer', () => {
    const r = agirPorFrase('mercado 35', HOJE);
    expect(r?.texto).toContain('Anotei');
    expect(getEstado().lancamentos).toHaveLength(1);
    expect(getEstado().lancamentos[0]).toMatchObject({ valor: 35, data: HOJE });
    r?.desfazer?.();
    expect(getEstado().lancamentos).toHaveLength(0);
  });

  it('vários gastos numa frase, com centavos', () => {
    const r = agirPorFrase('uber 18,50, almoço 30', HOJE);
    expect(getEstado().lancamentos.map((l) => l.valor).sort((a, b) => a - b)).toEqual([18.5, 30]);
    expect(r?.texto).toContain('2 gastos');
    r?.desfazer?.();
    expect(getEstado().lancamentos).toHaveLength(0);
  });

  it('"ontem" anota na data de ontem', () => {
    agirPorFrase('almoço 30 ontem', HOJE);
    expect(getEstado().lancamentos[0]?.data).toBe('2026-01-09');
  });

  it('"recebi 3000 de salário" vira receita de salário, com desfazer', () => {
    const r = agirPorFrase('recebi 3000 de salário', HOJE);
    expect(getEstado().receitas[0]).toMatchObject({ valor: 3000, tipo: 'salario' });
    r?.desfazer?.();
    expect(getEstado().receitas).toHaveLength(0);
  });

  it('pergunta não vira lançamento', () => {
    expect(agirPorFrase('quanto posso gastar hoje?', HOJE)).toBeNull();
    expect(getEstado().lancamentos).toHaveLength(0);
  });
});
