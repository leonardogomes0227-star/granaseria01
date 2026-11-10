import { describe, expect, it } from 'vitest';
import { aplicarFatura, analiseFatura, impactoCompra, lerData, lerFaturaCsv, lerParcela, lerValor, totalFatura } from './faturaCsv';
import type { Cartao } from './tipos';

const NUBANK = `date,category,title,amount
2026-11-02,restaurante,iFood *Pedido,45.90
2026-11-03,serviços,Netflix.Com,55.90
2026-11-05,compras,Magazine Luiza - Parcela 2/6,199.90
2026-11-06,transporte,Uber *Trip,23.50
2026-11-08,,Pagamento recebido,-1200.00
2026-11-09,saúde,Drogaria Pacheco,67.30
2026-11-10,,Estorno de compra,-20.00`;

describe('fatura em CSV', () => {
  it('lê o formato do Nubank, ignora pagamento e estorno e acha a parcela', () => {
    const r = lerFaturaCsv(NUBANK);
    expect(r.erro).toBeUndefined();
    expect(r.compras).toHaveLength(5);
    expect(r.ignoradas).toBe(2);
    const p = r.compras.find((c) => c.descricao.startsWith('Magazine'))!;
    expect(p).toMatchObject({ descricao: 'Magazine Luiza', parcelaAtual: 2, parcelasTotal: 6, valor: 199.9 });
    expect(r.compras.find((c) => c.descricao === 'Netflix.Com')?.categoria).toBe('Assinaturas');
    expect(totalFatura(r.compras)).toBe(392.5);
  });
  it('aceita ponto e vírgula, vírgula decimal e data brasileira', () => {
    const r = lerFaturaCsv('Data;Descrição;Valor\n03/11/2026;Mercado Extra;"1.234,56"\n04/11/2026;Padaria;12,50');
    expect(r.compras.map((c) => c.valor)).toEqual([1234.56, 12.5]);
    expect(r.compras[0].data).toBe('2026-11-03');
  });
  it('arquivo estranho: erro claro e nada inventado', () => {
    expect(lerFaturaCsv('a,b\n1,2').erro).toMatch(/colunas/);
    expect(lerFaturaCsv('').erro).toMatch(/vazio/);
    expect(lerFaturaCsv('date,title,amount\n2026-11-01,Pagamento recebido,-10').erro).toMatch(/compras/);
  });
  it('arquivo com BOM (comum em CSV de banco) também é lido', () => {
    expect(lerFaturaCsv('\uFEFFdate,title,amount\n2026-11-01,Padaria,10').compras).toHaveLength(1);
  });
  it('lê valores, datas e parcelas', () => {
    expect(lerValor('R$ 1.234,56')).toBe(1234.56);
    expect(Number.isNaN(lerValor('abc'))).toBe(true);
    expect(lerData('31/02/2026')).toBeNull();
    expect(lerData('2026-11-03')).toBe('2026-11-03');
    expect(lerParcela('Loja - Parcela 10/12')).toEqual({ descricao: 'Loja', atual: 10, total: 12 });
    expect(lerParcela('Loja sem parcela').atual).toBeUndefined();
  });
  it('aplica no cartão: fatura vira o total e parcelas futuras entram uma vez só', () => {
    const c: Cartao = { limite: 3000, usado: 100, fechaDia: 1, venceDia: 10 };
    const cs = lerFaturaCsv(NUBANK).compras;
    let n = 0;
    const a = aplicarFatura(c, cs, () => `id${n++}`);
    expect(a.cartao.usado).toBe(392.5);
    expect(a.cartao.parcelados).toEqual([{ id: 'id0', descricao: 'Magazine Luiza', parcela: 199.9, restantes: 4 }]);
    const b = aplicarFatura(a.cartao, cs, () => `id${n++}`); // importar de novo não duplica
    expect(b.cartao.parcelados).toHaveLength(1);
    expect(b.atualizados).toBe(1);
  });
  it('onde cortar: assinaturas, parcela do mês e o que dá para reduzir', () => {
    const a = analiseFatura(lerFaturaCsv(NUBANK).compras);
    expect(a.assinaturas.map((x) => x.descricao)).toEqual(['Netflix.Com']);
    expect(a.parcelasDoMes).toBe(199.9);
    expect(a.cortavel).toBeGreaterThan(55);
    expect(a.maiores.every((m) => !m.parcelasTotal)).toBe(true);
  });
  it('impacto de compra: parcela, fatura depois e veredito', () => {
    const c: Cartao = { limite: 3000, usado: 500, fechaDia: 1, venceDia: 10, parcelados: [{ id: 'p', descricao: 'TV', parcela: 200, restantes: 3 }], limitePessoal: 800 };
    const i = impactoCompra(c, { valor: 600, parcelas: 6 }, 400);
    expect(i.parcela).toBe(100);
    expect(i.faturaDepois).toBe(600);
    expect(i.antes[0]).toBe(200);
    expect(i.depois[0]).toBe(300);
    expect(i.veredito).toBe('cabe');
    expect(impactoCompra(c, { valor: 900, parcelas: 1 }, 5000).veredito).toBe('nao-cabe'); // passa do limite pessoal
    expect(impactoCompra({ ...c, limitePessoal: undefined }, { valor: 300, parcelas: 1 }, 0).veredito).toBe('nao-cabe'); // sem folga
  });
});
