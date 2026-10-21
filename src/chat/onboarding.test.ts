import { describe, expect, it } from 'vitest';
import { conferir, percorrer, rotuloDe, comNome, type AgenteId, type RespostaDada, type Valor } from './engine';
import { dadosDeEstado } from './dados';
import { ROTEIRO_ONBOARDING, concluirOnboarding, planoDe, sugestaoGuardar } from './roteiros/onboarding';

const NOW = new Date('2026-10-21T15:00:00Z');
const base = (agente: AgenteId = 'arkad', state: Record<string, string> = {}) => ({ agente, nome: 'Leonardo', dados: dadosDeEstado(state, NOW) });

/** Responde em sequência, conferindo que cada passo pedido é o esperado. */
function responder(agente: AgenteId, pares: [string, Valor][], state: Record<string, string> = {}) {
  const roteiro = ROTEIRO_ONBOARDING(agente);
  const respostas: RespostaDada[] = [];
  for (const [passo, valor] of pares) {
    const p = percorrer(roteiro, respostas, base(agente, state));
    expect(p.atual?.id, `esperava o passo ${passo}`).toBe(passo);
    const erro = conferir(p.atual!, valor, p.ctx);
    expect(erro, `resposta de ${passo} deveria servir`).toBeNull();
    respostas.push({ passo, valor });
  }
  return { roteiro, respostas, fim: percorrer(roteiro, respostas, base(agente, state)) };
}

describe('motor do chat', () => {
  it('começa falando sozinho e para na primeira pergunta', () => {
    const p = percorrer(ROTEIRO_ONBOARDING('arkad'), [], base());
    expect(p.visitas.map((v) => v.passo.id)).toEqual(['boas_vindas']);
    expect(p.atual?.id).toBe('renda');
    expect(p.fim).toBe(false);
  });

  it('{nome} some com a vírgula quando não sabemos o nome', () => {
    expect(comNome('Que bom ter você aqui, {nome}.', '')).toBe('Que bom ter você aqui.');
    expect(comNome('Pronto, {nome}. Preparei seu plano.', '')).toBe('Pronto. Preparei seu plano.');
    expect(comNome('Hm, {nome}, isso passa.', 'Ana')).toBe('Hm, Ana, isso passa.');
  });

  it('renda zero: o agente pede com calma', () => {
    const p = percorrer(ROTEIRO_ONBOARDING('arkad'), [], base());
    expect(conferir(p.atual!, 0, p.ctx)).toMatch(/Sem renda agora/);
  });

  it('resposta que não bate mais com o roteiro é descartada (o resto continua)', () => {
    const p = percorrer(ROTEIRO_ONBOARDING('arkad'), [{ passo: 'renda', valor: 3000 }, { passo: 'passo_que_nao_existe', valor: 1 }], base());
    expect(p.validas).toHaveLength(1);
    expect(p.atual?.id).toBe('renda_variavel');
  });

  it('editar uma resposta = cortar a lista ali e continuar', () => {
    const { roteiro, respostas } = responder('arkad', [
      ['renda', 4000],
      ['renda_variavel', 'fixa'],
      ['fixos', 2000],
      ['sobra', 1950],
      ['tem_divida', 'nao'],
    ]);
    const cortada = respostas.slice(0, 2); // edita "fixos"
    const p = percorrer(roteiro, [...cortada, { passo: 'fixos', valor: 1000 }], base());
    expect(p.atual?.id).toBe('sobra');
  });
});

