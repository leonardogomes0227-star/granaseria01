import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('salvar lançamento', () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
    vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} });
  });

  it('editar sem forma e sem conta apaga as duas, e o id do servidor fica', async () => {
    const { _resetarMemoria, substituir, getEstado } = await import('./store');
    const { salvarLancamento, salvarReceita, salvarTransferencia } = await import('./acoes');
    _resetarMemoria();
    substituir({
      config: { renda: 3000, onboardingFeito: true },
      contas: [{ id: 'a', nome: 'Banco' }, { id: 'b', nome: 'Carteira' }],
      lancamentos: [{ id: 'l1', serverId: 7, descricao: 'mercado', valor: 40, data: '2020-01-15', categoria: 'Mercado', forma: 'Pix', contaId: 'a' }],
      receitas: [{ id: 'r1', descricao: 'freela', valor: 100, data: '2020-01-15', tipo: 'extra', contaId: 'a' }],
      transferencias: [{ id: 't1', data: '2020-01-15', valor: 20, de: 'a', para: 'b', descricao: 'ajuste' }],
    });
    expect(salvarLancamento({ id: 'l1', descricao: 'padaria', valor: 12, data: '2020-01-15', categoria: 'Comida' })).toBe(true);
    const l = getEstado().lancamentos[0];
    expect(l.forma).toBeUndefined();
    expect(l.contaId).toBeUndefined();
    expect(l.serverId).toBe(7);
    expect(l.descricao).toBe('padaria');

    expect(salvarReceita({ id: 'r1', descricao: 'bico', valor: 80, data: '2020-01-15', tipo: 'extra' })).toBe(true);
    expect(getEstado().receitas[0].contaId).toBeUndefined();

    expect(salvarTransferencia({ id: 't1', data: '2020-01-15', valor: 20, de: 'a', para: 'b', descricao: '' })).toBe(true);
    expect(getEstado().transferencias[0].descricao).toBeUndefined();
  });

  it('emoji longo não fica pela metade', async () => {
    const { _resetarMemoria, substituir, getEstado } = await import('./store');
    const { salvarLancamento } = await import('./acoes');
    _resetarMemoria();
    substituir({ config: { renda: 1, onboardingFeito: true } });
    const texto = `${'a'.repeat(79)}\uD83C`;
    expect(salvarLancamento({ descricao: texto, valor: 10, data: '2020-01-15', categoria: 'Outros' })).toBe(true);
    expect(getEstado().lancamentos[0].descricao).toBe('a'.repeat(79));
    expect(getEstado().lancamentos[0].descricao).not.toMatch(/[\uD800-\uDBFF]$/);
  });
});
