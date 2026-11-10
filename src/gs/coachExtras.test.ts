import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL, type Estado } from './tipos';
import { recomendacoes } from './coachRegras';

const HOJE = '2026-11-20';
const base = (p: Partial<Estado> = {}, cfg: Partial<Estado['config']> = {}): Estado => {
  const e = ESTADO_INICIAL();
  return { ...e, ...p, config: { ...e.config, renda: 3000, reservaPct: 0, onboardingFeito: true, ...cfg } };
};
const L = (id: string, valor: number, data: string, descricao = id, categoria = 'Mercado') => ({ id, descricao, valor, data, categoria });
const ids = (e: Estado) => recomendacoes(e, HOJE).map((r) => r.id);

describe('orientações extras', () => {
  it('previsão: no ritmo atual o dinheiro acaba antes do fim do mês', () => {
    const ls = ['02', '04', '06', '08', '10', '12'].map((d, i) => L(`g${i}`, 350, `2026-11-${d}`));
    const r = recomendacoes(base({ lancamentos: ls }), HOJE).find((x) => x.id === 'previsao-falta');
    expect(r?.porque).toMatch(/× 11/);
  });
  it('previsão: sem dados suficientes ou com folga, não aparece', () => {
    expect(ids(base({ lancamentos: [L('a', 50, '2026-11-02')] }))).not.toContain('previsao-falta');
    expect(ids(base({ lancamentos: ['02', '03', '04', '05', '06'].map((d) => L(`g${d}`, 10, `2026-11-${d}`)) }))).not.toContain('previsao-falta');
  });
  it('gasto recorrente: mesma descrição em 2 meses com valor parecido', () => {
    const e = base({ lancamentos: [L('1', 40, '2026-10-05', 'Netflix', 'Lazer'), L('2', 40, '2026-11-05', 'netflix', 'Lazer')] });
    expect(ids(e).some((i) => i.startsWith('recorrente-'))).toBe(true);
    const diferente = base({ lancamentos: [L('1', 40, '2026-10-05', 'Café'), L('2', 90, '2026-11-05', 'Café')] });
    expect(ids(diferente).some((i) => i.startsWith('recorrente-'))).toBe(false);
  });
  it('meta atrasada só com prazo e ritmo abaixo de 70% do esperado', () => {
    const meta = { id: 'm', nome: 'Viagem', alvo: 1200, criadaEm: '2026-08-01', prazo: '2027-02-01', guardados: [{ data: '2026-09-01', valor: 100 }] };
    expect(ids(base({ metas: [meta] }))).toContain('meta-atrasada-m');
    expect(ids(base({ metas: [{ ...meta, guardados: [{ data: '2026-09-01', valor: 700 }] }] }))).not.toContain('meta-atrasada-m');
    expect(ids(base({ metas: [{ ...meta, prazo: undefined }] }))).not.toContain('meta-atrasada-m');
  });
  it('renda extra do mês gera sugestão de destino', () => {
    const e = base({ receitas: [{ id: 'r', descricao: 'Freela', valor: 400, data: '2026-11-10', tipo: 'extra' }] });
    expect(ids(e)).toContain('renda-extra');
  });
  it('cartão a partir de 70% do limite', () => {
    expect(ids(base({ cartao: { limite: 1000, usado: 750, fechaDia: 1, venceDia: 28 } }))).toContain('cartao-limite');
    expect(ids(base({ cartao: { limite: 1000, usado: 300, fechaDia: 1, venceDia: 28 } }))).not.toContain('cartao-limite');
  });
  it('gastando menos que o mês passado (mesmo período)', () => {
    const e = base({ lancamentos: [L('a', 300, '2026-10-03'), L('b', 150, '2026-11-03')] });
    expect(ids(e)).toContain('gastando-menos');
  });
});
