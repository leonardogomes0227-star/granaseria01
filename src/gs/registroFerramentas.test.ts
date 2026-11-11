import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL } from './tipos';
import { FERRAMENTAS, GRUPOS, PERGUNTAS, buscar, ferramenta, gradeDaArea, urgentesDaArea, type Area } from './registroFerramentas';

const HOJE = '2026-11-10';
const e0 = () => ({ ...ESTADO_INICIAL(), config: { ...ESTADO_INICIAL().config, renda: 3000 } });

describe('registro de ferramentas', () => {
  it('ids únicos, grupo existente, rota interna e status que nunca quebra', () => {
    expect(new Set(FERRAMENTAS.map((f) => f.id)).size).toBe(FERRAMENTAS.length);
    for (const f of FERRAMENTAS) {
      expect(GRUPOS[f.area], f.id).toContain(f.grupo);
      expect(f.rota.startsWith('/'), f.id).toBe(true);
      expect(f.resolve.length, f.id).toBeGreaterThan(5);
      expect(f.status(ESTADO_INICIAL(), HOJE).texto.length, f.id).toBeGreaterThan(0);
      expect(f.status(e0(), HOJE).texto.length, f.id).toBeGreaterThan(0);
    }
  });

  it('nenhuma ferramenta do app fica de fora', () => {
    const rotas = FERRAMENTAS.map((f) => f.rota.split(/[?#]/)[0]);
    for (const r of ['/plano/atrasos', '/plano/dividas', '/plano/emprestimos', '/plano/cartao', '/plano/calendario', '/recuperacao', '/lancamentos', '/plano/orcamento', '/plano/cortar', '/plano/assinaturas', '/plano/comprar', '/plano/parcelado', '/relatorios', '/plano/reserva', '/plano/extras', '/investir', '/plano/renda', '/coach', '/assistentes', '/guias', '/dados', '/planos', '/sobre', '/diagnostico']) expect(rotas, r).toContain(r);
    for (const slug of ['seus-direitos', 'check-in-mensal', 'placar-pai-rico', 'frase-do-dia', 'simulador-longo-prazo', 'meu-plano', 'meus-selos']) expect(rotas).toContain(`/ferramentas/${slug}`);
  });

  it('as 14 perguntas levam a uma ferramenta que existe', () => {
    expect(PERGUNTAS).toHaveLength(14);
    for (const p of PERGUNTAS) expect(ferramenta(p.ferramentaId), p.texto).toBeTruthy();
  });

  it('busca ignora acento e maiúscula e usa as palavras de busca', () => {
    expect(buscar('DIVIDA')[0].ferramentaId).toBe('dividas');
    expect(buscar('emprestimo').some((a) => a.ferramentaId === 'emprestimos')).toBe(true);
    expect(buscar('cartão estourou')[0].rota).toBe('/plano/cartao');
    expect(buscar('streaming')[0].ferramentaId).toBe('assinaturas');
    expect(buscar('13')[0].ferramentaId).toBe('extras');
    expect(buscar('xyzabc')).toEqual([]);
    expect(buscar(' ')).toEqual([]);
  });

  it('o que está em vermelho sobe no grupo', () => {
    const e = { ...e0(), gastosFixos: [{ id: 'a', nome: 'Internet', valor: 100, diaVencimento: 5, categoria: 'Internet', pagamentos: {}, criadaEm: '2026-11-01' }] };
    expect(urgentesDaArea('pagar', e, HOJE).map((f) => f.id)).toEqual(expect.arrayContaining(['contas', 'atrasos']));
    const sair = gradeDaArea('pagar', e, HOJE).find((g) => g.grupo === 'Sair do vermelho')!;
    expect(sair.itens[0].id).toBe('atrasos');
    for (const a of Object.keys(GRUPOS) as Area[]) expect(gradeDaArea(a, e, HOJE).length).toBeGreaterThan(0);
  });
});

describe('continuar de onde parou', () => {
  it('cada ferramenta de vários passos diz em que passo a pessoa está, e some quando terminou', () => {
    const e = e0();
    const c = (id: string, est = e) => ferramenta(id)!.continuar!(est, HOJE);
    expect(c('dividas')).toBeNull();
    const comDivida = { ...e, dividas: [{ id: 'd', nome: 'Cartão', saldo: 900, jurosMensal: 10, parcelaMinima: 90, pagamentos: [] }] };
    expect(c('dividas', comDivida)).toMatchObject({ passo: 2, total: 3 });
    expect(c('dividas', { ...comDivida, planoDividas: { estrategia: 'bola-de-neve' as const, pagamentoMensal: 300, criadoEm: HOJE } })).toMatchObject({ passo: 3 });
    expect(c('recuperacao', { ...e, recuperacao: { ativo: true, raioXFeito: false }, caminho: { ...e.caminho, etapas: { recuperacao: 4 } } })).toMatchObject({ passo: 4, total: 6 });
    expect(c('recuperacao', { ...e, recuperacao: { ativo: true, raioXFeito: true } })).toBeNull();
    expect(c('metas', { ...e, metas: [{ id: 'm', nome: 'Viagem', alvo: 1000, criadaEm: HOJE, guardados: [] }] })).toMatchObject({ passo: 2, total: 2 });
    expect(c('atrasos')).toBeNull();
  });
});
