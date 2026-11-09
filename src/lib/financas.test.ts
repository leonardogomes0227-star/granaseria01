import { quantoPossoGastarHoje } from './financas';
import { describe, expect, it } from 'vitest';
import {
  aporteSugerido,
  coerencia,
  custoEssencial,
  diasRestantes,
  disponivelMes,
  divisaoDabasir,
  divisaoExtra,
  estouro,
  mesesRestantes,
  metaReserva,
  metodoPadrao,
  ordemDividas,
  parcelaPrice,
  patrimonioParaViverDeRenda,
  porDia,
  previsaoMes,
  progresso,
  projecaoInvestimento,
  saldoReal,
  simularQuitacao,
  sobraTeorica,
  taxaEmprestimo,
  type DividaCalc,
} from './financas';

describe('básicos da seção 4', () => {
  it('custo essencial soma as contas fixas', () => {
    expect(custoEssencial([{ valor: 1300 }, { valor: 140.5 }, { valor: 80 }])).toBe(1520.5);
    expect(custoEssencial([])).toBe(0);
    expect(custoEssencial([{ valor: -10 }, { valor: 50 }])).toBe(50);
  });

  it('meta da reserva = 6x o custo, arredondada pra cima na centena', () => {
    expect(metaReserva(2000)).toBe(12000);
    expect(metaReserva(1520.5)).toBe(9200); // 9123 → 9200
    expect(metaReserva(0)).toBe(0);
    expect(metaReserva(1_000_000)).toBe(6_000_000);
  });

  it('sobra teórica = renda - fixos - parcelas', () => {
    expect(sobraTeorica(4000, 2000, 300)).toBe(1700);
    expect(sobraTeorica(1000, 1500, 0)).toBe(-500);
  });

  it('aporte sugerido = 10% da renda; com dívida, 10% da sobra depois dos fixos', () => {
    expect(aporteSugerido(4000)).toBe(400);
    expect(aporteSugerido(4000, { temDivida: true, sobraDepoisDosFixos: 2000 })).toBe(200);
    expect(aporteSugerido(0)).toBe(0);
    expect(aporteSugerido(0.5)).toBe(0);
  });

  it('Dabasir: 70/20/10 do que sobra depois dos fixos', () => {
    expect(divisaoDabasir(4000, 2000)).toEqual({ sobra: 2000, viver: 1400, dividas: 400, guardar: 200 });
    expect(divisaoDabasir(1000, 1500)).toEqual({ sobra: 0, viver: 0, dividas: 0, guardar: 0 });
  });
});

