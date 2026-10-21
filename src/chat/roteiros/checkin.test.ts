import { describe, expect, it } from 'vitest';
import { conferir, falasDoRoteiro, percorrer, respostaDe, type AgenteId, type RespostaDada, type Roteiro, type Valor } from '../engine';
import { dadosDeEstado } from '../dados';
import type { Missao } from '../../missoes';
import {
  acaoDe,
  acaoDoPasso,
  aplicarCheckin,
  cartaoDoCheckin,
  CHECKIN,
  idDoCheckin,
  jaNoMes,
  mesDoCheckinValido,
  mudancaDe,
  previsaoDoCheckin,
  ROTEIRO_CHECKIN,
  sequenciaDepois,
  situacao,
  valorARegistrar,
} from './checkin';

const NOW = new Date('2026-10-21T15:00:00Z'); // hoje = 2026-10-21: só outubro vale
const INICIO = new Date('2026-10-05T15:00:00Z'); // hoje = 2026-10-05: setembro ainda vale

/* ---------- missões de exemplo ---------- */

const missao = (p: Partial<Missao> & Pick<Missao, 'id' | 'tipo' | 'titulo'>): Missao => ({
  agente: 'arkad',
  metaValor: 0,
  valorInicial: 0,
  valorMensal: 0,
  dataInicio: '2026-08-10',
  dataPrevista: null,
  previsaoOriginal: null,
  prioridade: 3,
  status: 'ativa',
  passos: [],
  registros: [],
  createdAt: '2026-08-10T12:00:00.000Z',
  updatedAt: '2026-08-10T12:00:00.000Z',
  ...p,
});

const reg = (mes: string, valor: number) => ({ mes, valor, em: `${mes}-10`, origem: 'site' as const });

const RESERVA = missao({
  id: 'm-res',
  tipo: 'reserva',
  titulo: 'Reserva de emergência',
  metaValor: 9000,
  valorInicial: 1000,
  valorMensal: 400,
  registros: [reg('2026-08', 400)],
  passos: [
    { id: 'p1', ordem: 1, titulo: 'Guardar R$ 400 no dia 5', acao: 'guardar', dataAlvo: '2026-08' },
    { id: 'p2', ordem: 2, titulo: 'Chegar a R$ 4.500 (metade)', valor: 4500 },
    { id: 'p3', ordem: 3, titulo: 'Reserva completa em mar/28', valor: 9000 },
  ],
});
/** A mesma reserva, já com setembro guardado (pro check-in de outubro). */
const RESERVA_SET = missao({ ...RESERVA, registros: [reg('2026-08', 400), reg('2026-09', 400)] });
const RESERVA_QUASE = missao({ ...RESERVA, valorInicial: 8700, registros: [] });

const DIVIDA = missao({
  id: 'm-div',
  agente: 'dabasir',
  tipo: 'divida',
  titulo: 'Sair das dívidas',
  metaValor: 3000,
  valorMensal: 400,
  dataInicio: '2026-09-01',
  prioridade: 1,
  dividas: [{ id: 'd1', nome: 'Cartão', saldo: 3000, parcela: 200, jurosMes: 6 }],
  metodo: 'juros',
  passos: [{ id: 'p1', ordem: 1, titulo: 'Pagar R$ 400 em Cartão este mês', acao: 'pagar', dataAlvo: '2026-09' }],
});

const CONTAS = missao({
  id: 'm-contas',
  agente: 'bansir',
  tipo: 'contas',
  titulo: 'Contas em dia',
  recorrente: true,
  valorMensal: 1500,
  prioridade: 2,
  passos: [{ id: 'conta:a', ordem: 1, titulo: 'Pagar Aluguel · dia 5', acao: 'conferir', valor: null }],
});

const GASTOS = missao({
  id: 'm-gastos',
  agente: 'nomasir',
  tipo: 'gastos',
  titulo: 'Segurar os gastos',
  valorMensal: 55,
  prioridade: 4,
  passos: [
    { id: 'c1', ordem: 1, titulo: 'Cancelar Netflix', acao: 'cancelar', valor: 55 },
    { id: 'l1', ordem: 2, titulo: 'Gastar no máximo R$ 300 com delivery este mês', acao: 'conferir', valor: 300 },
  ],
});
const GASTOS_CANCELOU = missao({ ...GASTOS, passos: GASTOS.passos.map((p) => (p.id === 'c1' ? { ...p, concluidoEm: '2026-09-02T12:00:00.000Z' } : p)) });

const INVESTIR_SEM_VALOR = missao({
  id: 'm-inv',
  agente: 'sharru',
  tipo: 'investir',
  titulo: 'Fazer o ouro trabalhar',
  prioridade: 5,
  passos: [{ id: 'p1', ordem: 1, titulo: 'Conversar com Sharru Nada sobre investir', acao: 'conversar' }],
});
const INVESTIR = missao({ ...INVESTIR_SEM_VALOR, valorMensal: 300 });

const estado = (missoes: Missao[], extra: Record<string, string> = {}) => ({ 'gs-missoes': JSON.stringify(missoes), ...extra });

/* ---------- conversa ---------- */

interface Caso {
  agente: AgenteId;
  missao: string;
  mes: string;
  state: Record<string, string>;
  now?: Date;
  nome?: string;
}

const roteiroDe = (c: Caso) => {
  const r = ROTEIRO_CHECKIN(c.agente, c.missao, c.mes, c.now ?? NOW);
  expect(r, `roteiro de ${c.mes}`).not.toBeNull();
  return r as Roteiro;
};
const base = (c: Caso) => ({ agente: c.agente, nome: c.nome ?? 'Ana', dados: dadosDeEstado(c.state, c.now ?? NOW) });

