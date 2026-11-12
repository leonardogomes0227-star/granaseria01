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
    expect(r.orcamento).toBe(3000); // 5000 − 1500 de fixas − 500 pra reserva (10%)
    expect(r.ritmo).toBeCloseTo((1350 / 10) * 31, 0);
    expect(r.sobraProjetada).toBeLessThan(0);
  });
  it('quando o gasto passa do que sobra, o percentual passa de 100', () => {
    const e = base();
    e.lancamentos = [{ id: 'z', descricao: 'viagem', valor: 4000, data: '2026-10-02', categoria: 'Lazer' }];
    expect(resumoDoMes(e, '2026-10', '2026-10-10').pctUsado).toBeGreaterThan(100);
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

import { baseDoMes, envelopes, planoDeOrcamento } from './orcamento';

describe('envelopes', () => {
  // renda 5000, aluguel 1500, guarda 10% (500): sobram 3000 pro dia a dia
  const comHistorico = (): Estado => {
    const e = base();
    e.lancamentos = [
      { id: '1', descricao: 'mercado', valor: 900, data: '2026-09-10', categoria: 'Mercado' },
      { id: '2', descricao: 'uber', valor: 300, data: '2026-09-12', categoria: 'Transporte' },
      { id: '3', descricao: 'mercado', valor: 1100, data: '2026-10-10', categoria: 'Mercado' },
      { id: '4', descricao: 'uber', valor: 300, data: '2026-10-12', categoria: 'Transporte' },
    ];
    return e;
  };
  it('quanto dá pro dia a dia: renda − fixas − guardar', () => {
    expect(baseDoMes(comHistorico(), '2026-11')).toMatchObject({ fixos: 1500, guardar: 500, atraso: 0, diaADia: 3000 });
  });
  it('divide pelo que a pessoa costuma gastar, e o resto fica de sobra', () => {
    const p = planoDeOrcamento(comHistorico(), '2026-11');
    expect(p.fonte).toBe('historico');
    expect(p.costuma).toBe(1300);
    expect(Object.fromEntries(p.itens.map((i) => [i.categoria, i.valor]))).toEqual({ Mercado: 1000, Transporte: 300, Outros: 60 });
    expect(p.sobra).toBe(1640);
  });
  it('se costuma gastar mais do que dá, corta na mesma proporção', () => {
    const e = comHistorico();
    e.config.renda = 3200; // 3200 − 1500 − 320 = 1380 pro dia a dia, costuma 1300 + 5% de imprevisto
    const p = planoDeOrcamento(e, '2026-11');
    expect(p.itens.reduce((t, i) => t + i.valor, 0)).toBeLessThanOrEqual(p.base.diaADia);
    expect(p.itens[0].categoria).toBe('Mercado');
  });
  it('sem histórico, divide pela renda e usa tudo', () => {
    const e = base();
    e.lancamentos = [];
    const p = planoDeOrcamento(e, '2026-11');
    expect(p.fonte).toBe('renda');
    expect(p.itens.reduce((t, i) => t + i.valor, 0)).toBe(3000);
  });
  it('envelope: quanto resta, por dia e o dia em que acaba no ritmo de agora', () => {
    const e = base();
    e.limites = { Mercado: 1200, Comida: 400 };
    const [comida, mercado] = envelopes(e, '2026-10', '2026-10-10');
    expect(comida).toMatchObject({ categoria: 'Comida', resta: -50, tom: 'perigo' });
    expect(mercado).toMatchObject({ categoria: 'Mercado', resta: 400, acabaDia: 15, tom: 'aviso' });
    expect(mercado.porDia).toBe(18.18);
  });
});
