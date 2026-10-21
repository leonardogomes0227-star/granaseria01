import { describe, expect, it } from 'vitest';
import { barras, chaveDoVoo, juntarNomes, partesDoItem, romano, semNumero } from './resultado';

describe('cartão de resultado do chat', () => {
  it('numera em romano', () => {
    expect([1, 2, 3, 4, 5, 9, 10, 14, 40].map(romano)).toEqual(['I', 'II', 'III', 'IV', 'V', 'IX', 'X', 'XIV', 'XL']);
    expect(romano(0)).toBe('');
    expect(romano(-2)).toBe('');
    expect(romano(1.5)).toBe('');
  });

  it('tira o "1. " dos roteiros e deixa o resto', () => {
    expect(semNumero('1. Guardar R$ 400 no dia 5')).toBe('Guardar R$ 400 no dia 5');
    expect(semNumero('12) Pagar a fatura')).toBe('Pagar a fatura');
    expect(semNumero('Reserva completa em ago/28')).toBe('Reserva completa em ago/28');
    // número que é parte da frase fica
    expect(semNumero('10% da renda todo mês')).toBe('10% da renda todo mês');
  });

  it('separa o item da lista em nome e detalhe', () => {
    expect(partesDoItem('Cartão · quitada em mar/27')).toEqual({ nome: 'Cartão', detalhe: 'quitada em mar/27' });
    expect(partesDoItem('Aluguel · dia 25 · R$ 1.300')).toEqual({ nome: 'Aluguel', detalhe: 'dia 25 · R$ 1.300' });
    expect(partesDoItem('Pra viver de renda: R$ 900.000 investidos')).toEqual({ nome: 'Pra viver de renda: R$ 900.000 investidos', detalhe: null });
  });

  it('mede as barras pela maior', () => {
    const b = barras([
      { rotulo: '5 anos', valor: 25_000 },
      { rotulo: '10 anos', valor: 50_000 },
      { rotulo: '20 anos', valor: 1_000_000 },
    ]);
    expect(b.map((x) => x.pct)).toEqual([4, 5, 100]);
    expect(b[2].texto).toBe('R$ 1.000.000');
    expect(barras([{ rotulo: 'a', valor: 0.5 }])[0]).toMatchObject({ pct: 100, texto: 'R$ 0,50' });
  });

  it('aguenta gráfico vazio, zero e valor estranho', () => {
    expect(barras(undefined)).toEqual([]);
    expect(barras([{ rotulo: 'a', valor: 0 }])[0].pct).toBe(0);
    expect(barras([{ rotulo: 'a', valor: Number.NaN }, { rotulo: 'b', valor: 10 }]).map((x) => x.rotulo)).toEqual(['b']);
    expect(barras([{ rotulo: 'a', valor: -5 }, { rotulo: 'b', valor: 10 }]).map((x) => x.pct)).toEqual([0, 100]);
  });

  it('junta os nomes com "e"', () => {
    expect(juntarNomes([])).toBe('');
    expect(juntarNomes(['Arkad'])).toBe('Arkad');
    expect(juntarNomes(['Dabasir', 'Arkad'])).toBe('Dabasir e Arkad');
    expect(juntarNomes(['Dabasir', 'Arkad', 'Nomasir'])).toBe('Dabasir, Arkad e Nomasir');
  });

  it('liga o chip ao balão só quando o valor é simples', () => {
    expect(chaveDoVoo(2, 'fixa')).toBe('resposta-2-fixa');
    expect(chaveDoVoo(0, 500)).toBe('resposta-0-500');
    expect(chaveDoVoo(1, ['a'])).toBeUndefined();
  });
});
