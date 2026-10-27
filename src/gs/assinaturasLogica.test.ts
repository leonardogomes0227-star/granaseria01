import { describe, expect, it } from 'vitest';
import { acaoAssinaturas, conquistasAssinaturas, resumoAssinaturas } from './assinaturasLogica';
import type { Assinatura } from './tipos';

const a = (p: Partial<Assinatura>): Assinatura => ({ id: 'x', nome: 'Streaming', valor: 40, ativa: true, personalizada: false, ...p });

describe('assinaturas', () => {
  it('resume total, cortado e revisão do mês', () => {
    const l = [a({ id: '1', uso: 'nao', revisadaEm: '2026-10-02' }), a({ id: '2', valor: 20, uso: 'sim', revisadaEm: '2026-09-02' }), a({ id: '3', valor: 100, ativa: false })];
    const r = resumoAssinaturas(l, '2026-10');
    expect(r.total).toBe(60);
    expect(r.anual).toBe(720);
    expect(r.cortado).toBe(100);
    expect(r.pendentes.map((x) => x.id)).toEqual(['2']); // revisão de setembro não vale em outubro
    expect(r.economiaAnual).toBe(480);
  });
  it('ação: vazio, revisar, cortar, ok', () => {
    expect(acaoAssinaturas([], '2026-10').tipo).toBe('vazio');
    expect(acaoAssinaturas([a({})], '2026-10').tipo).toBe('revisar');
    expect(acaoAssinaturas([a({ uso: 'nao', revisadaEm: '2026-10-01' })], '2026-10').tipo).toBe('cortar');
    expect(acaoAssinaturas([a({ uso: 'sim', revisadaEm: '2026-10-01' })], '2026-10').tipo).toBe('ok');
  });
  it('conquistas', () => {
    expect(conquistasAssinaturas([a({ ativa: false, valor: 50 })], '2026-10')).toEqual(['Primeira assinatura cortada', 'Mais de R$ 100 por ano economizados', 'Mais de R$ 500 por ano economizados']);
  });
});
