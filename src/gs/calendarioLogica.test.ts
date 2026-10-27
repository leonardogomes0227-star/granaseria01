import { describe, expect, it } from 'vitest';
import { acaoCalendario, eventosDoMes, faltaDoMes, mesesEmDia } from './calendarioLogica';
import { ESTADO_INICIAL, type Estado } from './tipos';

const base = (): Estado => {
  const e = ESTADO_INICIAL();
  e.gastosFixos = [
    { id: 'a', nome: 'Aluguel', valor: 1500, diaVencimento: 5, categoria: 'Aluguel', pagamentos: { '2026-10': { valorPago: 1500, pagoEm: '2026-10-05' }, '2026-09': { valorPago: 1500, pagoEm: '2026-09-05' } } },
    { id: 'b', nome: 'Luz', valor: 180, diaVencimento: 23, categoria: 'Luz', pagamentos: { '2026-09': { valorPago: 180, pagoEm: '2026-09-20' } } },
  ];
  e.dividas = [{ id: 'd', nome: 'Cartão', saldo: 1000, jurosMensal: 8, parcelaMinima: 100, venceDia: 28, pagamentos: [] }];
  e.cartao = { limite: 3000, usado: 400, fechaDia: 20, venceDia: 27 };
  return e;
};

describe('calendário', () => {
  it('junta contas, parcela de dívida e fatura', () => {
    const ev = eventosDoMes(base(), '2026-10', '2026-10-25');
    expect(ev.map((x) => x.tipo)).toEqual(['conta', 'conta', 'cartao', 'divida']);
    expect(faltaDoMes(ev)).toBe(180 + 400 + 100);
  });
  it('ação: atrasada primeiro, depois a que vence logo', () => {
    const e = base();
    const a = acaoCalendario(eventosDoMes(e, '2026-10', '2026-10-25'), 5000);
    expect(a.tom).toBe('perigo');
    expect(a.texto).toContain('Luz');
    e.gastosFixos[1].pagamentos['2026-10'] = { valorPago: 180, pagoEm: '2026-10-24' };
    const b = acaoCalendario(eventosDoMes(e, '2026-10', '2026-10-25'), 5000);
    expect(b.tom).toBe('aviso');
    expect(b.texto).toContain('Fatura do cartão');
  });
  it('tudo pago', () => expect(acaoCalendario([], 0).tom).toBe('ok'));
  it('meses em dia', () => expect(mesesEmDia(base(), '2026-10')).toBe(1)); // setembro todo pago, agosto não
});
