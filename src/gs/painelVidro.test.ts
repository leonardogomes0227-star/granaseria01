import { describe, expect, it } from 'vitest';
import { detalheDisponivel } from './selectores';
import { ESTADO_INICIAL, type Estado } from './tipos';
import { painelVidro } from './painelVidro';

const HOJE = '2026-11-18';

const cheio = (): Estado => {
  const e = ESTADO_INICIAL();
  e.config = { ...e.config, renda: 5000 };
  e.receitas = [
    { id: 'r1', descricao: 'Salário', valor: 4800, data: '2026-10-05', tipo: 'salario' },
    { id: 'r2', descricao: 'Salário', valor: 5000, data: '2026-11-05', tipo: 'salario' },
  ];
  e.lancamentos = [
    { id: 'l1', descricao: 'Assaí', valor: 200, data: '2026-11-02', categoria: 'Mercado' },
    { id: 'l2', descricao: 'Assaí', valor: 80, data: '2026-11-10', categoria: 'Mercado' },
    { id: 'l3', descricao: 'iFood', valor: 60, data: '2026-11-18', categoria: 'Comida' },
    { id: 'l4', descricao: 'Feira', valor: 100, data: '2026-10-10', categoria: 'Mercado' },
  ];
  e.limites = { Mercado: 250, Comida: 200 };
  e.gastosFixos = [{ id: 'g', nome: 'Internet', valor: 100, diaVencimento: 20, categoria: 'Casa', pagamentos: { '2026-10': { valorPago: 100, pagoEm: '2026-10-20' } } }];
  e.metas = [{ id: 'm', nome: 'Viagem', alvo: 1000, criadaEm: '2026-08-01', guardados: [{ data: '2026-10-01', valor: 200 }] }];
  e.aportes = [
    { id: 'a', data: '2026-10-01', valor: 200, origem: 'meta', agenteId: 'meta:m' },
    { id: 'a2', data: '2026-11-01', valor: 150, origem: 'reserva' },
  ];
  e.dividas = [{ id: 'd', nome: 'Cartão', saldo: 1000, jurosMensal: 0, parcelaMinima: 100, pagamentos: [{ data: '2026-10-15', valor: 100 }, { data: '2026-11-15', valor: 200 }] }];
  return e;
};

describe('painel de vidro', () => {
  it('conta nova não ganha número', () => {
    const p = painelVidro(ESTADO_INICIAL(), HOJE);
    expect(p.kpis.every((k) => k.valor === null)).toBe(true);
    expect(p.funil).toBeNull();
    expect(p.categorias).toEqual([]);
    expect(p.maiores).toEqual([]);
    expect(p.ultimos).toEqual([]);
    expect(p.calor).toHaveLength(30);
    expect(p.calor.every((d) => d.valor === 0)).toBe(true);
  });

  it('monta os blocos com o que já está anotado', () => {
    const e = cheio();
    const p = painelVidro(e, HOJE);
    const kpi = (id: string) => p.kpis.find((k) => k.id === id)!;
    expect(kpi('saldo').valor).toBe(detalheDisponivel(e, '2026-11', HOJE).livre);
    expect(kpi('saldo').serie[kpi('saldo').serie.length - 1]?.valor).toBe(kpi('saldo').valor);
    expect(kpi('receitas')).toMatchObject({ valor: 5000, nota: 'registradas neste mês' });
    expect(kpi('receitas').delta).toMatchObject({ valor: 200, sentido: 'sobe' });
    expect(kpi('despesas').valor).toBe(340);
    expect(kpi('despesas').delta).toMatchObject({ valor: 140, sentido: 'sobe' });
    expect(kpi('guardado')).toMatchObject({ valor: 150, extra: '3% da receita' });
    expect(kpi('divida').valor).toBe(700);
    expect(kpi('divida').delta).toMatchObject({ valor: 100, sentido: 'sobe' });
    expect(kpi('divida').deltaRotulo).toBe('pago vs. mês passado');
    expect(kpi('patrimonio').valor).toBe(350);

    expect(p.categorias[0]).toMatchObject({ categoria: 'Mercado', pilula: 'estourou', lancamentos: 2, topo: 'Assaí' });
    expect(p.categorias.find((c) => c.categoria === 'Comida')).toMatchObject({ pilula: 'ok', topo: 'iFood', lancamentos: 1 });

    expect(p.funil?.passos.map((x) => x.valor)).toEqual([5000, 100, 340, 4560]);
    expect(p.funil?.segue[0]).toBeCloseTo(98, 5);
    expect(p.funil?.segue[1]).toBeCloseTo((4560 / 4900) * 100, 5);
    expect(p.funil?.segue[2]).toBeCloseTo((4560 / 5000) * 100, 5);

    const dia18 = p.calor.find((d) => d.dia === 18)!;
    expect(dia18.valor).toBe(60);
    expect(dia18.futuro).toBe(false);
    expect(p.calor.find((d) => d.dia === 19)?.futuro).toBe(true);
    expect(p.calor.find((d) => d.dia === 19)?.valor).toBe(0);
    expect(p.dias.find((d) => d.dia === 5)?.receita).toBe(5000);

    expect(p.contas[0]).toMatchObject({ nome: 'Internet', pilula: 'em 2 dias' });
    expect(p.maiores[0]).toMatchObject({ descricao: 'Assaí', valor: 200 });
    expect(p.metas[0]).toMatchObject({ nome: 'Viagem', guardado: 200, falta: 800 });
    expect(p.dividas[0]).toMatchObject({ nome: 'Cartão', saldo: 700 });
  });

  it('renda informada não vira delta contra zero', () => {
    const e = ESTADO_INICIAL();
    e.config = { ...e.config, renda: 3000 };
    const p = painelVidro(e, HOJE);
    const receitas = p.kpis.find((k) => k.id === 'receitas')!;
    expect(receitas.valor).toBe(3000);
    expect(receitas.nota).toMatch(/informada/);
    expect(receitas.delta).toBeNull();
    expect(receitas.serie).toEqual([]);
    expect(p.funil?.passos[0]).toMatchObject({ valor: 3000, nota: 'informada' });
  });

  it('descrição em branco não vira loja', () => {
    const e = ESTADO_INICIAL();
    e.lancamentos = [{ id: '1', descricao: '   ', valor: 10, data: HOJE, categoria: 'Outros' }];
    const p = painelVidro(e, HOJE);
    expect(p.categorias[0]).toMatchObject({ topo: null, lancamentos: 1, pilula: 'sem limite' });
    expect(p.maiores[0].descricao).toBe('Outros');
  });

  it('dívida sem pagamento não ganha queda inventada', () => {
    const e = ESTADO_INICIAL();
    e.dividas = [{ id: 'd', nome: 'Loja', saldo: 50, jurosMensal: 0, parcelaMinima: 10, pagamentos: [] }];
    const kpi = painelVidro(e, HOJE).kpis.find((k) => k.id === 'divida')!;
    expect(kpi.valor).toBe(50);
    expect(kpi.delta).toBeNull();
  });
});