function responder(c: Caso, pares: [string, Valor][]) {
  const roteiro = roteiroDe(c);
  const r: RespostaDada[] = [];
  for (const [passo, valor] of pares) {
    const p = percorrer(roteiro, r, base(c));
    expect(p.atual?.id, `esperava ${passo}`).toBe(passo);
    expect(conferir(p.atual!, valor, p.ctx)).toBeNull();
    r.push({ passo, valor });
  }
  return { roteiro, fim: percorrer(roteiro, r, base(c)) };
}

/** Onde a conversa está depois dessas respostas (sem conferir). */
const ate = (c: Caso, pares: [string, Valor][] = []) =>
  percorrer(
    roteiroDe(c),
    pares.map(([passo, valor]) => ({ passo, valor })),
    base(c)
  );

const falasDe = (p: ReturnType<typeof percorrer>, id: string) => {
  const v = [...p.visitas].reverse().find((x) => x.passo.id === id);
  return v ? falasDoRoteiro.falas(v.passo, v.ctx) : [];
};
const falasAtuais = (p: ReturnType<typeof percorrer>) => falasDoRoteiro.falas(p.atual!, p.ctx);
const ultimo = (p: ReturnType<typeof percorrer>) => p.visitas[p.visitas.length - 1].passo.id;

// os casos de sempre
const SETEMBRO_ARKAD: Caso = { agente: 'arkad', missao: 'm-res', mes: '2026-09', state: estado([RESERVA]), now: INICIO };
const OUTUBRO_ARKAD: Caso = { agente: 'arkad', missao: 'm-res', mes: '2026-10', state: estado([RESERVA_SET]) };
const SETEMBRO_DABASIR: Caso = { agente: 'dabasir', missao: 'm-div', mes: '2026-09', state: estado([DIVIDA]), now: INICIO };

/* ---------- testes ---------- */

describe('6.9 Check-in do mês — quando vale', () => {
  it('o id do roteiro é checkin:{missão}:{mês} (vira o id da conversa)', () => {
    expect(CHECKIN).toBe('checkin');
    const r = ROTEIRO_CHECKIN('arkad', 'm-res', '2026-10', NOW)!;
    expect(r).toMatchObject({ id: 'checkin:m-res:2026-10', agente: 'arkad', titulo: 'Check-in de outubro', primeiro: 'abertura' });
    expect(idDoCheckin('m-res', '2026-10')).toBe(r.id);
    expect(ROTEIRO_CHECKIN('dabasir', 'm-div', '2026-09', INICIO)).toMatchObject({ id: 'checkin:m-div:2026-09', agente: 'dabasir', titulo: 'Check-in de setembro' });
  });

  it('só o mês atual e, até o dia 10, o anterior; nunca futuro', () => {
    // dia 21: só outubro
    expect(ROTEIRO_CHECKIN('arkad', 'm-res', '2026-10', NOW)).not.toBeNull();
    expect(ROTEIRO_CHECKIN('arkad', 'm-res', '2026-09', NOW)).toBeNull();
    expect(ROTEIRO_CHECKIN('arkad', 'm-res', '2026-11', NOW)).toBeNull();
    // dia 5: setembro e outubro
    expect(ROTEIRO_CHECKIN('arkad', 'm-res', '2026-09', INICIO)).not.toBeNull();
    expect(ROTEIRO_CHECKIN('arkad', 'm-res', '2026-10', INICIO)).not.toBeNull();
    expect(ROTEIRO_CHECKIN('arkad', 'm-res', '2026-08', INICIO)).toBeNull();
    expect(ROTEIRO_CHECKIN('arkad', 'm-res', '2027-10', INICIO)).toBeNull();
    // virada do ano
    expect(ROTEIRO_CHECKIN('arkad', 'm-res', '2026-12', new Date('2027-01-03T15:00:00Z'))).not.toBeNull();
  });

  it('as datas são de Brasília', () => {
    // 11/out 02:00 UTC = 10/out 23:00 em Brasília: setembro ainda vale
    expect(mesDoCheckinValido('2026-09', new Date('2026-10-11T02:00:00Z'))).toBe(true);
    // 11/out 03:30 UTC = 11/out 00:30 em Brasília: já não vale
    expect(mesDoCheckinValido('2026-09', new Date('2026-10-11T03:30:00Z'))).toBe(false);
    // 1º/nov 01:00 UTC = 31/out 22:00 em Brasília: novembro ainda é futuro
    expect(mesDoCheckinValido('2026-11', new Date('2026-11-01T01:00:00Z'))).toBe(false);
    expect(mesDoCheckinValido('2026-10', new Date('2026-11-01T01:00:00Z'))).toBe(true);
  });

  it('mês, missão ou agente inválidos: sem roteiro', () => {
    for (const mes of ['', '2026-13', '2026-1', '2026-00', 'outubro', '2026-10-01']) expect(ROTEIRO_CHECKIN('arkad', 'm-res', mes, NOW)).toBeNull();
    for (const id of ['', ' ', 'a:b', 'm res']) expect(ROTEIRO_CHECKIN('arkad', id, '2026-10', NOW)).toBeNull();
    expect(ROTEIRO_CHECKIN('zeca' as AgenteId, 'm-res', '2026-10', NOW)).toBeNull();
  });
});

