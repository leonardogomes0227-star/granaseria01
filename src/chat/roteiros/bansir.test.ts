import { afterEach, describe, expect, it, vi } from 'vitest';
import { conferir, falasDoRoteiro, percorrer, respostaDe, rotuloDe, type ItemLista, type RespostaDada, type Valor } from '../engine';
import { dadosDeEstado } from '../dados';
import type { Bill } from '../../bills';
import { contasDoChat, idsFinais, juntarContas, proximaConta, reais, ROTEIRO_CONTAS } from './bansir';

const NOW = new Date('2026-10-21T15:00:00Z'); // hoje = 2026-10-21
const base = (state: Record<string, string> = {}, nome = 'Ana') => ({ agente: 'bansir' as const, nome, dados: dadosDeEstado(state, NOW) });

function responder(pares: [string, Valor][], state: Record<string, string> = {}, nome = 'Ana') {
  const r: RespostaDada[] = [];
  for (const [passo, valor] of pares) {
    const p = percorrer(ROTEIRO_CONTAS, r, base(state, nome));
    expect(p.atual?.id, `esperava ${passo}`).toBe(passo);
    expect(conferir(p.atual!, valor, p.ctx)).toBeNull();
    r.push({ passo, valor });
  }
  return percorrer(ROTEIRO_CONTAS, r, base(state, nome));
}

/** Onde a conversa está depois dessas respostas (sem conferir). */
const ate = (pares: [string, Valor][], state: Record<string, string> = {}) =>
  percorrer(
    ROTEIRO_CONTAS,
    pares.map(([passo, valor]) => ({ passo, valor })),
    base(state)
  );

const falasDe = (p: ReturnType<typeof percorrer>, id: string) => {
  const v = [...p.visitas].reverse().find((x) => x.passo.id === id);
  return v ? falasDoRoteiro.falas(v.passo, v.ctx) : [];
};
const falasAtuais = (p: ReturnType<typeof percorrer>) => falasDoRoteiro.falas(p.atual!, p.ctx);

const SALVAS: Bill[] = [
  { id: 'a', name: 'Aluguel', amount: 1500, dueDay: 5, startMonth: '2026-01', payments: [{ month: '2026-10', paidOn: '2026-10-05', amount: 1500 }] },
  { id: 'b', name: 'Luz', amount: 180, dueDay: 25, startMonth: '2026-01', payments: [] },
  { id: 'p', name: 'Geladeira', amount: 300, dueDay: 10, installments: 10, startMonth: '2026-05', payments: [] },
];
const COM_CONTAS = { 'gs-contas': JSON.stringify(SALVAS), 'gs-eu': JSON.stringify({ renda: 4000 }) };

const LISTA_FELIZ: ItemLista[] = [
  { id: 'a', nome: 'Aluguel', valor: 1500, dia: 5 },
  { id: 'b', nome: 'Luz', valor: 200, dia: 25 }, // mudou o valor
  { id: 'i1', nome: 'Internet', valor: 100, dia: 23 }, // nova
];

afterEach(() => vi.restoreAllMocks());