describe('dívidas', () => {
  const cartao: DividaCalc = { id: 'c', nome: 'Cartão', saldo: 3000, parcela: 200, jurosMes: 12 };
  const emprestimo: DividaCalc = { id: 'e', nome: 'Empréstimo', saldo: 1000, parcela: 150, jurosMes: 4 };
  const loja: DividaCalc = { id: 'l', nome: 'Loja', saldo: 400, parcela: 100, jurosMes: null };

  it('ordem por juros: maior primeiro, sem juros no fim do menor pro maior', () => {
    expect(ordemDividas([loja, emprestimo, cartao], 'juros').map((d) => d.id)).toEqual(['c', 'e', 'l']);
  });

  it('ordem menor primeiro: pelo saldo', () => {
    expect(ordemDividas([cartao, emprestimo, loja], 'menor').map((d) => d.id)).toEqual(['l', 'e', 'c']);
  });

  it('método padrão: juros se alguém tem juros, senão menor', () => {
    expect(metodoPadrao([cartao, loja])).toBe('juros');
    expect(metodoPadrao([{ ...loja }, { ...loja, id: 'x', saldo: 900 }])).toBe('menor');
  });

  it('quitação sem juros rola a parcela de uma dívida quitada pra próxima', () => {
    const a: DividaCalc = { id: 'a', nome: 'A', saldo: 300, parcela: 100 };
    const b: DividaCalc = { id: 'b', nome: 'B', saldo: 600, parcela: 100 };
    const r = simularQuitacao([a, b], 200, 'menor');
    // mês 1: A 200, B 500 · mês 2: A 100, B 400 · mês 3: A 0, B 300 · mês 4: B 100 · mês 5: B 0
    expect(r.porDivida).toEqual([
      { id: 'a', mes: 3 },
      { id: 'b', mes: 5 },
    ]);
    expect(r.meses).toBe(5);
    expect(r.totalJuros).toBe(0);
    expect(r.travou).toBe(false);
  });

  it('valor menor que as parcelas usa a soma das parcelas', () => {
    const r = simularQuitacao([{ id: 'a', nome: 'A', saldo: 400, parcela: 100 }], 10, 'menor');
    expect(r.meses).toBe(4);
  });

  it('trava quando em um ano a dívida quase não cai', () => {
    const r = simularQuitacao([{ id: 'c', nome: 'Cartão', saldo: 3000, parcela: 200, jurosMes: 12 }, { id: 'l', nome: 'Loja', saldo: 500, parcela: 100 }], 400, 'juros');
    expect(r.travou).toBe(true);
    expect(r.meses).toBeNull();
  });

  it('trava quando o valor não cobre os juros', () => {
    const r = simularQuitacao([{ id: 'a', nome: 'A', saldo: 10000, parcela: 50, jurosMes: 10 }], 50, 'juros');
    expect(r.travou).toBe(true);
    expect(r.meses).toBeNull();
  });

  it('com juros, termina e conta os juros pagos', () => {
    const r = simularQuitacao([cartao, emprestimo, loja], 800, 'juros');
    expect(r.meses).not.toBeNull();
    expect(r.totalJuros).toBeGreaterThan(0);
    expect(r.porDivida.find((d) => d.id === 'c')?.mes).toBeLessThanOrEqual(r.meses ?? 0);
  });

  it('sem dívidas: zero meses', () => {
    expect(simularQuitacao([], 100, 'juros')).toEqual({ meses: 0, porDivida: [], totalJuros: 0, travou: false });
  });
});

describe('quanto posso gastar hoje', () => {
  it('dias restantes contam hoje', () => {
    expect(diasRestantes('2026-10-21')).toBe(11);
    expect(diasRestantes('2026-10-31')).toBe(1);
    expect(diasRestantes('2026-02-01')).toBe(28);
    expect(diasRestantes('2028-02-01')).toBe(29);
  });

  it('por dia nunca é negativo e arredonda pra baixo', () => {
    expect(porDia(1000, 11)).toBe(90);
    expect(porDia(-50, 10)).toBe(0);
    expect(porDia(0, 10)).toBe(0);
    expect(porDia(100, 0)).toBe(100);
  });

  it('disponível pela spec e o estado estourou', () => {
    const d = disponivelMes({ renda: 4000, contasFixasDoMes: 2000, aportesPlanejados: 400, parcelasDoMes: 300, gastosVariaveis: 1500 });
    expect(d).toBe(-200);
    expect(estouro(d)).toEqual({ estourou: true, passou: 200 });
    expect(estouro(10)).toEqual({ estourou: false, passou: 0 });
  });

  it('saldo real = a conta atual da Início e do Meu mês (número trava)', () => {
    // mesmo cenário do teste visual: entrou 4500, saíram 135, conta de luz paga 140, nada guardado
    const left = saldoReal({ entradas: 4500, saidas: 135, contasPagas: 140, guardado: 0 });
    expect(left).toBe(4225);
    // a Início faz floor(left / (último - hoje + 1)); em 20/10 são 12 dias
    expect(porDia(left, diasRestantes('2026-10-20'))).toBe(352);
  });
});

describe('metas e previsões', () => {
  it('meses restantes', () => {
    expect(mesesRestantes(12000, 1000, 400)).toBe(28);
    expect(mesesRestantes(12000, 12000, 400)).toBe(0);
    expect(mesesRestantes(12000, 1000, 0)).toBeNull();
  });

  it('previsão: 1 mês restante termina este mês', () => {
    expect(previsaoMes('2026-10', 1)).toBe('2026-10');
    expect(previsaoMes('2026-10', 28)).toBe('2029-01');
    expect(previsaoMes('2026-12', 2)).toBe('2027-01');
    expect(previsaoMes('2026-10', null)).toBeNull();
  });

  it('progresso de 0 a 100; meta zero = 0', () => {
    expect(progresso(0, 1000)).toBe(0);
    expect(progresso(500, 1000)).toBe(50);
    expect(progresso(2000, 1000)).toBe(100);
    expect(progresso(10, 0)).toBe(0);
  });
});