describe('6.9 Check-in do mês — sem missão', () => {
  it('missão que não existe: uma fala só, fim, sem cartão e sem efeitos', () => {
    const c: Caso = { agente: 'arkad', missao: 'm-nada', mes: '2026-10', state: estado([RESERVA]) };
    const p = ate(c);
    expect(p.fim).toBe(true);
    expect(p.visitas).toHaveLength(1);
    expect(p.visitas[0].passo.id).toBe('abertura');
    expect(respostaDe(p.visitas[0].passo, p.ctx)).toEqual({ tipo: 'nenhuma' });
    expect(falasDe(p, 'abertura')).toEqual(['Não encontrei essa missão ativa. Ela pode ter sido pausada, concluída ou apagada.', 'Em Missões você vê o que está valendo agora.']);
    const r = roteiroDe(c);
    expect(r.resultado!(p.ctx)).toBeNull();
    expect(r.concluir!(p.ctx, r.id)).toEqual({ missoes: [], ativar: [] });
    // usuário novo, sem nada
    const novo = ate({ ...c, state: {} });
    expect(novo.fim).toBe(true);
    expect(novo.visitas).toHaveLength(1);
    expect(roteiroDe(c).resultado!(novo.ctx)).toBeNull();
  });

  it('missão pausada, concluída ou apagada conta como não encontrada', () => {
    for (const m of [missao({ ...RESERVA, status: 'pausada' }), missao({ ...RESERVA, status: 'concluida' }), missao({ ...RESERVA, deletedAt: '2026-10-01T00:00:00.000Z' })]) {
      const c: Caso = { ...OUTUBRO_ARKAD, state: estado([m]) };
      const p = ate(c);
      expect(p.fim).toBe(true);
      expect(falasDe(p, 'abertura')[0]).toBe('Não encontrei essa missão ativa. Ela pode ter sido pausada, concluída ou apagada.');
      expect(cartaoDoCheckin(p.ctx, 'm-res', '2026-10')).toBeNull();
    }
  });

  it('missão de outro agente: diz com quem é e termina', () => {
    const c: Caso = { agente: 'dabasir', missao: 'm-res', mes: '2026-10', state: estado([RESERVA]) };
    const p = ate(c);
    expect(p.fim).toBe(true);
    expect(falasDe(p, 'abertura')).toEqual(['Essa missão é com o Arkad. O check-in dela é com ele.']);
    expect(situacao(p.ctx, 'm-res', '2026-10').estado).toBe('outro_agente');
    expect(roteiroDe(c).resultado!(p.ctx)).toBeNull();
  });

  it('mês antes de a missão começar: não tem check-in', () => {
    const nova = missao({ ...RESERVA, dataInicio: '2026-10-02', registros: [] });
    const p = ate({ ...SETEMBRO_ARKAD, state: estado([nova]) });
    expect(p.fim).toBe(true);
    expect(falasDe(p, 'abertura')).toEqual(['Essa missão começou em outubro, então não tem check-in de setembro.']);
  });

  it('mês que ainda não chegou nos dados do app: não pergunta nada', () => {
    // o roteiro foi aberto em outubro, mas os dados dizem que hoje ainda é setembro
    const r = ROTEIRO_CHECKIN('arkad', 'm-res', '2026-10', NOW)!;
    const ctx = { agente: 'arkad' as const, nome: 'Ana', dados: dadosDeEstado(estado([RESERVA]), new Date('2026-09-30T15:00:00Z')) };
    const p = percorrer(r, [], ctx);
    expect(p.fim).toBe(true);
    expect(falasDe(p, 'abertura')).toEqual(['Outubro ainda não chegou. O check-in fica pra quando o mês começar.']);
    expect(situacao(p.ctx, 'm-res', '2026-10').estado).toBe('futuro');
  });
});

