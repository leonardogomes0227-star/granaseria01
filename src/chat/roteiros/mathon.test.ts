import { describe, expect, it } from 'vitest';
import { conferir, falasDoRoteiro, percorrer, respostaDe, rotuloDe, type RespostaDada, type Valor } from '../engine';
import { dadosDeEstado } from '../dados';
import { melhorProposta, parecerDoChat, propostaDoChat, propostasDoChat, ROTEIRO_EMPRESTIMO, taxaTexto } from './mathon';

const NOW = new Date('2026-10-21T15:00:00Z'); // hoje = 2026-10-21
const base = (state: Record<string, string> = {}, nome = 'Ana') => ({ agente: 'mathon' as const, nome, dados: dadosDeEstado(state, NOW) });
const comRenda = (renda: number) => ({ 'gs-eu': JSON.stringify({ renda }) });

function responder(pares: [string, Valor][], state: Record<string, string> = {}, nome = 'Ana') {
  const r: RespostaDada[] = [];
  for (const [passo, valor] of pares) {
    const p = percorrer(ROTEIRO_EMPRESTIMO, r, base(state, nome));
    expect(p.atual?.id, `esperava ${passo}`).toBe(passo);
    expect(conferir(p.atual!, valor, p.ctx), `resposta de ${passo}`).toBeNull();
    r.push({ passo, valor });
  }
  return percorrer(ROTEIRO_EMPRESTIMO, r, base(state, nome));
}

/** Onde a conversa está depois dessas respostas (sem conferir). */
const ate = (pares: [string, Valor][], state: Record<string, string> = {}, nome = 'Ana') =>
  percorrer(
    ROTEIRO_EMPRESTIMO,
    pares.map(([passo, valor]) => ({ passo, valor })),
    base(state, nome)
  );

/** O erro que o Mathon diz pra essa resposta no passo em que a conversa está. */
const erro = (pares: [string, Valor][], valor: Valor, state: Record<string, string> = {}) => {
  const p = ate(pares, state);
  return conferir(p.atual!, valor, p.ctx);
};

const falasDe = (p: ReturnType<typeof percorrer>, id: string) => {
  const v = [...p.visitas].reverse().find((x) => x.passo.id === id);
  return v ? falasDoRoteiro.falas(v.passo, v.ctx) : [];
};
const falasAtuais = (p: ReturnType<typeof percorrer>) => falasDoRoteiro.falas(p.atual!, p.ctx);
const opcoesAtuais = (p: ReturnType<typeof percorrer>) => {
  const r = respostaDe(p.atual!, p.ctx);
  return r.tipo === 'botoes' ? r.opcoes.map((o) => o.valor) : [];
};

const CALMA = 'Proposta boa não some em dois dias. Leia o contrato com calma antes de assinar.';
const RODAPE = 'Estimativa com os números da proposta. Não é recomendação de crédito.';

// Proposta 1 sabendo a parcela, cara: 5.000 em 12x de 700 = 8.400 (9,05% a.m.)
const CARA: [string, Valor][] = [
  ['p1_valor', 5000],
  ['p1_parcelas', 12],
  ['p1_sabe', 'parcela'],
  ['p1_parcela', 700],
  ['para', 'Trocar a geladeira'],
];
// Proposta 1 sabendo a taxa, dentro do comum: 10.000 em 12x a 2,5% = 974,87 por mês, 11.698,44 no total
const PELA_TAXA: [string, Valor][] = [
  ['p1_valor', 10000],
  ['p1_parcelas', 12],
  ['p1_sabe', 'taxa'],
  ['p1_taxa', 2.5],
  ['para', 'Reforma do banheiro'],
];

