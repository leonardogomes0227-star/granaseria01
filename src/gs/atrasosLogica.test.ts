import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ESTADO_INICIAL, type Estado } from './tipos';
import { atrasosAbertos, deOndeSai, encargos, folgaMensal, mensagemAtraso, mesesAtras, nivelDe, planoDeRecuperacao, situacaoAtrasos } from './atrasosLogica';
import { livreParaGastar } from './selectores';

// Exemplo da vida real: em outubro não deu pra pagar a parcela da casa nem a da moto.
const base = (): Estado => {
  const e = ESTADO_INICIAL();
  e.config.renda = 4000;
  e.gastosFixos = [
    { id: 'casa', nome: 'Parcela da casa', valor: 1200, diaVencimento: 10, categoria: 'Financiamento', pagamentos: { '2026-09': { valorPago: 1200, pagoEm: '2026-09-10' } }, criadaEm: '2026-09-01' },
    { id: 'moto', nome: 'Moto', valor: 600, diaVencimento: 15, categoria: 'Carro', pagamentos: { '2026-09': { valorPago: 600, pagoEm: '2026-09-15' } }, criadaEm: '2026-09-01' },
    { id: 'luz', nome: 'Luz', valor: 150, diaVencimento: 20, categoria: 'Luz', pagamentos: { '2026-09': { valorPago: 150, pagoEm: '2026-09-20' }, '2026-10': { valorPago: 150, pagoEm: '2026-10-20' } }, criadaEm: '2026-09-01' },
  ];
  return e;
};

describe('o que ficou pra trás', () => {
  it('acha as parcelas de outubro sem baixa, casa primeiro, com multa e juros estimados', () => {
    const r = atrasosAbertos(base(), '2026-11-05');
    expect(r.map((a) => a.chave)).toEqual(['gf:casa:2026-10', 'gf:moto:2026-10']);
    expect(r[0].dias).toBe(26);
    expect(r[0].encargos).toBe(34.4); // 2% + 1% x 26/30
    expect(r[0].total).toBe(1234.4);
  });
  it('a conta deste mês que ainda não venceu não é atraso; a que venceu é', () => {
    expect(atrasosAbertos(base(), '2026-11-10').some((a) => a.mes === '2026-11')).toBe(false);
    expect(atrasosAbertos(base(), '2026-11-11').map((a) => a.chave)).toContain('gf:casa:2026-11');
  });
  it('não inventa atraso antes da conta existir', () => {
    const e = base();
    e.gastosFixos = [{ id: 'nova', nome: 'Internet', valor: 100, diaVencimento: 5, categoria: 'Internet', pagamentos: {}, criadaEm: '2026-11-10' }]; // cadastrou depois do vencimento do mês
    expect(atrasosAbertos(e, '2026-11-20')).toEqual([]);
  });
  it('conta antiga sem data de cadastro e sem pagamento: só olha o mês atual', () => {
    const e = base();
    e.gastosFixos = [{ id: 'x', nome: 'Água', valor: 80, diaVencimento: 5, categoria: 'Água', pagamentos: {} }];
    expect(atrasosAbertos(e, '2026-11-20').map((a) => a.mes)).toEqual(['2026-11']);
  });
  it('"não devo essa" tira da lista', () => {
    const e = base();
    e.atrasos = { separado: 0, saidas: {}, ignorados: ['gf:moto:2026-10'] };
    expect(atrasosAbertos(e, '2026-11-05').map((a) => a.refId)).toEqual(['casa']);
  });
  it('parcela de dívida: o que foi pago cobre a mais antiga primeiro', () => {
    const e = ESTADO_INICIAL();
    e.dividas = [{ id: 'fin', nome: 'Financiamento da moto', saldo: 10000, jurosMensal: 2, parcelaMinima: 500, venceDia: 10, cadastradaEm: '2026-08-01', tipo: 'parcelada', pagamentos: [{ data: '2026-08-10', valor: 500 }, { data: '2026-09-10', valor: 200 }] }];
    const r = atrasosAbertos(e, '2026-11-05');
    expect(r.map((a) => [a.mes, a.valor])).toEqual([['2026-09', 300], ['2026-10', 500]]);
    expect(r[0].nivel).toBe(3);
  });
  it('cartão rotativo não tem parcela fixa: fica de fora', () => {
    const e = ESTADO_INICIAL();
    e.dividas = [{ id: 'c', nome: 'Cartão', saldo: 3000, jurosMensal: 12, parcelaMinima: 300, venceDia: 10, cadastradaEm: '2026-08-01', tipo: 'rotativa', pagamentos: [] }];
    expect(atrasosAbertos(e, '2026-11-05')).toEqual([]);
  });
});