describe('6.9 Check-in do mês — mês que passou (até o dia 10)', () => {
  it('abre com o tom do agente e a pergunta da spec, com os três botões', () => {
    const p = ate(SETEMBRO_ARKAD);
    expect(falasDe(p, 'abertura')).toEqual(['Oi, Ana. Vamos olhar a sua bolsa com calma.']);
    expect(p.atual?.id).toBe('como_foi');
    expect(falasAtuais(p)).toEqual(['Começou outubro. Conseguiu guardar R$ 400 em setembro?']);
    const r = respostaDe(p.atual!, p.ctx);
    expect(r.tipo === 'botoes' && r.opcoes.map((o) => o.rotulo)).toEqual(['Fiz tudo', 'Fiz uma parte', 'Não deu']);
    // sem nome, a vírgula some
    expect(falasDe(ate({ ...SETEMBRO_ARKAD, nome: '' }), 'abertura')).toEqual(['Oi. Vamos olhar a sua bolsa com calma.']);
  });

  it('Fiz tudo: comemora, conta a sequência e o cartão mostra o mês e a previsão', () => {
    const { roteiro, fim } = responder(SETEMBRO_ARKAD, [['como_foi', 'tudo']]);
    expect(fim.fim).toBe(true);
    expect(ultimo(fim)).toBe('tudo');
    expect(falasDe(fim, 'tudo')).toEqual(['Muito bem, Ana! Mais uma moeda na sua bolsa.', 'Mais um mês na conta. Sequência: 2 meses.']);
    expect(sequenciaDepois(fim.ctx, RESERVA, '2026-09')).toBe(2); // agosto e setembro

    const res = roteiro.resultado!(fim.ctx);
    expect(res).toEqual({
      titulo: 'Check-in de setembro',
      linhas: ['1. Guardou R$ 400 em setembro', '2. Previsão: mar/28'],
      agentes: ['arkad'],
      rodape: 'Ao confirmar, R$ 400 entram na missão em setembro. A data é uma estimativa com os seus números.',
      botao: 'Confirmar',
    });

    const c = roteiro.concluir!(fim.ctx, roteiro.id);
    expect(c.missoes).toEqual([]);
    expect(c.ativar).toEqual([]);
    expect(c.destino).toBeUndefined();
    expect(typeof c.efeitos).toBe('function'); // grava na missão (localStorage): não roda aqui

    // o que o efeito grava, sem localStorage
    const mud = mudancaDe(fim.ctx, RESERVA);
    expect(mud).toEqual({ totalNoMes: 400, valorMensal: null });
    expect(valorARegistrar(RESERVA, '2026-09', mud.totalNoMes)).toBe(400);
    const depois = aplicarCheckin(RESERVA, mud, '2026-09', '2026-10-05');
    expect(depois.registros.map((r) => [r.mes, r.valor])).toEqual([
      ['2026-08', 400],
      ['2026-09', 400],
    ]);
    expect(depois.registros[1].em).toBe('2026-10-05');
    expect(depois).toMatchObject({ valorMensal: 400, dataPrevista: '2028-03', status: 'ativa' });
  });

  it('Fiz uma parte: pergunta quanto, valida e mostra a previsão nova', () => {
    const p = ate(SETEMBRO_ARKAD, [['como_foi', 'parte']]);
    expect(p.atual?.id).toBe('quanto');
    expect(falasAtuais(p)).toEqual(['Quanto você conseguiu guardar?']);
    expect(respostaDe(p.atual!, p.ctx)).toMatchObject({ tipo: 'dinheiro', min: 0 });
    expect(conferir(p.atual!, 0, p.ctx)).toBe('Se não deu nada, tudo bem. Toque na sua resposta acima e troque por "Não deu".');
    expect(conferir(p.atual!, -10, p.ctx)).toBe('O valor não pode ser negativo.');
    expect(conferir(p.atual!, 400, p.ctx)).toBe('R$ 400 é o valor todo. Se você fez tudo, toque na sua resposta acima e troque por "Fiz tudo".');
    expect(conferir(p.atual!, 500, p.ctx)).toBe('R$ 400 é o valor todo. Se você fez tudo, toque na sua resposta acima e troque por "Fiz tudo".');
    expect(conferir(p.atual!, 399.99, p.ctx)).toBeNull();

    const { roteiro, fim } = responder(SETEMBRO_ARKAD, [['como_foi', 'parte'], ['quanto', 250]]);
    expect(ultimo(fim)).toBe('parte_fim');
    expect(falasDe(fim, 'parte_fim')).toEqual(['Já é um passo, Ana. Cada real guardado conta.', 'Mais um mês na conta. Sequência: 2 meses.', 'Sua nova previsão é abr/28.']);
    const res = roteiro.resultado!(fim.ctx);
    expect(res.linhas).toEqual(['1. Guardou R$ 250 em setembro', '2. Previsão: abr/28']);
    expect(res.rodape).toBe('Ao confirmar, R$ 250 entram na missão em setembro. A data é uma estimativa com os seus números.');
    expect(mudancaDe(fim.ctx, RESERVA)).toEqual({ totalNoMes: 250, valorMensal: null });
    expect(roteiro.concluir!(fim.ctx, roteiro.id)).toMatchObject({ missoes: [], ativar: [] });
  });

  it('Não deu: a previsão sem esse mês, e manter o valor', () => {
    const p = ate(SETEMBRO_ARKAD, [['como_foi', 'nao']]);
    expect(p.atual?.id).toBe('nao_deu');
    expect(falasAtuais(p)).toEqual(['Acontece. Sua nova previsão é abr/28.', 'Quer manter o valor de R$ 400 por mês ou ajustar?']);
    const r = respostaDe(p.atual!, p.ctx);
    expect(r.tipo === 'botoes' && r.opcoes.map((o) => o.rotulo)).toEqual(['Manter', 'Ajustar valor']);

    const { roteiro, fim } = responder(SETEMBRO_ARKAD, [['como_foi', 'nao'], ['nao_deu', 'manter']]);
    expect(ultimo(fim)).toBe('manter_fim');
    expect(falasDe(fim, 'manter_fim')).toEqual(['Tudo certo. Seguimos com R$ 400 por mês.', 'Este mês é uma nova chance. Eu te lembro na hora de guardar.']);
    const res = roteiro.resultado!(fim.ctx);
    expect(res.linhas).toEqual(['1. Setembro: não deu desta vez', '2. Previsão: abr/28']);
    expect(res.rodape).toBe('Ao confirmar, a missão segue com a data nova. A data é uma estimativa com os seus números.');
    // nada entra; só a data prevista é recalculada
    const mud = mudancaDe(fim.ctx, RESERVA);
    expect(mud).toEqual({ totalNoMes: 0, valorMensal: null });
    const depois = aplicarCheckin(RESERVA, mud, '2026-09', '2026-10-05');
    expect(depois.registros).toEqual(RESERVA.registros);
    expect(depois.dataPrevista).toBe('2028-04');
  });

  it('Não deu → Ajustar valor: pergunta o valor que cabe, valida e mostra a previsão nova', () => {
    const state = estado([RESERVA], { 'gs-eu': JSON.stringify({ renda: 3000 }) });
    const p = ate({ ...SETEMBRO_ARKAD, state }, [['como_foi', 'nao'], ['nao_deu', 'ajustar']]);
    expect(p.atual?.id).toBe('novo_valor');
    expect(falasAtuais(p)).toEqual(['Melhor um valor menor que você cumpre do que um maior que pesa.', 'Qual valor cabe por mês?']);
    expect(conferir(p.atual!, 0, p.ctx)).toBe('Digite pelo menos R$ 1,00.');
    expect(conferir(p.atual!, 3500, p.ctx)).toBe('Isso é mais do que entra por mês. Prefiro um valor que você consiga cumprir.');
    expect(conferir(p.atual!, 300, p.ctx)).toBeNull();

    const { roteiro, fim } = responder({ ...SETEMBRO_ARKAD, state }, [['como_foi', 'nao'], ['nao_deu', 'ajustar'], ['novo_valor', 300]]);
    expect(ultimo(fim)).toBe('ajuste_fim');
    expect(falasDe(fim, 'ajuste_fim')).toEqual(['Pronto. Com R$ 300 por mês, sua previsão fica para nov/28.', 'Este mês é uma nova chance. Eu sigo com você.']);
    const res = roteiro.resultado!(fim.ctx);
    expect(res.linhas).toEqual(['1. Setembro: não deu desta vez', '2. Novo valor: R$ 300 por mês · previsão nov/28']);
    expect(res.rodape).toBe('Ao confirmar, o novo valor por mês passa a valer. A data é uma estimativa com os seus números.');

    const mud = mudancaDe(fim.ctx, RESERVA);
    expect(mud).toEqual({ totalNoMes: 0, valorMensal: 300 });
    const depois = aplicarCheckin(RESERVA, mud, '2026-09', '2026-10-05');
    expect(depois).toMatchObject({ valorMensal: 300, dataPrevista: '2028-11' });
    expect(depois.registros).toEqual(RESERVA.registros);
    // o passo de guardar passa a citar o valor novo; os outros ficam como estavam
    expect(depois.passos.map((x) => x.titulo)).toEqual(['Guardar R$ 300 no dia 5', 'Chegar a R$ 4.500 (metade)', 'Reserva completa em mar/28']);
  });

  it('dívida: pergunta em reais, sem sequência, com a previsão da simulação', () => {
    const p = ate(SETEMBRO_DABASIR);
    expect(falasDe(p, 'abertura')).toEqual(['Oi, Ana. Vamos ver como anda a caminhada.']);
    expect(falasAtuais(p)).toEqual(['Começou outubro. Conseguiu pagar R$ 400 nas dívidas em setembro?']);

    const tudo = responder(SETEMBRO_DABASIR, [['como_foi', 'tudo']]);
    expect(falasDe(tudo.fim, 'tudo')).toEqual(['Muito bem, Ana! Cada pagamento é um peso a menos.', 'Mais um mês na conta.']);
    expect(tudo.roteiro.resultado!(tudo.fim.ctx).linhas).toEqual(['1. Pagou R$ 400 nas dívidas em setembro', '2. Previsão: jun/27']);
    expect(tudo.roteiro.resultado!(tudo.fim.ctx).agentes).toEqual(['dabasir']);

    const parte = responder(SETEMBRO_DABASIR, [['como_foi', 'parte'], ['quanto', 250]]);
    expect(falasDe(parte.fim, 'quanto')).toEqual(['Quanto você conseguiu pagar?']);
    expect(falasDe(parte.fim, 'parte_fim')).toEqual(['Já é um passo, Ana. Cada real pago tira um pouco do peso.', 'Sua nova previsão é jul/27.']);
    expect(parte.roteiro.resultado!(parte.fim.ctx).linhas).toEqual(['1. Pagou R$ 250 nas dívidas em setembro', '2. Previsão: jul/27']);

    const nao = ate(SETEMBRO_DABASIR, [['como_foi', 'nao']]);
    expect(falasAtuais(nao)[0]).toBe('Acontece. Sua nova previsão é ago/27.');
    const manter = responder(SETEMBRO_DABASIR, [['como_foi', 'nao'], ['nao_deu', 'manter']]);
    expect(falasDe(manter.fim, 'manter_fim')[1]).toBe('Este mês é uma nova chance. Eu te lembro na hora de pagar.');

    // abaixo das parcelas não passa
    const ajuste = ate(SETEMBRO_DABASIR, [['como_foi', 'nao'], ['nao_deu', 'ajustar']]);
    expect(conferir(ajuste.atual!, 100, ajuste.ctx)).toBe('As parcelas das suas dívidas somam R$ 200 por mês. Coloque pelo menos esse valor.');
    expect(conferir(ajuste.atual!, 200, ajuste.ctx)).toBeNull();
    // um valor que não vence os juros (10% de R$ 3.000 = R$ 300) também não
    const cara = missao({ ...DIVIDA, dividas: [{ id: 'd1', nome: 'Cartão', saldo: 3000, parcela: 0, jurosMes: 10 }] });
    const caro = ate({ ...SETEMBRO_DABASIR, state: estado([cara]) }, [['como_foi', 'nao'], ['nao_deu', 'ajustar']]);
    expect(conferir(caro.atual!, 250, caro.ctx)).toBe('Com esse valor, os juros crescem mais rápido que o pagamento. Tente um valor um pouco maior.');
    expect(conferir(caro.atual!, 500, caro.ctx)).toBeNull();
    const ajustou = responder(SETEMBRO_DABASIR, [['como_foi', 'nao'], ['nao_deu', 'ajustar'], ['novo_valor', 300]]);
    expect(falasDe(ajustou.fim, 'ajuste_fim')[0]).toBe('Pronto. Com R$ 300 por mês, sua previsão fica para jan/28.');
    const depois = aplicarCheckin(DIVIDA, mudancaDe(ajustou.fim.ctx, DIVIDA), '2026-09', '2026-10-05');
    expect(depois.valorMensal).toBe(300);
    expect(depois.passos[0].titulo).toBe('Pagar R$ 300 em Cartão este mês');
  });
});

