import { describe, expect, it } from 'vitest';
import { conferir, falasDoRoteiro, percorrer, respostaDe, rotuloDe, type Percurso, type RespostaDada, type Valor } from '../engine';
import { dadosDeEstado } from '../dados';
import { planoGastos, ROTEIRO_GASTOS, USEI_TODAS } from './nomasir';

const NOW = new Date('2026-10-21T15:00:00Z');
const base = (state: Record<string, string> = {}, nome = 'Ana') => ({ agente: 'nomasir' as const, nome, dados: dadosDeEstado(state, NOW) });

function responder(pares: [string, Valor][], state: Record<string, string> = {}, nome = 'Ana') {
  const r: RespostaDada[] = [];
  for (const [passo, valor] of pares) {
    const p = percorrer(ROTEIRO_GASTOS, r, base(state, nome));
    expect(p.atual?.id, `esperava ${passo}`).toBe(passo);
    expect(conferir(p.atual!, valor, p.ctx), `resposta de ${passo}`).toBeNull();
    r.push({ passo, valor });
  }
  return percorrer(ROTEIRO_GASTOS, r, base(state, nome));
}

/** O erro que o Nomasir diz pra esta resposta, no passo em que a conversa está. */
function erro(pares: [string, Valor][], passo: string, valor: Valor) {
  const p = responder(pares);
  expect(p.atual?.id).toBe(passo);
  return conferir(p.atual!, valor, p.ctx);
}

const falasDe = (p: Percurso, id: string) => {
  const v = p.visitas.find((x) => x.passo.id === id);
  if (!v) throw new Error(`passo ${id} não visitado`);
  return falasDoRoteiro.falas(v.passo, v.ctx);
};
const ultimo = (p: Percurso) => p.visitas[p.visitas.length - 1].passo.id;

