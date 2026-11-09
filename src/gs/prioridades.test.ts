import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL } from './tipos';
import { prioridades, resumoSemaforo } from './prioridades';

describe('prioridades do planejamento', () => {
  it('ordena vermelho, amarelo, verde e inclui cartão e dívida', () => {
    const e = ESTADO_INICIAL();
    e.gastosFixos = [
      { id: 'a', nome: 'Aluguel', valor: 1000, diaVencimento: 5, categoria: 'Aluguel', pagamentos: {}, criadaEm: '2026-11-01' },
      { id: 'b', nome: 'Luz', valor: 100, diaVencimento: 12, categoria: 'Luz', pagamentos: {}, criadaEm: '2026-11-01' },
      { id: 'c', nome: 'Internet', valor: 100, diaVencimento: 28, categoria: 'Internet', pagamentos: {}, criadaEm: '2026-11-01' },
    ];
    e.cartao = { limite: 1000, usado: 200, fechaDia: 1, venceDia: 25 };
    e.dividas = [{ id: 'd', nome: 'Empréstimo', saldo: 500, jurosMensal: 2, parcelaMinima: 100, pagamentos: [], venceDia: 20 }];
    const p = prioridades(e, '2026-11-10');
    expect(p[0].titulo).toBe('Aluguel');
    expect(p[0].semaforo).toBe('vermelho');
    expect(p.map((x) => x.semaforo)).toEqual([...p.map((x) => x.semaforo)].sort((a, b) => ['vermelho', 'amarelo', 'verde'].indexOf(a) - ['vermelho', 'amarelo', 'verde'].indexOf(b)));
    expect(p.some((x) => x.chave === 'cartao')).toBe(true);
    expect(resumoSemaforo(p).vermelho).toBe(1);
  });
  it('dívida paga no mês não aparece', () => {
    const e = ESTADO_INICIAL();
    e.dividas = [{ id: 'd', nome: 'X', saldo: 500, jurosMensal: 0, parcelaMinima: 100, pagamentos: [{ data: '2026-11-02', valor: 100 }], venceDia: 5 }];
    expect(prioridades(e, '2026-11-10')).toHaveLength(0);
  });
});