describe('o que pagar primeiro', () => {
  it('moradia, luz e água, financiamento, outras, cartão', () => {
    expect(nivelDe('Aluguel')).toBe(1);
    expect(nivelDe('Financiamento da casa', 'Financiamento')).toBe(1);
    expect(nivelDe('Conta de luz')).toBe(2);
    expect(nivelDe('Moto', 'Outros')).toBe(3);
    expect(nivelDe('Academia')).toBe(4);
    expect(nivelDe('Empréstimo do banco')).toBe(5);
  });
  it('encargos: sem atraso, nada', () => {
    expect(encargos(100, 0)).toBe(0);
    expect(encargos(100, 30)).toBe(3);
  });
});

describe('plano pra sair do atraso', () => {
  it('com R$ 500 por mês: separa, paga a casa, depois a moto', () => {
    const at = atrasosAbertos(base(), '2026-11-05');
    const p = planoDeRecuperacao(at, { porMes: 500, separado: 0, jaSaiuNoMes: 0, hoje: '2026-11-05' });
    expect(p.passos.map((x) => x.pagar.map((y) => y.chave))).toEqual([[], [], ['gf:casa:2026-10'], ['gf:moto:2026-10']]);
    expect(p.passos[2].pagar[0].valor).toBe(1258.4); // a multa e os juros crescem enquanto espera
    expect(p.emDiaEm).toBe('2027-02');
    expect(p.meses).toBe(4);
  });
  it('luz atrasada entra assim que couber, mesmo com a casa esperando', () => {
    const e = base();
    e.gastosFixos[2].pagamentos = { '2026-09': { valorPago: 150, pagoEm: '2026-09-20' } };
    const at = atrasosAbertos(e, '2026-11-05');
    const p = planoDeRecuperacao(at, { porMes: 300, separado: 0, jaSaiuNoMes: 0, hoje: '2026-11-05' });
    expect(p.passos[0].pagar.map((x) => x.nome)).toEqual(['Luz']);
  });
  it('a moto não passa na frente da casa', () => {
    const at = atrasosAbertos(base(), '2026-11-05');
    const p = planoDeRecuperacao(at, { porMes: 700, separado: 0, jaSaiuNoMes: 0, hoje: '2026-11-05' });
    expect(p.passos[0].pagar).toEqual([]); // 700 paga a moto, mas a casa vem antes
    expect(p.passos[1].pagar.map((x) => x.nome)).toEqual(['Parcela da casa']);
  });
  it('o que já foi separado conta, e o que já saiu no mês não entra de novo', () => {
    const at = atrasosAbertos(base(), '2026-11-05');
    const p = planoDeRecuperacao(at, { porMes: 500, separado: 1000, jaSaiuNoMes: 500, hoje: '2026-11-05' });
    expect(p.passos[0].entra).toBe(0);
    expect(p.passos[0].guardado).toBe(1000);
    expect(p.passos[1].pagar.map((x) => x.nome)).toEqual(['Parcela da casa']);
  });
  it('sem sobra: não fica em dia sozinho', () => {
    const at = atrasosAbertos(base(), '2026-11-05');
    const p = planoDeRecuperacao(at, { porMes: 0, separado: 0, jaSaiuNoMes: 0, hoje: '2026-11-05' });
    expect(p.emDiaEm).toBeNull();
  });
  it('sem atraso: em dia já', () => {
    expect(planoDeRecuperacao([], { porMes: 100, separado: 0, jaSaiuNoMes: 0, hoje: '2026-11-05' })).toEqual({ passos: [], emDiaEm: '2026-11', meses: 0 });
  });
});

