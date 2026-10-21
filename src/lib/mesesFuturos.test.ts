import { describe, expect, it } from 'vitest';
import { BACKUP_KEY, limparContas, limparGuardado, limparMesesFuturos, limparTracking, mesDoPlano, podeFecharMes, podePagarMes } from './mesesFuturos';
import { checkinMonths, currentMonth } from '../coachChat/months';

// 21/10/2026 às 12h em Brasília
const NOW = new Date('2026-10-21T15:00:00Z');

describe('mês do plano (mesma folga de um mês do WhatsApp)', () => {
  const t = { createdAt: '2026-10-05T12:00:00Z', months: [] as unknown[] };

  it('o mês 1 é pago no mês em que o plano começou', () => {
    expect(mesDoPlano(t.createdAt, 1)).toBe('2026-10');
    expect(mesDoPlano(t.createdAt, 3)).toBe('2026-12');
  });

  it('pode fechar o mês 1 em outubro, mas não o mês 2', () => {
    expect(podeFecharMes(t, NOW)).toBe(true);
    expect(podeFecharMes({ ...t, months: [{}] }, NOW)).toBe(false);
  });

  it('plano criado na virada (31/10 23h em Brasília = 01/11 UTC) começa em outubro', () => {
    expect(mesDoPlano('2026-11-01T02:00:00Z', 1)).toBe('2026-10');
  });

  it('faxina tira os meses fechados antes da hora e guarda o que saiu', () => {
    const r = limparTracking({ ...t, months: [{ a: 1 }, { a: 2 }, { a: 3 }] }, NOW);
    expect(r.tracking.months).toEqual([{ a: 1 }]);
    expect(r.removidos).toEqual([{ a: 2 }, { a: 3 }]);
    const ok = limparTracking({ ...t, months: [{ a: 1 }] }, NOW);
    expect(ok.removidos).toEqual([]);
    expect(ok.tracking.months).toEqual([{ a: 1 }]);
  });
});

describe('guardado e contas', () => {
  it('guardado com data depois de hoje sai', () => {
    const r = limparGuardado([{ on: '2026-10-20', amount: 100 }, { on: '2026-10-21', amount: 50 }, { on: '2026-11-02', amount: 70 }], NOW);
    expect(r.list.map((e) => e.on)).toEqual(['2026-10-20', '2026-10-21']);
    expect(r.removidos).toEqual([{ on: '2026-11-02', amount: 70 }]);
  });

  it('pagar adiantado hoje continua valendo; pagamento com data futura sai', () => {
    const bills = [
      { id: '1', name: 'Aluguel', payments: [{ month: '2026-11', paidOn: '2026-10-21', amount: 1300 }] },
      { id: '2', name: 'Luz', payments: [{ month: '2026-12', paidOn: '2026-12-05', amount: 140 }] },
    ];
    const r = limparContas(bills, NOW);
    expect(r.bills[0].payments).toHaveLength(1);
    expect(r.bills[1].payments).toHaveLength(0);
    expect(r.removidos).toHaveLength(1);
  });

  it('novo pagamento só até o mês atual', () => {
    expect(podePagarMes('2026-10', NOW)).toBe(true);
    expect(podePagarMes('2026-09', NOW)).toBe(true);
    expect(podePagarMes('2026-11', NOW)).toBe(false);
  });
});

describe('faxina do estado salvo', () => {
  it('não mexe em nada quando não há mês futuro', () => {
    const state = { 'gs-nome': 'Leo', 'gs-guardado': JSON.stringify([{ on: '2026-10-01', amount: 10 }]) };
    const r = limparMesesFuturos(state, NOW);
    expect(r.changed).toBe(false);
    expect(r.state).toBe(state);
  });

  it('limpa tracking, guardado e contas e guarda o backup', () => {
    const state = {
      'selos-tracking': JSON.stringify({ createdAt: '2026-10-05T12:00:00Z', baseline: {}, months: [{ paid: {} }, { paid: {} }] }),
      'gs-guardado': JSON.stringify([{ on: '2026-12-01', amount: 99 }]),
      'gs-contas': JSON.stringify([{ id: '2', name: 'Luz', payments: [{ month: '2026-12', paidOn: '2026-12-05', amount: 140 }] }]),
    };
    const r = limparMesesFuturos(state, NOW);
    expect(r.changed).toBe(true);
    expect(JSON.parse(r.state['selos-tracking']).months).toHaveLength(1);
    expect(JSON.parse(r.state['gs-guardado'])).toEqual([]);
    expect(JSON.parse(r.state['gs-contas'])[0].payments).toEqual([]);
    const backup = JSON.parse((r.state as Record<string, string>)[BACKUP_KEY]);
    expect(backup).toHaveLength(1);
    expect(Object.keys(backup[0].removido).sort()).toEqual(['gs-contas', 'gs-guardado', 'selos-tracking']);
  });

  it('JSON quebrado não derruba a faxina', () => {
    const r = limparMesesFuturos({ 'selos-tracking': '{quebrado', 'gs-contas': 'null' }, NOW);
    expect(r.changed).toBe(false);
  });
});

describe('check-in do coach continua sem meses futuros', () => {
  it('mês atual e, até o dia 10, o anterior', () => {
    expect(currentMonth(NOW)).toBe('2026-10');
    expect(checkinMonths('2026-09', NOW)).toEqual(['2026-10']);
    expect(checkinMonths('2026-09', new Date('2026-11-03T15:00:00Z'))).toEqual(['2026-10', '2026-11']);
  });
});
