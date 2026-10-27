import { describe, expect, it } from 'vitest';
import { conquistasCompra, contextoCompra, resumoDesejos } from './compraLogica';
import { ESTADO_INICIAL } from './tipos';
import type { Desejo } from './tipos';

const d = (p: Partial<Desejo>): Desejo => ({ id: 'x', item: 'Tênis', valor: 300, criadoEm: '2026-10-01T10:00:00Z', terminaEm: '2026-10-04T10:00:00Z', status: 'esperando', ...p });

describe('posso comprar', () => {
  it('resume o que foi evitado', () => {
    const r = resumoDesejos([d({ status: 'desistiu', valor: 300 }), d({ status: 'desistiu', valor: 250 }), d({ status: 'comprou' }), d({})]);
    expect(r).toMatchObject({ economizado: 550, desistiu: 2, comprou: 1, esperando: 1 });
    expect(r.pctDesistiu).toBeCloseTo(66.7, 1);
    expect(conquistasCompra(r)).toEqual(['Primeira compra evitada', 'R$ 500 economizados']);
  });
  it('contexto: meses pra juntar, dívida cara, reserva', () => {
    const e = ESTADO_INICIAL();
    e.config.renda = 3000;
    e.gastosFixos = [{ id: 'a', nome: 'Aluguel', valor: 1500, diaVencimento: 5, categoria: 'Aluguel', pagamentos: {} }];
    e.dividas = [{ id: 'd', nome: 'Cartão', saldo: 1000, jurosMensal: 9, parcelaMinima: 100, pagamentos: [] }];
    const c = contextoCompra(e, 4500, '2026-10', 200);
    expect(c.mesesParaJuntar).toBe(3); // sobram 1500 por mês
    expect(c.dividaCara).toBe(true);
    expect(c.reservaIncompleta).toBe(true);
    expect(contextoCompra(e, 100, '2026-10', 200).mesesParaJuntar).toBeNull();
  });
});