describe('quanto sobra e de onde sai', () => {
  it('folga = renda − gastos − parcelas das dívidas que não são conta fixa', () => {
    const e = base();
    e.dividas = [
      { id: 'd', nome: 'Empréstimo', saldo: 2000, jurosMensal: 3, parcelaMinima: 200, pagamentos: [] },
      { id: 'm', nome: 'Moto', saldo: 9000, jurosMensal: 2, parcelaMinima: 600, pagamentos: [] }, // já está nas contas fixas
    ];
    const f = folgaMensal(e, '2026-11');
    expect(f.parcelas).toBe(200);
    expect(f.folga).toBe(4000 - 1950 - 200);
  });
  it('pagar atraso antigo usa primeiro o separado; a conta deste mês é orçamento normal', () => {
    expect(deOndeSai(1234, 1000, '2026-10', '2026-11')).toEqual({ doSeparado: 1000, doMes: 234 });
    expect(deOndeSai(1234, 0, '2026-11', '2026-11')).toEqual({ doSeparado: 0, doMes: 0 });
  });
  it('o que saiu pro atraso desce do "pode gastar"', () => {
    const e = base();
    const antes = livreParaGastar(e, '2026-11');
    e.atrasos = { separado: 300, saidas: { '2026-11': 300 }, ignorados: [] };
    expect(livreParaGastar(e, '2026-11')).toBe(antes - 300);
  });
  it('situação: sugere a folga arredondada e monta o plano', () => {
    const s = situacaoAtrasos(base(), '2026-11-05');
    expect(s.anteriores).toHaveLength(2);
    expect(s.porMesSugerido).toBe(2050);
    expect(s.plano.passos[0].pagar.map((x) => x.nome)).toEqual(['Parcela da casa', 'Moto']);
  });
});

describe('mensagem pra quem você deve', () => {
  it('pedir pra jogar a parcela pro fim do contrato', () => {
    expect(mensagemAtraso({ nome: 'Leo', credor: 'Banco X', valor: 1234.4, meses: 1, pedido: 'fim' })).toBe(
      'Olá, tudo bem? Meu nome é Leo. Estou com uma parcela atrasada de Banco X (R$ 1.234,40) e quero colocar em dia. Consigo pagar as próximas parcelas normalmente. Vocês podem passar a parcela atrasada pro final do contrato? Podem me mandar a proposta por escrito? Obrigado.'
    );
  });
});

describe('ações', () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
    vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} });
  });
  it('separar, pagar com o separado e desfazer', async () => {
    const { _resetarMemoria, substituir, getEstado } = await import('./store');
    const { pagarAtraso, separarParaAtraso } = await import('./acoes');
    _resetarMemoria();
    substituir(base());
    separarParaAtraso(1000, '2026-11');
    const [casa] = atrasosAbertos(getEstado(), '2026-11-05');
    const d = pagarAtraso(casa, 1234.4, '2026-11-05')!;
    expect(getEstado().gastosFixos[0].pagamentos['2026-10'].valorPago).toBe(1234.4);
    expect(getEstado().atrasos).toMatchObject({ separado: 0, saidas: { '2026-11': 1234.4 } });
    d.desfazer();
    expect(getEstado().gastosFixos[0].pagamentos['2026-10']).toBeUndefined();
    expect(getEstado().atrasos).toMatchObject({ separado: 1000, saidas: { '2026-11': 1000 } });
  });
});

