import { describe, expect, it } from 'vitest';
import { conquistasExtras, efeitoNaDivida, guardarHistorico, lerHistorico, mesesDeProtecao, totalComDestino } from './extrasLogica';
import type { DividaSim } from './dividas';

const ds: DividaSim[] = [{ id: 'a', nome: 'Cartão', saldo: 3000, jurosMensal: 9, parcelaMinima: 150 }, { id: 'b', nome: 'Loja', saldo: 800, jurosMensal: 3, parcelaMinima: 80 }];

describe('dinheiro extra', () => {
  it('abater dívida adianta e economiza', () => {
    const r = efeitoNaDivida(ds, 600, 'maior-juro', 1000);
    expect(r!.meses).toBeGreaterThan(0);
    expect(r!.economia).toBeGreaterThan(0);
    expect(efeitoNaDivida([], 600, 'maior-juro', 1000)).toBeNull();
  });
  it('quitar tudo de uma vez zera os meses', () => expect(efeitoNaDivida(ds, 600, 'maior-juro', 5000)!.meses).toBeGreaterThan(5));
  it('histórico guarda os últimos 12 e ignora lixo', () => {
    let h = lerHistorico('lixo');
    expect(h).toEqual([]);
    for (let i = 0; i < 14; i++) h = lerHistorico(guardarHistorico(h, { data: '2026-10-01', origem: '13º', valor: 100, divida: 50, reserva: 30, lazer: 20 }));
    expect(h).toHaveLength(12);
    expect(totalComDestino(h)).toBe(1200);
    expect(conquistasExtras(h)).toEqual(['Primeiro extra com destino', '3 extras com destino', 'R$ 1.000 bem usados']);
  });
  it('meses de proteção', () => expect(mesesDeProtecao(2000, 2000)).toBe(1));
});
