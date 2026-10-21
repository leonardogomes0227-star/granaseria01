// Roteiro 6.6 — Mathon: antes de pegar empréstimo. Uso pontual: não cria missão, dá um "Parecer". A pessoa mostra a
// proposta (valor, número de parcelas e a parcela ou a taxa) e diz pra quê é o dinheiro. O Mathon conta o total, os
// juros e a taxa ao mês, e diz o que acha: acima de 5% a.m. o ouro sai caro (melhor esperar guardando a parcela);
// abaixo, só assinar se a parcela couber no mês (passa de 30% do que entra: ele avisa).
//
// Dá pra comparar até 3 propostas. Cada uma tem os seus passos fixos (p1_valor, p2_valor…): "Comparar outra proposta"
// pula pros passos da próxima. O "pra quê" é perguntado uma vez só (é o mesmo dinheiro nas três).
//
// A melhor proposta: com o mesmo valor, a que custa menos no total ("eu olho o total, não só a parcela"); com valores
// diferentes, o total não dá pra comparar e vale a menor taxa. O critério vale pra todas as propostas juntas, então a
// comparação de cada parecer bate com o veredito do fim.

import { parcelaPrice, taxaEmprestimo } from '../../lib/financas';
import { saveResult, type ResultCard } from '../../results';
import { brl, brlCurto, num, respondeu, txt, type Ctx, type Passo, type Roteiro } from '../engine';
import { falas, fim } from './comum';

export const MAX_PROPOSTAS = 3;
/** Onde fica o último parecer (o selo "Olho de Mathon" lê daqui). */
export const PARECER_KEY = 'gs-mathon-parecer';
/** Acima dessa taxa (% ao mês) o ouro sai caro. */
export const TAXA_CARA = 5;
/** A parcela não deveria passar dessa parte do que entra por mês. */
export const PARCELA_MAX_RENDA = 0.3;
const MAX_PARA = 40;

export interface Proposta {
  n: number; // 1, 2 ou 3
  valor: number; // o que a pessoa pega
  parcelas: number;
  parcela: number;
  taxa: number; // % ao mês (efetiva, aproximada)
  total: number; // parcela × parcelas
  juros: number; // total − valor
}

const centavos = (x: number) => Math.round(x * 100) / 100;
/** "R$ 1.225" (sem centavos); abaixo de R$ 100, com centavos quando tem, pra um valor pequeno não virar "R$ 0". */
export const reais = (n: number) => (Math.abs(n) < 100 ? brlCurto(n) : brl(n));
/** "3,50% a.m." */
export const taxaTexto = (t: number) => `${t.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.m.`;
const mesesTexto = (m: number) => (m === 1 ? '1 mês' : `${m} meses`);

/* ---------- leitura das respostas ---------- */

const id = (n: number, campo: string) => `p${n}_${campo}`;

/** A proposta n como a pessoa contou (null enquanto falta algum número). */
export function propostaDoChat(ctx: Ctx, n: number): Proposta | null {
  const valor = num(ctx, id(n, 'valor'));
  const parcelas = Math.round(num(ctx, id(n, 'parcelas')));
  if (!(valor > 0 && parcelas > 0)) return null;
  const sabe = txt(ctx, id(n, 'sabe'));
  let parcela: number;
  let taxa: number;
  let total: number;
  if (sabe === 'parcela' && respondeu(ctx, id(n, 'parcela'))) {
    parcela = num(ctx, id(n, 'parcela'));
    if (!(parcela > 0)) return null;
    taxa = taxaEmprestimo(valor, parcelas, parcela) ?? 100; // acima de 100% a.m. a validação não deixa passar
    total = centavos(parcela * parcelas); // o que a pessoa paga de verdade
  } else if (sabe === 'taxa' && respondeu(ctx, id(n, 'taxa'))) {
    taxa = Math.max(0, num(ctx, id(n, 'taxa')));
    parcela = parcelaPrice(valor, parcelas, taxa);
    total = taxa === 0 ? valor : centavos(parcela * parcelas); // sem juros paga o que pegou (o centavo da parcela não conta)
  } else return null;
  // taxa 0,00% é arredondamento da parcela: sem juros, pra fala, linha e lista dizerem a mesma coisa
  const juros = taxa > 0 ? centavos(Math.max(0, total - valor)) : 0;
  return { n, valor, parcelas, parcela, taxa, total, juros };
}

/** As propostas completas, em ordem. */
export function propostasDoChat(ctx: Ctx, ate = MAX_PROPOSTAS): Proposta[] {
  const ps: Proposta[] = [];
  for (let n = 1; n <= Math.min(ate, MAX_PROPOSTAS); n++) {
    const p = propostaDoChat(ctx, n);
    if (p) ps.push(p);
  }
  return ps;
}

