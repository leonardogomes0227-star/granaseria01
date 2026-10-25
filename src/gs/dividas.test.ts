import { describe, expect, it } from 'vitest';
import { compararEstrategias, linkWhatsApp, mensagemParaOBanco, ordenar, passoDoMes, saldoAtual, simular, type DividaSim } from './dividas';

const d = (id: string, saldo: number, juros: number, min: number): DividaSim => ({ id, nome: id, saldo, jurosMensal: juros, parcelaMinima: min });

describe('quitação de dívidas', () => {
  it('uma dívida, juros zero: saldo ÷ pagamento', () => {
    const s = simular([d('a', 1200, 0, 100)], 300, 'bola-de-neve', '2026-10');
    expect(s.meses).toBe(4);
    expect(s.totalJuros).toBe(0);
    expect(s.dataFinal).toBe('2027-02');
    expect(s.insuficiente).toBe(false);
  });
  it('uma dívida com juros: cada mês saldo × (1+juros) − pagamento', () => {
    const s = simular([d('a', 1000, 10, 50)], 600, 'maior-juro', '2026-10');
    // mês 1: 1100 - 600 = 500; mês 2: 550 - 550 = 0
    expect(s.meses).toBe(2);
    expect(s.cronograma[0].saldoTotal).toBe(500);
    expect(s.totalJuros).toBe(150);
  });
  it('duas dívidas: bola de neve paga a menor primeiro e libera o valor pra próxima', () => {
    const ds = [d('grande', 3000, 5, 100), d('pequena', 500, 2, 50)];
    expect(ordenar(ds, 'bola-de-neve').map((x) => x.id)).toEqual(['pequena', 'grande']);
    expect(ordenar(ds, 'maior-juro').map((x) => x.id)).toEqual(['grande', 'pequena']);
    const s = simular(ds, 600, 'bola-de-neve', '2026-10');
    expect(s.quita).toBe(true);
    expect(s.quitaEm.pequena).toBeLessThan(s.quitaEm.grande);
    const c = compararEstrategias(ds, 600, '2026-10');
    expect(c.melhor).toBe('maior-juro');
    expect(c.economia).toBeGreaterThan(0);
  });
  it('pagamento insuficiente: avisa o mínimo e nunca trava (limite de 600 meses)', () => {
    const s = simular([d('a', 10000, 8, 100)], 300, 'maior-juro', '2026-10'); // juros de 800/mês
    expect(s.insuficiente).toBe(true);
    expect(s.minimoNecessario).toBe(801);
    expect(s.quita).toBe(false);
    expect(s.meses).toBe(600);
  });
  it('pagamento menor que a soma das mínimas', () => {
    const s = simular([d('a', 1000, 0, 200), d('b', 1000, 0, 200)], 300, 'bola-de-neve', '2026-10');
    expect(s.insuficiente).toBe(true);
    expect(s.minimoNecessario).toBe(400);
  });
  it('sem dívidas: nada a fazer', () => {
    const s = simular([], 500, 'bola-de-neve');
    expect(s.quita).toBe(true);
    expect(s.meses).toBe(0);
  });
  it('passo do mês: mínima + extra na da vez', () => {
    const p = passoDoMes([d('grande', 3000, 5, 100), d('pequena', 500, 2, 50)], 600, 'bola-de-neve');
    expect(p?.divida.id).toBe('pequena');
    expect(p?.valor).toBe(500); // 50 mínima + 450 de extra, limitado ao saldo
  });
  it('saldo atual abate os pagamentos', () => {
    expect(saldoAtual({ id: 'a', nome: 'a', saldo: 1000, jurosMensal: 0, parcelaMinima: 0, pagamentos: [{ data: '2026-10-01', valor: 300 }, { data: '2026-10-02', valor: 800 }] })).toBe(0);
  });
  it('mensagem e link do WhatsApp', () => {
    const m = mensagemParaOBanco({ nome: 'Ana', credor: 'Banco X', saldo: 1500, entrada: 600, parcela: 150 });
    expect(m).toContain('Meu nome é Ana.');
    expect(m).toContain('com Banco X');
    expect(linkWhatsApp('oi tudo', '')).toBe('https://wa.me/?text=oi%20tudo');
    expect(linkWhatsApp('oi', '(11) 98888-7777')).toBe('https://wa.me/11988887777?text=oi');
  });
});
