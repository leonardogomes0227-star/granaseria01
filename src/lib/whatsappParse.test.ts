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

describe('WhatsApp: corrigir não vira gasto novo', () => {
  it('"era 30 não 35" troca o valor do último gasto, em vez de anotar R$ 35', () => {
    for (const m of ['era 30 não 35', 'era 30', 'na verdade foi 30', 'errei, era 30', 'corrige pra 30', 'foi 30, não 35', 'não era 35, era 30', 'o valor era R$ 30']) expect(parseMessage(m), m).toEqual({ kind: 'correct', amount: 30 });
    expect(parseMessage('corrigir')).toEqual({ kind: 'correct', amount: null });
  });
  it('"foi 30" sozinho continua sendo gasto (pode ser a resposta de "quanto foi?")', () => {
    expect(parseMessage('foi 30').kind).toBe('expense');
    expect(parseMessage('trocar pneu 300')).toMatchObject({ kind: 'expense', amount: 300 });
  });
});
describe('WhatsApp: perguntas e jeitos comuns de falar', () => {
  it('perguntas sobre o mês, o saldo e o quanto pode gastar', () => {
    for (const m of ['quanto gastei', 'como tá meu mês', 'meus gastos']) expect(parseMessage(m).kind, m).toBe('month');
    for (const m of ['quanto posso gastar hoje', 'posso gastar quanto', 'quanto posso gastar']) expect(parseMessage(m).kind, m).toBe('budget');
    for (const m of ['quanto eu tenho', 'quanto sobrou']) expect(parseMessage(m).kind, m).toBe('balance');
  });
  it('desfazer, risada e despedida não caem em "não entendi"', () => {
    for (const m of ['cancela', 'anotei errado', 'apaga isso']) expect(parseMessage(m).kind, m).toBe('undo');
    for (const m of ['kkk', 'tchau', 'haha', 'combinado']) expect(parseMessage(m).kind, m).toBe('thanks');
  });
  it('valor por extenso e verbos de comida', () => {
    expect(parseMessage('cinquenta reais no mercado')).toMatchObject({ kind: 'expense', amount: 50, category: 'Alimentação' });
    expect(parseMessage('almocei 25')).toMatchObject({ amount: 25, category: 'Alimentação' });
    expect(parseMessage('comprei pão 8')).toMatchObject({ amount: 8, category: 'Alimentação' });
    expect(parseMessage('abasteci 150')).toMatchObject({ amount: 150, category: 'Transporte' });
  });
});
