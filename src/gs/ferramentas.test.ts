import { describe, expect, it } from 'vitest';
import { analisarCompra, compararOfertas, contagem, custoDaOferta, dividirExtra, dividirMetodo, msRestantes, patrimonioParaRenda, planoDaMeta, projecaoAnos, proximaRepeticao, taxaEfetiva, terminoDaEspera, totalDesafio52, valorFuturo } from './ferramentas';

describe('posso comprar isso?', () => {
  it('cabe, aperta e não cabe', () => {
    const base = { renda: 4400, horasMes: 220 };
    expect(analisarCompra({ ...base, valor: 200, livre: 2000 }).veredito).toBe('cabe');
    expect(analisarCompra({ ...base, valor: 600, livre: 2000 }).veredito).toBe('aperta');
    expect(analisarCompra({ ...base, valor: 1500, livre: 2000 }).veredito).toBe('nao-cabe');
    expect(analisarCompra({ ...base, valor: 100, livre: 0 }).veredito).toBe('nao-cabe');
    expect(analisarCompra({ ...base, valor: 3000, livre: 2000 }).veredito).toBe('nao-cabe');
  });
  it('horas de trabalho: valor ÷ (renda ÷ horas)', () => {
    const a = analisarCompra({ renda: 4400, horasMes: 220, valor: 760, livre: 5000 }); // R$ 20/h
    expect(a.horas).toBe(38);
    expect(a.dias).toBe(4.8);
    expect(a.frase).toBe('Isso custa 38 horas do seu trabalho, quase 5 dias.');
  });
  it('sem renda não explode', () => {
    expect(analisarCompra({ renda: 0, horasMes: 220, valor: 100, livre: 0 }).horas).toBe(0);
  });
  it('espera de 72h vem de carimbo, não de memória', () => {
    const fim = terminoDaEspera('2026-10-01T12:00:00.000Z');
    expect(fim).toBe('2026-10-04T12:00:00.000Z');
    expect(msRestantes(fim, Date.parse('2026-10-03T12:00:00Z'))).toBe(24 * 3600_000);
    expect(msRestantes(fim, Date.parse('2026-10-05T12:00:00Z'))).toBe(0);
    expect(contagem(26 * 3600_000)).toBe('1d 2h');
    expect(contagem(5 * 60_000)).toBe('5min');
  });
});

describe('assinaturas', () => {
  it('soma simples e valor futuro', () => {
    const p = projecaoAnos(100, 0.8);
    expect(p.map((x) => x.simples)).toEqual([1200, 6000, 12000]);
    expect(valorFuturo(100, 0, 12)).toBe(1200);
    expect(valorFuturo(100, 1, 12)).toBeCloseTo(1268.25, 1);
    expect(p[2].investido).toBeGreaterThan(p[2].simples);
  });
});

describe('empréstimos', () => {
  it('taxa efetiva por bisseção', () => {
    // 1000 em 12x de 100 -> 1200 total
    const t = taxaEfetiva(1000, 12, 100)!;
    expect(t * 100).toBeCloseTo(2.92, 1);
    expect(taxaEfetiva(1000, 10, 100)).toBe(0);
    expect(taxaEfetiva(0, 10, 100)).toBeNull();
  });
  it('destaca a mais barata e a diferença em reais', () => {
    const r = compararOfertas([
      { valor: 5000, parcelas: 24, parcela: 300 },
      { valor: 5000, parcelas: 12, parcela: 520 },
    ]);
    expect(r.melhor).toBe(1);
    expect(custoDaOferta({ valor: 5000, parcelas: 24, parcela: 300 }).juros).toBe(2200);
    expect(r.diferenca).toBe(2200 - 1240);
  });
});

describe('extras, renda e metas', () => {
  it('divisão padrão 50/30/20, e sem dívida a parte dela vai pra reserva', () => {
    expect(dividirExtra(1000, true)).toEqual({ divida: 500, reserva: 300, lazer: 200 });
    expect(dividirExtra(1000, false)).toEqual({ divida: 0, reserva: 800, lazer: 200 });
  });
  it('liberdade de renda: gasto ÷ taxa', () => {
    expect(patrimonioParaRenda(3500, 0.7)).toBe(500000);
    expect(patrimonioParaRenda(3500, 0)).toBe(0);
  });
  it('meta: aporte por semana e por mês, prazo vencido e meta batida', () => {
    const p = planoDaMeta({ alvo: 6000, jaGuardado: 0, prazo: '2027-10-21', hoje: '2026-10-21' });
    expect(p.meses).toBe(12);
    expect(p.porMes).toBe(500);
    expect(p.porSemana).toBeCloseTo(115.38, 1);
    expect(planoDaMeta({ alvo: 100, jaGuardado: 40, prazo: '2026-10-01', hoje: '2026-10-21' }).prazoVencido).toBe(true);
    expect(planoDaMeta({ alvo: 100, jaGuardado: 100, prazo: '2026-10-01', hoje: '2026-10-21' }).metaBatida).toBe(true);
  });
  it('métodos: divisão fecha na renda; 52 semanas soma 1378 com base 1', () => {
    expect(dividirMetodo(5000, [50, 30, 20])).toEqual([2500, 1500, 1000]);
    expect(dividirMetodo(1000, [33, 33, 34]).reduce((t, x) => t + x, 0)).toBe(1000);
    expect(totalDesafio52(1)).toBe(1378);
  });
  it('lembrete que se repete', () => {
    expect(proximaRepeticao('2026-10-25', 'unica', '2026-10-21')).toBe('2026-10-25');
    expect(proximaRepeticao('2026-10-10', 'unica', '2026-10-21')).toBeNull();
    expect(proximaRepeticao('2026-10-10', 'semanal', '2026-10-21')).toBe('2026-10-24');
    expect(proximaRepeticao('2026-01-31', 'mensal', '2026-02-10')).toBe('2026-02-28');
  });
});
