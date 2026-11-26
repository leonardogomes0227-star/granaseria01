import { describe, expect, it } from 'vitest';
import { barra, dashboardDoMes, ehGastoDeCorte } from './dashboard';
import type { Expense, Income } from './db';
import { parseMessage } from './parse';

const limpo = (t: string | null) => (t ?? '').replace(/\u00a0/g, ' ');
const NOW = new Date('2026-11-26T15:00:00Z');
let n = 0;
const g = (amount: number, category: string, description: string, payment_method?: string): Expense => ({ id: ++n, phone: '5567999991234', amount, category, description, payment_method: payment_method ?? null, created_at: '2026-11-10T15:00:00Z' });
const r = (amount: number): Income => ({ id: ++n, phone: '5567999991234', amount, source: 'Salário', description: 'salário', created_at: '2026-11-05T15:00:00Z' });

describe('dashboard do mês no WhatsApp', () => {
  const gastos = [g(80, 'Alimentação', 'mercado', 'Pix'), g(120, 'Alimentação', 'mercado'), g(45, 'Alimentação', 'ifood'), g(60, 'Lazer', 'cinema'), g(1400, 'Moradia', 'aluguel'), g(30, 'Compras', 'shein')];

  it('mostra entrou, saiu e sobrou', () => {
    const t = limpo(dashboardDoMes({ expenses: gastos, incomes: [r(5200)], now: NOW }));
    expect(t).toContain('Seu mês · novembro');
    expect(t).toContain('Entrou: R$ 5.200,00');
    expect(t).toContain('Saiu: R$ 1.735,00');
    expect(t).toContain('Sobrou: R$ 3.465,00');
  });
  it('mostra para onde foi com barras e o que mais pesou', () => {
    const t = limpo(dashboardDoMes({ expenses: gastos, incomes: [], now: NOW }));
    expect(t).toContain('*Para onde foi*');
    expect(t).toMatch(/Moradia\n▓+░* 81% · R\$ 1\.400/);
    expect(t).toContain('🥇 Aluguel: R$ 1.400');
    expect(t).toContain('Mercado: R$ 200 (2x)'); // soma o mercado das duas vezes
  });
  it('separa o que dá para segurar (lazer, compras, delivery) sem julgar', () => {
    const t = limpo(dashboardDoMes({ expenses: gastos, incomes: [], now: NOW }));
    expect(t).toContain('Dá pra segurar*: R$ 135'); // ifood 45 + cinema 60 + shein 30
    expect(ehGastoDeCorte({ category: 'Alimentação', description: 'ifood' })).toBe(true);
    expect(ehGastoDeCorte({ category: 'Alimentação', description: 'mercado' })).toBe(false);
    expect(ehGastoDeCorte({ category: 'Moradia', description: 'aluguel' })).toBe(false);
  });
  it('sem entradas, avisa que ainda não anotou e não inventa saldo', () => {
    const t = limpo(dashboardDoMes({ expenses: gastos, incomes: [], now: NOW }));
    expect(t).toContain('ainda não anotou');
    expect(t).not.toContain('Sobrou');
  });
  it('saiu mais do que entrou: mostra o quanto faltou', () => {
    expect(limpo(dashboardDoMes({ expenses: gastos, incomes: [r(1000)], now: NOW }))).toContain('Faltou: R$ 735,00');
  });
  it('mostra a forma de pagamento quando existe, e o link do painel do site', () => {
    const t = limpo(dashboardDoMes({ expenses: gastos, incomes: [], now: NOW }));
    expect(t).toContain('Como pagou*: Pix R$ 80');
    expect(t).toContain('granaseria.com.br');
  });
  it('sem gastos devolve null (o bot responde com a dica de anotar)', () => {
    expect(dashboardDoMes({ expenses: [], incomes: [r(100)], now: NOW })).toBeNull();
  });
  it('a barra nunca some quando há gasto, e nunca passa de 10', () => {
    expect(barra(1, 1000)).toBe('▓░░░░░░░░░');
    expect(barra(1000, 1000)).toBe('▓▓▓▓▓▓▓▓▓▓');
    expect(barra(0, 1000)).toBe('░░░░░░░░░░');
  });
  it('várias formas de pedir o painel caem no mesmo comando', () => {
    for (const f of ['mês', 'resumo', 'dashboard', 'balanço', 'para onde foi meu dinheiro', 'como tá meu mês']) expect(parseMessage(f), f).toEqual({ kind: 'month' });
  });
});
