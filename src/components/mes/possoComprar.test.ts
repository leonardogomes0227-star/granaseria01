import { describe, expect, it } from 'vitest';
import { quantoPossoGastarHoje } from '../../lib/financas';
import type { Bill } from '../../bills';
import type { Missao } from '../../missoes';
import { dataCurta, falasDaResposta, montarConta, possoComprar } from './possoComprar';

const HOJE = '2026-10-21'; // faltam 11 dias (contando hoje)
// o real formatado vem com espaço fino (NBSP) depois do R$
const falas = (...a: Parameters<typeof falasDaResposta>) => falasDaResposta(...a).map((s) => s.replace(/\u00a0/g, ' '));

const conta = (disponivel: number) => ({ modo: 'plano' as const, disponivel, porDia: 0, estourou: disponivel < 0, passou: disponivel < 0 ? -disponivel : 0 });

const missao = (tipo: Missao['tipo'], valorMensal: number, status: Missao['status'] = 'ativa'): Missao => ({
  id: `m-${tipo}`,
  agente: 'arkad',
  titulo: tipo,
  tipo,
  metaValor: 1000,
  valorInicial: 0,
  valorMensal,
  dataInicio: '2026-10-01',
  dataPrevista: null,
  previsaoOriginal: null,
  prioridade: 1,
  status,
  passos: [],
  registros: [],
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
});

describe('a conta do mês é a mesma da Início', () => {
  it('monta a entrada do quantoPossoGastarHoje igual ao card', () => {
    const bills: Bill[] = [
      { id: '1', name: 'Aluguel', amount: 1300, dueDay: 25, startMonth: '2026-10', payments: [] },
      { id: '2', name: 'Luz', amount: 140, dueDay: 22, startMonth: '2026-10', payments: [{ month: '2026-10', paidOn: '2026-10-20', amount: 140 }] },
    ];
    const e = montarConta({
      hoje: HOJE,
      renda: 4000,
      entradas: 4000,
      saidas: [
        { amount: 90, category: 'Alimentação' },
        { amount: 42.5, category: 'Alimentação' },
        { amount: 100, category: 'Guardado' },
      ],
      bills,
      saved: [{ on: '2026-10-05', amount: 50 }, { on: '2026-09-30', amount: 70 }],
      missoes: [missao('divida', 512), missao('reserva', 256), missao('investir', 44, 'pausada')],
    });
    expect(e).toEqual({
      hoje: HOJE,
      rendaDeclarada: 4000,
      entradasAnotadas: 4000,
      gastosAnotados: 132.5,
      guardadoAnotado: 100,
      contasDoMes: 1440,
      contasPagas: 140,
      guardadoNoApp: 50,
      aportesPlanejados: 256,
      parcelasPlanejadas: 512,
    });
    // 4000 - 1440 - 256 - 512 - 132,5 = 1659,5 → 150 por dia nos 11 dias que faltam (o número da Início)
    expect(quantoPossoGastarHoje(e)).toMatchObject({ modo: 'plano', disponivel: 1659.5, porDia: 150 });
  });
});

describe('posso comprar isso?', () => {
  it('à vista que cabe: quanto sobra por dia depois', () => {
    const v = possoComprar(conta(1659.5), { preco: 450, parcelas: 1 }, { hoje: HOJE, gastosDoMes: 132.5 });
    expect(v).toEqual({ tipo: 'cabe', custoAgora: 450, parcela: null, sobraDepois: 1209.5, porDiaDepois: 109 });
    expect(falas(v, HOJE)).toEqual(['Cabe: sobram R$ 109 por dia depois.']);
  });

  it('parcelado: só a parcela deste mês pesa agora', () => {
    const v = possoComprar(conta(300), { preco: 1200, parcelas: 10 }, { hoje: HOJE, gastosDoMes: 0 });
    expect(v).toMatchObject({ tipo: 'cabe', custoAgora: 120, parcela: 120, sobraDepois: 180, porDiaDepois: 16 });
    expect(falas(v, HOJE)).toEqual([
      'Cabe: sobram R$ 16 por dia depois.',
      'São parcelas de R$ 120,00. As próximas entram nos meses que vêm.',
      'Fica apertado até o fim do mês. Se puder esperar, melhor.',
    ]);
  });

  it('não cabe: quanto guardar por semana e quando dá', () => {
    // 2.000 em 8 semanas = 250 por semana; o dinheiro de gastar do mês (500 + 3.500) deixa até 230 por semana
    const v = possoComprar(conta(500), { preco: 2000, parcelas: 1 }, { hoje: HOJE, gastosDoMes: 3500 });
    expect(v).toEqual({ tipo: 'nao-cabe', custoAgora: 2000, parcela: null, porSemana: 240, semanas: 9, quando: '2026-12-23' });
    expect(falas(v, HOJE)).toEqual(['Não cabe este mês. Se guardar R$ 240 por semana, dá em 23 dez.']);
  });

  it('não cabe parcelado: sugere juntar e pagar à vista', () => {
    const v = possoComprar(conta(50), { preco: 600, parcelas: 3 }, { hoje: HOJE, gastosDoMes: 0 });
    expect(v).toMatchObject({ tipo: 'nao-cabe', custoAgora: 200, parcela: 200, porSemana: 10, semanas: 60 });
    expect(falasDaResposta(v, HOJE)[1]).toBe('Juntando antes, você paga à vista e foge dos juros.');
  });

  it('estourou: nada cabe, e a sugestão continua de pé', () => {
    const v = possoComprar(conta(-200), { preco: 80, parcelas: 1 }, { hoje: HOJE, gastosDoMes: 2000 });
    expect(v).toMatchObject({ tipo: 'nao-cabe', porSemana: 10, semanas: 8, quando: '2026-12-16' });
  });

  it('valores pequenos e enormes', () => {
    expect(possoComprar(conta(1000), { preco: 0.5, parcelas: 1 }, { hoje: HOJE, gastosDoMes: 0 })).toMatchObject({ tipo: 'cabe', sobraDepois: 999.5 });
    const caro = possoComprar(conta(1000), { preco: 1_000_000, parcelas: 1 }, { hoje: HOJE, gastosDoMes: 3000 });
    expect(caro).toMatchObject({ tipo: 'nao-cabe', porSemana: 240 });
    // muito longe: o ano inteiro na data, e o Nomasir sugere outro caminho
    expect(falas(caro, HOJE)).toEqual(['Não cabe este mês. Se guardar R$ 240 por semana, dá em set/2106.', 'É bastante tempo. Vale procurar uma opção mais em conta.']);
    // preço menor que R$ 10 e sem dinheiro no mês: guarda o preço numa semana
    expect(possoComprar(conta(-10), { preco: 6, parcelas: 1 }, { hoje: HOJE, gastosDoMes: 0 })).toMatchObject({ porSemana: 6, semanas: 1 });
  });

  it('sem saber o que entrou, o Nomasir pede pra anotar', () => {
    const v = possoComprar(conta(0), { preco: 100, parcelas: 1 }, { hoje: HOJE, gastosDoMes: 0, semDados: true });
    expect(v).toEqual({ tipo: 'sem-dados' });
    expect(falas(v, HOJE)[0]).toMatch(/o que entrou/);
  });

  it('datas curtas: "22 dez" perto, "jul/28" longe', () => {
    expect(dataCurta('2026-12-22', HOJE)).toBe('22 dez');
    expect(dataCurta('2028-07-10', HOJE)).toBe('jul/28');
    expect(dataCurta('2040-07-10', HOJE)).toBe('jul/2040');
  });
});
