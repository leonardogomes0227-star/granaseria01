import { describe, expect, it } from 'vitest';
import { agruparPorDia, diaDe, digitar, diaMinimo, mesValido, mesesParaEscolher, nomeDoMes, partesDoTexto, teclaDoTeclado, textoDoValor, tituloDia, valorDoTexto, type Tecla } from './mes';

const digitarTudo = (teclas: Tecla[]) => teclas.reduce((t, k) => digitar(t, k), '');

describe('teclado do valor', () => {
  it('digita inteiro, vírgula e até dois centavos', () => {
    expect(digitarTudo(['4', '2', ',', '5', '0', '9'])).toBe('42,50');
    expect(digitarTudo([',', '5'])).toBe('0,5');
    expect(digitarTudo(['0', '0', '7'])).toBe('7');
    expect(digitarTudo(['1', ',', ','])).toBe('1,');
    expect(digitarTudo(['1', '2', 'apagar'])).toBe('1');
    expect(digitarTudo(['apagar'])).toBe('');
  });

  it('não passa de R$ 9.999.999,99', () => {
    expect(digitarTudo(['1', '0', '0', '0', '0', '0', '0', '0'])).toBe('1000000');
    expect(digitarTudo(['9', '9', '9', '9', '9', '9', '9', '9', ',', '9', '9'])).toBe('9999999,99');
  });

  it('valor, texto e como mostrar', () => {
    expect(valorDoTexto('42,50')).toBe(42.5);
    expect(valorDoTexto('0,5')).toBe(0.5);
    expect(valorDoTexto('')).toBe(0);
    expect(valorDoTexto('12,')).toBe(12);
    expect(textoDoValor(42.5)).toBe('42,50');
    expect(textoDoValor(80)).toBe('80');
    expect(textoDoValor(0.5)).toBe('0,50');
    expect(textoDoValor(0)).toBe('');
    expect(partesDoTexto('1234,5')).toEqual({ inteiro: '1.234', decimais: ',5' });
    expect(partesDoTexto('1000000')).toEqual({ inteiro: '1.000.000', decimais: '' });
    expect(partesDoTexto('')).toEqual({ inteiro: '0', decimais: '' });
  });

  it('teclado físico', () => {
    expect(teclaDoTeclado('7')).toBe('7');
    expect(teclaDoTeclado('.')).toBe(',');
    expect(teclaDoTeclado(',')).toBe(',');
    expect(teclaDoTeclado('Backspace')).toBe('apagar');
    expect(teclaDoTeclado('a')).toBeNull();
    expect(teclaDoTeclado('Enter')).toBeNull();
  });
});

describe('dias da lista', () => {
  const HOJE = '2026-10-21';
  it('"Hoje", "Ontem" e "18 out"', () => {
    expect(tituloDia('2026-10-21', HOJE)).toBe('Hoje');
    expect(tituloDia('2026-10-20', HOJE)).toBe('Ontem');
    expect(tituloDia('2026-10-18', HOJE)).toBe('18 out');
    expect(tituloDia('2026-09-30', '2026-10-01')).toBe('Ontem');
  });

  it('o dia é o de Brasília (23h de lá ainda é o mesmo dia)', () => {
    expect(diaDe('2026-10-22T01:30:00Z')).toBe('2026-10-21');
    expect(diaDe('2026-10-21T15:00:00.000Z')).toBe('2026-10-21');
  });

  it('agrupa do dia mais novo pro mais velho, mantendo a ordem dentro do dia', () => {
    const g = agruparPorDia(
      [
        { dia: '2026-10-21', n: 1 },
        { dia: '2026-10-18', n: 2 },
        { dia: '2026-10-21', n: 3 },
        { dia: '2026-10-20', n: 4 },
      ],
      HOJE
    );
    expect(g.map((x) => [x.titulo, x.itens.map((i) => i.n)])).toEqual([
      ['Hoje', [1, 3]],
      ['Ontem', [4]],
      ['18 out', [2]],
    ]);
    expect(agruparPorDia([], HOJE)).toEqual([]);
  });
});

describe('meses', () => {
  it('o atual e os que passaram, nunca o futuro', () => {
    const m = mesesParaEscolher('2026-10', 3);
    expect(m).toEqual(['2026-10', '2026-09', '2026-08', '2026-07']);
    expect(mesesParaEscolher('2026-01', 1)).toEqual(['2026-01', '2025-12']);
    expect(mesValido('2026-11', '2026-10')).toBe('2026-10');
    expect(mesValido('2026-08', '2026-10')).toBe('2026-08');
    expect(mesValido('2020-01', '2026-10')).toBe('2026-10');
    expect(mesValido(null, '2026-10')).toBe('2026-10');
  });

  it('nome do mês, com o ano só quando é outro', () => {
    expect(nomeDoMes('2026-10', '2026-10')).toBe('outubro');
    expect(nomeDoMes('2025-12', '2026-01')).toBe('dezembro de 2025');
  });

  it('o dia mais antigo pra anotar', () => {
    expect(diaMinimo('2026-10-21')).toBe('2025-10-01');
  });
});
