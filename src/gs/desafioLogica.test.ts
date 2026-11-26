import { describe, expect, it } from 'vitest';
import { gerarCelulas, marcoAtingido, passoDe, progresso, sortear, valorCurto } from './desafioLogica';

const soma = (v: number[]) => v.reduce((a, b) => a + b, 0);

describe('gerarCelulas', () => {
  it.each([[1000, 30], [5000, 52], [5000, 100], [10000, 100], [40000, 365], [40000, 52], [1234, 30], [100, 100], [999, 7], [250000, 365]])('meta %i em %i quadradinhos soma exato, positivo e crescente', (alvo, n) => {
    const c = gerarCelulas(alvo, n);
    expect(c).toHaveLength(n);
    expect(soma(c)).toBe(alvo);
    expect(c.every((x) => x > 0 && Number.isInteger(x))).toBe(true);
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThanOrEqual(c[i - 1]);
  });
  it('valores redondos: múltiplos do passo (menos, no máximo, o último)', () => {
    const c = gerarCelulas(40000, 365);
    const p = passoDe(40000, 365);
    expect(c.slice(0, -1).every((x) => x % p === 0)).toBe(true);
  });
  it('começa fácil: o primeiro é bem menor que o último', () => {
    const c = gerarCelulas(5000, 100);
    expect(c[0]).toBeLessThan(c[c.length - 1] / 10);
  });
  it('meta menor que a quantidade não gera grade', () => {
    expect(gerarCelulas(10, 30)).toEqual([]);
    expect(gerarCelulas(0, 30)).toEqual([]);
  });
});

describe('progresso, sorteio e marcos', () => {
  const c = gerarCelulas(1000, 30);
  it('soma o que foi marcado, sem contar repetido', () => {
    const p = progresso(c, [0, 0, 29]);
    expect(p.guardado).toBe(c[0] + c[29]);
    expect(p.marcadas).toBe(2);
    expect(p.falta).toBe(1000 - c[0] - c[29]);
  });
  it('sorteia só quadradinho livre, e null quando acabou', () => {
    expect(sortear(c, c.map((_, i) => i).filter((i) => i !== 7), () => 0.5)).toBe(7);
    expect(sortear(c, c.map((_, i) => i))).toBeNull();
  });
  it('avisa o marco que acabou de ser atingido', () => {
    expect(marcoAtingido(20, 26)).toBe(25);
    expect(marcoAtingido(26, 40)).toBeNull();
    expect(marcoAtingido(70, 100)).toBe(75);
  });
  it('valor curto para caber no quadradinho', () => {
    expect(valorCurto(35)).toBe('35');
    expect(valorCurto(1200)).toBe('1,2 mil');
    expect(valorCurto(2000)).toBe('2 mil');
  });
});

import { beforeEach } from 'vitest';
import { criarDesafio, desmarcarCelula, marcarCelula, removerMeta } from './acoes';
import { _resetarMemoria, getEstado } from './store';

describe('desafio ligado à meta e ao "pode gastar"', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* sem storage */ } _resetarMemoria(); });
  it('criar, marcar, não marcar duas vezes, desmarcar', () => {
    const celulas = gerarCelulas(1000, 30);
    const id = criarDesafio({ nome: 'Desafio dos R$ 1.000', alvo: 1000, celulas })!;
    const m = () => getEstado().metas.find((x) => x.id === id)!;
    expect(m().alvo).toBe(1000);
    expect(marcarCelula(id, 3)).toBe(true);
    expect(marcarCelula(id, 3)).toBe(false);
    expect(m().guardados).toEqual([expect.objectContaining({ valor: celulas[3], celula: 3 })]);
    expect(getEstado().aportes.filter((a) => a.agenteId === `meta:${id}`).map((a) => a.valor)).toEqual([celulas[3]]);
    expect(desmarcarCelula(id, 3)).toBe(true);
    expect(m().guardados).toEqual([]);
    expect(getEstado().aportes.filter((a) => a.agenteId === `meta:${id}`)).toEqual([]);
  });
  it('excluir o desafio não some com o dinheiro: vai para a reserva', () => {
    const id = criarDesafio({ nome: 'X', alvo: 1000, celulas: gerarCelulas(1000, 30) })!;
    marcarCelula(id, 0);
    removerMeta(id);
    expect(getEstado().aportes.some((a) => a.origem === 'reserva')).toBe(true);
  });
});