describe('quem começa a usar o app já atrasado', () => {
  // cadastrou a casa e a moto no dia 5 de dezembro; as de novembro já estavam atrasadas
  const novo = (): Estado => {
    const e = ESTADO_INICIAL();
    e.config.renda = 3500;
    e.gastosFixos = [
      { id: 'casa', nome: 'Parcela da casa', valor: 1200, diaVencimento: 10, categoria: 'Financiamento', pagamentos: {}, criadaEm: '2026-12-05' },
      { id: 'moto', nome: 'Moto', valor: 600, diaVencimento: 15, categoria: 'Carro', pagamentos: {}, criadaEm: '2026-12-05' },
    ];
    return e;
  };
  it('sem anotar, o app não tem como saber', () => {
    expect(atrasosAbertos(novo(), '2026-12-05')).toEqual([]);
  });
  it('anotado à mão entra na lista, na ordem, e não duplica com a conta fixa', () => {
    const e = novo();
    e.atrasos = { separado: 0, saidas: {}, ignorados: [], manuais: [
      { id: 'a1', nome: 'Moto', valor: 600, mes: '2026-11', vencimento: '2026-11-15', gastoId: 'moto' },
      { id: 'a2', nome: 'Parcela da casa', valor: 1200, mes: '2026-11', vencimento: '2026-11-10', gastoId: 'casa' },
    ] };
    const r = atrasosAbertos(e, '2026-12-11'); // a casa de dezembro também venceu
    expect(r.map((a) => a.chave)).toEqual(['mn:a2', 'gf:casa:2026-12', 'mn:a1']);
    expect(situacaoAtrasos(e, '2026-12-11').anteriores).toHaveLength(2);
  });
  it('deu baixa daquele mês no Meu mês: some da lista', () => {
    const e = novo();
    e.gastosFixos[0].pagamentos['2026-11'] = { valorPago: 1230, pagoEm: '2026-12-06' };
    e.atrasos = { separado: 0, saidas: {}, ignorados: [], manuais: [{ id: 'a2', nome: 'Parcela da casa', valor: 1200, mes: '2026-11', vencimento: '2026-11-10', gastoId: 'casa' }] };
    expect(atrasosAbertos(e, '2026-12-06')).toEqual([]);
  });
  it('meses pra anotar: os anteriores a este', () => {
    expect(mesesAtras('2026-12-05', 2)).toEqual(['2026-10', '2026-11']);
    expect(mesesAtras('2027-01-05', 1)).toEqual(['2026-12']);
  });
});

describe('ações de quem anotou', () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
    vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} });
  });
  it('anotar, pagar (dá baixa no mês da conta) e desfazer', async () => {
    const { _resetarMemoria, substituir, getEstado } = await import('./store');
    const { anotarAtraso, pagarAtraso } = await import('./acoes');
    _resetarMemoria();
    const e = ESTADO_INICIAL();
    e.gastosFixos = [{ id: 'moto', nome: 'Moto', valor: 600, diaVencimento: 15, categoria: 'Carro', pagamentos: {}, criadaEm: '2026-12-05' }];
    substituir(e);
    expect(anotarAtraso({ nome: 'Moto', valor: 600, diaVencimento: 15, meses: ['2026-10', '2026-11'], gastoId: 'moto' })).toHaveLength(2);
    const [out] = atrasosAbertos(getEstado(), '2026-12-05');
    expect(out.mes).toBe('2026-10');
    const d = pagarAtraso(out, 630, '2026-12-05')!;
    expect(getEstado().gastosFixos[0].pagamentos['2026-10'].valorPago).toBe(630);
    expect(atrasosAbertos(getEstado(), '2026-12-05').map((a) => a.mes)).toEqual(['2026-11']);
    expect(getEstado().atrasos?.saidas['2026-12']).toBe(630);
    d.desfazer();
    expect(getEstado().gastosFixos[0].pagamentos['2026-10']).toBeUndefined();
    expect(atrasosAbertos(getEstado(), '2026-12-05').map((a) => a.mes)).toEqual(['2026-10', '2026-11']);
    expect(getEstado().atrasos?.saidas['2026-12']).toBeUndefined();
  });
});

