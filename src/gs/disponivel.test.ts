import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL, type Estado } from './tipos';
import { detalheDisponivel, livreParaGastar, limiteDiario, rendaEfetiva } from './selectores';

const MES = '2026-11';
const HOJE = '2026-11-10'; // 21 dias restantes (10 a 30)
const base = (p: Partial<Estado> = {}, cfg: Partial<Estado['config']> = {}): Estado => {
  const e = ESTADO_INICIAL();
  return { ...e, ...p, config: { ...e.config, renda: 3000, reservaPct: 0, ...cfg } };
};
const conta = (valor: number, pago = false) => ({ id: 'c1', nome: 'Aluguel', valor, diaVencimento: 5, categoria: 'Aluguel', pagamentos: (pago ? { [MES]: { valorPago: valor, pagoEm: '2026-11-05' } } : {}) as Record<string, { valorPago: number; pagoEm: string }> });

describe('dinheiro disponível', () => {
  it('sem renda e sem saldo: incompleto, com aviso e sem inventar valor por dia', () => {
    const d = detalheDisponivel(base({}, { renda: 0 }), MES, HOJE);
    expect(d.modo).toBe('incompleto');
    expect(d.porDia).toBe(0);
    expect(d.avisos.length).toBeGreaterThan(0);
  });

  it('modo renda: renda − contas fixas − gastos, e marca a renda como estimada até o salário ser registrado', () => {
    const e = base({ gastosFixos: [conta(1000)], lancamentos: [{ id: 'l', descricao: 'x', valor: 200, data: '2026-11-02', categoria: 'Mercado' }] });
    const d = detalheDisponivel(e, MES, HOJE);
    expect(d.modo).toBe('renda');
    expect(d.livre).toBe(1800);
    expect(d.porDia).toBeCloseTo(1800 / 21, 2);
    expect(d.linhas.find((l) => l.id === 'renda')?.confianca).toBe('estimado');
    expect(d.temEstimativa).toBe(true);
  });

  it('registrar o salário confirma a renda sem somar duas vezes', () => {
    const e = base({ receitas: [{ id: 'r', descricao: 'Salário', valor: 3000, data: '2026-11-05', tipo: 'salario' }] });
    expect(rendaEfetiva(e, MES)).toBe(3000);
    expect(detalheDisponivel(e, MES, HOJE).linhas.find((l) => l.id === 'renda')?.confianca).toBe('confirmado');
  });

  it('receita extra soma; salário maior que o declarado vale o registrado', () => {
    const e = base({ receitas: [{ id: 'r', descricao: 'Salário', valor: 3500, data: '2026-11-05', tipo: 'salario' }, { id: 'x', descricao: 'Freela', valor: 300, data: '2026-11-06', tipo: 'extra' }] });
    expect(rendaEfetiva(e, MES)).toBe(3800);
  });

  it('fatura do cartão em aberto é compromisso (não duplica: compra no cartão não é gasto)', () => {
    const e = base({ cartao: { limite: 2000, usado: 500, fechaDia: 1, venceDia: 10 } });
    expect(livreParaGastar(e, MES, HOJE)).toBe(2500);
  });

  it('modo saldo: usa o saldo informado, desconta pendentes e NÃO conta o salário previsto', () => {
    const e = base({ gastosFixos: [conta(1000)] }, { saldoInformado: { valor: 2000, data: '2026-11-10' } });
    const d = detalheDisponivel(e, MES, HOJE);
    expect(d.modo).toBe('saldo');
    expect(d.livre).toBe(1000); // 2000 − 1000 de aluguel pendente; salário de 3000 só previsto
    expect(d.previstoNaoRecebido).toBe(3000);
    expect(d.avisos.join(' ')).toMatch(/não entra no cálculo/);
  });

  it('modo saldo: conta paga depois do saldo informado sai do saldo uma vez só (sem duplicar com pendentes)', () => {
    const e = base({ gastosFixos: [{ ...conta(1000, true) }] }, { saldoInformado: { valor: 2000, data: '2026-11-01' } });
    // pago em 05/11: saldo vira 1000 e a conta já não está pendente
    expect(detalheDisponivel(e, MES, HOJE).livre).toBe(1000);
  });

  it('modo saldo: receita registrada depois soma; gasto anotado depois subtrai', () => {
    const e = base(
      { receitas: [{ id: 'r', descricao: 'Salário', valor: 3000, data: '2026-11-05', tipo: 'salario' }], lancamentos: [{ id: 'l', descricao: 'x', valor: 250, data: '2026-11-06', categoria: 'Mercado' }] },
      { saldoInformado: { valor: 100, data: '2026-11-01' } }
    );
    expect(detalheDisponivel(e, MES, HOJE).livre).toBe(2850);
  });

  it('limiteDiario nunca é negativo e saldo negativo vira alerta', () => {
    const e = base({ gastosFixos: [conta(5000)] });
    expect(livreParaGastar(e, MES, HOJE)).toBe(-2000);
    expect(limiteDiario(e, MES, HOJE)).toBe(0);
  });

  it('meses que não são o atual ignoram o saldo informado', () => {
    const e = base({}, { saldoInformado: { valor: 9999, data: '2026-11-01' } });
    expect(detalheDisponivel(e, '2026-10', HOJE).modo).toBe('renda');
  });
});

import { migrar } from './migracao';
describe('migração aditiva', () => {
  it('estado antigo (sem receitas, metas ou saldo) continua válido e nada é apagado', () => {
    const antigo = { schemaVersion: 1, config: { renda: 2500, onboardingFeito: true }, gastosFixos: [{ id: 'g', nome: 'Luz', valor: 100, diaVencimento: 10, categoria: 'Luz', pagamentos: {} }], lancamentos: [{ id: 'l', descricao: 'x', valor: 10, data: '2026-11-01', categoria: 'Comida' }] };
    const e = migrar(antigo);
    expect(e.receitas).toEqual([]);
    expect(e.metas).toEqual([]);
    expect(e.config.saldoInformado).toBeUndefined();
    expect(e.gastosFixos).toHaveLength(1);
    expect(e.lancamentos).toHaveLength(1);
    expect(e.config.renda).toBe(2500);
  });
  it('descarta saldo informado inválido e receitas sem valor', () => {
    const e = migrar({ config: { renda: 1, saldoInformado: { valor: 'x', data: 'ontem' } }, receitas: [{ id: 'r', valor: 0, data: '2026-11-01' }, { id: 'ok', valor: 5, data: '2026-11-01', tipo: 'salario' }] });
    expect(e.config.saldoInformado).toBeUndefined();
    expect(e.receitas).toHaveLength(1);
  });
});
