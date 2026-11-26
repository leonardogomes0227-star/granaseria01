import { beforeEach, describe, expect, it } from 'vitest';
import { categoriaDoSite, categoriaDoWhatsApp } from './categoriasWa';
import { importarDoServidor, salvarLancamento } from './acoes';
import { _resetarMemoria, getEstado } from './store';

describe('categorias entre WhatsApp e site', () => {
  it('Alimentação vira Mercado ou Comida, pelo que foi', () => {
    expect(categoriaDoSite('Alimentação', 'supermercado')).toBe('Mercado');
    expect(categoriaDoSite('Alimentação', 'feira')).toBe('Mercado');
    expect(categoriaDoSite('Alimentação', 'ifood')).toBe('Comida');
    expect(categoriaDoSite('Moradia', 'aluguel')).toBe('Casa');
    expect(categoriaDoSite('Lazer', 'cinema')).toBe('Lazer');
    expect(categoriaDoSite('Pets', 'ração')).toBe('Outros');
  });
  it('e na volta, o site manda para o WhatsApp com o nome dele', () => {
    expect(categoriaDoWhatsApp('Mercado')).toBe('Alimentação');
    expect(categoriaDoWhatsApp('Comida')).toBe('Alimentação');
    expect(categoriaDoWhatsApp('Casa')).toBe('Moradia');
    expect(categoriaDoWhatsApp('Lazer')).toBe('Lazer');
  });
});

describe('importar do servidor sem duplicar', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* sem storage */ } _resetarMemoria(); });
  const hoje = new Date().toISOString().slice(0, 10);
  const srv = (id: number, extra = {}) => ({ id, kind: 'out' as const, amount: 80, category: 'Alimentação', description: 'mercado', created_at: `${hoje}T15:00:00Z`, ...extra });

  it('gasto do WhatsApp entra com o nome de categoria do site', () => {
    importarDoServidor([srv(7)]);
    const l = getEstado().lancamentos;
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ serverId: 7, categoria: 'Mercado', valor: 80 });
  });
  it('gasto que o próprio site mandou ganha o id de lá em vez de aparecer duas vezes', () => {
    salvarLancamento({ descricao: 'mercado', valor: 80, data: hoje, categoria: 'Mercado' });
    importarDoServidor([srv(9)]);
    const l = getEstado().lancamentos;
    expect(l).toHaveLength(1);
    expect(l[0].serverId).toBe(9);
  });
  it('importar duas vezes não duplica', () => {
    importarDoServidor([srv(7)]);
    importarDoServidor([srv(7)]);
    expect(getEstado().lancamentos).toHaveLength(1);
  });
  it('dois gastos iguais no mesmo dia continuam sendo dois', () => {
    salvarLancamento({ descricao: 'mercado', valor: 80, data: hoje, categoria: 'Mercado' });
    importarDoServidor([srv(1), srv(2)]);
    expect(getEstado().lancamentos).toHaveLength(2);
  });
  it('o que já tinha vindo com nome do WhatsApp é arrumado', () => {
    importarDoServidor([srv(5, { category: 'Moradia', description: 'luz', amount: 120 })]);
    expect(getEstado().lancamentos[0].categoria).toBe('Casa');
  });
});