describe('"pode gastar" com atraso', () => {
  const comPlano = (): Estado => {
    const e = base();
    e.lancamentos = [{ id: 'l', descricao: 'Mercado', valor: 900, data: '2026-10-12', categoria: 'Mercado' }];
    return e;
  };
  it('o que vai pro atraso já sai do "pode gastar", sem precisar tocar em Separei', () => {
    const e = comPlano();
    e.atrasos = { porMes: 600, separado: 0, saidas: {}, ignorados: [] };
    // renda 4000 − contas 1950 − 600 pro atraso (a reserva espera enquanto tem conta atrasada)
    expect(livreParaGastar(e, '2026-11')).toBe(4000 - 1950 - 600);
  });
  it('separar o combinado não desconta duas vezes; pagar mais que o combinado desconta o que saiu', () => {
    const e = comPlano();
    e.atrasos = { porMes: 600, separado: 600, saidas: { '2026-11': 600 }, ignorados: [] };
    const separou = livreParaGastar(e, '2026-11');
    e.atrasos = { porMes: 600, separado: 0, saidas: {}, ignorados: [] };
    expect(livreParaGastar(e, '2026-11')).toBe(separou);
    e.atrasos = { porMes: 600, separado: 0, saidas: { '2026-11': 900 }, ignorados: [] };
    expect(livreParaGastar(e, '2026-11')).toBe(separou - 300);
  });
  it('sem gasto do dia a dia anotado e sem escolher o valor, não reserva nada (a sobra seria otimista)', () => {
    const e = base();
    expect(livreParaGastar(e, '2026-11')).toBe(4000 - 1950);
  });
});

describe('parcela atrasada de dívida', () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
    vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} });
  });
  it('pagar a de outubro em novembro conta em outubro: a de novembro continua a pagar no Quitar dívidas', async () => {
    const { _resetarMemoria, substituir, getEstado } = await import('./store');
    const { pagarAtraso } = await import('./acoes');
    const { pagoNaDivida } = await import('./painelDividas');
    _resetarMemoria();
    const e = ESTADO_INICIAL();
    e.dividas = [{ id: 'fin', nome: 'Financiamento da moto', saldo: 10000, jurosMensal: 2, parcelaMinima: 500, venceDia: 10, cadastradaEm: '2026-09-01', tipo: 'parcelada', pagamentos: [{ data: '2026-09-10', valor: 500 }] }];
    substituir(e);
    const [out] = atrasosAbertos(getEstado(), '2026-11-05');
    const d = pagarAtraso(out, 515, '2026-11-05')!;
    expect(pagoNaDivida(getEstado().dividas[0], '2026-11')).toBe(0);
    expect(pagoNaDivida(getEstado().dividas[0], '2026-10')).toBe(515);
    expect(atrasosAbertos(getEstado(), '2026-11-05')).toEqual([]);
    d.desfazer();
    expect(getEstado().dividas[0].pagamentos).toHaveLength(1);
  });
});

describe('"pode gastar" já separa a reserva (pague-se primeiro)', () => {
  it('sem atraso: desconta os 10% combinados; guardar mais desconta o que guardou', async () => {
    const { guardarNoMes } = await import('./selectores');
    const e = ESTADO_INICIAL();
    e.config.renda = 3000;
    e.gastosFixos = [{ id: 'a', nome: 'Aluguel', valor: 1000, diaVencimento: 5, categoria: 'Aluguel', pagamentos: {}, criadaEm: '2026-11-01' }];
    expect(guardarNoMes(e, '2026-11')).toBe(300);
    expect(livreParaGastar(e, '2026-11')).toBe(1700);
    e.aportes = [{ id: 'x', data: '2026-11-05', valor: 500, origem: 'reserva' }];
    expect(livreParaGastar(e, '2026-11')).toBe(1500);
  });
  it('com a reserva completa, não separa mais', async () => {
    const { guardarNoMes } = await import('./selectores');
    const e = ESTADO_INICIAL();
    e.config.renda = 3000;
    e.gastosFixos = [{ id: 'a', nome: 'Aluguel', valor: 1000, diaVencimento: 5, categoria: 'Aluguel', pagamentos: {}, criadaEm: '2026-11-01' }];
    e.aportes = [{ id: 'x', data: '2026-01-05', valor: 10000, origem: 'reserva' }];
    expect(guardarNoMes(e, '2026-11')).toBe(0);
  });
  it('parcela de dívida sai do "pode gastar"', () => {
    const e = ESTADO_INICIAL();
    e.config.renda = 3000;
    e.config.reservaPct = 0;
    e.dividas = [{ id: 'd', nome: 'Empréstimo', saldo: 2000, jurosMensal: 3, parcelaMinima: 250, pagamentos: [] }];
    expect(livreParaGastar(e, '2026-11')).toBe(2750);
  });
});
