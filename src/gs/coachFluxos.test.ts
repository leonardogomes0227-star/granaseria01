import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL, type Estado } from './tipos';
import { FLUXOS, fluxoDaRota, normalizarAcao, rodarFluxo, type Entrada, type FluxoId } from './coachFluxos';
import { TOOLS, TOOLS_ACAO, TOOLS_CALCULO, executarTool, type Coleta } from '../../server/coachTools';
import { simularImpacto } from './caminho';

const HOJE = '2026-11-10';
const pagas = (ms: string[], v: number) => Object.fromEntries(ms.map((m) => [m, { valorPago: v, pagoEm: `${m}-05` }]));
/** A pessoa de exemplo: renda de R$ 4.200, uma conta atrasada, duas dívidas e gastos anotados. */
const exemplo = (): Estado => {
  const e = ESTADO_INICIAL();
  return {
    ...e,
    config: { ...e.config, nome: 'Leonardo', renda: 4200, diaSalario: 5, onboardingFeito: true },
    gastosFixos: [
      { id: 'a', nome: 'Aluguel', valor: 1200, diaVencimento: 5, categoria: 'Aluguel', pagamentos: pagas(['2026-08', '2026-09', '2026-10', '2026-11'], 1200), criadaEm: '2026-08-01' },
      { id: 'i', nome: 'Internet', valor: 99.9, diaVencimento: 7, categoria: 'Internet', pagamentos: pagas(['2026-08', '2026-09', '2026-10'], 99.9), criadaEm: '2026-08-01' },
    ],
    lancamentos: [
      { id: '1', descricao: 'Mercado', valor: 620, data: '2026-11-03', categoria: 'Mercado' }, { id: '2', descricao: 'Bar', valor: 310, data: '2026-11-07', categoria: 'Lazer' }, { id: '3', descricao: 'Uber', valor: 140, data: '2026-11-08', categoria: 'Transporte' },
      { id: '4', descricao: 'Mercado', valor: 900, data: '2026-10-10', categoria: 'Mercado' }, { id: '5', descricao: 'Bar', valor: 120, data: '2026-10-12', categoria: 'Lazer' },
    ],
    dividas: [
      { id: 'c', nome: 'Cartão', saldo: 3200, jurosMensal: 12, parcelaMinima: 320, pagamentos: [], cadastradaEm: HOJE, tipo: 'rotativa' },
      { id: 'p', nome: 'Empréstimo', saldo: 5400, jurosMensal: 1.2, parcelaMinima: 300, pagamentos: [], cadastradaEm: HOJE },
    ],
    planoDividas: { estrategia: 'bola-de-neve', pagamentoMensal: 900, criadoEm: HOJE },
  };
};
const ENTRADAS: Partial<Record<FluxoId, Entrada>> = { emprestimo: { valor: 5000, parcelas: 12, parcela: 520 }, 'posso-comprar': { nome: 'tênis', valor: 350 }, 'dinheiro-extra': { valor: 1500 }, juntar: { nome: 'viagem', valor: 3000, meses: 10 } };
const palavras = (t: string) => t.split(/\s+/).filter(Boolean).length;

describe('fluxos do coach (sem IA)', () => {
  it('são 9, cada um responde com os números da pessoa e termina em uma ação', () => {
    expect(FLUXOS).toHaveLength(9);
    for (const f of FLUXOS) {
      const r = rodarFluxo(f.id, exemplo(), HOJE, ENTRADAS[f.id]);
      expect(r.textos.length, f.id).toBeGreaterThan(0);
      expect(r.acoes.length, f.id).toBeGreaterThan(0);
      expect(r.textos.join(' '), f.id).toMatch(/R\$/);
      for (const t of r.textos) expect(palavras(t), `${f.id}: "${t}"`).toBeLessThanOrEqual(80);
    }
  });

  it('nunca inventa: sem dados, pede o que falta; sem valor, pergunta com exemplo', () => {
    const vazio = ESTADO_INICIAL();
    expect(rodarFluxo('meu-numero', vazio, HOJE).textos[0]).toContain('renda');
    expect(rodarFluxo('posso-comprar', vazio, HOJE).textos[0]).toContain('ex.:');
    expect(rodarFluxo('sair-das-dividas', vazio, HOJE).textos[0]).toContain('Cadastre');
    expect(rodarFluxo('conta-atrasada', vazio, HOJE).textos[0]).toContain('não há nada atrasado');
    expect(rodarFluxo('onde-errando', vazio, HOJE).textos[0]).toContain('chutando');
    for (const f of FLUXOS) expect(() => rodarFluxo(f.id, vazio, HOJE, ENTRADAS[f.id])).not.toThrow();
  });

  it('o impacto do fluxo é o mesmo da função do caminho', () => {
    const e = exemplo();
    expect(rodarFluxo('posso-comprar', e, HOJE, { valor: 2000 }).impacto).toEqual(simularImpacto(e, HOJE, { tipo: 'compra', valor: 2000 }));
    expect(rodarFluxo('conta-atrasada', e, HOJE).copiar?.texto).toContain('Internet');
    expect(rodarFluxo('sair-das-dividas', e, HOJE).acoes[0].tipo).toBe('escolher_metodo_quitacao');
  });

  it('abre no assunto certo conforme a tela de onde veio', () => {
    expect(fluxoDaRota('/plano/dividas')).toBe('sair-das-dividas');
    expect(fluxoDaRota('/plano/atrasos?anotar=1')).toBe('conta-atrasada');
    expect(fluxoDaRota('/plano/comprar')).toBe('posso-comprar');
    expect(fluxoDaRota('/sobre')).toBeNull();
  });

  it('ações: entrada inválida não vira proposta e a rota precisa ser do app', () => {
    expect(normalizarAcao('criar_meta', { nome: 'x', alvo: -5 })).toBeNull();
    expect(normalizarAcao('abrir_ferramenta', { rota: 'https://golpe.example', rotulo: 'x' })).toBeNull();
    expect(normalizarAcao('abrir_ferramenta', { rota: '/plano/dividas', rotulo: 'Ver' })?.dados.rota).toBe('/plano/dividas');
    expect(normalizarAcao('colocar_no_caminho', { titulo: 'Cancelar', detalhe: 'd', rota: 'javascript:alert(1)' })?.dados.rota).toBe('');
    expect(normalizarAcao('apagar_tudo', {})).toBeNull();
  });
});