export const paraDe = (ctx: Ctx) => txt(ctx, 'para').trim().replace(/\s+/g, ' ');

/* ---------- comparação ---------- */

const mesmoValor = (ps: Proposta[]) => ps.every((p) => Math.round(p.valor) === Math.round(ps[0].valor));
/** Da melhor pra pior: pelo total (todas com o mesmo valor) ou pela taxa (valores diferentes). */
const ordenadas = (ps: Proposta[], porTotal = mesmoValor(ps)) => [...ps].sort((a, b) => (porTotal ? a.total - b.total : a.taxa - b.taxa) || a.n - b.n);
const quaseIgual = (a: Proposta, b: Proposta, porTotal: boolean) => (porTotal ? Math.abs(a.total - b.total) < 1 : Math.abs(a.taxa - b.taxa) < 0.005);

/** As melhores entre 2 ou mais propostas: a que ganha, ou as que empatam com ela, em ordem (vazio com uma só). */
export function melhoresPropostas(ps: Proposta[]): Proposta[] {
  if (ps.length < 2) return [];
  const porTotal = mesmoValor(ps);
  const [a] = ordenadas(ps, porTotal);
  return ps.filter((p) => quaseIgual(p, a, porTotal));
}

/** A melhor, quando só uma ganha (null com uma proposta só ou com empate em primeiro). */
export function melhorProposta(ps: Proposta[]): Proposta | null {
  const m = melhoresPropostas(ps);
  return m.length === 1 ? m[0] : null;
}

/** As que levam " · a melhor" no cartão: as melhores, menos quando todas empatam (aí nenhuma se destaca). */
const marcadas = (ps: Proposta[]) => {
  const m = melhoresPropostas(ps);
  return m.length < ps.length ? m : [];
};
const numeros = (ps: Proposta[]) => ps.map((p) => p.n).join(' e ');

/** A fala que compara a proposta de agora com a melhor das anteriores (pelo mesmo critério do veredito). */
function comparacao(p: Proposta, anteriores: Proposta[]): string {
  const porTotal = mesmoValor([...anteriores, p]);
  const ref = ordenadas(anteriores, porTotal)[0];
  if (porTotal) {
    const d = ref.total - p.total;
    if (Math.abs(d) < 1) return `Custa quase o mesmo que a proposta ${ref.n}.`;
    return d > 0 ? `Essa sai ${reais(d)} mais barata que a proposta ${ref.n}.` : `Essa sai ${reais(-d)} mais cara que a proposta ${ref.n}.`;
  }
  const antes = 'Os valores são diferentes, então comparo pela taxa.';
  if (Math.abs(p.taxa - ref.taxa) < 0.005) return `${antes} É a mesma da proposta ${ref.n}.`;
  return p.taxa < ref.taxa ? `${antes} Essa é menor que a da proposta ${ref.n}.` : `${antes} Essa é maior que a da proposta ${ref.n}.`;
}

/* ---------- o parecer ---------- */

const temJuros = (p: Proposta) => p.juros > 0;

/** O que o Mathon acha da taxa (e da parcela, quando sabe quanto entra). */
function opiniao(ctx: Ctx, p: Proposta): string {
  if (p.taxa > TAXA_CARA) {
    const meses = Math.ceil(p.valor / p.parcela);
    return `Esse ouro sai caro. Se puder esperar ${mesesTexto(meses)} guardando ${reais(p.parcela)}, você compra sem pagar juros.`;
  }
  const aperta = ctx.dados.renda > 0 && p.parcela > ctx.dados.renda * PARCELA_MAX_RENDA;
  const aviso = `a parcela de ${reais(p.parcela)} passa de 30% do que entra por mês. Eu pegaria um valor menor.`;
  if (!temJuros(p)) return `Confira se não tem tarifa ou seguro escondido no contrato. ${aperta ? `E ${aviso}` : 'E só assine se a parcela couber no seu mês.'}`;
  return `A taxa está dentro do comum. ${aperta ? `Mas ${aviso}` : 'Mesmo assim, só assine se a parcela couber no seu mês.'}`;
}

/** As falas do parecer da proposta n (até 3 balões: custo, opinião e comparação com as anteriores). */
export function falasDoParecer(ctx: Ctx, n: number): string[] {
  const p = propostaDoChat(ctx, n);
  if (!p) return ['Faltou algum número dessa proposta.', 'Toque numa resposta pra corrigir.'];
  const custo = `Você vai pagar ${reais(p.total)} por ${reais(p.valor)}. ${temJuros(p) ? `São ${reais(p.juros)} só de juros.` : 'Não tem juros nessa conta.'}`;
  const anteriores = propostasDoChat(ctx, n - 1);
  return [custo, opiniao(ctx, p), anteriores.length ? comparacao(p, anteriores) : ''].filter(Boolean);
}

