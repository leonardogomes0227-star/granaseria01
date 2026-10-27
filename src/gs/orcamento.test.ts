import { describe, expect, it } from 'vitest';
import { acaoOrcamento, linhasDeCategoria, mesesNoLimite, regra503020, resumoDoMes } from './orcamento';
import { ESTADO_INICIAL, type Estado } from './tipos';

const base = (): Estado => {
  const e = ESTADO_INICIAL();
  e.config.renda = 5000;
  e.gastosFixos = [{ id: 'a', nome: 'Aluguel', valor: 1500, diaVencimento: 5, categoria: 'Aluguel', pagamentos: {} }];
  e.lancamentos = [
    { id: '1', descricao: 'mercado', valor: 800, data: '2026-10-02', categoria: 'Mercado' },
    { id: '2', descricao: 'ifood', valor: 450, data: '2026-10-03', categoria: 'Comida' },
    { id: '3', descricao: 'tênis', valor: 100, data: '2026-10-04', categoria: 'Compras' },
  ];
  return e;
};

describe('orçamento', () => {
  it('cores dos limites: normal, âmbar, vermelho; sem limite não tem barra', () => {
    const e = base();
    e.limites = { Mercado: 1600, Comida: 500, Compras: 80 };
    const l = Object.fromEntries(linhasDeCategoria(e, '2026-10').map((x) => [x.categoria, x]));
    expect(l.Mercado.tom).toBe('ok');
    expect(l.Comida.tom).toBe('aviso');
    expect(l.Compras.tom).toBe('perigo');
    expect(l.Lazer.tom).toBe('sem');
    expect(l.Lazer.pct).toBeNull();
  });
  it('regra 50/30/20 usa contas fixas e gastos', () => {
    const r = regra503020(base(), '2026-10');
    expect(r.map((x) => x.nome)).toEqual(['Necessidades', 'Desejos', 'Guardar']);
    expect(Math.round(r[0].pct)).toBe(46); // 1500 + 800
    expect(Math.round(r[1].pct)).toBe(11); // 450 + 100
    expect(Math.round(r[2].pct)).toBe(43);
    expect(r.every((x) => x.ok)).toBe(true);
  });
  it('sem renda não devolve regra', () => {
    expect(regra503020(ESTADO_INICIAL(), '2026-10')).toEqual([]);
  });
  it('resumo do mês: orçamento do dia a dia e ritmo', () => {
    const r = resumoDoMes(base(), '2026-10', '2026-10-10');
    expect(r.gastoVar).toBe(1350);
    expect(r.orcamento).toBe(3500); // 5000 - 1500 de fixas
    expect(r.ritmo).toBeCloseTo((1350 / 10) * 31, 0);
    expect(r.sobraProjetada).toBeLessThan(0);
  });
  it('ação: estouro vence, depois quase, depois ritmo', () => {
    const e = base();
    e.limites = { Compras: 80 };
    expect(acaoOrcamento(e, '2026-10', '2026-10-10').tom).toBe('perigo');
    e.limites = { Comida: 500 };
    expect(acaoOrcamento(e, '2026-10', '2026-10-10').tom).toBe('aviso');
    e.limites = { Mercado: 2000 };
    expect(acaoOrcamento(e, '2026-10', '2026-10-10').texto).toContain('No ritmo');
  });
  it('sem limites pede limites; sem gasto pede o primeiro gasto', () => {
    const e = base();
    expect(acaoOrcamento(e, '2026-10', '2026-10-10').texto).toContain('limites');
    e.lancamentos = [];
    expect(acaoOrcamento(e, '2026-10', '2026-10-10').texto).toContain('primeiro');
  });
  it('meses sem estourar', () => {
    const e = base();
    e.limites = { Mercado: 1000 };
    e.lancamentos.push({ id: '9', descricao: 'mercado', valor: 500, data: '2026-09-10', categoria: 'Mercado' }, { id: '8', descricao: 'mercado', valor: 2000, data: '2026-08-10', categoria: 'Mercado' });
    expect(mesesNoLimite(e, '2026-10')).toBe(2); // out e set dentro, ago estourou
  });
});
