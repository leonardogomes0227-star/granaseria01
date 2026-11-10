import { describe, expect, it } from 'vitest';
import { corrigirOcr, lerFaturaTexto } from './faturaTexto';

const HOJE = '2026-11-12';
describe('fatura em texto (cópia, PDF ou foto)', () => {
  it('lê "03 NOV  descrição  R$ 12,50" e ignora cabeçalho, pagamento e total', () => {
    const t = `FATURA NOVEMBRO
Total da fatura R$ 300,00
03 NOV iFood *Pedido R$ 45,90
05 NOV Magazine Luiza - Parcela 2/6 R$ 199,90
08 NOV Pagamento recebido -R$ 1.200,00
09 nov Drogaria Pacheco R$ 67,30`;
    const r = lerFaturaTexto(t, HOJE);
    expect(r.erro).toBeUndefined();
    expect(r.compras.map((c) => c.descricao)).toEqual(['iFood *Pedido', 'Magazine Luiza', 'Drogaria Pacheco']);
    expect(r.compras[1]).toMatchObject({ parcelaAtual: 2, parcelasTotal: 6, valor: 199.9, data: '2026-11-05' });
    expect(r.ignoradas).toBe(1); // o pagamento (as linhas sem data nem contam)
  });
  it('aceita 03/11, 03/11/2026 e valor sem R$', () => {
    const r = lerFaturaTexto('03/11 Padaria 12,50\n04/11/2026 Mercado Extra 1.234,56', HOJE);
    expect(r.compras.map((c) => [c.data, c.valor])).toEqual([['2026-11-03', 12.5], ['2026-11-04', 1234.56]]);
  });
  it('captura de tela: descrição numa linha e valor na outra', () => {
    const r = lerFaturaTexto('10 NOV Uber *Trip\nR$ 23,50\n11 NOV Netflix.Com\nR$ 55,90', HOJE);
    expect(r.compras.map((c) => [c.descricao, c.valor])).toEqual([['Uber *Trip', 23.5], ['Netflix.Com', 55.9]]);
    expect(r.compras[1].categoria).toBe('Assinaturas');
  });
  it('mês que ainda não chegou vira o ano passado (fatura de dezembro lida em janeiro)', () => {
    expect(lerFaturaTexto('20 DEZ Loja X R$ 10,00', '2027-01-05').compras[0].data).toBe('2026-12-20');
  });
  it('texto sem compras: erro claro', () => {
    expect(lerFaturaTexto('Olá, isto não é uma fatura', HOJE).erro).toMatch(/Não consegui/);
    expect(lerFaturaTexto('', HOJE).compras).toEqual([]);
  });
  it('data inválida é ignorada sem quebrar', () => {
    expect(lerFaturaTexto('31/02 Loja R$ 10,00\n05/11 Loja R$ 5,00', HOJE).compras).toHaveLength(1);
  });
  it('OCR: conserta "O" no lugar de zero na data e no valor, sem mexer na descrição', () => {
    const ocr = 'Fatura Novembro\n\nO3 NOV iFood *Pedido R$45,90\n\nO5 NOV Magazine Luiza - Parcela 2/6 R$199,90\nl0 NOV Uber*Trip R$2O,5O\nO9 NOV Drogaria Pacheco R$67,30\n';
    const r = lerFaturaTexto(ocr, HOJE, { ocr: true });
    expect(r.compras.map((c) => [c.data, c.descricao, c.valor])).toEqual([['2026-11-03', 'iFood *Pedido', 45.9], ['2026-11-05', 'Magazine Luiza', 199.9], ['2026-11-10', 'Uber*Trip', 20.5], ['2026-11-09', 'Drogaria Pacheco', 67.3]]);
    expect(corrigirOcr('3O NOV Loja R$ 1O,00')).toBe('30 NOV Loja R$ 10,00');
    expect(corrigirOcr('Olá O3 mundo')).toBe('Olá O3 mundo'); // não mexe em texto que não é data nem valor
  });
});
