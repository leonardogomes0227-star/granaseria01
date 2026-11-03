import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL, type Estado } from './tipos';
import { contasDoMes, faltaPagar, fatiasDaRenda, fixosPagos, gastoMensalMedio, guardadoNoMes, limiteDiario, livreParaGastar, patrimonioGuardado, reservaMeta, sequenciaDeDias, totalFixos, totalVariaveis } from './selectores';
import { diasRestantes, vencimentoNoMes } from './datas';

const base = (): Estado => {
  const e = ESTADO_INICIAL();
  e.config.renda = 5000;
  e.gastosFixos = [
    { id: 'a', nome: 'Aluguel', valor: 1500, diaVencimento: 5, categoria: 'Aluguel', pagamentos: {} },
    { id: 'b', nome: 'Luz', valor: 200, diaVencimento: 31, categoria: 'Luz', pagamentos: {} },
  ];
  return e;
};

describe('seletores', () => {
  it('mês sem dados: tudo zero, livre = renda', () => {
    const e = ESTADO_INICIAL();
    expect(totalFixos(e, '2026-10')).toBe(0);
    expect(livreParaGastar(e, '2026-10')).toBe(0);
    expect(limiteDiario(e, '2026-10', '2026-10-21')).toBe(0);
    expect(patrimonioGuardado(e)).toBe(0);
  });
  it('renda zero com gastos: livre negativo e limite diário 0', () => {
    const e = base();
    e.config.renda = 0;
    expect(livreParaGastar(e, '2026-10')).toBe(-1700);
    expect(limiteDiario(e, '2026-10', '2026-10-21')).toBe(0);
  });
  it('pagamento com valor diferente do previsto vale no lugar do previsto', () => {
    const e = base();
    e.gastosFixos[0].pagamentos['2026-10'] = { valorPago: 1620, pagoEm: '2026-10-05' };
    expect(totalFixos(e, '2026-10')).toBe(1820);
    expect(fixosPagos(e, '2026-10')).toBe(1620);
    expect(faltaPagar(e, '2026-10')).toBe(200);
    expect(totalFixos(e, '2026-09')).toBe(1700); // mês seguinte começa sem baixa
  });
  it('livre, limite diário e rosca', () => {
    const e = base();
    e.lancamentos = [{ id: '1', descricao: 'mercado', valor: 300, data: '2026-10-02', categoria: 'Mercado' }];
    e.aportes = [{ id: 'x', data: '2026-10-01', valor: 500, origem: 'reserva' }, { id: 'y', data: '2026-09-01', valor: 100, origem: 'manual' }];
    expect(totalVariaveis(e, '2026-10')).toBe(300);
    expect(guardadoNoMes(e, '2026-10')).toBe(500);
    expect(patrimonioGuardado(e)).toBe(600);
    expect(livreParaGastar(e, '2026-10')).toBe(2500);
    expect(diasRestantes('2026-10', '2026-10-21')).toBe(11);
    expect(limiteDiario(e, '2026-10', '2026-10-21')).toBe(227.27);
    const f = fatiasDaRenda(e, '2026-10');
    expect(f.map((x) => Math.round(x.pct))).toEqual([34, 50, 10]);
  });
  it('estourou: rosca sem fatia negativa', () => {
    const e = base();
    e.lancamentos = [{ id: '1', descricao: 'viagem', valor: 4000, data: '2026-10-02', categoria: 'Lazer' }];
    expect(livreParaGastar(e, '2026-10')).toBe(-1200); // 5000 − 1700 de contas − 500 pra reserva − 4000
    expect(fatiasDaRenda(e, '2026-10').find((x) => x.id === 'livre')?.valor).toBe(0);
  });
  it('gasto médio e reserva: média dos 3 meses anteriores, ou o mês atual sem histórico', () => {
    const e = base();
    e.lancamentos = [{ id: '1', descricao: 'a', valor: 600, data: '2026-10-02', categoria: 'x' }];
    expect(gastoMensalMedio(e, '2026-10')).toBe(2300); // sem histórico: usa outubro
    e.lancamentos.push({ id: '2', descricao: 'b', valor: 400, data: '2026-09-10', categoria: 'x' }, { id: '3', descricao: 'c', valor: 800, data: '2026-08-10', categoria: 'x' });
    expect(gastoMensalMedio(e, '2026-10')).toBe(2300); // (400+800)/2 = 600
    expect(reservaMeta(e, '2026-10')).toBe(13800);
  });
  it('vencimento 31 em mês curto vira o último dia', () => {
    expect(vencimentoNoMes('2026-02', 31)).toBe('2026-02-28');
    expect(vencimentoNoMes('2028-02', 30)).toBe('2028-02-29');
    expect(vencimentoNoMes('2026-04', 31)).toBe('2026-04-30');
  });
  it('estado das contas: atrasada, vence logo, em dia, paga', () => {
    const e = base();
    e.gastosFixos.push({ id: 'c', nome: 'Net', valor: 100, diaVencimento: 24, categoria: 'Internet', pagamentos: {} });
    e.gastosFixos[0].pagamentos['2026-10'] = { valorPago: 1500, pagoEm: '2026-10-05' };
    const c = contasDoMes(e, '2026-10', '2026-10-21');
    expect(c.map((x) => x.estado)).toEqual(['paga', 'vence-logo', 'em-dia']);
    expect(contasDoMes(e, '2026-10', '2026-10-28').find((x) => x.gasto.id === 'c')?.estado).toBe('atrasada');
  });
  it('sequência de dias registrando', () => {
    const e = ESTADO_INICIAL();
    e.lancamentos = ['2026-10-19', '2026-10-20', '2026-10-21'].map((d, i) => ({ id: String(i), descricao: 'x', valor: 1, data: d, categoria: 'x' }));
    expect(sequenciaDeDias(e, '2026-10-21')).toBe(3);
    expect(sequenciaDeDias(e, '2026-10-22')).toBe(3); // ainda não registrou hoje: conta até ontem
    expect(sequenciaDeDias(e, '2026-10-23')).toBe(0);
  });
});
