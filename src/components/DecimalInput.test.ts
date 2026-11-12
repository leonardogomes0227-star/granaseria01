import { describe, expect, it } from 'vitest';
import { digitarDinheiro } from './dinheiroCampo';

describe('campo de dinheiro', () => {
  it('ponto no fim vira vírgula, para o teclado decimal do celular', () => {
    expect(digitarDinheiro('12.')).toEqual({ texto: '12,', valor: 12 });
    expect(digitarDinheiro('12.5')).toEqual({ texto: '12,5', valor: 12.5 });
    expect(digitarDinheiro('12,50')).toEqual({ texto: '12,50', valor: 12.5 });
  });

  it('ponto de milhar colado continua milhar', () => {
    expect(digitarDinheiro('1.500')).toEqual({ texto: '1.500', valor: 1500 });
    expect(digitarDinheiro('1.500,50')).toEqual({ texto: '1.500,50', valor: 1500.5 });
  });

  it('zero, vazio e teto', () => {
    expect(digitarDinheiro('')).toEqual({ texto: '', valor: 0 });
    expect(digitarDinheiro('0,05')).toEqual({ texto: '0,05', valor: 0.05 });
    expect(digitarDinheiro('999999999')).toEqual({ texto: '99.999.999', valor: 99_999_999 });
  });
});
