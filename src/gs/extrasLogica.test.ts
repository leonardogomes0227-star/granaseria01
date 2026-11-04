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

import { rumoDoExtra } from './extrasLogica';
import { ESTADO_INICIAL as INICIAL } from './tipos';

describe('rumo do dinheiro extra', () => {
  const base = () => {
    const e = INICIAL();
    e.config.renda = 3000;
    e.gastosFixos = [{ id: 'casa', nome: 'Parcela da casa', valor: 1000, diaVencimento: 10, categoria: 'Financiamento', pagamentos: { '2026-10': { valorPago: 1000, pagoEm: '2026-10-10' } }, criadaEm: '2026-10-01' }];
    e.dividas = [
      { id: 'c', nome: 'Cartão', saldo: 1500, jurosMensal: 12, parcelaMinima: 150, pagamentos: [] },
      { id: 'f', nome: 'Financiamento', saldo: 20000, jurosMensal: 1, parcelaMinima: 600, pagamentos: [] },
    ];
    return e;
  };
  it('13º de R$ 3.000: 10% pra você, quita o cartão, o resto pra reserva', () => {
    const r = rumoDoExtra(base(), '2026-11-05', 3000); // antes do vencimento da casa (dia 10)
    expect(r.destinos.map((d) => [d.tipo, d.titulo, d.valor])).toEqual([
      ['divida', 'Quitar: Cartão', 1500],
      ['reserva', 'Reserva de emergência', 1200],
      ['voce', 'Pra você', 300],
    ]);
    expect(r.manchete).toBe('Com esse dinheiro você quita Cartão e reforça a reserva.');
  });
  it('conta atrasada vem antes de tudo; se não fecha inteira, guarda pra ela', () => {
    const e = base();
    e.gastosFixos[0].pagamentos = {};
    const r = rumoDoExtra(e, '2026-11-20', 800, 0);
    expect(r.destinos.map((d) => d.tipo)).toEqual(['separar-atraso']);
    const r2 = rumoDoExtra(e, '2026-11-20', 1200, 0);
    expect(r2.destinos[0]).toMatchObject({ tipo: 'atraso', titulo: 'Pôr em dia: Parcela da casa (out/26)' });
  });
  it('dívida barata não entra; sem nada a fazer, sobra pra investir', () => {
    const e = base();
    e.dividas = [e.dividas[1]];
    e.aportes = [{ id: 'x', data: '2026-01-01', valor: 50000, origem: 'reserva' }];
    const r = rumoDoExtra(e, '2026-11-05', 1000, 20);
    expect(r.destinos.map((d) => [d.tipo, d.valor])).toEqual([['investir', 800], ['voce', 200]]);
  });
});
