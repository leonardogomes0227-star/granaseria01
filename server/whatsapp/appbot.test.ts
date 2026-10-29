import { describe, expect, it } from 'vitest';
import { APP_KEY, comandoApp, lerApp, rodarApp } from './appbot.js';
import { ESTADO_INICIAL } from '../../src/gs/tipos.js';
import type { Estado } from '../../src/gs/tipos.js';

const AGORA = new Date('2026-10-12T15:00:00Z'); // 12:00 em Brasília
const base = (): Estado => ({
  ...ESTADO_INICIAL(),
  config: { ...ESTADO_INICIAL().config, renda: 4800, onboardingFeito: true },
  gastosFixos: [
    { id: 'g1', nome: 'Aluguel', valor: 1500, diaVencimento: 10, categoria: 'Aluguel', pagamentos: {} },
    { id: 'g2', nome: 'Internet', valor: 100, diaVencimento: 20, categoria: 'Internet', pagamentos: {} },
    { id: 'g3', nome: 'Luz', valor: 180, diaVencimento: 25, categoria: 'Luz', pagamentos: { '2026-10': { valorPago: 180, pagoEm: '2026-10-05' } } },
  ],
  dividas: [
    { id: 'd1', nome: 'Cartão rotativo', saldo: 3200, jurosMensal: 14, parcelaMinima: 320, pagamentos: [] },
    { id: 'd2', nome: 'Empréstimo', saldo: 400, jurosMensal: 3, parcelaMinima: 100, pagamentos: [] },
  ],
  planoDividas: { estrategia: 'maior-juro', pagamentoMensal: 900, criadoEm: '2026-10-01' },
});
const perfil = (e: Estado = base()) => ({ [APP_KEY]: JSON.stringify(e) });
const estadoDe = (p?: Record<string, string>) => JSON.parse(p![APP_KEY]) as Estado;

describe('comandoApp (o que entendo da mensagem)', () => {
  it('contas e dívidas, com ou sem acento', () => {
    expect(comandoApp('Contas')).toEqual({ kind: 'contas' });
    expect(comandoApp('o que vence?')).toEqual({ kind: 'contas' });
    expect(comandoApp('Minhas dívidas')).toEqual({ kind: 'dividas' });
    expect(comandoApp('quanto devo')).toEqual({ kind: 'dividas' });
  });
  it('paguei: com valor e sem valor', () => {
    expect(comandoApp('paguei o aluguel')).toEqual({ kind: 'pagou', alvo: 'aluguel', valor: null });
    expect(comandoApp('paguei 450 no cartão rotativo')).toEqual({ kind: 'pagou', alvo: 'cartao rotativo', valor: 450 });
    expect(comandoApp('paguei 1.500 do aluguel')).toEqual({ kind: 'pagou', alvo: 'aluguel', valor: 1500 });
    expect(comandoApp('paguei o aluguel 1500,50')).toEqual({ kind: 'pagou', alvo: 'aluguel', valor: 1500.5 });
  });
  it('sem dizer o quê, ou outra coisa: não é comigo', () => {
    expect(comandoApp('paguei 35')).toBeNull();
    expect(comandoApp('gastei 35 no mercado')).toBeNull();
    expect(comandoApp('oi')).toBeNull();
  });
});

