import { describe, expect, it } from 'vitest';
import { acaoReserva, mesesGuardando, mesesParaMeta, mesesProtegido, planoMensalReserva } from './reservaLogica';
import { ESTADO_INICIAL, type Estado } from './tipos';

const base = (): Estado => {
  const e = ESTADO_INICIAL();
  e.config.renda = 5000;
  e.config.reservaPct = 10;
  e.config.diaSalario = 5;
  e.gastosFixos = [{ id: 'a', nome: 'Aluguel', valor: 2000, diaVencimento: 5, categoria: 'Aluguel', pagamentos: {} }];
  return e;
};

describe('reserva de emergência', () => {
  it('meses de proteção e plano mensal', () => {
    const e = base();
    e.aportes = [{ id: '1', data: '2026-10-02', valor: 4000, origem: 'reserva' }];
    expect(mesesProtegido(e, '2026-10')).toBe(2);
    expect(planoMensalReserva(e)).toBe(500);
    e.config.reservaMensal = 800;
    expect(planoMensalReserva(e)).toBe(800);
  });
  it('saque diminui a proteção e não conta como guardado do mês', () => {
    const e = base();
    e.aportes = [{ id: '1', data: '2026-10-02', valor: 4000, origem: 'reserva' }, { id: '2', data: '2026-10-03', valor: -2000, origem: 'saque' }];
    expect(mesesProtegido(e, '2026-10')).toBe(1);
  });
  it('meses seguidos guardando', () => {
    const e = base();
    e.aportes = [{ id: '1', data: '2026-08-02', valor: 100, origem: 'reserva' }, { id: '2', data: '2026-09-02', valor: 100, origem: 'reserva' }];
    expect(mesesGuardando(e, '2026-10')).toBe(2);
  });
  it('ação: sem dados, começar, faltam, cumprida, completa', () => {
    expect(acaoReserva(ESTADO_INICIAL(), '2026-10', '2026-10-10').tipo).toBe('sem-dados');
    const e = base();
    expect(acaoReserva(e, '2026-10', '2026-10-10').tipo).toBe('comecar');
    e.aportes = [{ id: '1', data: '2026-10-08', valor: 200, origem: 'reserva' }];
    expect(acaoReserva(e, '2026-10', '2026-10-10').tipo).toBe('faltam');
    e.aportes = [{ id: '1', data: '2026-10-08', valor: 500, origem: 'reserva' }];
    expect(acaoReserva(e, '2026-10', '2026-10-10').tipo).toBe('cumprida');
    e.aportes = [{ id: '1', data: '2026-10-08', valor: 13000, origem: 'reserva' }];
    expect(acaoReserva(e, '2026-10', '2026-10-10').tipo).toBe('completa');
  });
  it('meta em meses', () => {
    expect(mesesParaMeta(1000, 300)).toBe(4);
    expect(mesesParaMeta(0, 300)).toBe(0);
    expect(mesesParaMeta(1000, 0)).toBeNull();
  });
});
