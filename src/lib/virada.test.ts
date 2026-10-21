import { describe, expect, it } from 'vitest';
import { virarMesRecorrente, type Missao } from '../missoes';

const base = { id: 'm1', recorrente: true, passos: [{ id: 'conta:a', ordem: 1, titulo: 'Pagar luz', concluidoEm: '2026-09-10T12:00:00Z' }, { id: 'conta:b', ordem: 2, titulo: 'Pagar água', concluidoEm: '2026-10-02T12:00:00Z' }] } as unknown as Missao;

describe('virada do mês', () => {
  it('as contas pagas no mês passado voltam a ficar pendentes', () => {
    const m = virarMesRecorrente(base, '2026-10-21');
    expect(m.passos.map((p) => p.concluidoEm)).toEqual([null, '2026-10-02T12:00:00Z']);
  });
  it('sem mudança devolve a mesma missão', () => {
    const m = virarMesRecorrente(base, '2026-09-30');
    expect(m).toBe(base);
  });
});
