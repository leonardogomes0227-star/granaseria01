import { describe, expect, it } from 'vitest';
import { conferir, percorrer, type AgenteId, type RespostaDada, type Roteiro, type Valor } from './engine';
import { dadosDeEstado } from './dados';
import { ROTEIRO_RESERVA } from './roteiros/arkad';
import { ROTEIRO_DIVIDAS } from './roteiros/dabasir';

const NOW = new Date('2026-10-21T15:00:00Z');
const base = (agente: AgenteId, state: Record<string, string> = {}) => ({ agente, nome: 'Ana', dados: dadosDeEstado(state, NOW) });

function responder(roteiro: Roteiro, pares: [string, Valor][], state: Record<string, string> = {}) {
  const r: RespostaDada[] = [];
  for (const [passo, valor] of pares) {
    const p = percorrer(roteiro, r, base(roteiro.agente, state));
    expect(p.atual?.id, `esperava ${passo}`).toBe(passo);
    expect(conferir(p.atual!, valor, p.ctx)).toBeNull();
    r.push({ passo, valor });
  }
  return percorrer(roteiro, r, base(roteiro.agente, state));
}

describe('6.2 Arkad — reserva', () => {
  const contas = { 'gs-contas': JSON.stringify([{ id: 'a', name: 'Aluguel', amount: 1500, dueDay: 5, startMonth: '2026-10', payments: [] }]), 'gs-eu': JSON.stringify({ renda: 4000 }) };
  it('usa os gastos fixos cadastrados, sugere 10% e pede o dia do salário', () => {
    const fim = responder(ROTEIRO_RESERVA, [['atual', 1000], ['custo_ok', 'sim'], ['meta', 'usar'], ['mensal', 400], ['dia', 5]], contas);
    expect(fim.fim).toBe(true);
    const res = ROTEIRO_RESERVA.resultado!(fim.ctx);
    expect(res.linhas).toEqual(['1. Guardar R$ 400 no dia 5', '2. Chegar a R$ 4.500 (metade)', '3. Reserva completa em mai/28']);
    const c = ROTEIRO_RESERVA.concluir!(fim.ctx, 'arkad:reserva');
    expect(c.missoes[0]).toMatchObject({ tipo: 'reserva', metaValor: 9000, valorInicial: 1000, valorMensal: 400 });
    expect(c.eu).toMatchObject({ diaSalario: 5 });
  });
  it('reserva já completa leva pro Sharru Nada', () => {
    const fim = responder(ROTEIRO_RESERVA, [['atual', 10000], ['custo_ok', 'sim'], ['meta', 'usar']], contas);
    expect(fim.visitas[fim.visitas.length - 1].passo.id).toBe('completa');
    expect(ROTEIRO_RESERVA.concluir!(fim.ctx, 'x').destino).toBe('/agentes/sharru/chat');
  });
  it('sem contas cadastradas, pergunta o custo', () => {
    const fim = responder(ROTEIRO_RESERVA, [['atual', 0], ['custo', 2000], ['meta', 'outro'], ['meta_valor', 15000], ['mensal', 500], ['dia', 10]]);
    expect(ROTEIRO_RESERVA.concluir!(fim.ctx, 'x').missoes[0].metaValor).toBe(15000);
  });
});

describe('6.3 Dabasir — dívidas', () => {
  it('lista, ordem e regra; plano com linha do tempo', () => {
    const state = { 'gs-eu': JSON.stringify({ renda: 4000, custoEssencial: 2000 }) };
    const fim = responder(
      ROTEIRO_DIVIDAS,
      [
        ['lista', [{ nome: 'Cartão', saldo: 3000, parcela: 200, juros: 6 }, { nome: 'Loja', saldo: 600, parcela: 100, juros: null }]],
        ['ordem', 'menor'],
        ['regra', 'ok'],
      ],
      state
    );
    const res = ROTEIRO_DIVIDAS.resultado!(fim.ctx);
    expect(res.linhas[0]).toBe('1. Pagar R$ 200 em Loja este mês'); // 400 (20% de 2000) - 200 da parcela do cartão
    expect(res.lista).toHaveLength(2);
    const m = ROTEIRO_DIVIDAS.concluir!(fim.ctx, 'dabasir:dividas').missoes[0];
    expect(m).toMatchObject({ tipo: 'divida', metodo: 'menor', valorMensal: 400 });
  });
  it('sem renda, pergunta renda e fixos', () => {
    const fim = responder(ROTEIRO_DIVIDAS, [['renda', 3000], ['fixos', 1500], ['lista', [{ nome: 'Cartão', saldo: 1000, parcela: 100, juros: 3 }]], ['regra', 'ok']]);
    expect(ROTEIRO_DIVIDAS.concluir!(fim.ctx, 'x').eu).toMatchObject({ renda: 3000, custoEssencial: 1500 });
  });
});
