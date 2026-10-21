import { describe, expect, it } from 'vitest';
import { conferir, falasDoRoteiro, percorrer, respostaDe, rotuloDe, type RespostaDada, type Valor } from '../engine';
import { dadosDeEstado } from '../dados';
import type { Missao } from '../../missoes';
import { DESTINO_KEY, dividir, fraseDaDivisao, lancamentos, linhaDoDestino, partesDoAjuste, percentuais, registroDoDestino, ROTEIRO_EXTRA, situacao, sugestao, valores } from './rodan';

const NOW = new Date('2026-10-21T15:00:00Z'); // hoje = 2026-10-21
const base = (state: Record<string, string> = {}, nome = 'Ana') => ({ agente: 'rodan' as const, nome, dados: dadosDeEstado(state, NOW) });

function responder(pares: [string, Valor][], state: Record<string, string> = {}, nome = 'Ana') {
  const r: RespostaDada[] = [];
  for (const [passo, valor] of pares) {
    const p = percorrer(ROTEIRO_EXTRA, r, base(state, nome));
    expect(p.atual?.id, `esperava ${passo}`).toBe(passo);
    expect(conferir(p.atual!, valor, p.ctx)).toBeNull();
    r.push({ passo, valor });
  }
  return percorrer(ROTEIRO_EXTRA, r, base(state, nome));
}

/** Onde a conversa está depois dessas respostas (sem conferir). */
const ate = (pares: [string, Valor][], state: Record<string, string> = {}, nome = 'Ana') =>
  percorrer(
    ROTEIRO_EXTRA,
    pares.map(([passo, valor]) => ({ passo, valor })),
    base(state, nome)
  );

const falasDe = (p: ReturnType<typeof percorrer>, id: string) => {
  const v = [...p.visitas].reverse().find((x) => x.passo.id === id);
  return v ? falasDoRoteiro.falas(v.passo, v.ctx) : [];
};
const falasAtuais = (p: ReturnType<typeof percorrer>) => falasDoRoteiro.falas(p.atual!, p.ctx);

/* ---------- missões de exemplo ---------- */

const missao = (p: Partial<Missao> & Pick<Missao, 'id' | 'tipo' | 'titulo'>): Missao => ({
  agente: 'arkad',
  metaValor: 0,
  valorInicial: 0,
  valorMensal: 0,
  dataInicio: '2026-09-01',
  dataPrevista: null,
  previsaoOriginal: null,
  prioridade: 1,
  status: 'ativa',
  passos: [],
  registros: [],
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...p,
});

const DIVIDA = missao({
  id: 'm-div',
  agente: 'dabasir',
  tipo: 'divida',
  titulo: 'Sair das dívidas',
  metaValor: 3000,
  valorMensal: 400,
  dividas: [{ id: 'd1', nome: 'Cartão', saldo: 3000, parcela: 200, jurosMes: 6 }],
});
const RESERVA = missao({ id: 'm-res', tipo: 'reserva', titulo: 'Reserva de emergência', metaValor: 9000, valorInicial: 1000, valorMensal: 400, prioridade: 3 });
const RESERVA_CHEIA = missao({ ...RESERVA, valorInicial: 9000 });
const RESERVA_CONCLUIDA = missao({ ...RESERVA, status: 'concluida', registros: [{ mes: '2026-09', valor: 8000, em: '2026-09-10', origem: 'site' }] });
const INVESTIR = missao({ id: 'm-inv', agente: 'sharru', tipo: 'investir', titulo: 'Ouro que trabalha', metaValor: 50000, valorMensal: 300, prioridade: 5 });

const estado = (missoes: Missao[], extra: Record<string, string> = {}) => ({ 'gs-missoes': JSON.stringify(missoes), ...extra });
const DIAG_COM_DIVIDA = { 'selos-wizard-progress': JSON.stringify({ data: { monthlyIncome: 3000, debts: [{ id: 'x', description: 'Cartão', value: 1500, installment: 150 }] } }) };

const COM_DIVIDA_E_RESERVA = estado([DIVIDA, RESERVA]);

/* ---------- testes ---------- */

