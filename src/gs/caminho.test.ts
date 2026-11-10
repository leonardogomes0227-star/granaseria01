import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL, type Divida, type Estado, type GastoFixo } from './tipos';
import { calcularCaminho, destino, fraseDoMarco, marcosAComemorar, marcosVisiveis, simularImpacto, type MarcoId } from './caminho';
import { passoAtual, passosDoMes, resumoDosPassos } from './passos';
import { migrar } from './migracao';
import { simular, paraSim } from './dividas';

const HOJE = '2026-11-10';
const MES = '2026-11';
const base = (p: Partial<Estado> = {}, cfg: Partial<Estado['config']> = {}): Estado => {
  const e = ESTADO_INICIAL();
  return { ...e, ...p, config: { ...e.config, renda: 4000, onboardingFeito: true, ...cfg } };
};
const conta = (id: string, nome: string, valor: number, dia: number, extra: Partial<GastoFixo> = {}): GastoFixo => ({ id, nome, valor, diaVencimento: dia, categoria: 'Outros', pagamentos: {}, criadaEm: '2026-08-01', ...extra });
const pagas = (meses: string[], valor: number) => Object.fromEntries(meses.map((m) => [m, { valorPago: valor, pagoEm: `${m}-05` }]));
const divida = (id: string, nome: string, saldo: number, juros: number, parcela: number): Divida => ({ id, nome, saldo, jurosMensal: juros, parcelaMinima: parcela, pagamentos: [], cadastradaEm: HOJE });
const gastos = (mes: string, valor: number) => ({ id: `l-${mes}`, descricao: 'mercado', valor, data: `${mes}-03`, categoria: 'Mercado' });
const marco = (e: Estado, id: MarcoId, hoje = HOJE) => calcularCaminho(e, hoje).find((m) => m.id === id)!;