describe('ferramentas do coach no servidor', () => {
  const nova = (): Coleta => ({ acoes: [], impactos: [] });
  it('11 de cálculo e 8 de ação, todas com esquema', () => {
    expect(TOOLS_CALCULO.map((t) => t.name)).toEqual(['ver_caminho', 'simular_impacto', 'analisar_compra', 'comparar_parcelado', 'comparar_emprestimos', 'plano_atrasos', 'simular_quitacao', 'dividir_extra', 'plano_meta', 'orcamento_atual', 'disponivel_hoje']);
    expect(TOOLS_ACAO).toHaveLength(8);
    for (const t of TOOLS) expect(t.input_schema.type).toBe('object');
  });

  it('calculam sobre o estado salvo e nunca quebram com entrada ruim', () => {
    const e = exemplo();
    for (const t of TOOLS) expect(() => executarTool(t.name, {}, e, HOJE, nova())).not.toThrow();
    for (const t of TOOLS_CALCULO) expect(() => executarTool(t.name, {}, ESTADO_INICIAL(), HOJE, nova())).not.toThrow();
    const c = nova();
    const imp = executarTool('simular_impacto', { tipo: 'compra', valor: 2000 }, e, HOJE, c);
    expect(imp).toEqual(simularImpacto(e, HOJE, { tipo: 'compra', valor: 2000 }));
    expect(c.impactos).toHaveLength(1);
    expect((executarTool('disponivel_hoje', {}, ESTADO_INICIAL(), HOJE, c) as { desconhecido?: string }).desconhecido).toBeTruthy();
    expect((executarTool('simular_quitacao', { metodo: 'maior-juro' }, e, HOJE, c) as { livreEm: string }).livreEm).toMatch(/^\d{4}-\d{2}$/);
  });

  it('ações não mudam nada: viram proposta para a pessoa confirmar', () => {
    const e = exemplo();
    const antes = JSON.stringify(e);
    const c = nova();
    executarTool('criar_meta', { nome: 'Viagem', alvo: 3000 }, e, HOJE, c);
    executarTool('colocar_no_caminho', { titulo: 'Cancelar o streaming', detalhe: 'R$ 40 por mês' }, e, HOJE, c);
    expect(JSON.stringify(e)).toBe(antes);
    expect(c.acoes.map((a) => a.tipo)).toEqual(['criar_meta', 'colocar_no_caminho']);
    expect(executarTool('criar_meta', { nome: '', alvo: 0 }, e, HOJE, c)).toHaveProperty('erro');
  });
});

// GERAR=1 npx vitest run src/gs/coachFluxos.test.ts → escreve docs/coach-exemplos.md com uma conversa de cada fluxo
describe.runIf(process.env.GERAR)('exemplos', () => {
  it('gera o documento', () => {
    const e = exemplo();
    let md = '# Coach: uma conversa de exemplo de cada fluxo\n\nGerado por `GERAR=1 npx vitest run src/gs/coachFluxos.test.ts`. Todos os números saem das funções testadas (as mesmas que a IA chama no servidor), sobre uma pessoa de exemplo: renda de R$ 4.200, Internet atrasada, R$ 8.600 em dívidas (cartão a 12% ao mês e empréstimo a 1,2%), pagando R$ 900 por mês. Data: 10/11/2026.\n';
    for (const f of FLUXOS) {
      const r = rodarFluxo(f.id, e, HOJE, ENTRADAS[f.id]);
      const ent = ENTRADAS[f.id] ? ` (${Object.entries(ENTRADAS[f.id]!).map(([k, v]) => `${k}: ${v}`).join(', ')})` : '';
      md += `\n## ${FLUXOS.indexOf(f) + 1}. ${f.titulo}\n\n**Você:** ${f.titulo}${ent}\n\n${r.textos.map((t) => `**Coach:** ${t.replace(/\n/g, '  \n')}`).join('\n\n')}\n`;
      if (r.impacto) md += `\n> **Cartão de resultado:** ${r.impacto.frase}\n`;
      if (r.copiar) md += `\n> **Botão:** ${r.copiar.rotulo}\n>\n> _${r.copiar.texto}_\n`;
      md += `\n${r.acoes.map((a) => `- **Cartão de ação:** ${a.titulo}${a.detalhe ? ` — ${a.detalhe}` : ''} ${a.tipo === 'abrir_ferramenta' ? '[Abrir]' : '[Fazer] [Ajustar] [Agora não]'}`).join('\n')}\n`;
    }
    writeFileSync('docs/coach-exemplos.md', md);
  });
});