describe('rodarApp', () => {
  it('lê o estado do app e ignora perfil sem contas nem dívidas', () => {
    expect(lerApp(perfil())?.gastosFixos).toHaveLength(3);
    expect(lerApp({})).toBeNull();
    expect(lerApp({ [APP_KEY]: '{quebrado' })).toBeNull();
    expect(lerApp(perfil(ESTADO_INICIAL()))).toBeNull();
  });

  it('contas: atrasada, vence logo, em dia e paga, com o que falta', () => {
    const r = rodarApp({ kind: 'contas' }, perfil(), AGORA)!;
    expect(r.perfil).toBeUndefined();
    expect(r.reply).toContain('🔴 *Aluguel* · R$ 1.500,00 · venceu dia 10/10');
    expect(r.reply).toContain('⚪ *Internet*');
    expect(r.reply).toContain('✅ *Luz* · R$ 180,00 · paga');
    expect(r.reply).toContain('Falta pagar *R$ 1.600,00* de R$ 1.780,00');
  });

  it('contas sem nada cadastrado orienta a cadastrar', () => {
    expect(rodarApp({ kind: 'contas' }, {}, AGORA)!.reply).toContain('ainda não cadastrou contas');
  });

  it('dívidas: ordem do plano, total e data de liberdade', () => {
    const r = rodarApp({ kind: 'dividas' }, perfil(), AGORA)!;
    expect(r.reply).toContain('R$ 3.600,00 no total');
    expect(r.reply.indexOf('1ª *Cartão rotativo*')).toBeGreaterThan(-1);
    expect(r.reply).toContain('2ª *Empréstimo*');
    expect(r.reply).toContain('você fica livre em');
  });

  it('dívidas sem cadastro no site: deixa o caminho de sempre (calculadora)', () => {
    expect(rodarApp({ kind: 'dividas' }, {}, AGORA)).toBeNull();
  });

  it('paguei o aluguel: marca a conta do mês com o valor dela, na data de hoje em Brasília', () => {
    const r = rodarApp({ kind: 'pagou', alvo: 'aluguel', valor: null }, perfil(), AGORA)!;
    expect(r.reply).toContain('*Aluguel* marcada como paga (R$ 1.500,00)');
    expect(r.reply).toContain('Ainda falta pagar R$ 100,00');
    const g = estadoDe(r.perfil).gastosFixos.find((x) => x.id === 'g1')!;
    expect(g.pagamentos['2026-10']).toEqual({ valorPago: 1500, pagoEm: '2026-10-12' });
  });

  it('conta já paga: não paga duas vezes', () => {
    const r = rodarApp({ kind: 'pagou', alvo: 'luz', valor: null }, perfil(), AGORA)!;
    expect(r.reply).toContain('já estava paga');
    expect(r.perfil).toBeUndefined();
  });

  it('paguei 450 no rotativo: abate da dívida e mostra o que falta', () => {
    const r = rodarApp({ kind: 'pagou', alvo: 'rotativo', valor: 450 }, perfil(), AGORA)!;
    expect(r.reply).toContain('Anotei R$ 450,00 em *Cartão rotativo*');
    expect(r.reply).toContain('Falta R$ 2.750,00');
    expect(estadoDe(r.perfil).dividas[0].pagamentos).toEqual([{ data: '2026-10-12', valor: 450 }]);
  });

  it('quitar uma dívida mostra a próxima; valor acima do saldo anota só o saldo', () => {
    const r = rodarApp({ kind: 'pagou', alvo: 'emprestimo', valor: 999 }, perfil(), AGORA)!;
    expect(r.reply).toContain('*Empréstimo* quitada!');
    expect(r.reply).toContain('(o saldo era R$ 400,00, anotei só isso)');
    expect(r.reply).toContain('vai pra *Cartão rotativo*');
    expect(estadoDe(r.perfil).dividas[1].pagamentos[0].valor).toBe(400);
  });

  it('dívida sem valor: pergunta quanto', () => {
    const r = rodarApp({ kind: 'pagou', alvo: 'rotativo', valor: null }, perfil(), AGORA)!;
    expect(r.reply).toContain('Quanto você pagou');
    expect(r.perfil).toBeUndefined();
  });

  it('nome que combina com duas contas: pede o nome inteiro e não grava nada', () => {
    const e = base();
    e.gastosFixos.push({ id: 'g4', nome: 'Aluguel da loja', valor: 800, diaVencimento: 12, categoria: 'Aluguel', pagamentos: {} });
    const r = rodarApp({ kind: 'pagou', alvo: 'aluguel', valor: null }, perfil(e), AGORA)!;
    expect(r.reply).toContain('mais de uma conta');
    expect(r.perfil).toBeUndefined();
  });

  it('não achou nada com esse nome: devolve null pra seguir como gasto', () => {
    expect(rodarApp({ kind: 'pagou', alvo: 'mercado', valor: 35 }, perfil(), AGORA)).toBeNull();
  });
});
