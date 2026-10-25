import { describe, expect, it } from 'vitest';
import { avaliarPosicao, distribuir, estatisticas, fechar, jurosCompostos, perfilDoQuiz, prioridadeAntesDeInvestir, resultadoPosicao } from './calculos';
import { ESTADO_INICIAL, type Posicao } from '../tipos';

const pos = (p: Partial<Posicao> = {}): Posicao => ({ id: 'p', ativo: 'BTC', lado: 'long', margem: 1000, alavancagem: 1, precoEntrada: 100, abertaEm: '2026-10-01T00:00:00Z', ...p });

describe('juros compostos', () => {
  it('aportes mensais e juros', () => {
    const r = jurosCompostos({ aporteMensal: 300, meses: 12, taxaMensalPct: 1 });
    expect(r.investido).toBe(3600);
    expect(r.final).toBeCloseTo(3804.75, 1);
    expect(r.juros).toBeCloseTo(204.75, 1);
  });
  it('taxa zero e poder de compra', () => {
    expect(jurosCompostos({ aporteMensal: 100, meses: 10, taxaMensalPct: 0 }).final).toBe(1000);
    const r = jurosCompostos({ aporteMensal: 100, meses: 12, taxaMensalPct: 1, inflacaoMensalPct: 0.4 });
    expect(r.poderDeCompra!).toBeLessThan(r.final);
    expect(jurosCompostos({ aporteMensal: 100, meses: 12, taxaMensalPct: 1 }).poderDeCompra).toBeNull();
  });
});

describe('perfil e distribuição', () => {
  it('pontua o quiz', () => {
    expect(perfilDoQuiz([0, 0, 0, 0, 0])).toBe('conservador');
    expect(perfilDoQuiz([1, 2, 2, 2, 1])).toBe('moderado');
    expect(perfilDoQuiz([3, 3, 3, 3, 3])).toBe('arrojado');
  });
  it('cripto fica numa parcela pequena e a soma fecha 100%', () => {
    for (const p of ['conservador', 'moderado', 'arrojado'] as const) {
      const d = distribuir(p, 500);
      expect(d.reduce((t, x) => t + x.pct, 0)).toBe(100);
      expect(d.find((x) => x.rotulo === 'Cripto')!.pct).toBeLessThanOrEqual(10);
    }
    expect(distribuir('moderado', 500).find((x) => x.rotulo === 'Cripto')!.valor).toBe(25);
  });
});

describe('antes de investir', () => {
  it('dívida cara e sem reserva: a dívida vem primeiro', () => {
    const e = ESTADO_INICIAL();
    e.config.renda = 4000;
    e.dividas = [{ id: 'd', nome: 'Cartão', saldo: 2000, jurosMensal: 9, parcelaMinima: 100, pagamentos: [] }];
    expect(prioridadeAntesDeInvestir(e, '2026-10', 1.1).passo).toBe('dividas');
    expect(prioridadeAntesDeInvestir(e, '2026-10', null).passo).toBe('dividas');
  });
  it('dívida mais barata que o CDI não bloqueia; reserva incompleta vem depois', () => {
    const e = ESTADO_INICIAL();
    e.gastosFixos = [{ id: 'g', nome: 'Aluguel', valor: 1000, diaVencimento: 5, categoria: 'Aluguel', pagamentos: {} }];
    e.dividas = [{ id: 'd', nome: 'Financiamento', saldo: 2000, jurosMensal: 0.8, parcelaMinima: 100, pagamentos: [] }];
    expect(prioridadeAntesDeInvestir(e, '2026-10', 1.1).passo).toBe('reserva');
  });
  it('sem dívida e com reserva completa: investir', () => {
    const e = ESTADO_INICIAL();
    e.gastosFixos = [{ id: 'g', nome: 'Aluguel', valor: 1000, diaVencimento: 5, categoria: 'Aluguel', pagamentos: {} }];
    e.aportes = [{ id: 'a', data: '2026-09-01', valor: 6000, origem: 'manual' }];
    expect(prioridadeAntesDeInvestir(e, '2026-10', 1.1).passo).toBe('investir');
  });
});

describe('simulação', () => {
  it('resultado = (preço ÷ entrada − 1) × margem × alavancagem, com sinal do lado', () => {
    expect(resultadoPosicao(pos(), 110)).toBe(100);
    expect(resultadoPosicao(pos({ alavancagem: 5 }), 110)).toBe(500);
    expect(resultadoPosicao(pos({ lado: 'short' }), 110)).toBe(-100);
    expect(resultadoPosicao(pos({ lado: 'short', alavancagem: 2 }), 90)).toBe(200);
  });
  it('liquidação quando o prejuízo chega à margem', () => {
    const r = avaliarPosicao(pos({ alavancagem: 10 }), 90); // -10% x 10 = -100% da margem
    expect(r.estado).toBe('liquidada');
    expect(r.resultado).toBe(-1000);
    expect(avaliarPosicao(pos({ alavancagem: 10 }), 50).resultado).toBe(-1000); // nunca perde mais que a margem
    expect(avaliarPosicao(pos({ alavancagem: 2 }), 95).estado).toBe('aberta');
  });
  it('stop e alvo', () => {
    expect(avaliarPosicao(pos({ stop: 95 }), 94).estado).toBe('stop');
    expect(avaliarPosicao(pos({ alvo: 120 }), 121).estado).toBe('alvo');
    expect(avaliarPosicao(pos({ lado: 'short', stop: 105 }), 106).estado).toBe('stop');
    expect(avaliarPosicao(pos({ lado: 'short', alvo: 90 }), 89).estado).toBe('alvo');
  });
  it('fechar devolve margem + resultado; estatísticas', () => {
    const { op, devolver } = fechar(pos({ alavancagem: 2 }), 110, 'manual', '2026-10-02T00:00:00Z');
    expect(op.resultado).toBe(200);
    expect(devolver).toBe(1200);
    const perda = fechar(pos({ alavancagem: 10 }), 80, 'liquidado', '2026-10-03T00:00:00Z');
    expect(perda.devolver).toBe(0);
    const s = estatisticas([op, perda.op]);
    expect(s.total).toBe(2);
    expect(s.taxaAcerto).toBe(50);
    expect(s.maiorPerda).toBe(-1000);
    expect(s.acumulado).toBe(-800);
  });
});
