import { describe, expect, it } from 'vitest';
import { comentarioDoGasto, dicasDoMidas, textoSeCouber, todasAsDicas, tomDaRegra } from './midasDicas';
import { ESTADO_INICIAL, type Estado } from './tipos';

const HOJE = '2026-11-18';

const base = (): Estado => {
  const e = ESTADO_INICIAL();
  e.config.renda = 4200;
  e.config.nome = 'Ana';
  return e;
};

const regras = (e: Estado, hoje = HOJE) => todasAsDicas(e, hoje).map((d) => d.regra);

describe('dicas do Midas', () => {
  it('conta nova não inventa número', () => {
    const d = dicasDoMidas(ESTADO_INICIAL(), HOJE);
    expect(d).toHaveLength(1);
    expect(d[0].regra).toBe('comecar');
    expect(d[0].texto).toContain('renda');
    expect(d[0].rota).toBe('/dados');
  });

  it('orçamento de comida no dia 18 vem na frente de um elogio', () => {
    const e = base();
    e.limites = { Comida: 400 };
    e.lancamentos = [
      { id: 'a', descricao: 'Almoço', valor: 200, data: '2026-11-10', categoria: 'Comida' },
      { id: 'b', descricao: 'Jantar', valor: 130, data: '2026-11-17', categoria: 'Comida' },
      { id: 'c', descricao: 'Café', valor: 20, data: '2026-11-16', categoria: 'Comida' },
    ];
    const d = dicasDoMidas(e, HOJE);
    expect(d[0].regra).toBe('orcamento-ritmo');
    expect(d[0].texto).toBe('Já foi 88% do orçamento de comida e ainda é dia 18.');
    expect(regras(e)).toContain('decimo');
    expect(d[0].prioridade).toBeGreaterThan(d.find((x) => x.regra === 'decimo')!.prioridade);
  });

  it('conta de amanhã e pico contra a média', () => {
    const e = base();
    e.gastosFixos = [{ id: 'luz', nome: 'Luz', valor: 180, diaVencimento: 19, categoria: 'Luz', pagamentos: {}, criadaEm: '2026-01-01' }];
    e.lancamentos = [
      { id: '1', descricao: 'Feira', valor: 200, data: '2026-09-10', categoria: 'Mercado' },
      { id: '2', descricao: 'Feira', valor: 220, data: '2026-10-10', categoria: 'Mercado' },
      { id: '3', descricao: 'Feira grande', valor: 700, data: '2026-11-12', categoria: 'Mercado' },
    ];
    const nomes = regras(e);
    expect(nomes).toContain('conta-amanha');
    expect(nomes).toContain('pico');
    expect(dicasDoMidas(e, HOJE)[0].regra).toBe('conta-amanha');
    expect(todasAsDicas(e, HOJE).find((d) => d.regra === 'pico')?.texto).toContain('Mercado');
  });

  it('plano da dívida, meta e 13º em novembro', () => {
    const e = base();
    e.dividas = [{ id: 'd', nome: 'Cartão', saldo: 2000, jurosMensal: 10, parcelaMinima: 200, pagamentos: [{ data: '2026-10-05', valor: 500 }] }];
    e.planoDividas = { estrategia: 'maior-juro', pagamentoMensal: 400, criadoEm: '2026-10-01' };
    e.metas = [{ id: 'm', nome: 'Viagem', alvo: 1000, criadaEm: '2026-08-01', guardados: [{ data: '2026-10-01', valor: 400 }] }];
    const nomes = regras(e);
    expect(nomes).toContain('divida-progresso');
    expect(nomes).toContain('meta');
    expect(nomes).toContain('decimo');
    expect(todasAsDicas(e, HOJE).find((d) => d.regra === 'meta')?.texto).toContain('40%');
    expect(todasAsDicas(e, '2026-12-10').find((d) => d.regra === 'decimo')?.texto).toContain('dezembro');
    expect(regras(e, '2026-07-10')).not.toContain('decimo');
  });

  it('cobra o dia sem anotação e elogia a sequência', () => {
    const e = base();
    e.lancamentos = [
      { id: '1', descricao: 'Pão', valor: 12, data: '2026-11-16', categoria: 'Comida' },
      { id: '2', descricao: 'Pão', valor: 12, data: '2026-11-17', categoria: 'Comida' },
    ];
    expect(regras(e)).toContain('nada-hoje');
    e.lancamentos.push({ id: '3', descricao: 'Pão', valor: 12, data: '2026-11-15', categoria: 'Comida' });
    expect(regras(e)).toContain('sequencia');
    expect(regras({ ...e, lancamentos: [...e.lancamentos, { id: '4', descricao: 'Hoje', valor: 8, data: HOJE, categoria: 'Comida' }] })).not.toContain('nada-hoje');
  });

  it('a espera tira a dica já mostrada e a próxima sobe', () => {
    const e = base();
    e.gastosFixos = [{ id: 'luz', nome: 'Luz', valor: 90, diaVencimento: 18, categoria: 'Luz', pagamentos: {}, criadaEm: '2026-01-01' }];
    const agora = 1_000_000;
    const primeira = dicasDoMidas(e, HOJE, {}, agora)[0];
    expect(primeira.regra).toBe('conta-hoje');
    const depois = dicasDoMidas(e, HOJE, { [primeira.id]: agora }, agora + 1000);
    expect(depois.find((d) => d.id === primeira.id)).toBeUndefined();
    const liberada = dicasDoMidas(e, HOJE, { [primeira.id]: agora }, agora + primeira.espera);
    expect(liberada[0].id).toBe(primeira.id);
  });

  it('comenta o terceiro delivery da semana e o teto da categoria', () => {
    const e = base();
    e.limites = { Comida: 100 };
    e.lancamentos = [
      { id: '1', descricao: 'ifood', valor: 40, data: '2026-11-16', categoria: 'Comida' },
      { id: '2', descricao: 'Rappi', valor: 35, data: '2026-11-17', categoria: 'Comida' },
      { id: '3', descricao: 'delivery', valor: 30, data: HOJE, categoria: 'Comida' },
    ];
    expect(comentarioDoGasto(e, HOJE)).toBe('Esse foi o 3º delivery da semana. Comida já foi 105% do orçamento.');
    expect(comentarioDoGasto(e, HOJE, e.lancamentos[0])).toContain('3º delivery');
  });

  it('o tom segue a gravidade da regra', () => {
    expect(tomDaRegra('conta-atrasada')).toBe('perigo');
    expect(tomDaRegra('orcamento-estouro')).toBe('perigo');
    expect(tomDaRegra('conta-amanha')).toBe('aviso');
    expect(tomDaRegra('orcamento-ritmo')).toBe('aviso');
    expect(tomDaRegra('meta')).toBe('ok');
    expect(tomDaRegra('sequencia')).toBe('ok');
    expect(tomDaRegra('decimo')).toBe('neutro');
    expect(dicasDoMidas(ESTADO_INICIAL(), HOJE)[0].icone).toBe('💡');
  });

  it('a frase da regra fica se a resposta da IA apagar o número ou for longa demais', () => {
    const original = 'Já foi 80% do orçamento de comida e ainda é dia 18.';
    expect(textoSeCouber(original, null)).toBe(original);
    expect(textoSeCouber(original, 'Comida está alta.')).toBe(original);
    expect(textoSeCouber(original, 'x'.repeat(180))).toBe(original);
    expect(textoSeCouber(original, 'Comida já foi 80% e ainda é dia 18.')).toBe('Comida já foi 80% e ainda é dia 18.');
  });
});
