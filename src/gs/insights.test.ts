import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL, type Estado } from './tipos';
import { assistenteAtivo, getInsights, resumoDaSemana, segundaDe } from './insights';

const base = (): Estado => {
  const e = ESTADO_INICIAL();
  e.config.renda = 5000;
  e.config.diaSalario = 5;
  return e;
};

describe('próximas ações', () => {
  it('vazio: sem renda e sem dados não inventa nada', () => {
    expect(getInsights(ESTADO_INICIAL(), '2026-10-21')).toEqual([]);
  });
  it('prioriza conta atrasada, depois salário e dívida, no máximo 3', () => {
    const e = base();
    e.gastosFixos = [{ id: 'a', nome: 'Aluguel', valor: 800, diaVencimento: 19, categoria: 'Aluguel', pagamentos: {} }];
    e.dividas = [{ id: 'd1', nome: 'Cartão', saldo: 2000, jurosMensal: 10, parcelaMinima: 100, pagamentos: [] }];
    e.planoDividas = { estrategia: 'maior-juro', pagamentoMensal: 480, criadoEm: '2026-10-01' };
    const r = getInsights(e, '2026-10-21');
    expect(r).toHaveLength(3);
    expect(r[0].texto).toContain('Aluguel está atrasada');
    expect(r.map((x) => x.id)).toContain('divida-mes');
    expect(r.find((x) => x.id === 'divida-mes')?.texto).toBe('Este mês pague R$ 480 na dívida Cartão');
  });
  it('salário caiu e nada guardado: sugere 10% pra guardar', () => {
    const r = getInsights(base(), '2026-10-21');
    expect(r.find((x) => x.id === 'reserva-salario')?.texto).toBe('Seu salário caiu. Guarde R$ 500 (10%) antes de gastar');
  });
  it('conta de mês anterior atrasada: com o salário, manda pagar a atrasada antes de guardar', () => {
    const e = base();
    e.gastosFixos = [{ id: 'casa', nome: 'Parcela da casa', valor: 1200, diaVencimento: 10, categoria: 'Financiamento', pagamentos: { '2026-09': { valorPago: 1200, pagoEm: '2026-09-10' } }, criadaEm: '2026-09-01' }];
    e.lancamentos = [{ id: 'l', descricao: 'Mercado', valor: 900, data: '2026-10-12', categoria: 'Mercado' }];
    const r = getInsights(e, '2026-11-05');
    expect(r[0]).toMatchObject({ id: 'atraso', texto: 'Seu salário caiu. Pague primeiro a atrasada Parcela da casa de out/26: cerca de R$ 1.234' });
    expect(r.some((x) => x.id === 'reserva-salario')).toBe(false);
  });
  it('sem gasto do dia a dia anotado, pergunta quanto sobra antes de mandar pagar', () => {
    const e = base();
    e.gastosFixos = [{ id: 'casa', nome: 'Parcela da casa', valor: 1200, diaVencimento: 10, categoria: 'Financiamento', pagamentos: { '2026-09': { valorPago: 1200, pagoEm: '2026-09-10' } }, criadaEm: '2026-09-01' }];
    expect(getInsights(e, '2026-11-05')[0].texto).toBe('Parcela da casa de out/26 ficou pra trás. Me diga quanto sobra por mês e eu monto o plano');
  });
  it('conta que vence em 2 dias', () => {
    const e = base();
    e.gastosFixos = [{ id: 'a', nome: 'Aluguel', valor: 800, diaVencimento: 23, categoria: 'Aluguel', pagamentos: {} }];
    expect(getInsights(e, '2026-10-21')[0].texto).toBe('Aluguel vence em 2 dias (R$ 800)');
  });
  it('só mostra o relevante pros assistentes ativos', () => {
    const e = base();
    e.gastosFixos = [{ id: 'a', nome: 'Aluguel', valor: 800, diaVencimento: 23, categoria: 'Aluguel', pagamentos: {} }];
    e.agentes.contas = { ativo: false, config: {} };
    expect(getInsights(e, '2026-10-21').some((x) => x.id.startsWith('conta-'))).toBe(false);
    expect(assistenteAtivo(e, 'renda')).toBe(false);
  });
  it('dívida com juro acima do CDI só aparece com o CDI real', () => {
    const e = base();
    e.dividas = [{ id: 'd1', nome: 'Cartão', saldo: 2000, jurosMensal: 10, parcelaMinima: 100, pagamentos: [] }];
    expect(getInsights(e, '2026-10-21', { cdiMensalPct: null }).some((x) => x.id === 'juro-vs-cdi')).toBe(false);
    expect(getInsights(e, '2026-10-21', { cdiMensalPct: 1 }).some((x) => x.id === 'juro-vs-cdi')).toBe(true);
  });
});

describe('resumo da semana', () => {
  it('segunda a domingo', () => {
    expect(segundaDe('2026-10-21')).toBe('2026-10-19'); // quarta
    expect(segundaDe('2026-10-25')).toBe('2026-10-19'); // domingo
    expect(segundaDe('2026-10-19')).toBe('2026-10-19');
  });
  it('soma gasto, contas pagas, guardado e a categoria que mais pesou', () => {
    const e = base();
    e.lancamentos = [
      { id: '1', descricao: 'a', valor: 100, data: '2026-10-19', categoria: 'Comida' },
      { id: '2', descricao: 'b', valor: 40, data: '2026-10-20', categoria: 'Transporte' },
      { id: '3', descricao: 'c', valor: 60, data: '2026-10-21', categoria: 'Comida' },
      { id: '4', descricao: 'fora', valor: 999, data: '2026-10-12', categoria: 'Lazer' },
    ];
    e.aportes = [{ id: 'x', data: '2026-10-20', valor: 300, origem: 'manual' }];
    e.gastosFixos = [{ id: 'a', nome: 'Luz', valor: 100, diaVencimento: 10, categoria: 'Luz', pagamentos: { '2026-10': { valorPago: 120, pagoEm: '2026-10-20' } } }];
    const r = resumoDaSemana(e, '2026-10-21');
    expect(r.gasto).toBe(200);
    expect(r.contasPagas).toBe(1);
    expect(r.valorContasPagas).toBe(120);
    expect(r.guardado).toBe(300);
    expect(r.categoriaTop).toEqual({ nome: 'Comida', valor: 160 });
    expect(resumoDaSemana(e, '2026-10-21', 1).gasto).toBe(999);
  });
});
