import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL, type Estado } from './tipos';
import { BASE, FOCOS, ferramentasLiberadas, focosIndicados, indicacoes, montarPlano, passosDoPlano, resumoDoPlano } from './planoPessoal';
import { passosDoMes } from './passos';
import { FERRAMENTAS } from './registroFerramentas';
import { migrar } from './migracao';

const HOJE = '2026-11-10';
const base = (p: Partial<Estado> = {}): Estado => { const e = ESTADO_INICIAL(); return { ...e, ...p, config: { ...e.config, renda: 4000, onboardingFeito: true } }; };
const comPlano = (e: Estado, focos: string[], extra: Partial<NonNullable<Estado['caminho']['plano']>> = {}): Estado => ({ ...e, caminho: { ...e.caminho, plano: { ...montarPlano({ focos }, HOJE), ...extra } } });
const pagas = (ms: string[], v: number) => Object.fromEntries(ms.map((m) => [m, { valorPago: v, pagoEm: `${m}-05` }]));

describe('plano pessoal', () => {
  it('todo foco libera ferramentas que existem no registro', () => {
    const ids = new Set(FERRAMENTAS.map((f) => f.id));
    for (const f of FOCOS) for (const id of f.ferramentas) expect(ids.has(id), `${f.id} → ${id}`).toBe(true);
    for (const id of BASE) expect(ids.has(id), id).toBe(true);
  });

  it('sem plano: o básico mais o que os números pedem; com plano: só o que ele escolheu', () => {
    const e = base({ dividas: [{ id: 'd', nome: 'Cartão', saldo: 3000, jurosMensal: 12, parcelaMinima: 300, pagamentos: [] }] });
    expect(focosIndicados(e, HOJE)[0].foco.id).toBe('dividas');
    const sem = ferramentasLiberadas(e, HOJE);
    expect(sem.has('dividas')).toBe(true);
    expect(sem.has('investir')).toBe(false);
    const meta = ferramentasLiberadas(comPlano(e, ['meta']), HOJE);
    expect(meta.has('metas')).toBe(true);
    expect(meta.has('dividas')).toBe(false);
    expect(meta.has('contas')).toBe(true); // o básico fica sempre
  });

  it('esconder tira o assunto; liberar depois traz a ferramenta de volta', () => {
    const e = comPlano(base(), ['investir'], { esconder: ['investir'] });
    expect(ferramentasLiberadas(e, HOJE).has('investir')).toBe(false);
    expect(ferramentasLiberadas({ ...e, caminho: { ...e.caminho, plano: { ...e.caminho.plano!, extras: ['investir'] } } }, HOJE).has('investir')).toBe(true);
  });

  it('o Coach indica a ferramenta quando a vida pede, e para de indicar quando já está liberada', () => {
    const e = comPlano(base({ receitas: [{ id: 'r', descricao: '13º', valor: 2000, data: '2026-11-08', tipo: 'extra' }] }), ['controlar']);
    const ind = indicacoes(e, HOJE);
    expect(ind[0]).toMatchObject({ ferramentaId: 'extras' });
    expect(ind[0].motivo).toContain('R$ 2.000');
    expect(indicacoes({ ...e, caminho: { ...e.caminho, plano: { ...e.caminho.plano!, extras: ['extras'] } } }, HOJE).some((i) => i.ferramentaId === 'extras')).toBe(false);
  });

  it('um passo de cada vez: no máximo 3 na tela, o urgente sempre entra, e um deles é o atual', () => {
    const e = comPlano(base({
      gastosFixos: [{ id: 'i', nome: 'Internet', valor: 100, diaVencimento: 5, categoria: 'Internet', pagamentos: pagas(['2026-09'], 100), criadaEm: '2026-09-01' }, { id: 'l', nome: 'Luz', valor: 150, diaVencimento: 11, categoria: 'Luz', pagamentos: {}, criadaEm: '2026-11-01' }],
      dividas: [{ id: 'd', nome: 'Cartão', saldo: 3000, jurosMensal: 12, parcelaMinima: 300, pagamentos: [], cadastradaEm: HOJE }],
      planoDividas: { estrategia: 'bola-de-neve', pagamentoMensal: 600, criadoEm: HOJE },
    }), ['meta']);
    const todos = passosDoMes(e, HOJE);
    const { visiveis, outros } = passosDoPlano(todos, e, HOJE);
    expect(visiveis.length).toBeLessThanOrEqual(3);
    expect(visiveis[0].origem).toBe('atraso');
    expect(visiveis.some((p) => p.status === 'atual')).toBe(true);
    expect(visiveis.some((p) => p.origem === 'divida')).toBe(false); // dívida não está no foco escolhido
    expect(outros).toBe(todos.length - visiveis.length);
    expect(resumoDoPlano(e.caminho.plano!)).toBe('Seu plano: juntar para um objetivo.');
  });

  it('mês no vermelho: guardar fica em espera e não aparece como passo a fazer', () => {
    const e = base({ gastosFixos: [{ id: 'a', nome: 'Aluguel', valor: 4500, diaVencimento: 25, categoria: 'Aluguel', pagamentos: {}, criadaEm: '2026-11-01' }] });
    const g = passosDoMes(e, HOJE).find((p) => p.origem === 'guardar')!;
    expect(g.status).toBe('segurado');
    expect(passosDoPlano(passosDoMes(e, HOJE), e, HOJE).visiveis.some((p) => p.origem === 'guardar')).toBe(false);
  });

  it('migração: o plano é guardado e lixo é descartado', () => {
    const e = migrar({ caminho: { plano: { focos: ['dividas', 'X!'], esconder: ['investir'], ritmo: 'tudo', extras: ['extras'], criadoEm: HOJE } } });
    expect(e.caminho.plano).toEqual({ focos: ['dividas'], esconder: ['investir'], ritmo: 'tudo', extras: ['extras'], criadoEm: HOJE });
    expect(migrar({ caminho: { plano: { focos: [] } } }).caminho.plano).toBeUndefined();
  });
});