/** O que fica salvo: o resumo e o cartão do painel, e o registro do parecer (pro selo). */
export function parecerDoChat(ctx: Ctx) {
  const ps = propostasDoChat(ctx);
  const melhor = melhorProposta(ps);
  const empatadas = melhor ? [] : marcadas(ps); // empate em primeiro, com outra atrás (2 de 3)
  const para = paraDe(ctx);
  const linha = (p: Proposta) => `${p.parcelas}x de ${reais(p.parcela)} = ${reais(p.total)} · ${taxaTexto(p.taxa)}`;
  const unica = ps.length === 1 ? ps[0] : null;
  const resumo = unica
    ? `${reais(unica.valor)} em ${linha(unica)}`
    : melhor
      ? `Proposta ${melhor.n} é a melhor de ${ps.length}: ${reais(melhor.total)} no total · ${taxaTexto(melhor.taxa)}`
      : empatadas.length
        ? `Propostas ${numeros(empatadas)} empatam em primeiro entre as ${ps.length}`
        : `As ${ps.length} propostas ${mesmoValor(ps) ? 'custam quase o mesmo' : 'têm quase a mesma taxa'}`;
  const card: ResultCard = {
    label: unica ? 'Custo total' : empatadas.length ? 'As melhores propostas' : 'A melhor proposta',
    big: unica ? reais(unica.total) : melhor ? `Proposta ${melhor.n}` : empatadas.length ? `Propostas ${numeros(empatadas)}` : 'Empate',
    rows: [...ps.map((p): [string, string] => [`Proposta ${p.n}`, linha(p)]), ...(para ? [['Pra quê', para] as [string, string]] : [])],
  };
  const registro = {
    em: ctx.dados.hoje,
    para,
    melhor: melhor?.n ?? null,
    propostas: ps.map((p) => ({ valor: p.valor, parcelas: p.parcelas, parcela: p.parcela, taxa: p.taxa, total: p.total, juros: p.juros })),
  };
  return { propostas: ps, melhor, resumo, card, registro };
}

/* ---------- os passos ---------- */

/** Os passos de uma proposta: valor → parcelas → sabe a parcela ou a taxa → parecer. */
function passosDaProposta(n: number): Passo[] {
  const ultima = n >= MAX_PROPOSTAS;
  return [
    {
      id: id(n, 'valor'),
      falas: n === 1 ? ['Quanto você quer pegar?'] : [`Vamos à proposta ${n}.`, 'Quanto você pegaria nessa?'],
      resposta: (ctx) => ({
        tipo: 'dinheiro',
        min: 1,
        max: 10_000_000,
        sugestao: () => {
          const v = num(ctx, id(1, 'valor'));
          return n > 1 && v > 0 ? { valor: v, rotulo: `${reais(v)} (o mesmo)` } : null;
        },
      }),
      proximo: id(n, 'parcelas'),
    },
    {
      id: id(n, 'parcelas'),
      falas: ['Em quantas parcelas?'],
      resposta: { tipo: 'numero', min: 1, max: 120, sufixo: 'x', sugestoes: [6, 12, 24, 36] },
      validar: (v) => (Number.isInteger(Number(v)) ? null : 'Parcela vem em número inteiro. Quantas são?'),
      proximo: id(n, 'sabe'),
    },
    {
      id: id(n, 'sabe'),
      falas: ['Você sabe o valor da parcela ou a taxa?'],
      resposta: {
        tipo: 'botoes',
        opcoes: [
          { valor: 'parcela', rotulo: 'Sei a parcela' },
          { valor: 'taxa', rotulo: 'Sei a taxa' },
        ],
      },
      proximo: (v) => (v === 'taxa' ? id(n, 'taxa') : id(n, 'parcela')),
    },
    {
      id: id(n, 'parcela'),
      falas: ['Qual o valor de cada parcela?'],
      resposta: { tipo: 'dinheiro', min: 0.01, max: 10_000_000 },
      validar: (v, ctx) => {
        const parcela = Number(v);
        const valor = num(ctx, id(n, 'valor'));
        const parcelas = num(ctx, id(n, 'parcelas'));
        // até 1 centavo a menos por parcela é arredondamento (3x de 333,33 por 1.000); mais que isso é engano
        if (parcela * parcelas < valor - 0.01 * parcelas - 1e-9) return 'Assim você pagaria menos do que pegou. Confere o valor da parcela?';
        if (taxaEmprestimo(valor, parcelas, parcela) === null) return 'Com essa parcela, os juros passariam de 100% ao mês. Confere os números?';
        return null;
      },
      proximo: n === 1 ? 'para' : id(n, 'parecer'),
    },
    {
      id: id(n, 'taxa'),
      falas: ['Qual a taxa ao mês?', 'Se a proposta mostrar o CET, use ele. Ele já inclui tarifas e seguros.'],
      resposta: { tipo: 'numero', min: 0, max: 30, decimais: 2, sufixo: '% a.m.' },
      proximo: n === 1 ? 'para' : id(n, 'parecer'),
    },
    {
      id: id(n, 'parecer'),
      falas: (ctx) => falasDoParecer(ctx, n),
      resposta: {
        tipo: 'botoes',
        opcoes: ultima ? [{ valor: 'salvar', rotulo: 'Salvar parecer' }] : [{ valor: 'comparar', rotulo: 'Comparar outra proposta' }, { valor: 'salvar', rotulo: 'Salvar parecer' }],
      },
      proximo: (v) => (v === 'comparar' && !ultima ? id(n + 1, 'valor') : 'fim'),
    },
  ];
}