describe('6.7 Rodan — dinheiro extra', () => {
  it('é o roteiro "extra" do Rodan e abre com a fala da spec', () => {
    expect(ROTEIRO_EXTRA).toMatchObject({ id: 'extra', agente: 'rodan', primeiro: 'abertura' });
    const p = ate([]);
    expect(falasDe(p, 'abertura')[0]).toBe('Recebeu um dinheiro a mais? Vamos dar destino a ele antes que ele suma.');
    expect(falasDe(p, 'abertura').length).toBeLessThanOrEqual(3);
    expect(p.atual?.id).toBe('valor');
    expect(falasAtuais(p)).toEqual(['Quanto entrou?']);
    expect(respostaDe(p.atual!, p.ctx)).toMatchObject({ tipo: 'dinheiro', min: 1 });
  });

  it('pergunta de onde veio, com os quatro botões', () => {
    const p = ate([['valor', 2000]]);
    expect(p.atual?.id).toBe('origem');
    expect(falasAtuais(p)).toEqual(['Que bom, Ana. R$ 2.000 a mais faz diferença.', 'De onde veio?']);
    const r = respostaDe(p.atual!, p.ctx);
    expect(r.tipo === 'botoes' && r.opcoes.map((o) => o.rotulo)).toEqual(['13º', 'Bônus', 'Freela ou bico', 'Outro']);
    // sem nome, a vírgula some
    expect(falasAtuais(ate([['valor', 2000]], {}, ''))[0]).toBe('Que bom. R$ 2.000 a mais faz diferença.');
  });

  it('caminho feliz com dívida e reserva: sugestão 70/30 do que sobra dos 10%, cartão e lançamentos', () => {
    const fim = responder([['valor', 2000], ['origem', '13'], ['sugestao', 'usar']], COM_DIVIDA_E_RESERVA);
    expect(fim.fim).toBe(true);
    expect(falasDe(fim, 'sugestao')).toEqual([
      'O 13º vem uma vez por ano. Merece um destino à altura.',
      'Minha sugestão: R$ 1.260 pra dívida, R$ 540 pra reserva e R$ 200 pra você aproveitar sem culpa.',
      'Primeiro a dívida, que cobra juros. Um pouco vai pra reserva, pra um imprevisto não virar dívida nova.',
    ]);
    expect(falasDe(fim, 'resultado')).toEqual(['Pronto, Ana. Cada real do seu dinheiro extra já tem destino.', 'E os R$ 200 pra você são pra aproveitar sem culpa.']);

    const res = ROTEIRO_EXTRA.resultado!(fim.ctx);
    expect(res.titulo).toBe('Destino do seu dinheiro extra');
    expect(res.linhas).toEqual(['1. R$ 1.260 pra dívida (Sair das dívidas)', '2. R$ 540 pra reserva', '3. R$ 200 pra você']);
    expect(res.lista).toBeUndefined();
    expect(res.botao).toBe('Lançar nas missões');
    expect(res.agentes).toEqual(['rodan']);
    expect(res.rodape).toBe('Ao lançar, cada parte entra na missão dela neste mês.');

    const c = ROTEIRO_EXTRA.concluir!(fim.ctx, 'rodan:extra');
    expect(c.missoes).toEqual([]);
    expect(c.ativar).toEqual(['rodan']);
    expect(c.destino).toBeUndefined();
    expect(typeof c.efeitos).toBe('function'); // registra nas missões e grava gs-rodan-destino: não roda aqui (sem localStorage)
    expect(lancamentos(fim.ctx)).toEqual([
      { missao: 'm-div', parte: 'divida', valor: 1260 },
      { missao: 'm-res', parte: 'reserva', valor: 540 },
    ]);
    expect(DESTINO_KEY).toBe('gs-rodan-destino');
    expect(registroDoDestino(fim.ctx)).toEqual({ em: '2026-10-21', total: 2000, partes: { divida: 1260, reserva: 540, investir: 0, voce: 200 } });
  });

  it('usuário novo (sem dados): tudo pra reserva e 10% pra pessoa, com a dica de começar com o Arkad', () => {
    const fim = responder([['valor', 1500], ['origem', 'freela'], ['sugestao', 'usar']]);
    expect(situacao(fim.ctx)).toEqual({ temDivida: false, reservaCompleta: false });
    expect(falasDe(fim, 'sugestao')).toEqual([
      'Freela é esforço a mais seu. Merece virar algo que fica.',
      'Minha sugestão: R$ 1.350 pra reserva e R$ 150 pra você aproveitar sem culpa.',
      'Sem dívida, o que mais te protege agora é a reserva.',
    ]);
    const res = ROTEIRO_EXTRA.resultado!(fim.ctx);
    expect(res.linhas).toEqual(['1. R$ 1.350 pra reserva (comece a missão com o Arkad)', '2. R$ 150 pra você']);
    expect(res.rodape).toBe('Ao lançar, o destino fica anotado. Quando a missão começar, é só guardar lá.');
    const c = ROTEIRO_EXTRA.concluir!(fim.ctx, 'x');
    expect(c).toMatchObject({ missoes: [], ativar: ['rodan'] });
    expect(lancamentos(fim.ctx)).toEqual([]);
  });

  it('dívida só no diagnóstico (sem missão): sugere a dívida e manda começar com o Dabasir', () => {
    const fim = responder([['valor', 1000], ['origem', 'bonus'], ['sugestao', 'usar']], DIAG_COM_DIVIDA);
    expect(situacao(fim.ctx).temDivida).toBe(true);
    expect(falasDe(fim, 'sugestao')[0]).toBe('Bônus é o reconhecimento do seu trabalho. Vamos fazer ele durar.');
    const res = ROTEIRO_EXTRA.resultado!(fim.ctx);
    expect(res.linhas).toEqual(['1. R$ 630 pra dívida (comece a missão com o Dabasir)', '2. R$ 270 pra reserva (comece a missão com o Arkad)', '3. R$ 100 pra você']);
    expect(lancamentos(fim.ctx)).toEqual([]);
  });

  it('missão de dívida já concluída: as dívidas antigas do diagnóstico não contam', () => {
    const quitada = missao({ ...DIVIDA, status: 'concluida' });
    const p = ate([['valor', 1000], ['origem', 'outro']], estado([quitada], DIAG_COM_DIVIDA));
    expect(situacao(p.ctx).temDivida).toBe(false);
    expect(falasAtuais(p)).toEqual([
      'Dinheiro que chega fora da rotina some fácil. Com destino, ele fica.',
      'Minha sugestão: R$ 900 pra reserva e R$ 100 pra você aproveitar sem culpa.',
      'Sem dívida, o que mais te protege agora é a reserva.',
    ]);
  });

  it('reserva completa e sem dívida: o resto vai pra investir (com e sem missão de investir)', () => {
    const semMissao = responder([['valor', 1000], ['origem', '13'], ['sugestao', 'usar']], estado([RESERVA_CHEIA]));
    expect(situacao(semMissao.ctx)).toEqual({ temDivida: false, reservaCompleta: true });
    expect(falasDe(semMissao, 'sugestao').slice(1)).toEqual([
      'Minha sugestão: R$ 900 pra investir e R$ 100 pra você aproveitar sem culpa.',
      'Sem dívida e com a reserva completa, agora o ouro pode trabalhar pra você.',
    ]);
    expect(ROTEIRO_EXTRA.resultado!(semMissao.ctx).linhas).toEqual(['1. R$ 900 pra investir (comece a missão com o Sharru Nada)', '2. R$ 100 pra você']);

    const comMissao = responder([['valor', 1000], ['origem', '13'], ['sugestao', 'usar']], estado([RESERVA_CHEIA, INVESTIR]));
    const res = ROTEIRO_EXTRA.resultado!(comMissao.ctx);
    expect(res.linhas).toEqual(['1. R$ 900 pra investir (Ouro que trabalha)', '2. R$ 100 pra você']);
    expect(res.rodape).toBe('Ao lançar, cada parte entra na missão dela neste mês.');
    expect(lancamentos(comMissao.ctx)).toEqual([{ missao: 'm-inv', parte: 'investir', valor: 900 }]);
  });

  it('reserva concluída e com dívida: quase tudo pra dívida', () => {
    const fim = responder([['valor', 1000], ['origem', '13'], ['sugestao', 'usar']], estado([DIVIDA, RESERVA_CONCLUIDA]));
    expect(situacao(fim.ctx)).toEqual({ temDivida: true, reservaCompleta: true });
    expect(falasDe(fim, 'sugestao').slice(1)).toEqual(['Minha sugestão: R$ 900 pra dívida e R$ 100 pra você aproveitar sem culpa.', 'Sua reserva já está completa, então quase tudo vai pra dívida.']);
    expect(ROTEIRO_EXTRA.resultado!(fim.ctx).linhas).toEqual(['1. R$ 900 pra dívida (Sair das dívidas)', '2. R$ 100 pra você']);
  });

  it('reserva sem missão: completa só quando o guardado chega na meta que o app conhece', () => {
    const p = ate([['valor', 1000]]);
    expect(situacao({ ...p.ctx, dados: { ...p.ctx.dados, guardado: 6000, reservaMeta: 6000 } }).reservaCompleta).toBe(true);
    expect(situacao({ ...p.ctx, dados: { ...p.ctx.dados, guardado: 5000, reservaMeta: 6000 } }).reservaCompleta).toBe(false);
    expect(situacao({ ...p.ctx, dados: { ...p.ctx.dados, guardado: 5000, reservaMeta: 0 } }).reservaCompleta).toBe(false);
  });

  it('ajustar: sliders só com as partes que fazem sentido, começando pela sugestão em %', () => {
    const p = ate([['valor', 2000], ['origem', '13'], ['sugestao', 'ajustar']], COM_DIVIDA_E_RESERVA);
    expect(p.atual?.id).toBe('ajuste');
    expect(falasAtuais(p)).toEqual(['Fique à vontade. Mexa nas partes do jeito que fizer sentido pra você.', 'A soma fica sempre em 100%.']);
    const r = respostaDe(p.atual!, p.ctx);
    expect(r).toEqual({
      tipo: 'divisao',
      total: 2000,
      partes: [
        { id: 'divida', rotulo: 'Dívida' },
        { id: 'reserva', rotulo: 'Reserva' },
        { id: 'voce', rotulo: 'Pra você' },
      ],
      inicial: { divida: 63, reserva: 27, voce: 10 },
    });
    // sem dívida e sem reserva completa: só reserva e "pra você"
    const novo = ate([['valor', 2000], ['origem', '13'], ['sugestao', 'ajustar']]);
    const rn = respostaDe(novo.atual!, novo.ctx);
    expect(rn.tipo === 'divisao' && rn.partes.map((x) => x.id)).toEqual(['reserva', 'voce']);
    expect(rn.tipo === 'divisao' && rn.inicial).toEqual({ reserva: 90, voce: 10 });
  });

  it('ajustar: os valores do ajuste vão pro balão, pro cartão e pros lançamentos', () => {
    const ajuste = { divida: 50, reserva: 30, voce: 20 };
    const fim = responder([['valor', 2000], ['origem', 'bonus'], ['sugestao', 'ajustar'], ['ajuste', ajuste]], COM_DIVIDA_E_RESERVA);
    expect(fim.fim).toBe(true);
    const v = fim.visitas.find((x) => x.passo.id === 'ajuste')!;
    expect(rotuloDe(v.passo, ajuste, v.ctx)).toBe('Dívida: R$ 1.000 · Reserva: R$ 600 · Pra você: R$ 400');
    expect(valores(fim.ctx)).toEqual({ divida: 1000, reserva: 600, investir: 0, voce: 400 });
    expect(ROTEIRO_EXTRA.resultado!(fim.ctx).linhas).toEqual(['1. R$ 1.000 pra dívida (Sair das dívidas)', '2. R$ 600 pra reserva', '3. R$ 400 pra você']);
    expect(lancamentos(fim.ctx)).toEqual([
      { missao: 'm-div', parte: 'divida', valor: 1000 },
      { missao: 'm-res', parte: 'reserva', valor: 600 },
    ]);
    expect(registroDoDestino(fim.ctx).partes).toEqual({ divida: 1000, reserva: 600, investir: 0, voce: 400 });
  });

  it('ajustar com as quatro partes: o cartão mostra três linhas e a lista tem todas', () => {
    const state = estado([DIVIDA, RESERVA_CONCLUIDA]);
    const p = ate([['valor', 1000], ['origem', '13'], ['sugestao', 'ajustar']], state);
    const r = respostaDe(p.atual!, p.ctx);
    expect(r.tipo === 'divisao' && r.partes.map((x) => x.id)).toEqual(['divida', 'reserva', 'investir', 'voce']);
    expect(r.tipo === 'divisao' && r.inicial).toEqual({ divida: 90, reserva: 0, investir: 0, voce: 10 });
    const fim = responder([['valor', 1000], ['origem', '13'], ['sugestao', 'ajustar'], ['ajuste', { divida: 40, reserva: 20, investir: 20, voce: 20 }]], state);
    const res = ROTEIRO_EXTRA.resultado!(fim.ctx);
    expect(res.linhas).toEqual(['1. R$ 400 pra dívida (Sair das dívidas)', '2. R$ 200 pra reserva (comece a missão com o Arkad)', '3. R$ 200 pra investir (comece a missão com o Sharru Nada)']);
    expect(res.lista).toEqual(['R$ 400 pra dívida (Sair das dívidas)', 'R$ 200 pra reserva (comece a missão com o Arkad)', 'R$ 200 pra investir (comece a missão com o Sharru Nada)', 'R$ 200 pra você']);
    expect(res.rodape).toBe('Ao lançar, as partes com missão entram nela neste mês. As outras ficam anotadas.');
    expect(lancamentos(fim.ctx)).toEqual([{ missao: 'm-div', parte: 'divida', valor: 400 }]);
  });

  it('ajustar tudo pra dívida: sem a parte "pra você", a fala final muda', () => {
    const fim = responder([['valor', 999], ['origem', '13'], ['sugestao', 'ajustar'], ['ajuste', { divida: 100, reserva: 0, voce: 0 }]], COM_DIVIDA_E_RESERVA);
    expect(valores(fim.ctx)).toEqual({ divida: 999, reserva: 0, investir: 0, voce: 0 });
    expect(ROTEIRO_EXTRA.resultado!(fim.ctx).linhas).toEqual(['1. R$ 999 pra dívida (Sair das dívidas)']);
    expect(falasDe(fim, 'resultado')).toEqual(['Pronto, Ana. Cada real do seu dinheiro extra já tem destino.', 'Tudo vai trabalhar a seu favor. Bela escolha.']);
  });

  it('ajustar tudo pra pessoa: nada a lançar, o destino fica anotado', () => {
    const fim = responder([['valor', 800], ['origem', 'outro'], ['sugestao', 'ajustar'], ['ajuste', { reserva: 0, voce: 100 }]]);
    const res = ROTEIRO_EXTRA.resultado!(fim.ctx);
    expect(res.linhas).toEqual(['1. R$ 800 pra você']);
    expect(res.rodape).toBe('Ao lançar, o destino fica anotado.');
    expect(lancamentos(fim.ctx)).toEqual([]);
  });

  it('validações: valor, botões e divisão', () => {
    const v = ate([]);
    expect(conferir(v.atual!, 0, v.ctx)).toBe('Digite pelo menos R$ 1,00.');
    expect(conferir(v.atual!, -50, v.ctx)).toBe('Digite pelo menos R$ 1,00.');
    expect(conferir(v.atual!, 200_000_000, v.ctx)).toBe('Esse valor parece alto demais. Confere e digita de novo?');
    expect(conferir(v.atual!, 1, v.ctx)).toBeNull();

    const o = ate([['valor', 1000]]);
    expect(conferir(o.atual!, 'loteria', o.ctx)).toBe('Escolha uma das opções.');

    const s = ate([['valor', 1000], ['origem', '13']]);
    expect(conferir(s.atual!, 'talvez', s.ctx)).toBe('Escolha uma das opções.');

    const a = ate([['valor', 1000], ['origem', '13'], ['sugestao', 'ajustar']], COM_DIVIDA_E_RESERVA);
    expect(conferir(a.atual!, { divida: 50, reserva: 30, voce: 10 }, a.ctx)).toBe('A divisão precisa somar 100%.');
    expect(conferir(a.atual!, { divida: 110, reserva: -10, voce: 0 }, a.ctx)).toBe('Cada parte vai de 0% a 100%.');
    expect(conferir(a.atual!, { divida: 60, reserva: 30, voce: 10 }, a.ctx)).toBeNull();
  });

  it('a soma é sempre o total: o resto do arredondamento fica com a pessoa', () => {
    // 35% de 1001 = 350,35 → R$ 350; o resto (R$ 651) fica com a pessoa
    expect(dividir(1001, { reserva: 35, voce: 65 }, ['reserva', 'voce'])).toEqual({ divida: 0, reserva: 350, investir: 0, voce: 651 });
    expect(dividir(7, { divida: 33, reserva: 33, voce: 34 }, ['divida', 'reserva', 'voce'])).toEqual({ divida: 2, reserva: 2, investir: 0, voce: 3 });
    for (const total of [1, 7, 99, 1001, 2345.67, 1_000_000]) {
      const d = dividir(total, { divida: 45, reserva: 35, investir: 15, voce: 5 }, ['divida', 'reserva', 'investir', 'voce']);
      expect(d.divida + d.reserva + d.investir + d.voce).toBeCloseTo(total, 6);
      expect(Math.min(d.divida, d.reserva, d.investir, d.voce)).toBeGreaterThanOrEqual(0);
    }
    // na sugestão, os centavos do total também ficam com a pessoa
    const p = ate([['valor', 1500.5], ['origem', '13']]);
    expect(sugestao(p.ctx)).toEqual({ divida: 0, reserva: 1350, investir: 0, voce: 150.5 });
  });

  it('os % iniciais são inteiros e somam 100, mesmo com valores quebrados', () => {
    for (const total of [1, 2, 3, 7, 13, 101, 999]) {
      const p = ate([['valor', total]], COM_DIVIDA_E_RESERVA);
      const ids = partesDoAjuste(p.ctx);
      const pct = percentuais(sugestao(p.ctx), total, ids);
      expect(Object.values(pct).reduce((t, x) => t + x, 0)).toBe(100);
      expect(Object.values(pct).every((x) => Number.isInteger(x) && x >= 0)).toBe(true);
    }
    expect(percentuais({ divida: 0, reserva: 0, investir: 0, voce: 0 }, 0, ['reserva', 'voce'])).toEqual({ reserva: 0, voce: 100 });
  });

  it('valor pequeno: a frase só fala das partes que existem', () => {
    const p = ate([['valor', 1], ['origem', '13']]);
    expect(falasAtuais(p)[1]).toBe('Minha sugestão: R$ 1 pra reserva.');
    expect(fraseDaDivisao({ divida: 0, reserva: 0, investir: 0, voce: 300 })).toBe('R$ 300 pra você aproveitar sem culpa');
    expect(linhaDoDestino({ parte: 'reserva', valor: 400, missao: missao({ id: 'r', tipo: 'reserva', titulo: 'Guardar pra imprevistos' }) })).toBe('R$ 400 pra reserva (Guardar pra imprevistos)');
  });

  it('o texto não usa as palavras proibidas', () => {
    const casos: [Record<string, string>, [string, Valor][]][] = [
      [{}, [['valor', 1500], ['origem', 'freela'], ['sugestao', 'usar']]],
      [COM_DIVIDA_E_RESERVA, [['valor', 2000], ['origem', '13'], ['sugestao', 'ajustar'], ['ajuste', { divida: 50, reserva: 30, voce: 20 }]]],
      [estado([RESERVA_CHEIA]), [['valor', 1000], ['origem', 'bonus'], ['sugestao', 'usar']]],
      [estado([DIVIDA, RESERVA_CONCLUIDA]), [['valor', 1000], ['origem', 'outro'], ['sugestao', 'usar']]],
    ];
    for (const [state, pares] of casos) {
      const fim = responder(pares, state);
      const res = ROTEIRO_EXTRA.resultado!(fim.ctx);
      const textos = [...fim.visitas.flatMap((v) => falasDoRoteiro.falas(v.passo, v.ctx)), res.titulo, ...res.linhas, ...(res.lista ?? []), res.rodape ?? '', res.botao ?? ''].join(' ').toLowerCase();
      for (const proibida of ['aporte', 'despesa', 'fechar o mês', 'o combinado', 'inadimplência']) expect(textos).not.toContain(proibida);
      expect(res.linhas.length).toBeLessThanOrEqual(3);
      res.linhas.forEach((l, i) => expect(l.startsWith(`${i + 1}. `)).toBe(true));
      for (const v of fim.visitas) expect(falasDoRoteiro.falas(v.passo, v.ctx).length).toBeLessThanOrEqual(3);
    }
  });
});
