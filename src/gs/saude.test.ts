import { describe, expect, it } from 'vitest';
import { saudeFinanceira } from './saude';
import { ESTADO_INICIAL, type Estado } from './tipos';

const base = (): Estado => {
  const e = ESTADO_INICIAL();
  e.config.renda = 5000;
  e.gastosFixos = [{ id: 'a', nome: 'Aluguel', valor: 1500, diaVencimento: 5, categoria: 'Aluguel', pagamentos: { '2026-10': { valorPago: 1500, pagoEm: '2026-10-05' } } }];
  return e;
};

describe('saúde financeira', () => {
  it('sem dívida, com contas em dia e reserva completa a nota é alta', () => {
    const e = base();
    e.aportes = [{ id: 'x', data: '2026-09-01', valor: 12000, origem: 'manual' }];
    const s = saudeFinanceira(e, '2026-10', '2026-10-21');
    expect(s.criterios.find((c) => c.id === 'dividas')!.pontos).toBe(100);
    expect(s.criterios.find((c) => c.id === 'contas')!.pontos).toBe(100);
    expect(s.nota).toBeGreaterThan(85);
  });
  it('dívida alta e sem reserva derrubam a nota e apontam o pior critério', () => {
    const e = base();
    e.dividas = [{ id: 'd', nome: 'Cartão', saldo: 15000, jurosMensal: 9, parcelaMinima: 300, pagamentos: [] }];
    const s = saudeFinanceira(e, '2026-10', '2026-10-21');
    expect(s.nota).toBeLessThan(65);
    expect(['dividas', 'reserva']).toContain(s.pior.id);
  });
  it('conta atrasada tira pontos de "contas em dia"', () => {
    const e = base();
    e.gastosFixos.push({ id: 'b', nome: 'Luz', valor: 100, diaVencimento: 10, categoria: 'Luz', pagamentos: {} });
    expect(saudeFinanceira(e, '2026-10', '2026-10-21').criterios.find((c) => c.id === 'contas')!.pontos).toBe(45);
  });
  it('estado vazio não quebra', () => {
    const s = saudeFinanceira(ESTADO_INICIAL(), '2026-10', '2026-10-21');
    expect(s.nota).toBeGreaterThanOrEqual(0);
    expect(s.nota).toBeLessThanOrEqual(100);
  });
});