describe('6.5 Nomasir — gastos', () => {
  it('abre com a história do Nomasir e pergunta onde escapa', () => {
    const p = percorrer(ROTEIRO_GASTOS, [], base());
    expect(ROTEIRO_GASTOS).toMatchObject({ id: 'gastos', agente: 'nomasir', primeiro: 'abertura' });
    expect(p.atual?.id).toBe('onde');
    expect(falasDe(p, 'abertura')).toEqual(['Vou ser sincero: eu perdi todo o ouro que meu pai me deu antes de aprender.', 'Gasto pequeno que se repete é o que mais pesa.']);
    expect(falasDoRoteiro.falas(p.atual!, p.ctx)).toEqual(['Onde você acha que mais escapa?', 'Pode marcar mais de um.']);
    const r = respostaDe(p.atual!, p.ctx);
    expect(r.tipo === 'multiplo' && r.opcoes.map((o) => o.rotulo)).toEqual(['Delivery', 'Assinaturas', 'Compras online', 'Saídas', 'Transporte por app', 'Outro']);
  });

  it('caminho feliz: segue a ordem das opções, corta assinatura e limita; economia no rodapé quando não cabe', () => {
    const fim = responder([
      ['onde', ['saidas', 'assinaturas', 'delivery']], // ordem do toque não importa
      ['gasto_delivery', 400],
      ['teto_delivery', 200],
      ['assinaturas', [{ nome: 'Netflix', valor: 40 }, { nome: 'Spotify', valor: 22 }, { nome: 'App de treino', valor: 30 }]],
      ['nao_usou', ['a1', 'a3']],
      ['gasto_saidas', 300],
      ['teto_saidas', 300],
    ]);
    expect(fim.fim).toBe(true);
    expect(ultimo(fim)).toBe('resultado');

    // falas
    expect(falasDe(fim, 'gasto_delivery')).toEqual(['Quanto vai em delivery por mês, mais ou menos?']);
    expect(falasDe(fim, 'teto_delivery')).toEqual(['R$ 400 por mês dá R$ 4.800 no ano.', 'E quanto você topa gastar no máximo?', 'Se quiser cortar de vez, pode pôr zero.']);
    expect(falasDe(fim, 'teto_saidas')).toEqual(['R$ 300 por mês dá R$ 3.600 no ano.', 'E quanto você topa gastar no máximo?']); // a dica do zero só na primeira vez
    expect(falasDe(fim, 'nao_usou')).toEqual(['Somando, dá R$ 92 por mês, R$ 1.104 no ano.', 'Qual você não usou no último mês?', 'Pode marcar mais de uma.']);
    expect(falasDe(fim, 'resultado')).toEqual(['Pronto, Ana. Segurando esses gastos, sobram R$ 270 por mês.', 'Em um ano, isso dá R$ 3.240. Foi cortando o pequeno que eu voltei a juntar ouro.']);

    // as opções do "não usei" são as assinaturas listadas + "Usei todas"
    const v = fim.visitas.find((x) => x.passo.id === 'nao_usou')!;
    const r = respostaDe(v.passo, v.ctx);
    expect(r.tipo === 'multiplo' && r.opcoes).toEqual([
      { valor: 'a1', rotulo: 'Netflix' },
      { valor: 'a2', rotulo: 'Spotify' },
      { valor: 'a3', rotulo: 'App de treino' },
      { valor: USEI_TODAS, rotulo: 'Usei todas' },
    ]);
    expect(rotuloDe(v.passo, ['a1', 'a3'], fim.ctx)).toBe('Netflix, App de treino');

    // cartão: 4 itens, só 3 linhas; a economia vai pro rodapé e o resto aparece nos detalhes
    const res = ROTEIRO_GASTOS.resultado!(fim.ctx);
    expect(res.titulo).toBe('Seu plano com Nomasir');
    expect(res.linhas).toEqual(['1. Delivery: no máximo R$ 200/mês', '2. Cancelar Netflix (R$ 40)', '3. Cancelar App de treino (R$ 30)']);
    expect(res.rodape).toBe('Economia estimada: R$ 270/mês → R$ 3.240/ano');
    expect(res.lista).toEqual(['Delivery: no máximo R$ 200/mês', 'Cancelar Netflix (R$ 40)', 'Cancelar App de treino (R$ 30)', 'Saídas: no máximo R$ 300/mês']);
    expect(res.agentes).toEqual(['nomasir']);

    // missão
    const c = ROTEIRO_GASTOS.concluir!(fim.ctx, 'nomasir:gastos');
    expect(c.ativar).toEqual(['nomasir']);
    expect(c.efeitos).toBeUndefined();
    expect(c.missoes).toHaveLength(1);
    const m = c.missoes[0];
    expect(m).toMatchObject({
      agente: 'nomasir',
      conversa: 'nomasir:gastos',
      titulo: 'Segurar os gastos',
      tipo: 'gastos',
      status: 'ativa',
      metaValor: 0,
      valorInicial: 0,
      valorMensal: 270,
      economiaMensal: 270,
      dataInicio: '2026-10-21',
      editarPasso: 'onde',
      limites: { Delivery: 200, Saídas: 300 },
    });
    expect(m.passos).toEqual([
      { id: 'c1', ordem: 1, titulo: 'Cancelar Netflix', valor: 40, acao: 'cancelar', dataAlvo: '2026-10' },
      { id: 'c2', ordem: 2, titulo: 'Cancelar App de treino', valor: 30, acao: 'cancelar', dataAlvo: '2026-10' },
      { id: 'l1', ordem: 3, titulo: 'Gastar no máximo R$ 200 com delivery este mês', valor: 200, acao: 'conferir', dataAlvo: '2026-10' },
      { id: 'l2', ordem: 4, titulo: 'Gastar no máximo R$ 300 com saídas este mês', valor: 300, acao: 'conferir', dataAlvo: '2026-10' },
    ]);
  });

  it('teto zero corta de vez; com poucos itens a economia é a última linha', () => {
    const fim = responder([
      ['onde', ['delivery']],
      ['gasto_delivery', 150],
      ['teto_delivery', 0],
    ]);
    const v = fim.visitas.find((x) => x.passo.id === 'teto_delivery')!;
    expect(rotuloDe(v.passo, 0, fim.ctx)).toBe('R$ 0 (cortar de vez)');
    expect(rotuloDe(v.passo, 120, fim.ctx)).toBe('R$ 120');
    const res = ROTEIRO_GASTOS.resultado!(fim.ctx);
    expect(res.linhas).toEqual(['1. Delivery: cortar de vez (R$ 150/mês)', '2. Economia estimada: R$ 150/mês → R$ 1.800/ano']);
    expect(res.rodape).toBe('Estimativa com os seus números.');
    expect(res.lista).toBeUndefined();
    const m = ROTEIRO_GASTOS.concluir!(fim.ctx, 'x').missoes[0];
    expect(m).toMatchObject({ valorMensal: 150, economiaMensal: 150, limites: { Delivery: 0 } });
    expect(m.passos).toEqual([{ id: 'l1', ordem: 1, titulo: 'Não gastar com delivery este mês', valor: 0, acao: 'conferir', dataAlvo: '2026-10' }]);
  });

  it('três itens com economia: as três linhas são os itens e a economia vai pro rodapé', () => {
    const fim = responder([
      ['onde', ['delivery', 'compras', 'app']],
      ['gasto_delivery', 300],
      ['teto_delivery', 200],
      ['gasto_compras', 500],
      ['teto_compras', 250],
      ['gasto_app', 200],
      ['teto_app', 150],
    ]);
    const res = ROTEIRO_GASTOS.resultado!(fim.ctx);
    expect(res.linhas).toEqual(['1. Compras online: no máximo R$ 250/mês', '2. Delivery: no máximo R$ 200/mês', '3. Transporte por app: no máximo R$ 150/mês']);
    expect(res.rodape).toBe('Economia estimada: R$ 400/mês → R$ 4.800/ano');
    expect(res.lista).toBeUndefined();
    expect(falasDe(fim, 'gasto_app')).toEqual(['Quanto vai em corridas de app por mês, mais ou menos?']);
    const m = ROTEIRO_GASTOS.concluir!(fim.ctx, 'x').missoes[0];
    expect(m.limites).toEqual({ 'Compras online': 250, Delivery: 200, 'Transporte por app': 150 });
    expect(m.passos.map((p) => p.titulo)).toEqual([
      'Gastar no máximo R$ 250 com compras online este mês',
      'Gastar no máximo R$ 200 com delivery este mês',
      'Gastar no máximo R$ 150 com corridas de app este mês',
    ]);
  });

  it('"outro" pergunta com o quê e usa o nome nas falas, no cartão e nos limites', () => {
    const fim = responder([
      ['onde', ['outro', 'app']],
      ['gasto_app', 200],
      ['teto_app', 120],
      ['outro_nome', '  Farmácia '],
      ['gasto_outro', 180],
      ['teto_outro', 100],
    ]);
    expect(falasDe(fim, 'outro_nome')).toEqual(['Com o quê?']);
    expect(falasDe(fim, 'gasto_outro')).toEqual(['Quanto vai em farmácia por mês, mais ou menos?']);
    const res = ROTEIRO_GASTOS.resultado!(fim.ctx);
    expect(res.linhas).toEqual(['1. Transporte por app: no máximo R$ 120/mês', '2. Farmácia: no máximo R$ 100/mês', '3. Economia estimada: R$ 160/mês → R$ 1.920/ano']);
    const m = ROTEIRO_GASTOS.concluir!(fim.ctx, 'x').missoes[0];
    expect(m.limites).toEqual({ 'Transporte por app': 120, Farmácia: 100 });
    expect(m.passos.map((p) => p.titulo)).toContain('Gastar no máximo R$ 100 com farmácia este mês');
  });

  it('"outro" com nome de uma categoria da lista não apaga o limite dela; sigla fica como está', () => {
    const fim = responder([
      ['onde', ['delivery', 'outro']],
      ['gasto_delivery', 300],
      ['teto_delivery', 200],
      ['outro_nome', 'delivery'],
      ['gasto_outro', 100],
      ['teto_outro', 50],
    ]);
    expect(planoGastos(fim.ctx).limites.map((l) => l.rotulo)).toEqual(['Delivery', 'Delivery (outro)']);
    const sigla = responder([['onde', ['outro']], ['outro_nome', 'iFood'], ['gasto_outro', 100], ['teto_outro', 80]]);
    expect(falasDe(sigla, 'gasto_outro')).toEqual(['Quanto vai em iFood por mês, mais ou menos?']);
    expect(planoGastos(sigla.ctx).limites[0].rotulo).toBe('iFood');
    const minusculo = responder([['onde', ['outro']], ['outro_nome', 'lanche na rua'], ['gasto_outro', 100], ['teto_outro', 80]]);
    expect(planoGastos(minusculo.ctx).limites[0].rotulo).toBe('Lanche na rua');
  });

  it('"Usei todas" não cancela nada; sem nada pra cortar, ainda cria a missão com os limites', () => {
    const fim = responder([
      ['onde', ['delivery', 'assinaturas']],
      ['gasto_delivery', 200],
      ['teto_delivery', 200],
      ['assinaturas', [{ nome: 'Netflix', valor: 40 }, { nome: 'Spotify', valor: 25 }]],
      ['nao_usou', [USEI_TODAS]],
    ]);
    expect(ultimo(fim)).toBe('resultado');
    expect(falasDe(fim, 'resultado')).toEqual(['Esses gastos já estão bem controlados, Ana.', 'Vou deixar os limites anotados pra você manter assim.']);
    const res = ROTEIRO_GASTOS.resultado!(fim.ctx);
    expect(res.linhas).toEqual(['1. Delivery: no máximo R$ 200/mês', '2. Assinaturas: manter as que você usa (R$ 65/mês)']);
    expect(res.rodape).toBe('Seus gastos já estão bem controlados. Agora é manter.');
    const m = ROTEIRO_GASTOS.concluir!(fim.ctx, 'x').missoes[0];
    expect(m).toMatchObject({ tipo: 'gastos', valorMensal: 0, economiaMensal: 0, limites: { Delivery: 200 }, notas: 'Seus gastos já estão bem controlados. Agora é manter.' });
    expect(m.passos).toEqual([{ id: 'l1', ordem: 1, titulo: 'Gastar no máximo R$ 200 com delivery este mês', valor: 200, acao: 'conferir', dataAlvo: '2026-10' }]);
  });

  it('só assinaturas: cancela as não usadas (da mais cara pra mais barata)', () => {
    const fim = responder([
      ['onde', ['assinaturas']],
      ['assinaturas', [{ nome: 'Jornal', valor: 15 }, { nome: 'Netflix', valor: 55.9 }]],
      ['nao_usou', ['a1', 'a2']],
    ]);
    const res = ROTEIRO_GASTOS.resultado!(fim.ctx);
    expect(res.linhas).toEqual(['1. Cancelar Netflix (R$ 56)', '2. Cancelar Jornal (R$ 15)', '3. Economia estimada: R$ 71/mês → R$ 851/ano']);
    const m = ROTEIRO_GASTOS.concluir!(fim.ctx, 'x').missoes[0];
    expect(m).toMatchObject({ valorMensal: 70.9, economiaMensal: 70.9, limites: {} });
    expect(m.passos.map((p) => [p.titulo, p.acao])).toEqual([
      ['Cancelar Netflix', 'cancelar'],
      ['Cancelar Jornal', 'cancelar'],
    ]);
  });

  it('lista de assinaturas vazia pula o "não usei" e segue pra próxima categoria', () => {
    const fim = responder([
      ['onde', ['assinaturas', 'saidas']],
      ['assinaturas', []],
      ['gasto_saidas', 250],
      ['teto_saidas', 150],
    ]);
    expect(fim.visitas.some((v) => v.passo.id === 'nao_usou')).toBe(false);
    expect(ROTEIRO_GASTOS.resultado!(fim.ctx).linhas).toEqual(['1. Saídas: no máximo R$ 150/mês', '2. Economia estimada: R$ 100/mês → R$ 1.200/ano']);
  });

  it('gasto zero pula o teto; sem nada no plano, o cartão e a missão ainda fazem sentido', () => {
    const fim = responder(
      [
        ['onde', ['delivery', 'compras']],
        ['gasto_delivery', 0],
        ['gasto_compras', 0],
      ],
      {},
      ''
    );
    expect(fim.fim).toBe(true);
    expect(fim.visitas.some((v) => v.passo.id.startsWith('teto_'))).toBe(false);
    expect(falasDe(fim, 'resultado')).toEqual(['Pelo que você contou, não tem nada escapando agora. Melhor assim.', 'Se algo mudar, é só voltar aqui.']);
    const res = ROTEIRO_GASTOS.resultado!(fim.ctx);
    expect(res.linhas).toEqual(['1. Seguir de olho nos gastos pequenos']);
    const m = ROTEIRO_GASTOS.concluir!(fim.ctx, 'x').missoes[0];
    expect(m).toMatchObject({ tipo: 'gastos', valorMensal: 0, limites: {} });
    expect(m.passos).toEqual([{ id: 'p1', ordem: 1, titulo: 'Anotar os gastos pequenos deste mês', acao: 'conferir', dataAlvo: '2026-10' }]);
  });

  it('sugere um teto 30% menor', () => {
    const p = responder([['onde', ['delivery']], ['gasto_delivery', 300]]);
    const r = respostaDe(p.atual!, p.ctx);
    expect(r.tipo === 'dinheiro' && r.sugestao?.(p.ctx)).toEqual({ valor: 210, rotulo: 'R$ 210 (30% a menos)' });
    const pequeno = responder([['onde', ['delivery']], ['gasto_delivery', 5]]);
    const r2 = respostaDe(pequeno.atual!, pequeno.ctx);
    expect(r2.tipo === 'dinheiro' && r2.sugestao?.(pequeno.ctx)).toBeNull();
  });

  it('validações ditas pelo Nomasir', () => {
    expect(erro([], 'onde', [])).toBe('Escolha pelo menos uma opção.');
    const ate = [['onde', ['delivery', 'outro']], ['gasto_delivery', 200]] as [string, Valor][];
    expect(erro(ate, 'teto_delivery', 250)).toBe('Assim o teto fica acima do que já vai hoje (R$ 200). Pode ser igual ou menor.');
    expect(erro(ate, 'teto_delivery', 200)).toBeNull();
    expect(erro(ate, 'teto_delivery', 0)).toBeNull();
    expect(erro(ate, 'teto_delivery', -10)).toBe('O valor não pode ser negativo.');
    expect(erro([['onde', ['delivery']]], 'gasto_delivery', -1)).toBe('O valor não pode ser negativo.');
    const outro = [...ate, ['teto_delivery', 100]] as [string, Valor][];
    expect(erro(outro, 'outro_nome', 'x'.repeat(31))).toBe('Resume em poucas palavras, até 30 letras.');
    expect(erro(outro, 'outro_nome', '   ')).toBe('Escreva alguma coisa.');
    const assin = [['onde', ['assinaturas']]] as [string, Valor][];
    expect(erro(assin, 'assinaturas', [{ nome: 'Netflix', valor: null }])).toBe('Falta quanto por mês em Netflix.');
    expect(erro(assin, 'assinaturas', [{ nome: '', valor: 30 }])).toBe('Falta nome em uma assinatura.');
    const listadas = [...assin, ['assinaturas', [{ nome: 'Netflix', valor: 40 }]]] as [string, Valor][];
    expect(erro(listadas, 'nao_usou', ['a1', USEI_TODAS])).toBe('Você marcou “Usei todas” e também uma que não usou. Fica com qual?');
    expect(erro(listadas, 'nao_usou', [])).toBe('Escolha pelo menos uma opção.');
  });

  it('mudar onde escapa descarta as respostas que não batem mais', () => {
    const r: RespostaDada[] = [
      { passo: 'onde', valor: ['saidas'] },
      { passo: 'gasto_delivery', valor: 300 },
    ];
    const p = percorrer(ROTEIRO_GASTOS, r, base());
    expect(p.atual?.id).toBe('gasto_saidas');
    expect(p.validas).toHaveLength(1);
  });

  it('usuário novo, sem nenhum dado, e valor pequeno (R$ 0,50): os centavos não somem', () => {
    const fim = responder([['onde', ['saidas']], ['gasto_saidas', 0.5], ['teto_saidas', 0]], {}, '');
    expect(fim.fim).toBe(true);
    expect(falasDe(fim, 'teto_saidas')[0]).toBe('R$ 0,50 por mês dá R$ 6 no ano.');
    expect(falasDe(fim, 'resultado')[0]).toBe('Pronto. Segurando esses gastos, sobram R$ 0,50 por mês.');
    expect(ROTEIRO_GASTOS.resultado!(fim.ctx).linhas).toEqual(['1. Saídas: cortar de vez (R$ 0,50/mês)', '2. Economia estimada: R$ 0,50/mês → R$ 6/ano']);
    const m = ROTEIRO_GASTOS.concluir!(fim.ctx, 'x').missoes[0];
    expect(m).toMatchObject({ valorMensal: 0.5, economiaMensal: 0.5, limites: { Saídas: 0 }, notas: 'Segurando esses gastos, sobram R$ 0,50 por mês.' });
    // R$ 0,40 não vira "R$ 0"
    const menor = responder([['onde', ['delivery']], ['gasto_delivery', 0.4], ['teto_delivery', 0]], {}, '');
    expect(falasDe(menor, 'teto_delivery')[0]).toBe('R$ 0,40 por mês dá R$ 4,80 no ano.');
    expect(falasDe(menor, 'resultado')[0]).toBe('Pronto. Segurando esses gastos, sobram R$ 0,40 por mês.');
  });

  it('valores enormes (R$ 1.000.000) não quebram as contas nem o texto', () => {
    const fim = responder([['onde', ['compras']], ['gasto_compras', 1_000_000], ['teto_compras', 400_000]]);
    expect(falasDe(fim, 'teto_compras')[0]).toBe('R$ 1.000.000 por mês dá R$ 12.000.000 no ano.');
    const v = fim.visitas.find((x) => x.passo.id === 'teto_compras')!;
    const r = respostaDe(v.passo, v.ctx);
    expect(r.tipo === 'dinheiro' && r.sugestao?.(v.ctx)).toEqual({ valor: 700_000, rotulo: 'R$ 700.000 (30% a menos)' });
    expect(ROTEIRO_GASTOS.resultado!(fim.ctx).linhas).toEqual(['1. Compras online: no máximo R$ 400.000/mês', '2. Economia estimada: R$ 600.000/mês → R$ 7.200.000/ano']);
    expect(ROTEIRO_GASTOS.concluir!(fim.ctx, 'x').missoes[0]).toMatchObject({ valorMensal: 600_000, limites: { 'Compras online': 400_000 } });
    expect(erro([['onde', ['compras']]], 'gasto_compras', 20_000_000)).toBe('Esse valor parece alto demais. Confere e digita de novo?');
  });

  it('uma assinatura só: sem "somando" e sem "mais de uma"', () => {
    const fim = responder([
      ['onde', ['assinaturas']],
      ['assinaturas', [{ nome: 'Netflix', valor: 40 }]],
      ['nao_usou', [USEI_TODAS]],
    ]);
    expect(falasDe(fim, 'nao_usou')).toEqual(['Dá R$ 40 por mês, R$ 480 no ano.', 'Qual você não usou no último mês?']);
    expect(falasDe(fim, 'resultado')[0]).toBe('Pelo que você contou, não tem nada escapando agora, Ana. Melhor assim.');
    const res = ROTEIRO_GASTOS.resultado!(fim.ctx);
    expect(res.linhas).toEqual(['1. Assinaturas: manter as que você usa (R$ 40/mês)']);
    const m = ROTEIRO_GASTOS.concluir!(fim.ctx, 'x').missoes[0];
    expect(m).toMatchObject({ valorMensal: 0, economiaMensal: 0, limites: {} });
    expect(m.passos.map((p) => p.titulo)).toEqual(['Anotar os gastos pequenos deste mês']);
  });

  it('editar uma resposta do meio: as perguntas seguintes usam o valor novo', () => {
    const antes: RespostaDada[] = [
      { passo: 'onde', valor: ['delivery', 'saidas'] },
      { passo: 'gasto_delivery', valor: 400 },
      { passo: 'teto_delivery', valor: 300 },
      { passo: 'gasto_saidas', valor: 200 },
    ];
    // a tela corta a lista na resposta editada e manda o valor novo
    const editado = [...antes.slice(0, 1), { passo: 'gasto_delivery', valor: 150 }];
    const p = percorrer(ROTEIRO_GASTOS, editado, base());
    expect(p.atual?.id).toBe('teto_delivery');
    expect(falasDoRoteiro.falas(p.atual!, p.ctx)[0]).toBe('R$ 150 por mês dá R$ 1.800 no ano.');
    expect(conferir(p.atual!, 300, p.ctx)).toBe('Assim o teto fica acima do que já vai hoje (R$ 150). Pode ser igual ou menor.');
    // trocar o "onde" muda o caminho: agora as assinaturas entram depois do delivery
    const outroCaminho = percorrer(ROTEIRO_GASTOS, [{ passo: 'onde', valor: ['delivery', 'assinaturas'] }, ...antes.slice(1, 3)], base());
    expect(outroCaminho.atual?.id).toBe('assinaturas');
    // a dica do zero volta pro primeiro teto do caminho novo
    const v = outroCaminho.visitas.find((x) => x.passo.id === 'teto_delivery')!;
    expect(falasDoRoteiro.falas(v.passo, v.ctx)[2]).toBe('Se quiser cortar de vez, pode pôr zero.');
    // sem "gasto" respondido, o cartão não inventa limite
    expect(planoGastos(percorrer(ROTEIRO_GASTOS, [antes[0]], base()).ctx).limites).toEqual([]);
  });

  it('textos sem palavras proibidas, até 3 balões por passo e até 3 linhas numeradas', () => {
    const caminhos = [
      responder([['onde', ['delivery', 'assinaturas', 'compras', 'saidas', 'app', 'outro']], ['gasto_delivery', 400], ['teto_delivery', 0], ['assinaturas', [{ nome: 'Netflix', valor: 40 }, { nome: 'Spotify', valor: 22 }]], ['nao_usou', ['a2']], ['gasto_compras', 300], ['teto_compras', 300], ['gasto_saidas', 0], ['gasto_app', 120], ['teto_app', 80], ['outro_nome', 'Cigarro'], ['gasto_outro', 200], ['teto_outro', 50]]),
      responder([['onde', ['assinaturas']], ['assinaturas', []]], {}, ''),
      responder([['onde', ['delivery']], ['gasto_delivery', 200], ['teto_delivery', 200]]),
      responder([['onde', ['outro']], ['outro_nome', 'farmácia'], ['gasto_outro', 0.5], ['teto_outro', 0]], {}, ''),
    ];
    const proibidas = /aporte|despesa|fechar o m[eê]s|o combinado|inadimpl/i;
    for (const fim of caminhos) {
      expect(fim.fim).toBe(true);
      for (const v of fim.visitas) {
        const f = falasDoRoteiro.falas(v.passo, v.ctx);
        expect(f.length).toBeGreaterThan(0);
        expect(f.length).toBeLessThanOrEqual(3);
        for (const s of f) expect(s).not.toMatch(proibidas);
      }
      const res = ROTEIRO_GASTOS.resultado!(fim.ctx);
      expect(res.linhas.length).toBeGreaterThan(0);
      expect(res.linhas.length).toBeLessThanOrEqual(3);
      res.linhas.forEach((l, i) => expect(l.startsWith(`${i + 1}. `)).toBe(true));
      for (const s of [res.titulo, ...res.linhas, ...(res.lista ?? []), res.rodape ?? '']) expect(s).not.toMatch(proibidas);
      const m = ROTEIRO_GASTOS.concluir!(fim.ctx, 'x').missoes[0];
      for (const passo of m.passos) {
        expect(passo.titulo).not.toMatch(proibidas);
        expect(passo.dataAlvo).toBe('2026-10'); // nunca mês futuro
      }
      expect(m.notas ?? '').not.toMatch(proibidas);
    }
    // o caminho completo: 5 itens, economia no rodapé, a lista traz tudo
    const res = ROTEIRO_GASTOS.resultado!(caminhos[0].ctx);
    expect(res.linhas).toEqual(['1. Delivery: cortar de vez (R$ 400/mês)', '2. Cigarro: no máximo R$ 50/mês', '3. Transporte por app: no máximo R$ 80/mês']);
    expect(res.rodape).toBe('Economia estimada: R$ 612/mês → R$ 7.344/ano');
    expect(res.lista).toEqual(['Delivery: cortar de vez (R$ 400/mês)', 'Cigarro: no máximo R$ 50/mês', 'Transporte por app: no máximo R$ 80/mês', 'Cancelar Spotify (R$ 22)', 'Compras online: no máximo R$ 300/mês']);
    const m = ROTEIRO_GASTOS.concluir!(caminhos[0].ctx, 'x').missoes[0];
    expect(m.limites).toEqual({ Delivery: 0, Cigarro: 50, 'Transporte por app': 80, 'Compras online': 300 });
    expect(m.passos.map((p) => [p.titulo, p.acao])).toEqual([
      ['Cancelar Spotify', 'cancelar'],
      ['Não gastar com delivery este mês', 'conferir'],
      ['Gastar no máximo R$ 50 com cigarro este mês', 'conferir'],
      ['Gastar no máximo R$ 80 com corridas de app este mês', 'conferir'],
      ['Gastar no máximo R$ 300 com compras online este mês', 'conferir'],
    ]);
  });
});