const passos: Passo[] = [
  {
    id: 'abertura',
    falas: (ctx) => falas(ctx, ['Antes de assinar qualquer coisa, {nome}, me mostra a proposta.', 'Eu olho o total, não só a parcela.']),
    resposta: { tipo: 'nenhuma' },
    proximo: id(1, 'valor'),
  },
  ...passosDaProposta(1),
  {
    id: 'para',
    falas: ['Pra quê é esse dinheiro?'],
    resposta: { tipo: 'texto', placeholder: 'Ex.: trocar a geladeira', max: MAX_PARA },
    validar: (v) => (String(v).trim().length > MAX_PARA ? `Me conta em até ${MAX_PARA} letras.` : null),
    proximo: id(1, 'parecer'),
  },
  ...passosDaProposta(2),
  ...passosDaProposta(3),
  fim('fim', (ctx) => {
    const ps = propostasDoChat(ctx);
    const melhores = melhoresPropostas(ps);
    const calma = 'Proposta boa não some em dois dias. Leia o contrato com calma antes de assinar.';
    const cabe = 'Escolha a parcela que cabe melhor no seu mês.';
    if (ps.length < 2) return falas(ctx, ['Esse é o meu parecer, {nome}.', calma]);
    const porTotal = mesmoValor(ps);
    const criterio = porTotal ? 'Pelo total' : 'Pela taxa';
    if (melhores.length === 1) return falas(ctx, [`${criterio}, a proposta ${melhores[0].n} é a melhor, {nome}.`, calma]);
    if (melhores.length < ps.length) return falas(ctx, [`${criterio}, as propostas ${numeros(melhores)} empatam em primeiro, {nome}.`, cabe, calma]);
    return falas(ctx, [porTotal ? 'As propostas custam quase o mesmo, {nome}.' : 'As taxas ficam quase iguais, {nome}.', cabe, calma]);
  }),
];

export const ROTEIRO_EMPRESTIMO: Roteiro = {
  id: 'emprestimo',
  agente: 'mathon',
  titulo: 'Antes de pegar empréstimo',
  primeiro: 'abertura',
  passos,
  resultado: (ctx) => {
    const ps = propostasDoChat(ctx);
    const melhores = marcadas(ps);
    const para = paraDe(ctx);
    return {
      titulo: 'Parecer do Mathon',
      linhas: ps.map((p, i) => `${i + 1}. Proposta ${p.n}: ${reais(p.total)} no total · ${taxaTexto(p.taxa)}${melhores.includes(p) ? ' · a melhor' : ''}`),
      lista: [...(para ? [`Pra quê: ${para}`] : []), ...ps.map((p) => `Proposta ${p.n}: ${p.parcelas}x de ${reais(p.parcela)} · ${temJuros(p) ? `${reais(p.juros)} de juros` : 'sem juros'}`)],
      agentes: ['mathon'],
      rodape: 'Estimativa com os números da proposta. Não é recomendação de crédito.',
      botao: 'Salvar parecer',
    };
  },
  // Uso pontual: nenhuma missão. Salva o parecer no painel (ferramenta "loan") e o registro pro selo.
  concluir: (ctx) => {
    const p = parecerDoChat(ctx);
    return {
      missoes: [],
      ativar: ['mathon'],
      efeitos: () => {
        if (!p.propostas.length) return; // nada pra salvar: não troca o parecer anterior por um vazio
        try {
          localStorage.setItem(PARECER_KEY, JSON.stringify(p.registro));
        } catch {
          // segue sem o registro
        }
        saveResult('loan', p.resumo, p.card);
      },
    };
  },
};
