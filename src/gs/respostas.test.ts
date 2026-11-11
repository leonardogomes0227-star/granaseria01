import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL, type Estado } from './tipos';
import { respostaDe } from './respostas';

const HOJE = '2026-11-10';
const IDS = ['contas', 'calendario', 'atrasos', 'dividas', 'cartao', 'recuperacao', 'lancamentos', 'orcamento', 'relatorios', 'reserva', 'metas', 'extras', 'investir', 'renda', 'assinaturas'];
const pagas = (ms: string[], v: number) => Object.fromEntries(ms.map((m) => [m, { valorPago: v, pagoEm: `${m}-05` }]));
const cheio = (): Estado => {
  const e = ESTADO_INICIAL();
  return {
    ...e,
    config: { ...e.config, renda: 4200, onboardingFeito: true },
    gastosFixos: [{ id: 'a', nome: 'Aluguel', valor: 1200, diaVencimento: 5, categoria: 'Aluguel', pagamentos: pagas(['2026-09', '2026-10'], 1200), criadaEm: '2026-09-01' }, { id: 'l', nome: 'Luz', valor: 180, diaVencimento: 20, categoria: 'Luz', pagamentos: pagas(['2026-09', '2026-10'], 180), criadaEm: '2026-09-01' }],
    lancamentos: [{ id: '1', descricao: 'Mercado', valor: 500, data: '2026-11-03', categoria: 'Mercado' }, { id: '2', descricao: 'Mercado', valor: 900, data: '2026-10-03', categoria: 'Mercado' }],
    receitas: [{ id: 'r', descricao: 'Salário', valor: 4200, data: '2026-10-05', tipo: 'salario' }],
    dividas: [{ id: 'c', nome: 'Cartão', saldo: 3000, jurosMensal: 12, parcelaMinima: 300, pagamentos: [], cadastradaEm: HOJE }],
    planoDividas: { estrategia: 'bola-de-neve', pagamentoMensal: 800, criadoEm: HOJE },
    cartao: { limite: 3000, usado: 900, fechaDia: 20, venceDia: 27 },
    assinaturas: [{ id: 's', nome: 'Streaming', valor: 40, ativa: true, personalizada: false }],
    metas: [{ id: 'm', nome: 'Viagem', alvo: 3000, criadaEm: HOJE, prazo: '2027-06-10', guardados: [] }],
    limites: { Mercado: 450 },
  };
};

describe('a resposta de cada ferramenta', () => {
  it('toda ferramenta responde em uma frase, com um botão, sem quebrar com estado vazio', () => {
    for (const id of IDS) {
      for (const e of [ESTADO_INICIAL(), cheio()]) {
        const r = respostaDe(id, e, HOJE);
        if (!r) continue;
        expect(r.frase.length, id).toBeGreaterThan(10);
        expect(r.acao.rotulo.length, id).toBeGreaterThan(2);
        expect(Boolean(r.acao.rota || r.acao.handler), id).toBe(true);
        expect(r.frase, id).not.toMatch(/NaN|undefined|Infinity/);
      }
    }
  });

  it('com dados, a resposta tem número; as que têm prazo dizem a data', () => {
    const e = cheio();
    for (const id of IDS.filter((x) => x !== 'extras')) expect(respostaDe(id, e, HOJE)?.frase ?? '', id).toMatch(/R\$|\d/);
    expect(respostaDe('dividas', e, HOJE)!.frase).toMatch(/livre das dívidas em \w+ de 20\d\d/);
    expect(respostaDe('metas', e, HOJE)!.frase).toContain('junho de 2027');
    expect(respostaDe('orcamento', e, HOJE)!.frase).toContain('Mercado passou');
    expect(respostaDe('contas', e, HOJE)!.acao.handler).toBe('baixa');
  });

  it('ferramenta com coisa a fazer oferece "Colocar no meu caminho"', () => {
    const e = cheio();
    for (const id of ['contas', 'dividas', 'cartao', 'orcamento', 'reserva', 'metas']) expect(respostaDe(id, e, HOJE)?.passo?.titulo, id).toBeTruthy();
  });
});
