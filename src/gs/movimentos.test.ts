import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL } from './tipos';
import { filtrarMovimentos, intervalo, movimentosDoMes, movimentosNoPeriodo, totaisMov } from './movimentos';

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

describe('transferências, conta, período e ordem', () => {
  const x = ESTADO_INICIAL();
  x.contas = [{ id: 'a', nome: 'Nubank' }, { id: 'b', nome: 'Carteira' }];
  x.lancamentos = [{ id: 'l1', descricao: 'Café', valor: 10, data: '2026-11-08', categoria: 'Comida', contaId: 'a' }, { id: 'l2', descricao: 'Jantar', valor: 90, data: '2026-10-01', categoria: 'Comida', contaId: 'b' }];
  x.transferencias = [{ id: 't', data: '2026-11-09', valor: 500, de: 'a', para: 'b' }];
  it('transferência é neutra nos totais e mostra origem → destino', () => {
    const m = movimentosNoPeriodo(x, '2026-11-01', '2026-11-30');
    expect(m.find((i) => i.tipo === 'transferencia')?.descricao).toBe('Nubank → Carteira');
    expect(totaisMov(m)).toEqual({ entrou: 0, saiu: 10, saldo: -10 });
  });
  it('filtra por conta e ordena', () => {
    const m = movimentosNoPeriodo(x, '2026-10-01', '2026-11-30');
    expect(filtrarMovimentos(m, { tipo: 'todos', busca: '', categoria: '', contaId: 'b' })).toHaveLength(1);
    expect(filtrarMovimentos(m, { tipo: 'despesa', busca: '', categoria: '', ordem: 'maior' })[0].valor).toBe(90);
    expect(filtrarMovimentos(m, { tipo: 'despesa', busca: '', categoria: '', ordem: 'antigos' })[0].valor).toBe(90);
  });
  it('atalhos de período', () => {
    expect(intervalo('7d', '2026-11', '2026-11-10')).toEqual({ de: '2026-11-04', ate: '2026-11-10' });
    expect(intervalo('ano', '2026-11', '2026-11-10').de).toBe('2026-01-01');
  });
});