describe('roteiro 6.1 — onboarding', () => {
  it('caminho sem dívida termina no resultado com 3 linhas', () => {
    const { fim } = responder('arkad', [
      ['renda', 4000],
      ['renda_variavel', 'fixa'],
      ['fixos', 2000],
      ['sobra', 1950],
      ['tem_divida', 'nao'],
      ['guardado', 1000],
      ['quanto_guardar', 400],
    ]);
    expect(fim.fim).toBe(true);
    expect(fim.visitas[fim.visitas.length - 1]?.passo.id).toBe('resultado');
    const r = ROTEIRO_ONBOARDING('arkad').resultado!(fim.ctx);
    expect(r.titulo).toBe('Seu plano com Arkad');
    expect(r.linhas).toHaveLength(2); // sem dívida: reserva + por dia
    expect(r.linhas[0]).toBe('1. Guardar R$ 400/mês · reserva em jan/29');
    expect(r.linhas[1]).toMatch(/^2\. Gastar até R\$ \d+ por dia$/);
    expect(r.agentes).toContain('arkad');
  });

  it('renda que varia: fala do mês fraco antes dos fixos', () => {
    const roteiro = ROTEIRO_ONBOARDING('arkad');
    const p = percorrer(roteiro, [{ passo: 'renda', valor: 3000 }, { passo: 'renda_variavel', valor: 'varia' }], base());
    const falas = (p.atual!.falas as (c: typeof p.ctx) => string[])(p.ctx);
    expect(falas[0]).toMatch(/mês fraco/);
  });

  it('fixos maiores que a renda: oferece revisar e volta pro lugar certo', () => {
    const roteiro = ROTEIRO_ONBOARDING('arkad');
    const r: RespostaDada[] = [
      { passo: 'renda', valor: 1000 },
      { passo: 'renda_variavel', valor: 'fixa' },
      { passo: 'fixos', valor: 1500 },
    ];
    expect(percorrer(roteiro, r, base()).atual?.id).toBe('fixos_revisar');
    // revisar renda → pergunta a renda de novo e volta pra conferência (sem repetir "fixa ou varia")
    const rev = [...r, { passo: 'fixos_revisar', valor: 'renda' }];
    expect(percorrer(roteiro, rev, base()).atual?.id).toBe('renda');
    expect(percorrer(roteiro, [...rev, { passo: 'renda', valor: 2000 }], base()).atual?.id).toBe('sobra');
    // "está certo mesmo" segue
    expect(percorrer(roteiro, [...r, { passo: 'fixos_revisar', valor: 'ok' }], base()).atual?.id).toBe('sobra');
  });

  it('sobra muito menor que a conta: pergunta pra onde vai; "não sei" ativa o Nomasir', () => {
    const { fim } = responder('arkad', [
      ['renda', 4000],
      ['renda_variavel', 'fixa'],
      ['fixos', 2000],
      ['sobra', 300],
      ['sobra_destino', ['lanches', 'naosei']],
      ['tem_divida', 'nao'],
      ['guardado', 0],
      ['quanto_guardar', 400],
    ]);
    expect(planoDe(fim.ctx).agentes).toEqual(expect.arrayContaining(['arkad', 'nomasir']));
  });

  it('com dívidas: lista, Dabasir, sugestão de 10% da sobra e trava acima da sobra', () => {
    const roteiro = ROTEIRO_ONBOARDING('dabasir');
    const { respostas } = responder('dabasir', [
      ['renda', 4000],
      ['renda_variavel', 'fixa'],
      ['fixos', 2000],
      ['sobra', 1900],
      ['tem_divida', 'tenho'],
      [
        'lista_dividas',
        [
          { nome: 'Cartão', saldo: 3000, parcela: 200, juros: 5 },
          { nome: 'Loja', saldo: 500, parcela: 100, juros: null },
        ],
      ],
      ['guardado', 0],
    ]);
    const p = percorrer(roteiro, respostas, base('dabasir'));
    expect(p.atual?.id).toBe('quanto_guardar');
    // sobra depois dos fixos = 2000 → 10% = 200
    expect(sugestaoGuardar(p.ctx)).toBe(200);
    // sobra teórica = 4000 - 2000 - 400 (20% do Dabasir) = 1600
    expect(conferir(p.atual!, 1700, p.ctx)).toMatch(/mais do que sobra/);
    expect(conferir(p.atual!, 200, p.ctx)).toBeNull();
    const fim = percorrer(roteiro, [...respostas, { passo: 'quanto_guardar', valor: 200 }], base('dabasir'));
    const res = roteiro.resultado!(fim.ctx);
    expect(res.linhas[0]).toMatch(/^1\. Pagar R\$ 400\/mês nas dívidas · quitado em /);
    expect(res.linhas).toHaveLength(3);
    const c = concluirOnboarding(fim.ctx, 'dabasir:onboarding');
    const divida = c.missoes.find((m) => m.tipo === 'divida')!;
    expect(divida.agente).toBe('dabasir');
    expect(divida.valorMensal).toBe(400);
    expect(divida.dividas?.[0].nome).toBe('Cartão'); // maior juros primeiro
    expect(divida.passos[0].titulo).toBe('Pagar R$ 300 em Cartão este mês'); // 400 - parcela da loja
    expect(c.missoes.find((m) => m.tipo === 'reserva')?.valorMensal).toBe(200);
    expect(c.ativar).toEqual(expect.arrayContaining(['dabasir', 'arkad']));
    expect(c.eu).toMatchObject({ renda: 4000, custoEssencial: 2000, agentePrincipal: 'dabasir', onboardingConcluido: true });
  });

  it('juros que o valor do mês não vence: o cartão diz que precisa renegociar', () => {
    const roteiro = ROTEIRO_ONBOARDING('dabasir');
    const { respostas } = responder('dabasir', [
      ['renda', 4000],
      ['renda_variavel', 'fixa'],
      ['fixos', 2000],
      ['sobra', 1900],
      ['tem_divida', 'tenho'],
      ['lista_dividas', [{ nome: 'Cartão', saldo: 3000, parcela: 200, juros: 14 }]],
      ['guardado', 0],
      ['quanto_guardar', 100],
    ]);
    const fim = percorrer(roteiro, respostas, base('dabasir'));
    expect(roteiro.resultado!(fim.ctx).linhas[0]).toBe('1. Pagar R$ 400/mês em Cartão · precisa renegociar');
    expect(concluirOnboarding(fim.ctx, 'x').missoes[0].notas).toMatch(/Renegociar/);
  });

  it('lista de dívidas pede pelo menos uma e o saldo de cada', () => {
    const roteiro = ROTEIRO_ONBOARDING('arkad');
    const r: RespostaDada[] = [
      { passo: 'renda', valor: 4000 },
      { passo: 'renda_variavel', valor: 'fixa' },
      { passo: 'fixos', valor: 2000 },
      { passo: 'sobra', valor: 1950 },
      { passo: 'tem_divida', valor: 'tenho' },
    ];
    const p = percorrer(roteiro, r, base());
    expect(p.atual?.id).toBe('lista_dividas');
    expect(conferir(p.atual!, [], p.ctx)).toMatch(/pelo menos 1/);
    expect(conferir(p.atual!, [{ nome: 'Cartão', saldo: 0, parcela: null, juros: null }], p.ctx)).toMatch(/quanto deve/i);
    expect(rotuloDe(p.atual!, [{ nome: 'A', saldo: 1 }, { nome: 'B', saldo: 2 }], p.ctx)).toBe('2 dívidas');
  });

  it('reserva já completa pula pro Sharru Nada', () => {
    const { fim } = responder('arkad', [
      ['renda', 4000],
      ['renda_variavel', 'fixa'],
      ['fixos', 1000],
      ['sobra', 2950],
      ['tem_divida', 'nao'],
      ['guardado', 6000],
      ['quanto_guardar', 400],
    ]);
    const c = concluirOnboarding(fim.ctx, 'arkad:onboarding');
    expect(c.missoes.map((m) => m.tipo)).toEqual(['investir']);
    expect(c.ativar).toContain('sharru');
    expect(ROTEIRO_ONBOARDING('arkad').resultado!(fim.ctx).linhas[0]).toMatch(/Reserva completa/);
  });

  it('o roteiro pré-preenche com o que o app já sabe', () => {
    const state = {
      'gs-contas': JSON.stringify([{ id: 'a', name: 'Aluguel', amount: 1300, dueDay: 5, startMonth: '2026-10', payments: [] }, { id: 'b', name: 'Celular', amount: 90, dueDay: 10, startMonth: '2026-10', payments: [], installments: 10 }]),
      'gs-eu': JSON.stringify({ renda: 3500 }),
    };
    const roteiro = ROTEIRO_ONBOARDING('arkad');
    const p = percorrer(roteiro, [], base('arkad', state));
    expect(p.ctx.dados.renda).toBe(3500);
    expect(p.ctx.dados.custoEssencial).toBe(1300); // parcela não conta como gasto fixo
  });
});