describe('6.9 Check-in do mês — mês atual', () => {
  it('pergunta "Como está outubro?" e o Fiz tudo conta outubro na sequência', () => {
    const p = ate(OUTUBRO_ARKAD);
    expect(falasAtuais(p)).toEqual(['Como está outubro? Conseguiu guardar R$ 400?']);
    const { roteiro, fim } = responder(OUTUBRO_ARKAD, [['como_foi', 'tudo']]);
    expect(falasDe(fim, 'tudo')).toEqual(['Muito bem, Ana! Mais uma moeda na sua bolsa.', 'Mais um mês na conta. Sequência: 3 meses.']);
    expect(roteiro.resultado!(fim.ctx).linhas).toEqual(['1. Guardou R$ 400 em outubro', '2. Previsão: mar/28']);
  });

  it('Não deu no mês atual: a conta começa no mês que vem', () => {
    const p = ate(OUTUBRO_ARKAD, [['como_foi', 'nao']]);
    expect(falasAtuais(p)[0]).toBe('Acontece. Sua nova previsão é abr/28.');
    expect(previsaoDoCheckin(RESERVA_SET, '2026-10', '2026-10-21')).toBe('2028-04');
    // o mesmo mês com o valor guardado: termina antes
    expect(previsaoDoCheckin(aplicarCheckin(RESERVA_SET, { totalNoMes: 400, valorMensal: null }, '2026-10', '2026-10-21'), '2026-10', '2026-10-21')).toBe('2028-03');
    const { roteiro, fim } = responder(OUTUBRO_ARKAD, [['como_foi', 'nao'], ['nao_deu', 'manter']]);
    expect(roteiro.resultado!(fim.ctx).linhas).toEqual(['1. Outubro: não deu desta vez', '2. Previsão: abr/28']);
    expect(aplicarCheckin(RESERVA_SET, mudancaDe(fim.ctx, RESERVA_SET), '2026-10', '2026-10-21').dataPrevista).toBe('2028-04');
  });

  it('o que já foi marcado no mês conta: só entra o que falta', () => {
    const comParte = missao({ ...RESERVA_SET, registros: [...RESERVA_SET.registros, reg('2026-10', 150)] });
    const c: Caso = { ...OUTUBRO_ARKAD, state: estado([comParte]) };
    expect(jaNoMes(comParte, '2026-10')).toBe(150);
    expect(falasAtuais(ate(c))).toEqual(['Como está outubro? Conseguiu guardar R$ 400?', 'Até agora você marcou R$ 150 este mês.']);

    const tudo = responder(c, [['como_foi', 'tudo']]);
    const res = tudo.roteiro.resultado!(tudo.fim.ctx);
    expect(res.linhas[0]).toBe('1. Guardou R$ 400 em outubro');
    expect(res.rodape).toBe('Ao confirmar, R$ 250 entram na missão em outubro. A data é uma estimativa com os seus números.');
    expect(valorARegistrar(comParte, '2026-10', 400)).toBe(250);

    const q = ate(c, [['como_foi', 'parte']]);
    expect(falasAtuais(q)).toEqual(['Quanto você conseguiu guardar no total, contando os R$ 150 que já marcou?']);
    expect(conferir(q.atual!, 100, q.ctx)).toBe('Você já marcou R$ 150 este mês. Coloque o total, contando esse valor.');
    const parte = responder(c, [['como_foi', 'parte'], ['quanto', 300]]);
    const depois = aplicarCheckin(comParte, mudancaDe(parte.fim.ctx, comParte), '2026-10', '2026-10-21');
    expect(depois.registros.filter((r) => r.mes === '2026-10').map((r) => r.valor)).toEqual([150, 150]);

    // "não deu", mas já tinha uma parte marcada: o cartão mostra o que foi marcado
    const nao = responder(c, [['como_foi', 'nao'], ['nao_deu', 'manter']]);
    expect(nao.roteiro.resultado!(nao.fim.ctx).linhas[0]).toBe('1. Guardou R$ 150 em outubro');
  });

  it('a missão que completa no check-in comemora em dobro', () => {
    const c: Caso = { ...OUTUBRO_ARKAD, state: estado([RESERVA_QUASE]) };
    const { roteiro, fim } = responder(c, [['como_foi', 'tudo']]);
    expect(falasDe(fim, 'tudo')).toEqual(['Muito bem, Ana! Mais uma moeda na sua bolsa.', 'Mais um mês na conta. Sequência: 1 mês.', 'E com isso a missão está completa. Que conquista!']);
    expect(roteiro.resultado!(fim.ctx).linhas).toEqual(['1. Guardou R$ 400 em outubro', '2. Missão completa']);
    expect(aplicarCheckin(RESERVA_QUASE, mudancaDe(fim.ctx, RESERVA_QUASE), '2026-10', '2026-10-21').status).toBe('concluida');

    const parte = responder(c, [['como_foi', 'parte'], ['quanto', 350]]);
    expect(falasDe(parte.fim, 'parte_fim')[2]).toBe('E com isso a missão está completa. Que conquista!');
  });

  it('contas (Bansir): pergunta das contas, sem previsão; Não deu termina com calma', () => {
    const c: Caso = { agente: 'bansir', missao: 'm-contas', mes: '2026-10', state: estado([CONTAS]) };
    const p = ate(c);
    expect(falasDe(p, 'abertura')).toEqual(['E aí, Ana? Vamos ver como andam as coisas.']);
    expect(falasAtuais(p)).toEqual(['Como está outubro? Conseguiu pagar as contas?']);

    const tudo = responder(c, [['como_foi', 'tudo']]);
    expect(falasDe(tudo.fim, 'tudo')).toEqual(['Muito bem, Ana! Conta em dia é sono tranquilo.', 'Mais um mês na conta.']);
    expect(tudo.roteiro.resultado!(tudo.fim.ctx)).toMatchObject({ linhas: ['1. Pagou R$ 1.500 das contas em outubro'], rodape: 'Ao confirmar, R$ 1.500 entram na missão em outubro.', agentes: ['bansir'] });

    const nao = responder(c, [['como_foi', 'nao']]);
    expect(ultimo(nao.fim)).toBe('nao_deu_fim');
    expect(falasDe(nao.fim, 'nao_deu_fim')).toEqual(['Acontece. O plano continua valendo.', 'Este mês é uma nova chance. Eu sigo com você.']);
    expect(nao.roteiro.resultado!(nao.fim.ctx)).toMatchObject({ linhas: ['1. Outubro: não deu desta vez'], rodape: 'Ao confirmar, o plano segue valendo.' });
    expect(mudancaDe(nao.fim.ctx, CONTAS)).toEqual({ totalNoMes: 0, valorMensal: null });

    const parte = responder(c, [['como_foi', 'parte'], ['quanto', 1000]]);
    expect(falasDe(parte.fim, 'quanto')).toEqual(['Quanto você conseguiu pagar?']);
    expect(falasDe(parte.fim, 'parte_fim')).toEqual(['Já é um passo, Ana. Cada conta paga é um alívio.']);
    expect(parte.roteiro.resultado!(parte.fim.ctx).linhas).toEqual(['1. Pagou R$ 1.000 das contas em outubro']);
  });

  it('gastos (Nomasir): a ação é o próximo passo da missão, em minúscula', () => {
    const c: Caso = { agente: 'nomasir', missao: 'm-gastos', mes: '2026-10', state: estado([GASTOS]) };
    expect(falasAtuais(ate(c))).toEqual(['Como está outubro? Conseguiu cancelar Netflix?']);
    expect(falasAtuais(ate({ ...c, state: estado([GASTOS_CANCELOU]) }))).toEqual(['Como está outubro? Conseguiu gastar no máximo R$ 300 com delivery?']);
    const anterior: Caso = { ...c, mes: '2026-09', state: estado([GASTOS_CANCELOU]), now: INICIO };
    expect(falasAtuais(ate(anterior))).toEqual(['Começou outubro. Conseguiu gastar no máximo R$ 300 com delivery em setembro?']);

    const parte = responder(anterior, [['como_foi', 'parte'], ['quanto', 30]]);
    expect(falasDe(parte.fim, 'quanto')).toEqual(['Quanto você conseguiu economizar?']);
    expect(falasDe(parte.fim, 'parte_fim')).toEqual(['Já é um passo, Ana. Cada real segurado conta.']);
    expect(parte.roteiro.resultado!(parte.fim.ctx).linhas).toEqual(['1. Economizou R$ 30 em setembro']);
  });

  it('investir sem valor por mês: sem "Fiz uma parte"; Não deu oferece definir um valor', () => {
    const c: Caso = { agente: 'sharru', missao: 'm-inv', mes: '2026-10', state: estado([INVESTIR_SEM_VALOR]) };
    const p = ate(c);
    expect(falasAtuais(p)).toEqual(['Como está outubro? Conseguiu conversar com Sharru Nada sobre investir?']);
    const r = respostaDe(p.atual!, p.ctx);
    expect(r.tipo === 'botoes' && r.opcoes.map((o) => o.valor)).toEqual(['tudo', 'nao']);

    const tudo = responder(c, [['como_foi', 'tudo']]);
    expect(falasDe(tudo.fim, 'tudo')).toEqual(['Muito bem, Ana! Seu ouro já está trabalhando.', 'Mais um mês na conta.']);
    expect(tudo.roteiro.resultado!(tudo.fim.ctx)).toMatchObject({ linhas: ['1. Fez tudo em outubro'], rodape: 'Ao confirmar, o plano segue valendo.' });

    expect(falasAtuais(ate(c, [['como_foi', 'nao']]))).toEqual(['Acontece. Sem problema nenhum.', 'Quer manter assim ou definir um valor por mês?']);
    const manter = responder(c, [['como_foi', 'nao'], ['nao_deu', 'manter']]);
    expect(falasDe(manter.fim, 'manter_fim')).toEqual(['Tudo certo. Seguimos assim.', 'Este mês é uma nova chance. Eu te lembro na hora de guardar.']);
  });

  it('investir com valor: ajustar sem meta não fala de data', () => {
    const c: Caso = { agente: 'sharru', missao: 'm-inv', mes: '2026-10', state: estado([INVESTIR]) };
    expect(falasAtuais(ate(c))).toEqual(['Como está outubro? Conseguiu guardar R$ 300?']);
    const { roteiro, fim } = responder(c, [['como_foi', 'nao'], ['nao_deu', 'ajustar'], ['novo_valor', 200]]);
    expect(falasDe(fim, 'ajuste_fim')).toEqual(['Pronto. Seguimos com R$ 200 por mês.', 'Este mês é uma nova chance. Eu sigo com você.']);
    expect(roteiro.resultado!(fim.ctx)).toMatchObject({ linhas: ['1. Outubro: não deu desta vez', '2. Novo valor: R$ 200 por mês'], rodape: 'Ao confirmar, o novo valor por mês passa a valer.' });
    expect(aplicarCheckin(INVESTIR, mudancaDe(fim.ctx, INVESTIR), '2026-10', '2026-10-21').valorMensal).toBe(200);
  });

  it('validações dos botões', () => {
    const p = ate(OUTUBRO_ARKAD);
    expect(conferir(p.atual!, 'talvez', p.ctx)).toBe('Escolha uma das opções.');
    const n = ate(OUTUBRO_ARKAD, [['como_foi', 'nao']]);
    expect(conferir(n.atual!, 'depois', n.ctx)).toBe('Escolha uma das opções.');
    // sem valor por mês, "Fiz uma parte" nem aparece
    const inv = ate({ agente: 'sharru', missao: 'm-inv', mes: '2026-10', state: estado([INVESTIR_SEM_VALOR]) });
    expect(conferir(inv.atual!, 'parte', inv.ctx)).toBe('Escolha uma das opções.');
  });
});