describe('6.6 Mathon — antes de pegar empréstimo', () => {
  it('é o roteiro "emprestimo" do Mathon e abre desconfiado, olhando o total', () => {
    expect(ROTEIRO_EMPRESTIMO).toMatchObject({ id: 'emprestimo', agente: 'mathon', titulo: 'Antes de pegar empréstimo', primeiro: 'abertura' });
    const p = ate([]);
    expect(falasDe(p, 'abertura')).toEqual(['Antes de assinar qualquer coisa, Ana, me mostra a proposta.', 'Eu olho o total, não só a parcela.']);
    expect(falasDe(ate([], {}, ''), 'abertura')[0]).toBe('Antes de assinar qualquer coisa, me mostra a proposta.');
    expect(p.atual?.id).toBe('p1_valor');
    expect(falasAtuais(p)).toEqual(['Quanto você quer pegar?']);
    const r = respostaDe(p.atual!, p.ctx);
    expect(r).toMatchObject({ tipo: 'dinheiro', min: 1 });
    if (r.tipo === 'dinheiro') expect(r.sugestao?.(p.ctx)).toBeNull(); // na primeira, nada pra sugerir
  });

  it('pergunta parcelas (6, 12, 24, 36), se sabe a parcela ou a taxa, e mostra "12x" no balão', () => {
    const p = ate([['p1_valor', 5000]]);
    expect(p.atual?.id).toBe('p1_parcelas');
    expect(falasAtuais(p)).toEqual(['Em quantas parcelas?']);
    expect(respostaDe(p.atual!, p.ctx)).toMatchObject({ tipo: 'numero', min: 1, max: 120, sugestoes: [6, 12, 24, 36] });
    expect(rotuloDe(p.atual!, 12, p.ctx)).toBe('12x');

    const s = ate([['p1_valor', 5000], ['p1_parcelas', 12]]);
    expect(falasAtuais(s)).toEqual(['Você sabe o valor da parcela ou a taxa?']);
    expect(rotuloDe(s.atual!, 'parcela', s.ctx)).toBe('Sei a parcela');
    expect(rotuloDe(s.atual!, 'taxa', s.ctx)).toBe('Sei a taxa');

    expect(ate([...CARA.slice(0, 3)]).atual?.id).toBe('p1_parcela');
    const t = ate([['p1_valor', 5000], ['p1_parcelas', 12], ['p1_sabe', 'taxa']]);
    expect(t.atual?.id).toBe('p1_taxa');
    expect(respostaDe(t.atual!, t.ctx)).toMatchObject({ tipo: 'numero', min: 0, max: 30, decimais: 2, sufixo: '% a.m.' });
    expect(rotuloDe(t.atual!, 2.5, t.ctx)).toBe('2,5% a.m.');
  });

  it('caminho feliz: proposta cara (acima de 5% a.m.) sugere esperar guardando a parcela', () => {
    const p = ate(CARA.slice(0, 4));
    expect(p.atual?.id).toBe('para');
    expect(falasAtuais(p)).toEqual(['Pra quê é esse dinheiro?']);
    expect(respostaDe(p.atual!, p.ctx)).toMatchObject({ tipo: 'texto', max: 40 });

    const parecer = responder(CARA);
    expect(parecer.atual?.id).toBe('p1_parecer');
    expect(falasAtuais(parecer)).toEqual(['Você vai pagar R$ 8.400 por R$ 5.000. São R$ 3.400 só de juros.', 'Esse ouro sai caro. Se puder esperar 8 meses guardando R$ 700, você compra sem pagar juros.']);
    expect(opcoesAtuais(parecer)).toEqual(['comparar', 'salvar']);
    expect(rotuloDe(parecer.atual!, 'comparar', parecer.ctx)).toBe('Comparar outra proposta');
    expect(rotuloDe(parecer.atual!, 'salvar', parecer.ctx)).toBe('Salvar parecer');

    const fim = responder([...CARA, ['p1_parecer', 'salvar']]);
    expect(fim.fim).toBe(true);
    expect(falasDe(fim, 'fim')).toEqual(['Esse é o meu parecer, Ana.', CALMA]);
    expect(propostaDoChat(fim.ctx, 1)).toEqual({ n: 1, valor: 5000, parcelas: 12, parcela: 700, taxa: 9.05, total: 8400, juros: 3400 });

    const res = ROTEIRO_EMPRESTIMO.resultado!(fim.ctx);
    expect(res).toEqual({
      titulo: 'Parecer do Mathon',
      linhas: ['1. Proposta 1: R$ 8.400 no total · 9,05% a.m.'], // uma só: nada de "a melhor"
      lista: ['Pra quê: Trocar a geladeira', 'Proposta 1: 12x de R$ 700 · R$ 3.400 de juros'],
      agentes: ['mathon'],
      rodape: RODAPE,
      botao: 'Salvar parecer',
    });
  });

  it('concluir: nenhuma missão, ativa o Mathon e deixa o parecer pra salvar', () => {
    const fim = responder([...CARA, ['p1_parecer', 'salvar']]);
    const c = ROTEIRO_EMPRESTIMO.concluir!(fim.ctx, 'mathon:emprestimo');
    expect(c.missoes).toEqual([]);
    expect(c.ativar).toEqual(['mathon']);
    expect(c.eu).toBeUndefined();
    expect(typeof c.efeitos).toBe('function'); // grava em gs-resultados e gs-mathon-parecer: não roda aqui (sem localStorage)

    const p = parecerDoChat(fim.ctx);
    expect(p.resumo).toBe('R$ 5.000 em 12x de R$ 700 = R$ 8.400 · 9,05% a.m.');
    expect(p.card).toEqual({
      label: 'Custo total',
      big: 'R$ 8.400',
      rows: [
        ['Proposta 1', '12x de R$ 700 = R$ 8.400 · 9,05% a.m.'],
        ['Pra quê', 'Trocar a geladeira'],
      ],
    });
    expect(p.registro).toEqual({ em: '2026-10-21', para: 'Trocar a geladeira', melhor: null, propostas: [{ valor: 5000, parcelas: 12, parcela: 700, taxa: 9.05, total: 8400, juros: 3400 }] });
  });

  it('cara em uma parcela só: "esperar 1 mês"', () => {
    const p = responder([['p1_valor', 1000], ['p1_parcelas', 1], ['p1_sabe', 'parcela'], ['p1_parcela', 1100], ['para', 'Conserto do carro']]);
    expect(falasAtuais(p)).toEqual(['Você vai pagar R$ 1.100 por R$ 1.000. São R$ 100 só de juros.', 'Esse ouro sai caro. Se puder esperar 1 mês guardando R$ 1.100, você compra sem pagar juros.']);
  });

  it('pela taxa, dentro do comum e sem saber a renda: só assinar se a parcela couber', () => {
    const p = responder(PELA_TAXA);
    expect(p.atual?.id).toBe('p1_parecer');
    expect(falasAtuais(p)).toEqual(['Você vai pagar R$ 11.698 por R$ 10.000. São R$ 1.698 só de juros.', 'A taxa está dentro do comum. Mesmo assim, só assine se a parcela couber no seu mês.']);
    expect(propostaDoChat(p.ctx, 1)).toMatchObject({ parcela: 974.87, taxa: 2.5, total: 11698.44, juros: 1698.44 });
  });

  it('exatamente 5% a.m. ainda é "dentro do comum"', () => {
    const p = responder([['p1_valor', 1000], ['p1_parcelas', 10], ['p1_sabe', 'taxa'], ['p1_taxa', 5], ['para', 'Curso']]);
    expect(falasAtuais(p)[1]).toBe('A taxa está dentro do comum. Mesmo assim, só assine se a parcela couber no seu mês.');
  });

  it('parcela acima de 30% do que entra: avisa com calma', () => {
    const aperta = responder(PELA_TAXA, comRenda(3000)); // 975 > 900
    expect(falasAtuais(aperta)[1]).toBe('A taxa está dentro do comum. Mas a parcela de R$ 975 passa de 30% do que entra por mês. Eu pegaria um valor menor.');
    const cabe = responder(PELA_TAXA, comRenda(5000)); // 975 < 1.500
    expect(falasAtuais(cabe)[1]).toBe('A taxa está dentro do comum. Mesmo assim, só assine se a parcela couber no seu mês.');
  });

  it('sem juros: pede pra conferir tarifas escondidas (e também olha a renda)', () => {
    const SEM_JUROS: [string, Valor][] = [['p1_valor', 1200], ['p1_parcelas', 12], ['p1_sabe', 'parcela'], ['p1_parcela', 100], ['para', 'Celular']];
    const p = responder(SEM_JUROS);
    expect(falasAtuais(p)).toEqual(['Você vai pagar R$ 1.200 por R$ 1.200. Não tem juros nessa conta.', 'Confira se não tem tarifa ou seguro escondido no contrato. E só assine se a parcela couber no seu mês.']);
    expect(propostaDoChat(p.ctx, 1)).toMatchObject({ taxa: 0, juros: 0 });
    const aperta = responder(SEM_JUROS, comRenda(300));
    expect(falasAtuais(aperta)[1]).toBe('Confira se não tem tarifa ou seguro escondido no contrato. E a parcela de R$ 100 passa de 30% do que entra por mês. Eu pegaria um valor menor.');
    // taxa zero também dá "sem juros"
    const pelaTaxa = responder([['p1_valor', 1200], ['p1_parcelas', 12], ['p1_sabe', 'taxa'], ['p1_taxa', 0], ['para', 'Celular']]);
    expect(falasAtuais(pelaTaxa)[0]).toBe('Você vai pagar R$ 1.200 por R$ 1.200. Não tem juros nessa conta.');
    expect(propostaDoChat(pelaTaxa.ctx, 1)).toMatchObject({ parcela: 100, total: 1200, juros: 0 });
  });

  it('parcela arredondada (3x de 333,33 por 1.000) passa e conta como sem juros', () => {
    const p = responder([['p1_valor', 1000], ['p1_parcelas', 3], ['p1_sabe', 'parcela'], ['p1_parcela', 333.33], ['para', 'Fogão']]);
    expect(propostaDoChat(p.ctx, 1)).toMatchObject({ taxa: 0, juros: 0 });
    expect(falasAtuais(p)[0]).toBe('Você vai pagar R$ 1.000 por R$ 1.000. Não tem juros nessa conta.');
  });

  it('compara até 3 propostas com o mesmo valor: a melhor é a que custa menos no total', () => {
    const P1: [string, Valor][] = [['p1_valor', 10000], ['p1_parcelas', 12], ['p1_sabe', 'taxa'], ['p1_taxa', 3], ['para', 'Quitar o cartão']];
    const p2 = ate([...P1, ['p1_parecer', 'comparar']]);
    expect(p2.atual?.id).toBe('p2_valor');
    expect(falasAtuais(p2)).toEqual(['Vamos à proposta 2.', 'Quanto você pegaria nessa?']);
    const r2 = respostaDe(p2.atual!, p2.ctx);
    if (r2.tipo === 'dinheiro') expect(r2.sugestao?.(p2.ctx)).toEqual({ valor: 10000, rotulo: 'R$ 10.000 (o mesmo)' });
    else throw new Error('esperava dinheiro');

    // proposta 2: 24x a 2% (taxa menor, mas sai mais cara no total). O "pra quê" não se repete.
    const P2: [string, Valor][] = [['p2_valor', 10000], ['p2_parcelas', 24], ['p2_sabe', 'taxa'], ['p2_taxa', 2]];
    const parecer2 = responder([...P1, ['p1_parecer', 'comparar'], ...P2]);
    expect(parecer2.atual?.id).toBe('p2_parecer');
    expect(falasAtuais(parecer2)).toEqual([
      'Você vai pagar R$ 12.689 por R$ 10.000. São R$ 2.689 só de juros.',
      'A taxa está dentro do comum. Mesmo assim, só assine se a parcela couber no seu mês.',
      'Essa sai R$ 634 mais cara que a proposta 1.',
    ]);
    expect(opcoesAtuais(parecer2)).toEqual(['comparar', 'salvar']);

    // proposta 3: 12x de 974,87 (2,50% a.m.), comparada com a melhor das anteriores (a 1)
    const P3: [string, Valor][] = [['p3_valor', 10000], ['p3_parcelas', 12], ['p3_sabe', 'parcela'], ['p3_parcela', 974.87]];
    const parecer3 = responder([...P1, ['p1_parecer', 'comparar'], ...P2, ['p2_parecer', 'comparar'], ...P3]);
    expect(parecer3.atual?.id).toBe('p3_parecer');
    expect(falasAtuais(parecer3)[2]).toBe('Essa sai R$ 357 mais barata que a proposta 1.');
    expect(opcoesAtuais(parecer3)).toEqual(['salvar']); // na terceira, só salvar
    expect(conferir(parecer3.atual!, 'comparar', parecer3.ctx)).toBe('Escolha uma das opções.');

    const fim = responder([...P1, ['p1_parecer', 'comparar'], ...P2, ['p2_parecer', 'comparar'], ...P3, ['p3_parecer', 'salvar']]);
    expect(fim.fim).toBe(true);
    expect(falasDe(fim, 'fim')).toEqual(['Pelo total, a proposta 3 é a melhor, Ana.', CALMA]);
    expect(propostasDoChat(fim.ctx)).toHaveLength(3);
    const res = ROTEIRO_EMPRESTIMO.resultado!(fim.ctx);
    expect(res.linhas).toEqual(['1. Proposta 1: R$ 12.055 no total · 3,00% a.m.', '2. Proposta 2: R$ 12.689 no total · 2,00% a.m.', '3. Proposta 3: R$ 11.698 no total · 2,50% a.m. · a melhor']);
    expect(res.lista).toEqual(['Pra quê: Quitar o cartão', 'Proposta 1: 12x de R$ 1.005 · R$ 2.055 de juros', 'Proposta 2: 24x de R$ 529 · R$ 2.689 de juros', 'Proposta 3: 12x de R$ 975 · R$ 1.698 de juros']);
    expect(res.rodape).toBe(RODAPE);
    expect(res.botao).toBe('Salvar parecer');

    const p = parecerDoChat(fim.ctx);
    expect(p.melhor?.n).toBe(3);
    expect(p.resumo).toBe('Proposta 3 é a melhor de 3: R$ 11.698 no total · 2,50% a.m.');
    expect(p.card).toMatchObject({ label: 'A melhor proposta', big: 'Proposta 3' });
    expect(p.card.rows).toHaveLength(4);
    expect(p.registro.melhor).toBe(3);
    expect(p.registro.propostas.map((x) => x.total)).toEqual([12055.44, 12689.04, 11698.44]);
    const c = ROTEIRO_EMPRESTIMO.concluir!(fim.ctx, 'x');
    expect(c).toMatchObject({ missoes: [], ativar: ['mathon'] });
  });

  it('salvar na proposta 2 termina sem pedir a terceira', () => {
    const fim = responder([...CARA, ['p1_parecer', 'comparar'], ['p2_valor', 5000], ['p2_parcelas', 12], ['p2_sabe', 'taxa'], ['p2_taxa', 2], ['p2_parecer', 'salvar']]);
    expect(fim.fim).toBe(true);
    expect(fim.visitas.map((v) => v.passo.id)).not.toContain('p3_valor');
    expect(ROTEIRO_EMPRESTIMO.resultado!(fim.ctx).linhas).toEqual(['1. Proposta 1: R$ 8.400 no total · 9,05% a.m.', '2. Proposta 2: R$ 5.674 no total · 2,00% a.m. · a melhor']);
  });

  it('com valores diferentes, compara pela taxa', () => {
    const fim = responder([
      ['p1_valor', 10000], ['p1_parcelas', 12], ['p1_sabe', 'taxa'], ['p1_taxa', 3], ['para', 'Moto'], ['p1_parecer', 'comparar'],
      ['p2_valor', 8000], ['p2_parcelas', 12], ['p2_sabe', 'taxa'], ['p2_taxa', 2],
    ]);
    expect(falasAtuais(fim)[2]).toBe('Os valores são diferentes, então comparo pela taxa. Essa é menor que a da proposta 1.');
    const mais = responder([
      ['p1_valor', 8000], ['p1_parcelas', 12], ['p1_sabe', 'taxa'], ['p1_taxa', 2], ['para', 'Moto'], ['p1_parecer', 'comparar'],
      ['p2_valor', 10000], ['p2_parcelas', 12], ['p2_sabe', 'taxa'], ['p2_taxa', 3], ['p2_parecer', 'salvar'],
    ]);
    expect(falasDe(mais, 'p2_parecer')[2]).toBe('Os valores são diferentes, então comparo pela taxa. Essa é maior que a da proposta 1.');
    expect(falasDe(mais, 'fim')).toEqual(['Pela taxa, a proposta 1 é a melhor, Ana.', CALMA]);
    expect(ROTEIRO_EMPRESTIMO.resultado!(mais.ctx).linhas[0]).toBe('1. Proposta 1: R$ 9.078 no total · 2,00% a.m. · a melhor');

    const mesma = ate([
      ['p1_valor', 8000], ['p1_parcelas', 12], ['p1_sabe', 'taxa'], ['p1_taxa', 2], ['para', 'Moto'], ['p1_parecer', 'comparar'],
      ['p2_valor', 10000], ['p2_parcelas', 24], ['p2_sabe', 'taxa'], ['p2_taxa', 2], ['p2_parecer', 'salvar'],
    ]);
    expect(falasDe(mesma, 'p2_parecer')[2]).toBe('Os valores são diferentes, então comparo pela taxa. É a mesma da proposta 1.');
    expect(falasDe(mesma, 'fim')).toEqual(['As taxas ficam quase iguais, Ana.', 'Escolha a parcela que cabe melhor no seu mês.', CALMA]);
    expect(melhorProposta(propostasDoChat(mesma.ctx))).toBeNull();
  });

  it('empate no total: nenhuma marcada como a melhor', () => {
    const fim = responder([
      ['p1_valor', 10000], ['p1_parcelas', 12], ['p1_sabe', 'taxa'], ['p1_taxa', 3], ['para', 'Moto'], ['p1_parecer', 'comparar'],
      ['p2_valor', 10000], ['p2_parcelas', 12], ['p2_sabe', 'parcela'], ['p2_parcela', 1004.62], ['p2_parecer', 'salvar'],
    ]);
    expect(falasDe(fim, 'p2_parecer')[2]).toBe('Custa quase o mesmo que a proposta 1.');
    expect(falasDe(fim, 'fim')).toEqual(['As propostas custam quase o mesmo, Ana.', 'Escolha a parcela que cabe melhor no seu mês.', CALMA]);
    const res = ROTEIRO_EMPRESTIMO.resultado!(fim.ctx);
    expect(res.linhas.every((l) => !l.includes('a melhor'))).toBe(true);
    const p = parecerDoChat(fim.ctx);
    expect(p.resumo).toBe('As 2 propostas custam quase o mesmo');
    expect(p.card.big).toBe('Empate');
    expect(p.registro.melhor).toBeNull();
  });

  it('valida os números com a voz do Mathon', () => {
    expect(erro([], 0)).toBe('Digite pelo menos R$ 1,00.');
    expect(erro([['p1_valor', 5000]], 0)).toBe('Digite um número de 1 a 120.');
    expect(erro([['p1_valor', 5000]], 121)).toBe('Digite um número de 1 a 120.');
    expect(erro([['p1_valor', 5000]], 12.5)).toBe('Parcela vem em número inteiro. Quantas são?');
    expect(erro([['p1_valor', 5000], ['p1_parcelas', 12]], 'outra')).toBe('Escolha uma das opções.');
    const naParcela = CARA.slice(0, 3);
    expect(erro(naParcela, 400)).toBe('Assim você pagaria menos do que pegou. Confere o valor da parcela?'); // 12 × 400 < 5.000
    expect(erro(naParcela, 0)).toBe('Digite pelo menos R$ 1,00.');
    expect(erro([['p1_valor', 1000], ['p1_parcelas', 12], ['p1_sabe', 'parcela']], 1100)).toBe('Com essa parcela, os juros passariam de 100% ao mês. Confere os números?');
    const naTaxa: [string, Valor][] = [['p1_valor', 5000], ['p1_parcelas', 12], ['p1_sabe', 'taxa']];
    expect(erro(naTaxa, 31)).toBe('Digite um número de 0 a 30.');
    expect(erro(naTaxa, -1)).toBe('Digite um número de 0 a 30.');
    expect(erro(naTaxa, 30)).toBeNull();
    expect(erro(CARA.slice(0, 4), '   ')).toBe('Escreva alguma coisa.');
    expect(erro(CARA.slice(0, 4), 'x'.repeat(41))).toBe('Me conta em até 40 letras.');
    // a proposta 2 também confere a parcela com os números dela
    expect(erro([...CARA, ['p1_parecer', 'comparar'], ['p2_valor', 3000], ['p2_parcelas', 10], ['p2_sabe', 'parcela']], 200)).toBe('Assim você pagaria menos do que pegou. Confere o valor da parcela?');
  });

  it('editar a resposta "sei a parcela" pra "sei a taxa" corta o que veio depois', () => {
    const p = ate([['p1_valor', 5000], ['p1_parcelas', 12], ['p1_sabe', 'taxa'], ['p1_parcela', 700], ['para', 'x']]);
    expect(p.atual?.id).toBe('p1_taxa');
    expect(p.validas).toHaveLength(3);
    expect(propostaDoChat(p.ctx, 1)).toBeNull();
  });

  it('usuário novo, sem nome e sem dados: tudo funciona e nada de renda no aviso', () => {
    const fim = responder([...PELA_TAXA, ['p1_parecer', 'salvar']], {}, '');
    expect(fim.fim).toBe(true);
    expect(falasDe(fim, 'fim')).toEqual(['Esse é o meu parecer.', CALMA]);
    expect(ROTEIRO_EMPRESTIMO.resultado!(fim.ctx).linhas).toEqual(['1. Proposta 1: R$ 11.698 no total · 2,50% a.m.']);
  });

  it('sem respostas, o parecer não quebra', () => {
    const ctx = ate([]).ctx;
    expect(propostasDoChat(ctx)).toEqual([]);
    expect(ROTEIRO_EMPRESTIMO.resultado!(ctx)).toMatchObject({ titulo: 'Parecer do Mathon', linhas: [], lista: [] });
    expect(ROTEIRO_EMPRESTIMO.concluir!(ctx, 'x')).toMatchObject({ missoes: [], ativar: ['mathon'] });
    expect(taxaTexto(9.05)).toBe('9,05% a.m.');
    expect(taxaTexto(3)).toBe('3,00% a.m.');
  });

  it('textos sem as palavras proibidas', () => {
    const fim = responder([...CARA, ['p1_parecer', 'comparar'], ['p2_valor', 5000], ['p2_parcelas', 12], ['p2_sabe', 'taxa'], ['p2_taxa', 2], ['p2_parecer', 'salvar']], comRenda(1000));
    const textos = [
      ...fim.visitas.flatMap((v) => falasDoRoteiro.falas(v.passo, v.ctx)),
      ...Object.values(ROTEIRO_EMPRESTIMO.resultado!(fim.ctx)).flat().map(String),
      parecerDoChat(fim.ctx).resumo,
    ].join(' ').toLowerCase();
    for (const proibida of ['aporte', 'despesa', 'fechar o mês', 'o combinado', 'inadimplência']) expect(textos).not.toContain(proibida);
  });
});
