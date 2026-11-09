import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL } from './tipos';
import { filtrarMovimentos, movimentosDoMes, totaisMov } from './movimentos';

const e = ESTADO_INICIAL();
e.lancamentos = [{ id: 'l1', descricao: 'Mercado', valor: 100, data: '2026-11-02', categoria: 'Mercado' }];
e.receitas = [{ id: 'r1', descricao: 'Salário', valor: 3000, data: '2026-11-05', tipo: 'salario' }];
e.gastosFixos = [{ id: 'g1', nome: 'Aluguel', valor: 1000, diaVencimento: 5, categoria: 'Aluguel', pagamentos: { '2026-11': { valorPago: 1000, pagoEm: '2026-11-05' } } }];

describe('movimentos', () => {
  it('conta paga aparece uma única vez (derivada, sem despesa duplicada)', () => {
    const m = movimentosDoMes(e, '2026-11');
    expect(m.filter((x) => x.descricao === 'Aluguel')).toHaveLength(1);
    expect(m).toHaveLength(3);
    expect(totaisMov(m)).toEqual({ entrou: 3000, saiu: 1100, saldo: 1900 });
  });
  it('filtra por tipo e busca sem ligar para acento', () => {
    const m = movimentosDoMes(e, '2026-11');
    expect(filtrarMovimentos(m, { tipo: 'receita', busca: '', categoria: '' })).toHaveLength(1);
    expect(filtrarMovimentos(m, { tipo: 'todos', busca: 'salario', categoria: '' })).toHaveLength(1);
    expect(filtrarMovimentos(m, { tipo: 'todos', busca: '', categoria: 'Mercado' })).toHaveLength(1);
  });
});
