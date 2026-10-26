import { describe, expect, it } from 'vitest';
import { capacidadeDePagamento, economiaDoPlano, mesesSeguidos, pagamentoSugerido, proximaAcao, pagoNoMes } from './painelDividas';
import type { Divida } from './tipos';

const div = (p: Partial<Divida> = {}): Divida => ({ id: 'a', nome: 'Cartão', saldo: 1000, jurosMensal: 8, parcelaMinima: 100, pagamentos: [], ...p });

describe('painel de dívidas', () => {
  it('soma pagamentos do mês', () => expect(pagoNoMes([div({ pagamentos: [{ data: '2026-10-02', valor: 50 }, { data: '2026-09-02', valor: 70 }] })], '2026-10')).toBe(50));
  it('conta meses seguidos', () => {
    const d = div({ pagamentos: [{ data: '2026-08-05', valor: 100 }, { data: '2026-09-05', valor: 100 }] });
    expect(mesesSeguidos([d], '2026-10', 100)).toBe(2); // outubro ainda aberto não quebra
    expect(mesesSeguidos([d], '2026-11', 100)).toBe(0); // novembro sem pagar e outubro sem pagar
  });
  it('economia do plano contra o mínimo', () => {
    const r = economiaDoPlano([{ id: 'a', nome: 'Cartão', saldo: 3000, jurosMensal: 9, parcelaMinima: 300 }], 600, 'maior-juro');
    expect(r?.economia).toBeGreaterThan(0);
  });
  it('ação: parcela perto de vencer vence sobre o resto', () => {
    const a = proximaAcao([div({ venceDia: 12 })], 500, '2026-10-10');
    expect(a.tipo).toBe('vence');
    expect(a.texto).toContain('em 2 dias');
  });
  it('ação: atrasada, começo, faltam e cumprida', () => {
    expect(proximaAcao([div({ venceDia: 5 })], 500, '2026-10-10').texto).toContain('venceu dia 5');
    expect(proximaAcao([div()], 500, '2026-10-10').tipo).toBe('comeco');
    expect(proximaAcao([div({ pagamentos: [{ data: '2026-10-03', valor: 200 }] })], 500, '2026-10-10').tipo).toBe('faltam');
    expect(proximaAcao([div({ pagamentos: [{ data: '2026-10-03', valor: 500 }] })], 500, '2026-10-10').tipo).toBe('cumprida');
  });
  it('parcela já paga no mês não gera aviso de vencimento', () => expect(proximaAcao([div({ venceDia: 12, pagamentos: [{ data: '2026-10-09', valor: 100 }] })], 100, '2026-10-10').tipo).toBe('cumprida'));
  it('capacidade e pagamento sugerido', () => {
    expect(capacidadeDePagamento(5000, 3800)).toBe(1200);
    expect(capacidadeDePagamento(0, 100)).toBe(0);
    expect(pagamentoSugerido(230, 1200, 3800)).toBe(700);
    expect(pagamentoSugerido(0, 0, 600)).toBe(100);
    expect(pagamentoSugerido(300, 200, 3000)).toBe(300);
  });
});
