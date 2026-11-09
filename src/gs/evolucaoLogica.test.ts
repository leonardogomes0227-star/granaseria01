import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL, type Estado } from './tipos';
import { frasesDeEvolucao, gastosPorCategoria, patrimonioPorMes, planejadoXRealizado, serieMensal } from './evolucaoLogica';

const HOJE = '2026-11-20';
const mk = (p: Partial<Estado> = {}, renda = 3000): Estado => ({ ...ESTADO_INICIAL(), ...p, config: { ...ESTADO_INICIAL().config, renda } });
const L = (id: string, valor: number, data: string, categoria = 'Mercado') => ({ id, descricao: id, valor, data, categoria });

describe('evolução', () => {
  it('sem dados: nada de comparação inventada', () => {
    expect(frasesDeEvolucao(mk(), HOJE)).toEqual([]);
    expect(patrimonioPorMes(mk(), HOJE)).toBeNull();
  });
  it('série só começa no primeiro registro e marca renda estimada', () => {
    const s = serieMensal(mk({ lancamentos: [L('a', 100, '2026-10-05')] }), HOJE);
    expect(s.map((x) => x.mes)).toEqual(['2026-10', '2026-11']);
    expect(s[0].receitaEstimada).toBe(true);
    expect(s[0].receitas).toBe(3000);
  });
  it('receita registrada vale mais que a estimativa', () => {
    const e = mk({ lancamentos: [L('a', 100, '2026-10-05')], receitas: [{ id: 'r', descricao: 'S', valor: 3200, data: '2026-10-05', tipo: 'salario' }] });
    const s = serieMensal(e, HOJE)[0];
    expect(s.receitas).toBe(3200);
    expect(s.receitaEstimada).toBe(false);
  });
  it('compara no mesmo período do mês anterior', () => {
    const e = mk({ lancamentos: [L('a', 300, '2026-10-03'), L('b', 900, '2026-10-25'), L('c', 150, '2026-11-03')] });
    const f = frasesDeEvolucao(e, HOJE);
    expect(f.find((x) => x.id === 'mes-menos')?.texto).toMatch(/50%/); // 150 vs 300 até o dia 20 (o 900 do dia 25 não conta)
  });
  it('categorias e planejado × realizado', () => {
    const e = mk({ lancamentos: [L('a', 400, '2026-11-02'), L('b', 100, '2026-11-03', 'Lazer')], limites: { Mercado: 300 } });
    expect(gastosPorCategoria(e, '2026-11')[0].categoria).toBe('Mercado');
    expect(planejadoXRealizado(e, '2026-11')).toEqual([{ categoria: 'Mercado', planejado: 300, realizado: 400 }]);
  });
  it('% guardado usa a renda', () => {
    const e = mk({ lancamentos: [L('a', 10, '2026-11-02')], aportes: [{ id: 'x', data: '2026-11-02', valor: 300, origem: 'reserva' }] });
    expect(frasesDeEvolucao(e, HOJE).find((x) => x.id === 'guardou')?.texto).toMatch(/10%/);
  });
});

import { compararMeses, economiaAcumulada } from './evolucaoLogica';
describe('economia acumulada e comparação', () => {
  const e = mk({ lancamentos: [L('a', 1000, '2026-10-05'), L('b', 500, '2026-11-05')] }, 3000);
  it('acumula receitas − despesas só dos meses com dados', () => {
    const s = serieMensal(e, HOJE, 3);
    expect(economiaAcumulada(s).map((x) => x.valor)).toEqual([2000, 4500]);
  });
  it('compara com o mês anterior; sem anterior não inventa', () => {
    const s = serieMensal(e, HOJE, 3);
    expect(compararMeses(s, '2026-11')?.dDespesas).toBe(-50);
    expect(compararMeses(s, '2026-10')).toBeNull();
  });
});
