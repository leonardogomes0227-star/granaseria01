import { describe, expect, it } from 'vitest';
import { deveLiberarFila, FILA_LIBERA_PADRAO_SEGUNDOS, respostaDaFila, segundosParaLiberar } from './filaLibera';

const criado = '2026-11-27T12:00:00.000Z';
const t0 = Date.parse(criado);

describe('tempo da fila', () => {
  it('sem variável, espera o padrão curto', () => {
    expect(segundosParaLiberar(undefined)).toBe(FILA_LIBERA_PADRAO_SEGUNDOS);
    expect(FILA_LIBERA_PADRAO_SEGUNDOS).toBeLessThanOrEqual(60);
  });
  it('aceita segundos configurados, inclusive zero', () => {
    expect(segundosParaLiberar('45')).toBe(45);
    expect(segundosParaLiberar('0')).toBe(0);
  });
  it('valor inválido volta ao padrão, e um número enorme não passa de uma hora', () => {
    expect(segundosParaLiberar('abc')).toBe(FILA_LIBERA_PADRAO_SEGUNDOS);
    expect(segundosParaLiberar('-3')).toBe(FILA_LIBERA_PADRAO_SEGUNDOS);
    expect(segundosParaLiberar('999999')).toBe(3600);
  });
});

describe('quem a fila libera', () => {
  it('em espera, só depois do tempo', () => {
    expect(deveLiberarFila('espera', criado, t0 + 19_000, 20)).toBe(false);
    expect(deveLiberarFila('espera', criado, t0 + 20_000, 20)).toBe(true);
  });
  it('convidado, ativo e recusado ficam como estão', () => {
    expect(deveLiberarFila('convidado', criado, t0 + 99_000, 20)).toBe(false);
    expect(deveLiberarFila('ativo', criado, t0 + 99_000, 20)).toBe(false);
    expect(deveLiberarFila('recusado', criado, t0 + 99_000, 20)).toBe(false);
  });
  it('sem data de entrada, não libera no escuro', () => {
    expect(deveLiberarFila('espera', 'nao-e-data', t0, 20)).toBe(false);
  });
});

describe('resposta para a página', () => {
  const row = { status: 'espera', nome: 'Ana', convite_ate: null, criado_em: criado };
  it('não traz posição, total, indicações nem dados de plano pago', () => {
    const r = respostaDaFila(row, t0, 20);
    expect(r).toEqual({
      status: 'espera',
      nome: 'Ana',
      conviteAte: null,
      liberaEm: new Date(t0 + 20_000).toISOString(),
      esperaSegundos: 20,
      liberado: false,
    });
    expect(r).not.toHaveProperty('posicao');
    expect(r).not.toHaveProperty('total');
    expect(r).not.toHaveProperty('indicacoes');
    expect(r).not.toHaveProperty('plano');
    expect(r).not.toHaveProperty('tipo');
  });
  it('convidado já está liberado, sem relógio', () => {
    const r = respostaDaFila({ ...row, status: 'convidado', convite_ate: '2026-12-04T12:00:00.000Z' }, t0 + 30_000, 20);
    expect(r.liberado).toBe(true);
    expect(r.liberaEm).toBeNull();
    expect(r.conviteAte).toBe('2026-12-04T12:00:00.000Z');
  });
});
