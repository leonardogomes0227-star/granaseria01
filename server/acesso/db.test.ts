import { describe, expect, it } from 'vitest';
import { normalizarFone } from './db';

describe('normalizarFone', () => {
  it('aceita celular com e sem 55, com máscara', () => {
    expect(normalizarFone('(67) 99999-1234')).toBe('5567999991234');
    expect(normalizarFone('+55 67 99999-1234')).toBe('5567999991234');
    expect(normalizarFone('5567999991234')).toBe('5567999991234');
  });
  it('põe o nono dígito quando faltar', () => {
    expect(normalizarFone('67 9999-1234')).toBe('5567999991234');
  });
  it('recusa o que não parece celular', () => {
    expect(normalizarFone('')).toBeNull();
    expect(normalizarFone('1234')).toBeNull();
    expect(normalizarFone('(67) 3321-1234')).toBeNull();
    expect(normalizarFone('(07) 99999-1234')).toBeNull();
  });
});
