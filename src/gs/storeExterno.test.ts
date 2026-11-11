import { beforeEach, describe, expect, it } from 'vitest';

// localStorage mínimo, só para este teste
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 } as Storage;

import { STORE_KEY, atualizar, getEstado } from './store';
import { ESTADO_INICIAL } from './tipos';

describe('store: dados que chegam por fora não são pisados pela memória', () => {
  beforeEach(() => mem.clear());
  it('depois que a sincronização grava os dados da conta, a próxima ação parte deles', () => {
    atualizar((e) => ({ ...e, config: { ...e.config, renda: 1000 } }));
    expect(getEstado().lancamentos).toHaveLength(0);
    // a sincronização traz o estado completo da conta e grava direto no armazenamento
    const daConta = { ...ESTADO_INICIAL(), config: { ...ESTADO_INICIAL().config, renda: 5000, onboardingFeito: true }, lancamentos: Array.from({ length: 12 }, (_, i) => ({ id: `l${i}`, descricao: 'x', valor: 10, categoria: 'Mercado', data: '2026-11-02' })) };
    mem.set(STORE_KEY, JSON.stringify(daConta));
    // antes de a página recarregar, alguma parte do app salva algo (ex.: chegou um lançamento do WhatsApp)
    atualizar((e) => ({ ...e, config: { ...e.config, nome: 'Leo' } }));
    const salvo = JSON.parse(mem.get(STORE_KEY)!);
    expect(salvo.lancamentos).toHaveLength(12);
    expect(salvo.config.renda).toBe(5000);
    expect(salvo.config.nome).toBe('Leo');
  });
});
