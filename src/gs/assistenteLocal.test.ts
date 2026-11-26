import { describe, expect, it } from 'vitest';
import { responderLocal } from './assistenteLocal';
import { ESTADO_INICIAL } from './tipos';

const HOJE = '2026-11-11';
const base = () => {
  const e = ESTADO_INICIAL();
  e.config.renda = 5000;
  e.gastosFixos = [
    { id: 'a', nome: 'Escola', valor: 650, diaVencimento: 1, categoria: 'Outros', pagamentos: {}, criadaEm: '2026-11-01' },
    { id: 'b', nome: 'Luz', valor: 180, diaVencimento: 13, categoria: 'Luz', pagamentos: {}, criadaEm: '2026-11-01' },
  ];
  return e;
};

describe('assistente local', () => {
  it('diz o que pagar primeiro, começando pela atrasada', () => {
    const r = responderLocal('O que eu pago primeiro?', base(), HOJE);
    expect(r.texto).toContain('R$ 830');
    expect(r.texto).toContain('Escola');
    expect(r.links?.[0].rota).toBe('/pagar');
  });
  it('sem contas, convida a cadastrar', () => {
    const r = responderLocal('quais contas vencem?', ESTADO_INICIAL(), HOJE);
    expect(r.links?.[0].rota).toBe('/pagar?nova=1');
  });
  it('sem renda, pede a renda antes de dizer quanto pode gastar', () => {
    const r = responderLocal('Quanto posso gastar hoje?', ESTADO_INICIAL(), HOJE);
    expect(r.links?.[0].rota).toBe('/dados');
  });
  it('responde sobre dívidas com o total', () => {
    const e = base();
    e.dividas = [{ id: 'd', nome: 'Cartão', saldo: 3000, jurosMensal: 12, parcelaMinima: 300, pagamentos: [], tipo: 'rotativa' }];
    expect(responderLocal('Quando fico livre das dívidas?', e, HOJE).texto).toContain('R$ 3.000');
  });
  it('o que não entende, procura nas ferramentas ou sugere perguntas', () => {
    expect(responderLocal('quero investir', base(), HOJE).links?.length).toBeGreaterThan(0);
    // sem entender, ainda leva a pessoa para a lista de todas as ferramentas
    expect(responderLocal('xyzzy', base(), HOJE).links?.[0].rota).toBe('/ferramentas');
  });

  it('direciona para a aba que a pessoa procura', () => {
    const contas = responderLocal('abrir minhas contas', base(), HOJE);
    expect(contas.ir).toBe('/pagar');
    expect(responderLocal('onde fica o orçamento?', base(), HOJE).links?.some((l) => l.rota === '/plano/orcamento')).toBe(true);
    expect(responderLocal('quero ver os relatórios', base(), HOJE).links?.[0].rota).toBe('/relatorios');
    expect(responderLocal('me leva para a reserva', base(), HOJE).links?.length).toBeGreaterThan(0);
  });
});
