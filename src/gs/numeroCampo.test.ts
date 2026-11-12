import { describe, expect, it } from 'vitest';
import { digitarNumero, fecharNumero } from './numeroCampo';

describe('campo de número', () => {
  it('não sobe para o mínimo no meio da digitação', () => {
    expect(digitarNumero('1', 480).valor).toBe(1);
    expect(digitarNumero('0', 5).valor).toBe(0);
    expect(digitarNumero('0,', 5)).toEqual({ texto: '0,', valor: 0 });
    expect(digitarNumero('0,5', 30).valor).toBe(0.5);
    expect(digitarNumero('10', 60).valor).toBe(10);
  });

  it('o teto vale na hora e o mínimo só ao sair', () => {
    expect(digitarNumero('99', 31)).toEqual({ texto: '31', valor: 31 });
    expect(fecharNumero('0', 1, 31)).toEqual({ texto: '1', valor: 1 });
    expect(fecharNumero('0,5', 0.1, 5)).toEqual({ texto: '0,5', valor: 0.5 });
    expect(fecharNumero('', 1, 31)).toEqual({ texto: '', valor: '' });
    expect(fecharNumero('abc', 1, 31)).toEqual({ texto: '', valor: '' });
  });
});