describe('coerência', () => {
  it('fixos maiores que a renda', () => {
    expect(coerencia({ renda: 1000, custo: 1200 }).fixosPassamDaRenda).toBe(true);
    expect(coerencia({ renda: 1000, custo: 800, parcelas: 300 }).fixosPassamDaRenda).toBe(true);
    expect(coerencia({ renda: 1000, custo: 800 }).fixosPassamDaRenda).toBe(false);
  });

  it('diferença só quando passa de R$ 100', () => {
    expect(coerencia({ renda: 4000, custo: 2000, sobraInformada: 1950 }).diferenca).toBeNull();
    expect(coerencia({ renda: 4000, custo: 2000, sobraInformada: 300 }).diferenca).toBe(1700);
  });
});

describe('Mathon, Sharru e Rodan', () => {
  it('taxa do empréstimo', () => {
    // R$ 1.000 em 12x de R$ 100 ≈ 2,92% ao mês
    expect(taxaEmprestimo(1000, 12, 100)).toBeCloseTo(2.92, 1);
    expect(taxaEmprestimo(1000, 10, 100)).toBe(0);
    expect(taxaEmprestimo(0, 10, 100)).toBeNull();
  });

  it('parcela Price', () => {
    expect(parcelaPrice(1000, 12, 0)).toBeCloseTo(83.33, 2);
    expect(parcelaPrice(1000, 12, 2.92)).toBeCloseTo(100, 0);
  });

  it('viver de renda a 0,5% ao mês', () => {
    expect(patrimonioParaViverDeRenda(3000)).toBe(600000);
  });

  it('projeção de investimento', () => {
    expect(projecaoInvestimento(0, 100, 12, 0)).toBe(1200);
    expect(projecaoInvestimento(0, 100, 12)).toBeGreaterThan(1200);
  });

  it('dinheiro extra soma o total', () => {
    for (const p of [
      { temDivida: true, reservaCompleta: false },
      { temDivida: true, reservaCompleta: true },
      { temDivida: false, reservaCompleta: false },
      { temDivida: false, reservaCompleta: true },
    ]) {
      const r = divisaoExtra(2999, p);
      expect(r.divida + r.reserva + r.investir + r.voce).toBe(2999);
    }
    expect(divisaoExtra(1000, { temDivida: false, reservaCompleta: true })).toEqual({ divida: 0, reserva: 0, investir: 900, voce: 100 });
  });
});

describe('número da Início', () => {
  const base = { hoje: '2026-10-21', entradasAnotadas: 4500, gastosAnotados: 135, guardadoAnotado: 0, contasDoMes: 0, contasPagas: 140, guardadoNoApp: 0, aportesPlanejados: 0, parcelasPlanejadas: 0 };
  it('sem renda declarada: o saldo real de sempre (número trava)', () => {
    const r = quantoPossoGastarHoje({ ...base, rendaDeclarada: 0 });
    expect(r).toMatchObject({ modo: 'real', disponivel: 4225, porDia: 384, estourou: false });
  });
  it('com renda declarada: reserva as contas do mês e o combinado', () => {
    const r = quantoPossoGastarHoje({ ...base, rendaDeclarada: 4000, contasDoMes: 2000, aportesPlanejados: 400, parcelasPlanejadas: 300, gastosAnotados: 800 });
    // renda vale o maior (4500 anotado) → 4500 - 2000 - 400 - 300 - 800 = 1000 → 11 dias
    expect(r).toMatchObject({ modo: 'plano', disponivel: 1000, porDia: 90, estourou: false });
  });
  it('estourou mostra quanto passou', () => {
    const r = quantoPossoGastarHoje({ ...base, entradasAnotadas: 0, rendaDeclarada: 3000, contasDoMes: 2000, aportesPlanejados: 300, gastosAnotados: 900 });
    expect(r).toMatchObject({ estourou: true, passou: 200, porDia: 0 });
  });
  it('o que já foi guardado além do planejado também sai', () => {
    const r = quantoPossoGastarHoje({ ...base, rendaDeclarada: 4500, aportesPlanejados: 300, guardadoNoApp: 500, gastosAnotados: 0 });
    expect(r.disponivel).toBe(4000);
  });
});

