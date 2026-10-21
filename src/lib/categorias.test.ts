import { describe, expect, it } from 'vitest';
import { CATEGORIES, OTHER_CATEGORY, detectCategory, detectIncomeSource, extractMethod } from '../../server/whatsapp/parse';
import {
  CATEGORIAS_SAIDA,
  FONTES_ENTRADA,
  GUARDADO,
  ICONES_ENTRADA,
  ICONES_SAIDA,
  OUTROS,
  categoriaPorNome,
  detectarCategoria,
  detectarFonte,
  detectarForma,
  iconeCategoria,
  rotuloCategoria,
} from './categorias';

describe('categorias dos lançamentos', () => {
  it('usa os mesmos nomes do WhatsApp, na mesma ordem', () => {
    expect(CATEGORIAS_SAIDA.map((c) => c.nome)).toEqual([...CATEGORIES.map((c) => c.name), OTHER_CATEGORY.name]);
    expect(GUARDADO).toBe('Guardado');
    expect(OUTROS).toBe('Outros');
  });

  it('cada palavra do bot cai na mesma categoria aqui', () => {
    for (const c of CATEGORIES)
      for (const p of c.keywords) {
        expect(detectarCategoria(p) ?? OTHER_CATEGORY.name).toBe(detectCategory(p));
        expect(detectarCategoria(`gastei 30 no ${p} hoje`) ?? OTHER_CATEGORY.name).toBe(detectCategory(`gastei 30 no ${p} hoje`));
      }
  });

  it('acha a categoria pelas palavras da descrição', () => {
    expect(detectarCategoria('táxi pro centro')).toBe('Transporte');
    expect(detectarCategoria('Uber')).toBe('Transporte');
    expect(detectarCategoria('corrida 99')).toBe('Transporte');
    expect(detectarCategoria('iFood')).toBe('Alimentação');
    expect(detectarCategoria('lanches')).toBe('Alimentação');
    expect(detectarCategoria('mercado do mês')).toBe('Alimentação');
    expect(detectarCategoria('restaurante')).toBe('Alimentação');
    expect(detectarCategoria('Farmácia')).toBe('Saúde');
    expect(detectarCategoria('reserva do hotel')).toBe('Lazer');
    expect(detectarCategoria('reserva')).toBe('Guardado');
  });

  it('palavra inteira: "bar" não pega "barbearia"; sem pista, null', () => {
    expect(detectarCategoria('barbearia')).toBe('Cuidados pessoais');
    expect(detectarCategoria('barra de cereal')).toBeNull();
    expect(detectarCategoria('')).toBeNull();
    expect(detectarCategoria('   ')).toBeNull();
  });

  it('entradas: as mesmas fontes do bot', () => {
    for (const t of ['salário', '13o', 'décimo terceiro', 'freela', 'vendi a bike', 'reembolso', 'presente da vó', 'rendimento', 'cashback', 'pix da Ana'])
      expect(detectarFonte(t) ?? 'Outros').toBe(detectIncomeSource(t));
    expect(detectarFonte('Salário de outubro')).toBe('Salário');
    expect(detectarFonte('bico no sábado')).toBe('Renda extra');
    expect(detectarFonte('')).toBeNull();
    expect(FONTES_ENTRADA[FONTES_ENTRADA.length - 1]?.nome).toBe('Outros');
  });

  it('forma de pagamento, como o bot', () => {
    for (const t of ['mercado no pix', 'cartão de crédito', 'no débito', 'em dinheiro', 'boleto', 'vale refeição', 'no cartão', 'padaria'])
      expect(detectarForma(t) ?? undefined).toBe(extractMethod(t).method);
  });

  it('rótulos e nomes', () => {
    expect(rotuloCategoria('Alimentação')).toBe('Comida');
    expect(rotuloCategoria('Moradia')).toBe('Casa');
    expect(rotuloCategoria('Farmácia')).toBe('Farmácia');
    expect(categoriaPorNome('comida')).toBe('Alimentação');
    expect(categoriaPorNome('SAUDE')).toBe('Saúde');
    expect(categoriaPorNome('Delivery')).toBeNull();
  });

  it('toda categoria e toda fonte tem ícone', () => {
    for (const c of CATEGORIAS_SAIDA) expect(ICONES_SAIDA[c.nome]).toBeTruthy();
    for (const f of FONTES_ENTRADA) expect(ICONES_ENTRADA[f.nome]).toBeTruthy();
    expect(iconeCategoria('Nada disso')).toBeTruthy();
    expect(iconeCategoria('Nada disso', 'in')).toBeTruthy();
  });
});
