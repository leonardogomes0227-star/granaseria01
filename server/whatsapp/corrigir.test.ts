import { describe, expect, it } from 'vitest';
import { handleText, type BotDeps } from './bot';

type Gasto = { id: number; phone: string; amount: number; category: string; description: string; created_at: string };
function banco() {
  const gastos: Gasto[] = [];
  const deps = {
    insertExpense: async (e: { phone: string; amount: number; category: string; description: string }) => { gastos.push({ id: gastos.length + 1, phone: e.phone, amount: e.amount, category: e.category, description: e.description, created_at: '2026-11-11T15:00:00.000Z' }); return true; },
    listExpensesSince: async () => gastos,
    deleteLastExpense: async () => gastos.pop() ?? null,
    updateLastExpense: async (_p: string, patch: { amount?: number }) => { const u = gastos[gastos.length - 1]; if (!u) return null; const before = { ...u }; Object.assign(u, patch); return { before, after: u }; },
    now: () => new Date('2026-11-11T15:00:00Z'),
  } as unknown as BotDeps;
  return { gastos, deps };
}
const manda = (deps: BotDeps, text: string, id = text) => handleText({ id, phone: '5511999990000', text }, deps);

describe('WhatsApp: corrigir o último gasto', () => {
  it('"era 30 não 35" troca o valor e não cria outro gasto', async () => {
    const { gastos, deps } = banco();
    await manda(deps, 'mercado 35');
    const r = await manda(deps, 'era 30 não 35');
    expect(gastos).toHaveLength(1);
    expect(gastos[0].amount).toBe(30);
    expect(r).toContain('Corrigi');
    expect(r).toMatch(/agora é \*R\$\s30,00/);
  });
  it('sem gasto para corrigir, avisa; "corrigir" sozinho ensina como', async () => {
    const { gastos, deps } = banco();
    expect(await manda(deps, 'era 30')).toContain('Não encontrei');
    expect(await manda(deps, 'corrigir')).toContain('era 30');
    expect(gastos).toHaveLength(0);
  });
});