describe('6.9 Check-in do mês — regras puras', () => {
  it('nunca registra mês futuro', () => {
    const mud = { totalNoMes: 400, valorMensal: 300 };
    expect(aplicarCheckin(RESERVA, mud, '2026-11', '2026-10-21')).toBe(RESERVA);
    expect(aplicarCheckin(RESERVA, mud, 'nada', '2026-10-21')).toBe(RESERVA);
  });

  it('aplicar duas vezes não registra em dobro', () => {
    const mud = { totalNoMes: 400, valorMensal: null };
    const uma = aplicarCheckin(RESERVA, mud, '2026-09', '2026-10-05');
    const duas = aplicarCheckin(uma, mud, '2026-09', '2026-10-05');
    expect(duas.registros).toHaveLength(2);
    expect(duas).toBe(uma);
    expect(valorARegistrar(uma, '2026-09', 400)).toBe(0);
    expect(valorARegistrar(uma, '2026-09', 250)).toBe(0);
  });

  it('o valor novo só troca o valor exato nos passos de guardar/pagar', () => {
    const m = missao({
      ...RESERVA,
      passos: [
        { id: 'a', ordem: 1, titulo: 'Guardar R$ 400 no dia 5', acao: 'guardar' },
        { id: 'b', ordem: 2, titulo: 'Guardar R$ 400.000 um dia', acao: 'guardar' },
        { id: 'c', ordem: 3, titulo: 'Chegar a R$ 400 de novo', valor: 400 },
      ],
    });
    const depois = aplicarCheckin(m, { totalNoMes: 0, valorMensal: 350 }, '2026-10', '2026-10-21');
    expect(depois.passos.map((p) => p.titulo)).toEqual(['Guardar R$ 350 no dia 5', 'Guardar R$ 400.000 um dia', 'Chegar a R$ 400 de novo']);
    // o mesmo valor: nada muda
    expect(aplicarCheckin(m, { totalNoMes: 0, valorMensal: 400 }, '2026-10', '2026-10-21').passos).toEqual(m.passos);
  });

  it('a ação: valor por mês, contas, próximo passo ou "seguir o plano"', () => {
    expect(acaoDe(RESERVA, '2026-10-21')).toBe('guardar R$ 400');
    expect(acaoDe(DIVIDA, '2026-10-21')).toBe('pagar R$ 400 nas dívidas');
    expect(acaoDe(CONTAS, '2026-10-21')).toBe('pagar as contas');
    expect(acaoDe(GASTOS, '2026-10-21')).toBe('cancelar Netflix');
    const tudoFeito = missao({ ...GASTOS, passos: GASTOS.passos.map((p) => ({ ...p, concluidoEm: '2026-10-01T00:00:00.000Z' })) });
    expect(acaoDe(tudoFeito, '2026-10-21')).toBe('seguir o plano');
    expect(acaoDoPasso('Pagar Aluguel · dia 5')).toBe('pagar Aluguel');
    expect(acaoDoPasso('Gastar no máximo R$ 300 com delivery este mês')).toBe('gastar no máximo R$ 300 com delivery');
    expect(acaoDoPasso('')).toBe('');
  });

  it('a sequência só conta reserva e investir, com o mês do check-in', () => {
    const p = ate(SETEMBRO_ARKAD, [['como_foi', 'nao']]);
    // sem guardar em setembro, a sequência de agosto já não chega até hoje
    expect(sequenciaDepois(p.ctx, RESERVA, '2026-09')).toBe(0);
  });
});

