import { describe, expect, it } from 'vitest';
import { linhasDeCategoria, regra503020 } from './orcamento';
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
});