describe('calcularCaminho', () => {
  it('sem dados: nada é inventado; o primeiro marco pede os dados', () => {
    const ms = calcularCaminho(base({}, { renda: 0 }), HOJE);
    expect(ms[0].status).toBe('atual');
    expect(ms[0].dataPrevista).toBeNull();
    expect(ms[0].pendencia).toBeTruthy();
    expect(ms.every((m) => m.status !== 'feito')).toBe(true);
  });

  it('só renda: em dia feito, marcos de dívida somem e a reserva pede as contas', () => {
    const ms = calcularCaminho(base(), HOJE);
    expect(marcosVisiveis(ms).map((m) => m.id)).toEqual(['em-dia', 'reserva', 'objetivo', 'investir', 'renda']);
    expect(ms.find((m) => m.id === 'em-dia')!.status).toBe('feito');
    expect(destino(ms)!.id).toBe('reserva');
    expect(destino(ms)!.dataPrevista).toBeNull();
  });

  it('com atraso: a data vem do plano de atrasos e as premissas aparecem', () => {
    const e = base({ gastosFixos: [conta('a', 'Aluguel', 1000, 5, { pagamentos: pagas(['2026-08', '2026-09'], 1000) })], lancamentos: [gastos('2026-10', 1500), gastos(MES, 500)], atrasos: { porMes: 600, separado: 0, saidas: {}, ignorados: [] } });
    const m = marco(e, 'em-dia');
    expect(m.status).toBe('atual');
    expect(m.faltaValor).toBeGreaterThan(2000); // outubro e novembro, com multa
    expect(m.dataPrevista).toBe('2026-12');
    expect(m.premissas.join(' ')).toContain('R$ 600');
    // a reserva só começa a contar depois de pôr em dia
    expect(marco(e, 'reserva').dataPrevista! > m.dataPrevista!).toBe(true);
  });

  it('com dívidas: datas iguais às da simulação, nos dois métodos', () => {
    const dividas = [divida('c', 'Cartão', 3000, 12, 300), divida('f', 'Financiamento', 8000, 1, 400)];
    for (const estrategia of ['bola-de-neve', 'maior-juro'] as const) {
      const e = base({ dividas, planoDividas: { estrategia, pagamentoMensal: 1200, criadoEm: HOJE } });
      const sim = simular(paraSim(dividas), 1200, estrategia, MES);
      expect(marco(e, 'dividas').dataPrevista).toBe(sim.dataFinal);
      expect(marco(e, 'dividas-caras').faltaMeses).toBe(sim.quitaEm.c);
      expect(marco(e, 'dividas-caras').faltaValor).toBe(3000);
      expect(destino(calcularCaminho(e, HOJE))!.id).toBe('dividas-caras');
    }
  });

  it('dívida só barata: o marco das caras não se aplica', () => {
    const e = base({ dividas: [divida('f', 'Carro', 5000, 0.9, 500)] });
    expect(marco(e, 'dividas-caras').status).toBe('nao-se-aplica');
    expect(marco(e, 'dividas').status).toBe('atual');
  });

  it('pagamento que não cobre os juros: sem data e com o mínimo necessário', () => {
    const e = base({ dividas: [divida('c', 'Cartão', 10000, 12, 100)], planoDividas: { estrategia: 'bola-de-neve', pagamentoMensal: 100, criadoEm: HOJE } });
    const m = marco(e, 'dividas');
    expect(m.dataPrevista).toBeNull();
    expect(m.pendencia).toContain('pelo menos');
  });

  it('reserva: falta ÷ valor por mês; pronta quando o guardado cobre a meta', () => {
    const fixos = [conta('a', 'Aluguel', 1000, 5, { pagamentos: pagas(['2026-08', '2026-09', '2026-10', MES], 1000) })];
    const e = base({ gastosFixos: fixos, lancamentos: [gastos('2026-10', 1000)] }, { reservaMeses: 3 }); // meta 3 × 2000 = 6000; guarda 400/mês
    const m = marco(e, 'reserva');
    expect(m.faltaValor).toBe(6000);
    expect(m.faltaMeses).toBe(15);
    expect(m.dataPrevista).toBe('2028-02');
    const pronta = { ...e, aportes: [{ id: 'a', data: '2026-10-01', valor: 6000, origem: 'manual' as const }] };
    expect(marco(pronta, 'reserva').status).toBe('feito');
    expect(destino(calcularCaminho(pronta, HOJE))!.id).toBe('objetivo');
  });

  it('meta com prazo: a data é o prazo e o valor por mês vem do plano da meta', () => {
    const e = base({ metas: [{ id: 'm', nome: 'Viagem', alvo: 3000, criadaEm: HOJE, prazo: '2027-05-10', guardados: [] }] });
    const m = marco(e, 'objetivo');
    expect(m.titulo).toBe('Viagem');
    expect(m.dataPrevista).toBe('2027-05');
    expect(m.porMes).toBe(500);
    expect(fraseDoMarco(m)).toEqual({ antes: 'Viagem em', data: 'maio de 2027' });
  });

  it('último dia do mês: não quebra e não devolve data no passado', () => {
    const e = base({ dividas: [divida('c', 'Cartão', 900, 10, 300)], planoDividas: { estrategia: 'bola-de-neve', pagamentoMensal: 500, criadoEm: '2026-11-30' } });
    for (const m of calcularCaminho(e, '2026-11-30')) if (m.dataPrevista) expect(m.dataPrevista >= '2026-11').toBe(true);
    expect(marco(e, 'dividas', '2026-11-30').dataPrevista).toBe('2027-02'); // 3 meses: os juros de 10% deixam um resto no terceiro
  });
});

