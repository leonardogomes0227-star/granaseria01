import { describe, expect, it } from 'vitest';
import { parseMessage } from '../../server/whatsapp/parse';

describe('WhatsApp: gasto com centavos não vira dois gastos', () => {
  it('"uber 18,50" é um gasto de R$ 18,50 (o exemplo da ajuda do bot)', () => {
    expect(parseMessage('uber 18,50')).toMatchObject({ kind: 'expense', amount: 18.5, description: 'uber' });
  });
  it('vírgula com espaço ou palavra depois ainda separa vários gastos', () => {
    const a = parseMessage('uber 20, almoço 35');
    expect(a.kind).toBe('multi');
    expect(a.kind === 'multi' && a.items.map((i) => i.amount)).toEqual([20, 35]);
    const b = parseMessage('uber 18,50, almoço 35,90');
    expect(b.kind === 'multi' && b.items.map((i) => i.amount)).toEqual([18.5, 35.9]);
  });
});
