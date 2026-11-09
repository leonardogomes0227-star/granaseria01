import { describe, expect, it } from 'vitest';
import { contextoDoCoach } from './coachContexto';

const estado = (e: unknown) => ({ 'grana-seria:v1': JSON.stringify(e) });
const base = {
  schemaVersion: 1,
  config: { nome: 'Maria Secreta', renda: 3000, onboardingFeito: true, reservaPct: 0 },
  gastosFixos: [{ id: 'g', nome: 'Aluguel', valor: 1000, diaVencimento: 5, categoria: 'Aluguel', pagamentos: {}, criadaEm: '2026-11-01' }],
  lancamentos: [{ id: 'l', descricao: 'Presente para o João Silva', valor: 120, data: '2026-11-03', categoria: 'Compras' }],
};

describe('contexto do coach (montado no servidor)', () => {
  it('sem dados: manda o modelo perguntar, sem números', () => {
    const c = contextoDoCoach({}, '2026-11-10');
    expect(c.temDados).toBe(false);
    expect(c.texto).toMatch(/não invente/i);
  });
  it('usa números reais e marca confirmado × estimado', () => {
    const c = contextoDoCoach(estado(base), '2026-11-10');
    expect(c.temDados).toBe(true);
    expect(c.texto).toMatch(/R\$ 120,00/);
    expect(c.texto).toMatch(/ESTIMADAS|estimado/i);
  });
  it('não vaza nome da pessoa nem descrição dos lançamentos', () => {
    const c = contextoDoCoach(estado(base), '2026-11-10');
    expect(c.texto).not.toMatch(/Maria|Secreta|João|Silva|Presente/);
  });
  it('JSON quebrado não derruba', () => {
    expect(contextoDoCoach({ 'grana-seria:v1': '{quebrado' }, '2026-11-10').temDados).toBe(false);
  });
});