describe('simularImpacto', () => {
  const comDivida = base({ dividas: [divida('c', 'Cartão', 6000, 8, 300)], planoDividas: { estrategia: 'bola-de-neve', pagamentoMensal: 900, criadoEm: HOJE } });

  it('compra atrasa o destino', () => {
    const i = simularImpacto(comDivida, HOJE, { tipo: 'compra', valor: 1800 })!;
    expect(i.marcoId).toBe('dividas-caras');
    expect(i.meses).toBeGreaterThan(0);
    expect(i.dataDepois! > i.dataAntes).toBe(true);
    expect(i.frase).toContain('atrasa');
  });

  it('extra recebido e corte mensal adiantam', () => {
    const extra = simularImpacto(comDivida, HOJE, { tipo: 'extra', valor: 2000 })!;
    expect(extra.meses).toBeLessThan(0);
    expect(extra.frase).toContain('antes');
    expect(simularImpacto(comDivida, HOJE, { tipo: 'corte', porMes: 300 })!.meses).toBeLessThan(0);
  });

  it('parcela nova pesa todo mês e atrasa', () => {
    expect(simularImpacto(comDivida, HOJE, { tipo: 'parcela', valor: 200, meses: 24 })!.meses).toBeGreaterThan(0);
    expect(simularImpacto(comDivida, HOJE, { tipo: 'compra', valor: 1200, parcelas: 3 })!.meses).toBeGreaterThan(0);
  });

  it('extra que quita tudo: o destino chega agora', () => {
    const i = simularImpacto(comDivida, HOJE, { tipo: 'extra', valor: 6000 })!;
    expect(i.dataDepois).toBe(MES);
  });

  it('sem data para comparar: não inventa', () => {
    expect(simularImpacto(base({}, { renda: 0 }), HOJE, { tipo: 'compra', valor: 100 })).toBeNull();
  });

  it('na reserva: compra atrasa e extra adianta', () => {
    const e = base({ gastosFixos: [conta('a', 'Aluguel', 2000, 5, { pagamentos: pagas(['2026-08', '2026-09', '2026-10', MES], 2000) })] }, { reservaMeses: 3 });
    expect(simularImpacto(e, HOJE, { tipo: 'compra', valor: 800 })!.meses).toBe(2);
    expect(simularImpacto(e, HOJE, { tipo: 'extra', valor: 800 })!.meses).toBe(-2);
  });
});

describe('passos do mês', () => {
  it('ordem: atrasada, vence logo, guardar segurado, limite, fatura, dívida', () => {
    const e = base({
      gastosFixos: [conta('a', 'Aluguel', 1000, 5, { pagamentos: pagas(['2026-08', '2026-09'], 1000) }), conta('i', 'Internet', 100, 12, { pagamentos: pagas(['2026-08', '2026-09', '2026-10'], 100) })],
      lancamentos: [gastos(MES, 200)],
      cartao: { limite: 2000, usado: 500, fechaDia: 20, venceDia: 27 },
      dividas: [divida('d', 'Loja', 1000, 3, 200)],
      planoDividas: { estrategia: 'bola-de-neve', pagamentoMensal: 200, criadoEm: HOJE },
    });
    const ps = passosDoMes(e, HOJE);
    expect(ps.map((p) => p.origem)).toEqual(['atraso', 'atraso', 'conta', 'guardar', 'limite', 'fatura', 'divida']);
    expect(passoAtual(ps)!.titulo).toContain('Aluguel');
    expect(ps.find((p) => p.origem === 'guardar')!.status).toBe('segurado');
    expect(new Set(ps.map((p) => p.id)).size).toBe(ps.length);
  });

  it('sem atraso: guardar entra, vira feito ao guardar, e o limite é contínuo', () => {
    const e = base();
    const ps = passosDoMes(e, HOJE);
    expect(ps.find((p) => p.origem === 'guardar')!.acao.valor).toBe(400);
    expect(ps.find((p) => p.origem === 'limite')!.status).toBe('continuo');
    const depois = passosDoMes({ ...e, aportes: [{ id: 'a', data: HOJE, valor: 400, origem: 'reserva' }] }, HOJE);
    expect(depois.find((p) => p.origem === 'guardar')!.status).toBe('feito');
  });

  it('ocultar esconde só neste mês; passos manuais entram e contam no resumo', () => {
    const e = base({ caminho: { passos: [{ id: 'p1', titulo: 'Cancelar o streaming', detalhe: 'R$ 40 por mês', origem: 'cortar', criadoEm: HOJE }], ocultos: { [`guardar:${MES}`]: MES }, marcosFeitos: [], etapas: {} } });
    const ps = passosDoMes(e, HOJE);
    expect(ps.some((p) => p.origem === 'guardar')).toBe(false);
    expect(passosDoMes(e, HOJE, { comOcultos: true }).find((p) => p.origem === 'guardar')!.status).toBe('oculto');
    expect(ps.find((p) => p.manual)!.titulo).toBe('Cancelar o streaming');
    expect(passosDoMes(e, '2026-12-02').some((p) => p.origem === 'guardar')).toBe(true);
    expect(resumoDosPassos(ps).total).toBeGreaterThan(0);
  });
});

