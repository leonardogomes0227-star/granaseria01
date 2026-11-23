import { describe, expect, it } from 'vitest';
import { marcaDaConta, resumoDasContas } from './contasBancarias';
import { ESTADO_INICIAL } from './tipos';

describe('contas bancárias do Início', () => {
  it('reconhece a marca pelo nome e dá uma cor estável às desconhecidas', () => {
    expect(marcaDaConta('Nubank').cor).toBe('#7A1FD0');
    expect(marcaDaConta('Banco Inter').sigla).toBe('inter');
    expect(marcaDaConta('Minha poupança').sigla).toBe('pp');
    expect(marcaDaConta('Cooperativa X').cor).toBe(marcaDaConta('Cooperativa X').cor);
  });

  it('o saldo soma receitas e transferências recebidas e tira gastos e transferências enviadas', () => {
    const e = ESTADO_INICIAL();
    e.contas = [{ id: 'a', nome: 'Nubank' }, { id: 'b', nome: 'Inter' }];
    e.receitas = [{ id: 'r', descricao: 'Salário', valor: 3000, data: '2026-11-01', tipo: 'salario', contaId: 'a' }];
    e.lancamentos = [{ id: 'l', descricao: 'Mercado', valor: 200, data: '2026-11-05', categoria: 'Mercado', contaId: 'a' }];
    e.transferencias = [{ id: 't', data: '2026-11-10', valor: 500, de: 'a', para: 'b' }];
    const [a, b] = resumoDasContas(e, '2026-11-20');
    expect(a.saldo).toBe(2300);
    expect(b.saldo).toBe(500);
    expect(a.serie.length).toBeGreaterThan(5);
  });

  it('gasto futuro ainda não entra no saldo', () => {
    const e = ESTADO_INICIAL();
    e.contas = [{ id: 'a', nome: 'C6' }];
    e.receitas = [{ id: 'r', descricao: 'Extra', valor: 100, data: '2026-11-25', tipo: 'extra', contaId: 'a' }];
    expect(resumoDasContas(e, '2026-11-20')[0].saldo).toBe(0);
  });
});