describe('6.9 Check-in do mês — textos', () => {
  it('não usa as palavras proibidas, até 3 balões por passo e até 3 linhas no cartão', () => {
    const renda = { 'gs-eu': JSON.stringify({ renda: 3000 }) };
    const casos: [Caso, [string, Valor][]][] = [
      [SETEMBRO_ARKAD, [['como_foi', 'tudo']]],
      [SETEMBRO_ARKAD, [['como_foi', 'parte'], ['quanto', 250]]],
      [SETEMBRO_ARKAD, [['como_foi', 'nao'], ['nao_deu', 'manter']]],
      [{ ...SETEMBRO_ARKAD, state: estado([RESERVA], renda) }, [['como_foi', 'nao'], ['nao_deu', 'ajustar'], ['novo_valor', 300]]],
      [SETEMBRO_DABASIR, [['como_foi', 'tudo']]],
      [SETEMBRO_DABASIR, [['como_foi', 'nao'], ['nao_deu', 'ajustar'], ['novo_valor', 300]]],
      [{ ...OUTUBRO_ARKAD, state: estado([RESERVA_QUASE]) }, [['como_foi', 'tudo']]],
      [{ agente: 'bansir', missao: 'm-contas', mes: '2026-10', state: estado([CONTAS]) }, [['como_foi', 'nao']]],
      [{ agente: 'nomasir', missao: 'm-gastos', mes: '2026-10', state: estado([GASTOS]) }, [['como_foi', 'parte'], ['quanto', 20]]],
      [{ agente: 'sharru', missao: 'm-inv', mes: '2026-10', state: estado([INVESTIR_SEM_VALOR]) }, [['como_foi', 'nao'], ['nao_deu', 'manter']]],
      [{ agente: 'arkad', missao: 'm-nada', mes: '2026-10', state: {} }, []],
    ];
    for (const [c, pares] of casos) {
      const { roteiro, fim } = responder(c, pares);
      expect(fim.fim).toBe(true);
      const res = roteiro.resultado!(fim.ctx);
      const textos = [...fim.visitas.flatMap((v) => falasDoRoteiro.falas(v.passo, v.ctx)), res?.titulo ?? '', ...(res?.linhas ?? []), res?.rodape ?? '', res?.botao ?? ''].join(' ').toLowerCase();
      for (const proibida of ['aporte', 'despesa', 'fechar o mês', 'o combinado', 'inadimplência', 'undefined', 'null', 'nan']) expect(textos).not.toContain(proibida);
      for (const v of fim.visitas) expect(falasDoRoteiro.falas(v.passo, v.ctx).length).toBeLessThanOrEqual(3);
      if (res) {
        expect(res.linhas.length).toBeGreaterThanOrEqual(1);
        expect(res.linhas.length).toBeLessThanOrEqual(3);
        res.linhas.forEach((l, i) => expect(l.startsWith(`${i + 1}. `)).toBe(true));
        expect(res.botao).toBe('Confirmar');
        expect(res.titulo).toMatch(/^Check-in de (setembro|outubro)$/);
      }
    }
  });
});