describe('estado do caminho', () => {
  it('migração aditiva: estado antigo ganha o campo sem perder nada; lixo é descartado', () => {
    const antigo = { config: { renda: 3000 }, dividas: [{ id: 'd', nome: 'x', saldo: 10, jurosMensal: 1, parcelaMinima: 5 }] };
    const e = migrar(antigo);
    expect(e.caminho).toEqual({ passos: [], ocultos: {}, marcosFeitos: [], etapas: {}, ultimaVisita: undefined, ultimoPasso: undefined, voltaDispensada: undefined, metodoQuitacao: undefined });
    expect(e.dividas).toHaveLength(1);
    const sujo = migrar({ caminho: { passos: [{ id: 'a', titulo: 'Ok', rota: 'http://x' }, { titulo: 'sem id' }], ocultos: { a: 'ontem', b: '2026-11' }, ultimaVisita: 'nada', etapas: { atrasos: 2, x: 'y' }, marcosFeitos: ['em-dia', 3] } });
    expect(sujo.caminho.passos).toHaveLength(1);
    expect(sujo.caminho.passos[0].rota).toBeUndefined();
    expect(sujo.caminho.ocultos).toEqual({ b: '2026-11' });
    expect(sujo.caminho.ultimaVisita).toBeUndefined();
    expect(sujo.caminho.etapas).toEqual({ atrasos: 2 });
    expect(sujo.caminho.marcosFeitos).toEqual(['em-dia']);
    expect(migrar(JSON.parse(JSON.stringify(sujo))).caminho).toEqual(sujo.caminho);
  });

  it('festa: só para marco pronto e ainda não comemorado', () => {
    const e = base({ dividas: [{ ...divida('c', 'Cartão', 500, 10, 100), pagamentos: [{ data: HOJE, valor: 500 }] }] });
    const ms = calcularCaminho(e, HOJE);
    expect(marcosAComemorar(e, ms).map((m) => m.id)).toEqual(['dividas-caras', 'dividas']);
    expect(marcosAComemorar({ ...e, caminho: { ...e.caminho, marcosFeitos: ['dividas-caras', 'dividas'] } }, ms)).toEqual([]);
  });
});

describe('bem-vindo de volta', () => {
  it('só depois de 24h; conta o que venceu, o que veio do WhatsApp e os dias sem anotar', async () => {
    const { resumoDaVolta } = await import('./voltou');
    const agora = new Date('2026-11-10T15:00:00-03:00');
    const e = base({
      gastosFixos: [conta('i', 'Internet', 100, 8, { pagamentos: pagas(['2026-10'], 100) })],
      receitas: [{ id: 'r', descricao: 'Salário', valor: 3000, data: '2026-11-09', tipo: 'salario', serverId: 7 }],
    });
    const com = (ultimaVisita?: string) => ({ ...e, caminho: { ...e.caminho, ultimaVisita } });
    expect(resumoDaVolta(com(undefined), agora)).toBeNull();
    expect(resumoDaVolta(com('2026-11-10T09:00:00-03:00'), agora)).toBeNull();
    const v = resumoDaVolta(com('2026-11-05T10:00:00-03:00'), agora)!;
    expect(v.desde).toBe('quinta');
    expect(v.mudancas.join(' · ')).toBe('Internet venceu · caiu R$ 3.000 de salário pelo WhatsApp · você ficou 5 dias sem anotar');
  });
});