describe('6.4 Bansir — contas fixas', () => {
  it('é o roteiro "contas" do Bansir e abre com a fala do livro', () => {
    expect(ROTEIRO_CONTAS).toMatchObject({ id: 'contas', agente: 'bansir', titulo: 'Contas em dia', primeiro: 'abertura' });
    const p = ate([]);
    expect(falasDe(p, 'abertura')).toEqual(['Eu vivia trabalhando e o dinheiro nunca chegava no fim do mês. Começou a mudar quando eu soube exatamente o que vencia e quando.']);
    expect(p.atual?.id).toBe('contas');
  });

  it('pré-preenche a lista com as contas cadastradas (sem as parcelas)', () => {
    const p = ate([], COM_CONTAS);
    const r = respostaDe(p.atual!, p.ctx);
    expect(r.tipo).toBe('lista');
    if (r.tipo !== 'lista') return;
    expect(r).toMatchObject({ rotuloItem: 'conta', minItens: 1 });
    expect(r.campos.map((c) => [c.id, c.tipo])).toEqual([
      ['nome', 'texto'],
      ['valor', 'dinheiro'],
      ['dia', 'dia'],
    ]);
    expect(r.inicial).toEqual([
      { id: 'a', nome: 'Aluguel', valor: 1500, dia: 5 },
      { id: 'b', nome: 'Luz', valor: 180, dia: 25 },
    ]);
    expect(falasAtuais(p)).toEqual(['Essas são as contas que já estão anotadas, Ana.', 'Confere se mudou alguma coisa e põe as que faltam.']);
  });

  it('caminho feliz: lista, lembrete sim, cartão e missão recorrente', () => {
    const fim = responder([['contas', LISTA_FELIZ], ['lembrete', 'sim']], COM_CONTAS);
    expect(fim.fim).toBe(true);
    expect(falasDe(fim, 'lembrete')).toEqual(['Anotei: 3 contas, R$ 1.800 por mês.', 'Quer que eu te lembre um dia antes de cada uma vencer?']);
    expect(falasDe(fim, 'resultado')).toEqual(['Pronto, Ana. Agora você sabe o que vence e quando.', 'Um dia antes de cada conta, eu te aviso.']);

    const res = ROTEIRO_CONTAS.resultado!(fim.ctx);
    expect(res.titulo).toBe('Seu plano com Bansir');
    expect(res.linhas).toEqual(['1. 3 contas · R$ 1.800 por mês', '2. Próxima: Internet dia 23', '3. Lembrete um dia antes de cada uma']);
    expect(res.lista).toEqual(['Aluguel · dia 5 · R$ 1.500', 'Internet · dia 23 · R$ 100', 'Luz · dia 25 · R$ 200']);
    expect(res.agentes).toEqual(['bansir']);

    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const carimbo = (1_800_000_000_000).toString(36);
    const c = ROTEIRO_CONTAS.concluir!(fim.ctx, 'bansir:contas');
    expect(c.ativar).toEqual(['bansir']);
    expect(c.eu).toBeUndefined();
    expect(typeof c.efeitos).toBe('function'); // grava em gs-contas: não roda aqui (sem localStorage)
    expect(c.missoes).toHaveLength(1);
    const m = c.missoes[0];
    expect(m).toMatchObject({
      agente: 'bansir',
      conversa: 'bansir:contas',
      titulo: 'Contas em dia',
      tipo: 'contas',
      recorrente: true,
      metaValor: 0,
      valorInicial: 0,
      valorMensal: 1800,
      dataInicio: '2026-10-21',
      lembrarVespera: true,
      editarPasso: 'contas',
      status: 'ativa',
      prioridade: 2,
    });
    expect(m.notas).toBeUndefined();
    // um passo por conta, na ordem do vencimento, com os ids finais (a nova ganha 'b-' + carimbo + posição na lista)
    expect(m.passos).toEqual([
      { id: 'conta:a', ordem: 1, titulo: 'Pagar Aluguel · dia 5', acao: 'conferir', valor: null },
      { id: `conta:b-${carimbo}2`, ordem: 2, titulo: 'Pagar Internet · dia 23', acao: 'conferir', valor: null },
      { id: 'conta:b', ordem: 3, titulo: 'Pagar Luz · dia 25', acao: 'conferir', valor: null },
    ]);
  });

  it('mostra a resposta da lista como "3 contas · R$ 1.800"', () => {
    const p = ate([], COM_CONTAS);
    expect(rotuloDe(p.atual!, LISTA_FELIZ, p.ctx)).toBe('3 contas · R$ 1.800');
    expect(rotuloDe(p.atual!, [], p.ctx)).toBe('Nenhuma');
  });

  it('lembrete não: cartão sem lembrete e missão com lembrarVespera falso', () => {
    const fim = responder([['contas', LISTA_FELIZ], ['lembrete', 'nao']], COM_CONTAS);
    expect(falasDe(fim, 'resultado')).toEqual(['Pronto, Ana. Agora você sabe o que vence e quando.', 'Se quiser lembrete depois, é só me chamar.']);
    expect(ROTEIRO_CONTAS.resultado!(fim.ctx).linhas[2]).toBe('3. Sem lembrete · você confere em Missões');
    expect(ROTEIRO_CONTAS.concluir!(fim.ctx, 'x').missoes[0].lembrarVespera).toBe(false);
  });

  it('usuário novo, sem dados: lista vazia, falas de começo e uma conta só', () => {
    const p = ate([]);
    const r = respostaDe(p.atual!, p.ctx);
    expect(r.tipo === 'lista' && r.inicial).toEqual([]);
    expect(falasAtuais(p)).toEqual(['Vamos anotar as contas que vencem todo mês: aluguel, luz, água, internet, celular.', 'Pra cada uma, me diz o valor e o dia que vence.']);

    // sem renda: não pergunta de coerência, vai direto pro lembrete
    const fim = responder([['contas', [{ id: 'i1', nome: 'Luz', valor: 120.5, dia: 21 }]], ['lembrete', 'nao']], {}, '');
    expect(falasDe(fim, 'lembrete')).toEqual(['Anotei: 1 conta, R$ 121 por mês.', 'Quer que eu te lembre um dia antes dela vencer?']);
    expect(falasDe(fim, 'resultado')[0]).toBe('Pronto. Agora você sabe o que vence e quando.'); // sem nome
    expect(ROTEIRO_CONTAS.resultado!(fim.ctx).linhas).toEqual(['1. 1 conta · R$ 121 por mês', '2. Próxima: Luz vence hoje', '3. Sem lembrete · você confere em Missões']);

    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const m = ROTEIRO_CONTAS.concluir!(fim.ctx, 'x').missoes[0];
    expect(m.valorMensal).toBe(120.5);
    expect(m.passos).toEqual([{ id: `conta:b-${(1_800_000_000_000).toString(36)}0`, ordem: 1, titulo: 'Pagar Luz · dia 21', acao: 'conferir', valor: null }]);
  });

  it('uma conta com lembrete: "dela"', () => {
    const fim = responder([['contas', [{ id: 'i1', nome: 'Água', valor: 80, dia: 10 }]], ['lembrete', 'sim']]);
    expect(ROTEIRO_CONTAS.resultado!(fim.ctx).linhas[2]).toBe('3. Lembrete um dia antes dela');
    expect(falasDe(fim, 'resultado')).toEqual(['Pronto, Ana. Agora você sabe o que vence e quando.', 'Um dia antes dela vencer, eu te aviso.']);
  });

  it('valor pequeno (R$ 0,50): com centavos, nunca "R$ 0" nem "R$ 1"', () => {
    expect(reais(0.5)).toBe('R$ 0,50');
    expect(reais(0)).toBe('R$ 0');
    expect(reais(1.4)).toBe('R$ 1');
    const pequena: ItemLista[] = [{ id: 'i1', nome: 'Taxa', valor: 0.5, dia: 28 }];
    const p = ate([]);
    expect(rotuloDe(p.atual!, pequena, p.ctx)).toBe('1 conta · R$ 0,50');
    const fim = responder([['contas', pequena], ['lembrete', 'nao']]);
    expect(falasDe(fim, 'lembrete')[0]).toBe('Anotei: 1 conta, R$ 0,50 por mês.');
    const res = ROTEIRO_CONTAS.resultado!(fim.ctx);
    expect(res.linhas[0]).toBe('1. 1 conta · R$ 0,50 por mês');
    expect(res.lista).toEqual(['Taxa · dia 28 · R$ 0,50']);
    expect(ROTEIRO_CONTAS.concluir!(fim.ctx, 'x').missoes[0].valorMensal).toBe(0.5);
  });

  it('valor enorme (R$ 1.000.000): passa da renda, oferece revisar e o cartão mostra o valor inteiro', () => {
    const grande: ItemLista[] = [
      { id: 'a', nome: 'Aluguel', valor: 1500, dia: 5 },
      { id: 'i1', nome: 'Casa', valor: 1_000_000, dia: 10 },
    ];
    const r = responder([['contas', grande]], COM_CONTAS);
    expect(r.atual?.id).toBe('revisar');
    expect(falasAtuais(r)[0]).toBe('Hm, Ana, essas contas dão R$ 1.001.500 e entram R$ 4.000 por mês.');
    const fim = responder([['contas', grande], ['revisar', 'ok'], ['lembrete', 'sim']], COM_CONTAS);
    const res = ROTEIRO_CONTAS.resultado!(fim.ctx);
    expect(res.linhas[0]).toBe('1. 2 contas · R$ 1.001.500 por mês');
    expect(res.lista).toEqual(['Aluguel · dia 5 · R$ 1.500', 'Casa · dia 10 · R$ 1.000.000']);
    const m = ROTEIRO_CONTAS.concluir!(fim.ctx, 'x').missoes[0];
    expect(m.valorMensal).toBe(1_001_500);
    expect(m.notas).toBe('As contas passam do que entra hoje. A gente ajusta com o tempo.');
  });

  it('próxima conta: amanhã e virada pro mês que vem', () => {
    const amanha = responder([['contas', [{ id: 'i1', nome: 'Gás', valor: 90, dia: 22 }, { id: 'i2', nome: 'Água', valor: 80, dia: 3 }]], ['lembrete', 'sim']]);
    expect(ROTEIRO_CONTAS.resultado!(amanha.ctx).linhas[1]).toBe('2. Próxima: Gás vence amanhã');
    const virada = responder([['contas', [{ id: 'i1', nome: 'Gás', valor: 90, dia: 10 }, { id: 'i2', nome: 'Água', valor: 80, dia: 3 }]], ['lembrete', 'sim']]);
    expect(ROTEIRO_CONTAS.resultado!(virada.ctx).linhas[1]).toBe('2. Próxima: Água dia 3'); // já passaram este mês: a primeira de novembro
  });

  it('proximaConta: dia 31 em mês curto e virada de ano', () => {
    expect(proximaConta([{ dia: 31 }], '2026-11-30')).toEqual({ conta: { dia: 31 }, dias: 0 });
    expect(proximaConta([{ dia: 30 }], '2027-02-28')).toEqual({ conta: { dia: 30 }, dias: 0 });
    expect(proximaConta([{ dia: 1 }], '2026-12-31')).toEqual({ conta: { dia: 1 }, dias: 1 });
    expect(proximaConta([{ dia: 20 }, { dia: 2 }], '2026-12-25')).toEqual({ conta: { dia: 2 }, dias: 8 });
    expect(proximaConta([], '2026-10-21')).toBeNull();
  });

  it('valida a lista com a fala do Bansir', () => {
    const p = ate([]);
    const v = (valor: Valor) => conferir(p.atual!, valor, p.ctx);
    expect(v([])).toBe('Adicione pelo menos 1 conta.');
    expect(v([{ nome: 'Luz', valor: null, dia: 10 }])).toBe('Falta valor em Luz.');
    expect(v([{ nome: 'Luz', valor: 100, dia: null }])).toBe('Falta dia do vencimento em Luz.');
    expect(v([{ nome: 'Luz', valor: 100, dia: 32 }])).toBe('O dia do vencimento vai de 1 a 31.');
    expect(v([{ nome: '', valor: 100, dia: 5 }])).toBe('Falta nome em uma conta.');
    expect(v([{ nome: '   ', valor: 100, dia: 5 }])).toBe('Falta o nome de uma conta.');
    expect(v([{ nome: 'Luz', valor: 20_000_000, dia: 5 }])).toBe('Esse valor parece alto demais. Confere e digita de novo?');
    expect(v([{ nome: 'Casa', valor: 1_000_000, dia: 5 }])).toBeNull(); // valor enorme, mas possível
  });

  it('contas passam da renda: oferece revisar; revisar volta pra lista como ela estava', () => {
    const state = { 'gs-eu': JSON.stringify({ renda: 1000 }) };
    const muitas: ItemLista[] = [
      { id: 'i1', nome: 'Aluguel', valor: 900, dia: 5 },
      { id: 'i2', nome: 'Luz', valor: 300, dia: 15 },
    ];
    const r1 = responder([['contas', muitas]], state);
    expect(r1.atual?.id).toBe('revisar');
    expect(falasAtuais(r1)).toEqual(['Hm, Ana, essas contas dão R$ 1.200 e entram R$ 1.000 por mês.', 'Quer revisar a lista ou está certo assim?']);

    const r2 = responder([['contas', muitas], ['revisar', 'contas']], state);
    expect(r2.atual?.id).toBe('contas');
    expect(falasAtuais(r2)).toEqual(['Pode mexer à vontade. Corrija o que precisar.']);
    const lista = respostaDe(r2.atual!, r2.ctx);
    expect(lista.tipo === 'lista' && lista.inicial).toEqual(muitas);

    const fim = responder([['contas', muitas], ['revisar', 'contas'], ['contas', [{ id: 'i1', nome: 'Aluguel', valor: 700, dia: 5 }]], ['lembrete', 'sim']], state);
    expect(fim.fim).toBe(true);
    expect(falasDe(fim, 'lembrete')[0]).toBe('Anotei: 1 conta, R$ 700 por mês.');
    expect(ROTEIRO_CONTAS.resultado!(fim.ctx).linhas).toEqual(['1. 1 conta · R$ 700 por mês', '2. Próxima: Aluguel dia 5', '3. Lembrete um dia antes dela']);
    expect(ROTEIRO_CONTAS.concluir!(fim.ctx, 'x').missoes[0]).toMatchObject({ valorMensal: 700, notas: undefined });
  });

  it('revisar duas vezes: se ainda passa da renda, pergunta de novo', () => {
    const state = { 'gs-eu': JSON.stringify({ renda: 1000 }) };
    const muitas: ItemLista[] = [{ id: 'i1', nome: 'Aluguel', valor: 1100, dia: 5 }];
    const r = responder([['contas', muitas], ['revisar', 'contas'], ['contas', [{ id: 'i1', nome: 'Aluguel', valor: 1050, dia: 5 }]]], state);
    expect(r.atual?.id).toBe('revisar');
    expect(falasAtuais(r)[0]).toBe('Hm, Ana, essas contas dão R$ 1.050 e entram R$ 1.000 por mês.');
    const fim = responder([['contas', muitas], ['revisar', 'contas'], ['contas', [{ id: 'i1', nome: 'Aluguel', valor: 1050, dia: 5 }]], ['revisar', 'ok'], ['lembrete', 'nao']], state);
    expect(fim.fim).toBe(true);
    expect(falasDe(fim, 'lembrete')[0]).toBe('Tudo bem. A gente começa do jeito que está e ajusta com o tempo.');
    expect(ROTEIRO_CONTAS.concluir!(fim.ctx, 'x').missoes[0].valorMensal).toBe(1050);
  });

  it('editar uma resposta antiga: as de depois saem e o caminho segue só pelo que veio antes', () => {
    const state = { 'gs-eu': JSON.stringify({ renda: 1000 }) };
    const muitas: ItemLista[] = [{ id: 'i1', nome: 'Aluguel', valor: 1200, dia: 5 }];
    const antes: RespostaDada[] = [
      { passo: 'contas', valor: muitas },
      { passo: 'revisar', valor: 'ok' },
      { passo: 'lembrete', valor: 'sim' },
    ];
    expect(percorrer(ROTEIRO_CONTAS, antes, base(state)).fim).toBe(true);
    // a tela corta as respostas depois da editada e regrava: a lista nova cabe na renda, então não pergunta de novo
    const editada: RespostaDada[] = [{ passo: 'contas', valor: [{ id: 'i1', nome: 'Aluguel', valor: 800, dia: 5 }] }];
    const p = percorrer(ROTEIRO_CONTAS, editada, base(state));
    expect(p.atual?.id).toBe('lembrete');
    expect(falasAtuais(p)[0]).toBe('Anotei: 1 conta, R$ 800 por mês.');
    // editar só o lembrete muda o cartão e a missão
    const semLembrete = percorrer(ROTEIRO_CONTAS, [...antes.slice(0, 2), { passo: 'lembrete', valor: 'nao' }], base(state));
    expect(ROTEIRO_CONTAS.resultado!(semLembrete.ctx).linhas[2]).toBe('3. Sem lembrete · você confere em Missões');
    expect(ROTEIRO_CONTAS.concluir!(semLembrete.ctx, 'x').missoes[0].lembrarVespera).toBe(false);
  });

  it('contas passam da renda e está certo: segue com calma e anota na missão', () => {
    const state = { 'gs-eu': JSON.stringify({ renda: 1000 }) };
    const fim = responder([['contas', [{ id: 'i1', nome: 'Aluguel', valor: 1200, dia: 5 }]], ['revisar', 'ok'], ['lembrete', 'sim']], state);
    expect(falasDe(fim, 'lembrete')).toEqual(['Tudo bem. A gente começa do jeito que está e ajusta com o tempo.', 'Quer que eu te lembre um dia antes dela vencer?']);
    const m = ROTEIRO_CONTAS.concluir!(fim.ctx, 'x').missoes[0];
    expect(m.notas).toBe('As contas passam do que entra hoje. A gente ajusta com o tempo.');
    expect(m.valorMensal).toBe(1200);
  });

  it('contasDoChat: ordena pelo dia, tira as sem valor e dá nome padrão', () => {
    const p = ate([['contas', [{ id: 'x', nome: 'Luz', valor: 100, dia: 20 }, { id: 'y', nome: 'Zero', valor: 0, dia: 1 }, { nome: '', valor: 50, dia: 2 }]]]);
    expect(contasDoChat(p.ctx)).toEqual([
      { id: 'nova2', nome: 'Conta 3', valor: 50, dia: 2, ordem: 2 },
      { id: 'x', nome: 'Luz', valor: 100, dia: 20, ordem: 0 },
    ]);
  });

  it('idsFinais: mantém o id das salvas, dá id novo às outras (inclusive id repetido)', () => {
    const p = ate(
      [
        [
          'contas',
          [
            { id: 'a', nome: 'Aluguel', valor: 1500, dia: 5 },
            { id: 'a', nome: 'Aluguel de novo', valor: 100, dia: 6 },
            { id: 'i9', nome: 'Celular', valor: 60, dia: 8 },
          ],
        ],
      ],
      COM_CONTAS
    );
    expect(idsFinais(p.ctx, 'k').map((c) => [c.id, c.nova])).toEqual([
      ['a', false],
      ['b-k1', true],
      ['b-k2', true],
    ]);
  });

  it('juntarContas: atualiza as que existem, acrescenta as novas e nunca apaga nada', () => {
    const salvas: Bill[] = [...SALVAS, { id: 'd', name: 'Academia', amount: 90, dueDay: 10, startMonth: '2026-03', payments: [] }];
    const p = ate([['contas', LISTA_FELIZ]], COM_CONTAS);
    const finais = idsFinais(p.ctx, 'k');
    const out = juntarContas(salvas, finais, '2026-10');
    expect(out).toEqual([
      { ...SALVAS[0] }, // Aluguel igual, com o pagamento de outubro
      { ...SALVAS[1], amount: 200 }, // Luz com o valor novo
      SALVAS[2], // parcela: intacta
      salvas[3], // Academia saiu da lista do chat, mas continua salva
      { id: 'b-k2', name: 'Internet', amount: 100, dueDay: 23, startMonth: '2026-10', payments: [] },
    ]);
    // os passos da missão apontam pras mesmas contas salvas
    expect(finais.map((c) => c.id).every((id) => out.some((b) => b.id === id))).toBe(true);
  });

  it('idsFinais: conta salva editada na lista (id novo, mesmo nome) continua a mesma conta', () => {
    // a lista do chat dá id novo ao item que a pessoa edita; o nome (sem acento e maiúscula) acha a conta salva
    const p = ate([['contas', [{ id: 'a', nome: 'Aluguel', valor: 1500, dia: 5 }, { id: 'ixyz', nome: '  luz ', valor: 210, dia: 26 }]]], COM_CONTAS);
    const finais = idsFinais(p.ctx, 'k');
    expect(finais.map((c) => [c.id, c.nova])).toEqual([
      ['a', false],
      ['b', false],
    ]);
    const out = juntarContas(SALVAS, finais, '2026-10');
    expect(out).toHaveLength(3); // nenhuma conta repetida
    expect(out[1]).toEqual({ ...SALVAS[1], name: 'luz', amount: 210, dueDay: 26 });
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    expect(ROTEIRO_CONTAS.concluir!({ ...p.ctx, respostas: { ...p.ctx.respostas, lembrete: 'sim' } }, 'x').missoes[0].passos.map((x) => x.id)).toEqual(['conta:a', 'conta:b']);
  });

  it('"Editar respostas" depois de concluir: as contas novas da conversa anterior não entram de novo', () => {
    // 1ª conversa: Internet entrou como b-k2
    const p1 = ate([['contas', LISTA_FELIZ]], COM_CONTAS);
    const salvas1 = juntarContas(SALVAS, idsFinais(p1.ctx, 'k'), '2026-10');
    // 2ª vez: as contas salvas já têm a Internet; a lista do chat volta com o id provisório (i1)
    const state2 = { ...COM_CONTAS, 'gs-contas': JSON.stringify(salvas1) };
    const p2 = ate([['contas', LISTA_FELIZ.map((it) => (it.nome === 'Internet' ? { ...it, valor: 110 } : it))]], state2);
    const finais2 = idsFinais(p2.ctx, 'z');
    expect(finais2.map((c) => [c.nome, c.id, c.nova])).toEqual([
      ['Aluguel', 'a', false],
      ['Internet', 'b-k2', false],
      ['Luz', 'b', false],
    ]);
    const salvas2 = juntarContas(salvas1, finais2, '2026-10');
    expect(salvas2).toHaveLength(salvas1.length);
    expect(salvas2.find((b) => b.id === 'b-k2')).toMatchObject({ name: 'Internet', amount: 110, dueDay: 23 });
  });

  it('idsFinais: duas contas com o mesmo nome — a salva fica com o id, a outra é nova', () => {
    const state = { 'gs-contas': JSON.stringify([{ id: 'e1', name: 'Escola', amount: 500, dueDay: 10, startMonth: '2026-01', payments: [] }]) };
    const p = ate([['contas', [{ id: 'e1', nome: 'Escola', valor: 500, dia: 10 }, { id: 'i2', nome: 'Escola', valor: 450, dia: 10 }]]], state);
    expect(idsFinais(p.ctx, 'k').map((c) => [c.id, c.nova])).toEqual([
      ['e1', false],
      ['b-k1', true],
    ]);
  });

  it('juntarContas: muda nome e dia; não mexe em parcela mesmo com o mesmo id', () => {
    const out = juntarContas(SALVAS, [
      { id: 'b', nome: 'Energia', valor: 180, dia: 28, nova: false },
      { id: 'p', nome: 'Outra', valor: 1, dia: 1, nova: false },
    ], '2026-10');
    expect(out[1]).toMatchObject({ id: 'b', name: 'Energia', amount: 180, dueDay: 28 });
    expect(out[2]).toBe(SALVAS[2]);
    expect(out).toHaveLength(3);
  });

  it('textos sem palavras proibidas e no máximo 3 balões por passo', () => {
    const caminhos = [
      responder([['contas', LISTA_FELIZ], ['lembrete', 'sim']], COM_CONTAS),
      responder([['contas', LISTA_FELIZ], ['lembrete', 'nao']], COM_CONTAS),
      responder([['contas', [{ id: 'i1', nome: 'Aluguel', valor: 1200, dia: 5 }]], ['revisar', 'ok'], ['lembrete', 'sim']], { 'gs-eu': JSON.stringify({ renda: 1000 }) }),
      responder([['contas', [{ id: 'i1', nome: 'Aluguel', valor: 1200, dia: 5 }]], ['revisar', 'contas'], ['contas', [{ id: 'i1', nome: 'Aluguel', valor: 900, dia: 5 }]], ['lembrete', 'nao']], { 'gs-eu': JSON.stringify({ renda: 1000 }) }),
      responder([['contas', [{ id: 'i1', nome: 'Taxa', valor: 0.5, dia: 1 }]], ['lembrete', 'sim']], {}, ''),
    ];
    const proibidas = /aporte|despesa|fechar o m[eê]s|o combinado|inadimpl/i;
    for (const fim of caminhos) {
      for (const v of fim.visitas) {
        const f = falasDoRoteiro.falas(v.passo, v.ctx);
        expect(f.length).toBeLessThanOrEqual(3);
        for (const s of f) expect(s).not.toMatch(proibidas);
      }
      const res = ROTEIRO_CONTAS.resultado!(fim.ctx);
      expect(res.linhas.length).toBeLessThanOrEqual(3);
      for (const s of [res.titulo, ...res.linhas, ...(res.lista ?? [])]) expect(s).not.toMatch(proibidas);
      for (const passo of ROTEIRO_CONTAS.concluir!(fim.ctx, 'x').missoes[0].passos) expect(passo.titulo).not.toMatch(proibidas);
    }
  });
});
