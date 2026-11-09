import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL, type Estado } from './tipos';
import { missaoDoDia, recomendacoes, situacaoFinanceira } from './coachRegras';

const HOJE = '2026-11-10';
const base = (p: Partial<Estado> = {}, cfg: Partial<Estado['config']> = {}): Estado => {
  const e = ESTADO_INICIAL();
  return { ...e, ...p, config: { ...e.config, renda: 3000, reservaPct: 0, ...cfg } };
};
const conta = (dia: number, valor = 500, pago = false) => ({ id: `c${dia}`, nome: `Conta${dia}`, valor, diaVencimento: dia, categoria: 'Outros', pagamentos: (pago ? { '2026-11': { valorPago: valor, pagoEm: '2026-11-01' } } : {}) as Record<string, { valorPago: number; pagoEm: string }>, criadaEm: '2026-11-01' });

describe('coach por regras', () => {
  it('sem dados: orienta a começar, sem números inventados', () => {
    const e = base({}, { renda: 0 });
    expect(situacaoFinanceira(e, HOJE)).toBe('sem-dados');
    const r = recomendacoes(e, HOJE);
    expect(r[0].id).toBe('comecar');
    expect(r[0].porque).toMatch(/dados suficientes/);
  });
  it('conta vencendo logo vira aviso com o porquê (valor e data)', () => {
    const r = recomendacoes(base({ gastosFixos: [conta(12)] }), HOJE);
    const x = r.find((i) => i.id === 'vence-logo')!;
    expect(x.tom).toBe('aviso');
    expect(x.porque).toContain('Conta12');
  });
  it('conta atrasada tem prioridade sobre aviso', () => {
    const r = recomendacoes(base({ gastosFixos: [conta(5), conta(12)] }), HOJE);
    expect(r[0].tom).toBe('perigo');
  });
  it('gastando mais do que tem', () => {
    const r = recomendacoes(base({ gastosFixos: [conta(20, 4000)] }), HOJE);
    expect(r.some((i) => i.id === 'acima-da-renda')).toBe(true);
  });
  it('categoria que subiu 25%+ só com base mínima e dia >= 7', () => {
    const ls = [
      { id: '1', descricao: 'a', valor: 200, data: '2026-10-03', categoria: 'Mercado' },
      { id: '2', descricao: 'b', valor: 400, data: '2026-11-03', categoria: 'Mercado' },
    ];
    expect(recomendacoes(base({ lancamentos: ls }), HOJE).some((i) => i.id === 'subiu-Mercado')).toBe(true);
    expect(recomendacoes(base({ lancamentos: ls }), '2026-11-05').some((i) => i.id === 'subiu-Mercado')).toBe(false);
    const pouco = [{ ...ls[0], valor: 20 }, { ...ls[1], valor: 80 }];
    expect(recomendacoes(base({ lancamentos: pouco }), HOJE).some((i) => i.id.startsWith('subiu'))).toBe(false);
  });
  it('avisos desligados somem, mas urgência vermelha continua', () => {
    const e = base({ gastosFixos: [conta(12), conta(5)] }, { avisosDesligados: ['vencimento'] });
    const r = recomendacoes(e, HOJE);
    expect(r.some((i) => i.tom === 'perigo')).toBe(true);
    expect(r.some((i) => i.id === 'vence-logo')).toBe(false);
  });
  it('missão: prioridade urgente; senão registrar despesas', () => {
    expect(missaoDoDia(base({ gastosFixos: [conta(12)] }), HOJE).feita).toBe(false);
    expect(missaoDoDia(base({ gastosFixos: [conta(25, 100, false)] }), HOJE).id).toBe('registrar');
  });
});
