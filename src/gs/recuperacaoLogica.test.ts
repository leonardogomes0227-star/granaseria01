import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL, type Estado } from './tipos';
import { passoDoDia, planoDeSaida, sobrevivencia, triagem, vitorias } from './recuperacaoLogica';

const HOJE = '2026-11-20';
const base = (p: Partial<Estado> = {}): Estado => {
  const e = ESTADO_INICIAL();
  return { ...e, ...p, config: { ...e.config, renda: 3000, reservaPct: 0, onboardingFeito: true } };
};
const conta = (id: string, nome: string, categoria: string, dia: number, valor: number) => ({ id, nome, valor, diaVencimento: dia, categoria, pagamentos: {} as Record<string, { valorPago: number; pagoEm: string }>, criadaEm: '2026-09-01' });
const divida = (id: string, nome: string, saldo: number, juros: number, parcela: number, extra = {}) => ({ id, nome, saldo, jurosMensal: juros, parcelaMinima: parcela, pagamentos: [], cadastradaEm: '2026-10-01', ...extra });

describe('modo recuperação', () => {
  it('triagem: essencial atrasado primeiro, depois juros altos, depois o resto', () => {
    const e = base({ gastosFixos: [conta('a', 'Aluguel', 'Aluguel', 5, 1000), conta('c', 'Academia', 'Outros', 5, 100)], dividas: [divida('d1', 'Empréstimo', 3000, 2, 300), divida('d2', 'Cartão', 2000, 12, 200)] });
    const t = triagem(e, HOJE);
    expect(t[0].nome).toBe('Aluguel');
    expect(t[0].grupo).toBe(1);
    const nomes = t.map((i) => i.nome);
    expect(nomes.indexOf('Cartão')).toBeLessThan(nomes.indexOf('Empréstimo'));
    expect(t.find((i) => i.nome === 'Cartão')?.grupo).toBe(2);
    expect(t.find((i) => i.nome === 'Empréstimo')?.grupo).toBe(3);
    expect(t.every((i) => i.motivo.length > 0)).toBe(true);
  });
  it('conta do mês vencida (mesmo cadastrada hoje) entra na triagem e no total', () => {
    const e = base({ gastosFixos: [{ ...conta('a', 'Aluguel', 'Aluguel', 5, 1000), criadaEm: '2026-11-20' }] });
    const t = triagem(e, HOJE);
    expect(t.map((i) => i.nome)).toContain('Aluguel');
    expect(planoDeSaida(e, HOJE).totalDevido).toBeGreaterThanOrEqual(1000);
  });
  it('valor estimado é marcado', () => {
    const e = base({ dividas: [divida('d', 'Cartão', 1000, 12, 100, { estimado: true })] });
    expect(triagem(e, HOJE)[0].estimado).toBe(true);
    expect(planoDeSaida(e, HOJE).temEstimativa).toBe(true);
  });
  it('plano de saída: soma o que deve e calcula uma data quando dá', () => {
    const e = base({ dividas: [divida('d', 'Empréstimo', 1200, 2, 200)] });
    const p = planoDeSaida(e, HOJE);
    expect(p.totalDevido).toBe(1200);
    expect(p.emDiaEm).toMatch(/^\d{4}-\d{2}$/);
  });
  it('sem como pagar nem os juros, não inventa data', () => {
    const e = base({ dividas: [divida('d', 'Cartão', 50000, 15, 100)] });
    expect(planoDeSaida(e, HOJE).emDiaEm).toBeNull();
  });
  it('separa essenciais de supérfluos', () => {
    const e = base({ gastosFixos: [conta('a', 'Aluguel', 'Aluguel', 5, 1000), conta('c', 'Academia', 'Outros', 5, 100)], lancamentos: [{ id: '1', descricao: 'x', valor: 200, data: '2026-11-03', categoria: 'Mercado' }, { id: '2', descricao: 'y', valor: 80, data: '2026-11-04', categoria: 'Lazer' }] });
    expect(sobrevivencia(e, '2026-11')).toEqual({ essenciais: 1200, outrasFixas: 100, superfluos: 80 });
  });
  it('passo do dia: essencial atrasado vence; sem pendência, o teto do dia', () => {
    const atrasada = base({ gastosFixos: [conta('a', 'Aluguel', 'Aluguel', 5, 1000)] });
    expect(passoDoDia(atrasada, HOJE).tipo).toBe('pagar');
    expect(passoDoDia(atrasada, HOJE).titulo).toMatch(/Aluguel/);
    expect(passoDoDia(base(), HOJE).tipo).toBe('segurar');
    expect(passoDoDia(base({}), HOJE).titulo).toMatch(/máximo/);
  });
  it('sem renda nem saldo, pede a renda em vez de inventar teto', () => {
    const e = base();
    e.config.renda = 0;
    expect(passoDoDia(e, HOJE).tipo).toBe('informar');
  });
  it('vitórias: total pago, dívidas quitadas e dias sem supérfluo', () => {
    const e = base({ dividas: [divida('d', 'Cartão', 100, 0, 50, { pagamentos: [{ data: '2026-11-10', valor: 100 }] })], lancamentos: [{ id: '1', descricao: 'x', valor: 30, data: '2026-11-17', categoria: 'Lazer' }] });
    e.recuperacao = { ativo: true, desde: '2026-11-01', raioXFeito: true };
    const v = vitorias(e, HOJE);
    expect(v.pago).toBe(100);
    expect(v.quitadas).toBe(1);
    expect(v.diasSemSuperfluo).toBe(3); // 18, 19 e 20
  });
});
