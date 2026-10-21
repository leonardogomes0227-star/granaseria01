// Roteiro 6.4 — Bansir: contas fixas. Revisa a lista de contas (nome, valor e dia do vencimento), pré-preenchida com
// as que já estão cadastradas, pergunta se ele lembra um dia antes de cada uma vencer e monta a missão "Contas em dia"
// (recorrente: os passos são as contas do mês e recomeçam todo mês).
//
// Ao tocar no botão do cartão, a lista do chat também vai pras contas salvas (gs-contas): as que já existiam mudam
// nome, valor e dia; as novas entram como contas de todo mês. As que saíram da lista do chat NUNCA são apagadas, e as
// parcelas de dívida (que não aparecem aqui) ficam como estão.

import { addMonths, daysInMonth } from '../../coachChat/months';
import { loadBills, saveBills, type Bill } from '../../bills';
import { coerencia, custoEssencial } from '../../lib/financas';
import { novaMissao } from '../../missoes';
import { brl, brl2, lista, respondeu, txt, type Ctx, type ItemLista, type Passo, type Roteiro } from '../engine';
import type { ContaFixa } from '../dados';
import { falas, fim } from './comum';

/* ---------- leitura das respostas ---------- */

/** Uma conta da conversa; 'ordem' é a posição dela na lista do chat (entra no id das contas novas). */
export type ContaDoChat = ContaFixa & { ordem: number };

/** As contas da conversa, na ordem do vencimento (as sem valor ficam de fora). */
export function contasDoChat(ctx: Ctx): ContaDoChat[] {
  return lista(ctx, 'contas')
    .map((it, i) => ({
      id: String(it.id ?? '').trim(),
      nome: String(it.nome ?? '').trim() || `Conta ${i + 1}`,
      valor: Math.round((Number(it.valor) || 0) * 100) / 100,
      dia: Math.min(31, Math.max(1, Math.round(Number(it.dia)) || 1)),
      ordem: i,
    }))
    .filter((c) => c.valor > 0)
    .sort((a, b) => a.dia - b.dia || a.ordem - b.ordem)
    .map(({ id, nome, valor, dia, ordem }) => ({ id: id || `nova${ordem}`, nome, valor, dia, ordem }));
}

const totalDe = (ctx: Ctx) => custoEssencial(contasDoChat(ctx));
const quantas = (n: number) => (n === 1 ? '1 conta' : `${n} contas`);
/** Valor de resumo sem centavos; abaixo de R$ 1 com centavos (R$ 0,50 não vira "R$ 1" nem "R$ 0"). */
export const reais = (n: number) => (n > 0 && n < 1 ? brl2(n) : brl(n));
const comLembrete = (ctx: Ctx) => txt(ctx, 'lembrete') === 'sim';

/** As contas passam do que entra? (só quando a gente sabe a renda) */
const passaDaRenda = (ctx: Ctx) => ctx.dados.renda > 0 && coerencia({ renda: ctx.dados.renda, custo: totalDe(ctx) }).fixosPassamDaRenda;

/* ---------- a próxima conta a vencer ---------- */

const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
/** O vencimento no mês (dia 31 em mês de 30 dias vence no dia 30). */
const vencimentoEm = (mes: string, dia: number) => `${mes}-${String(Math.min(dia, daysInMonth(mes))).padStart(2, '0')}`;

/** A conta que vence primeiro a partir de hoje (inclusive) e em quantos dias. */
export function proximaConta<T extends { dia: number }>(contas: T[], hoje: string): { conta: T; dias: number } | null {
  const mes = hoje.slice(0, 7);
  let melhor: { conta: T; dias: number } | null = null;
  for (const conta of contas) {
    let venc = vencimentoEm(mes, conta.dia);
    if (venc < hoje) venc = vencimentoEm(addMonths(mes, 1), conta.dia);
    const dias = diasEntre(hoje, venc);
    if (!melhor || dias < melhor.dias) melhor = { conta, dias };
  }
  return melhor;
}

const quandoVence = (p: { conta: ContaFixa; dias: number }) => (p.dias === 0 ? `${p.conta.nome} vence hoje` : p.dias === 1 ? `${p.conta.nome} vence amanhã` : `${p.conta.nome} dia ${p.conta.dia}`);

/* ---------- as contas salvas (gs-contas) ---------- */

export interface ContaFinal extends ContaFixa {
  nova: boolean; // não existia nas contas salvas
}

/** O nome pra comparar: sem acento, sem maiúscula e sem espaço sobrando ("  Água " = "agua"). */
const chaveNome = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Os ids que as contas vão ter de verdade: as que vieram das contas salvas mantêm o id; as novas ganham
 * 'b-' + carimbo + posição na lista. Os passos da missão e as contas salvas usam esses mesmos ids.
 *
 * Primeiro vale o id. Depois, o nome: a lista do chat dá id novo a uma conta que a pessoa editou, e "Editar
 * respostas" volta com os ids provisórios da conversa anterior. Sem isso, a mesma conta entraria duas vezes.
 */
export function idsFinais(ctx: Ctx, carimbo: string = Date.now().toString(36)): ContaFinal[] {
  const contas = contasDoChat(ctx);
  const salvas = ctx.dados.contas;
  const usados = new Set<string>();
  const achado = new Map<number, string>(); // ordem na lista do chat → id da conta salva
  for (const c of contas) {
    if (salvas.some((s) => s.id === c.id) && !usados.has(c.id)) {
      achado.set(c.ordem, c.id);
      usados.add(c.id);
    }
  }
  for (const c of contas) {
    if (achado.has(c.ordem)) continue;
    const mesma = salvas.find((s) => !usados.has(s.id) && chaveNome(s.nome) === chaveNome(c.nome));
    if (mesma) {
      achado.set(c.ordem, mesma.id);
      usados.add(mesma.id);
    }
  }
  return contas.map((c) => {
    const id = achado.get(c.ordem);
    return { id: id ?? `b-${carimbo}${c.ordem}`, nome: c.nome, valor: c.valor, dia: c.dia, nova: !id };
  });
}

/**
 * Junta a lista do chat às contas salvas: atualiza nome, valor e dia das que já existem, acrescenta as novas como
 * contas de todo mês e não apaga nenhuma. Parcelas (installments) ficam como estão.
 */
export function juntarContas(salvas: Bill[], finais: ContaFinal[], mes: string): Bill[] {
  const doChat = new Map(finais.map((c) => [c.id, c]));
  const atualizadas = salvas.map((b) => {
    const c = doChat.get(b.id);
    return c && !b.installments ? { ...b, name: c.nome, amount: c.valor, dueDay: c.dia } : b;
  });
  const existentes = new Set(salvas.map((b) => b.id));
  const novas: Bill[] = finais.filter((c) => !existentes.has(c.id)).map((c) => ({ id: c.id, name: c.nome, amount: c.valor, dueDay: c.dia, startMonth: mes, payments: [] }));
  return [...atualizadas, ...novas];
}

/* ---------- passos ---------- */

const passos: Passo[] = [
  {
    id: 'abertura',
    falas: ['Eu vivia trabalhando e o dinheiro nunca chegava no fim do mês. Começou a mudar quando eu soube exatamente o que vencia e quando.'],
    resposta: { tipo: 'nenhuma' },
    proximo: 'contas',
  },
  {
    id: 'contas',
    falas: (ctx) => {
      if (respondeu(ctx, 'contas')) return ['Pode mexer à vontade. Corrija o que precisar.'];
      if (ctx.dados.contas.length) return falas(ctx, ['Essas são as contas que já estão anotadas, {nome}.', 'Confere se mudou alguma coisa e põe as que faltam.']);
      return ['Vamos anotar as contas que vencem todo mês: aluguel, luz, água, internet, celular.', 'Pra cada uma, me diz o valor e o dia que vence.'];
    },
    resposta: (ctx) => ({
      tipo: 'lista',
      rotuloItem: 'conta',
      minItens: 1,
      campos: [
        { id: 'nome', rotulo: 'Nome', tipo: 'texto', placeholder: 'Ex.: luz, aluguel', max: 40 },
        { id: 'valor', rotulo: 'Valor', tipo: 'dinheiro' },
        { id: 'dia', rotulo: 'Dia do vencimento', tipo: 'dia' },
      ],
      // na volta (revisar), a lista vem como a pessoa deixou
      inicial: respondeu(ctx, 'contas') ? lista(ctx, 'contas') : ctx.dados.contas.map((c): ItemLista => ({ id: c.id, nome: c.nome, valor: c.valor, dia: c.dia })),
    }),
    validar: (v) => {
      const itens = Array.isArray(v) ? (v as ItemLista[]) : [];
      if (itens.some((it) => !String(it.nome ?? '').trim())) return 'Falta o nome de uma conta.';
      if (itens.some((it) => Number(it.valor) > 10_000_000)) return 'Esse valor parece alto demais. Confere e digita de novo?';
      return null;
    },
    rotulo: (v) => {
      const itens = Array.isArray(v) ? (v as ItemLista[]) : [];
      const total = custoEssencial(itens.map((it) => ({ valor: Number(it.valor) || 0 })));
      return itens.length ? `${quantas(itens.length)} · ${reais(total)}` : 'Nenhuma';
    },
    // só olha a resposta deste passo (editar uma resposta antiga corta as de depois)
    proximo: (_v, ctx) => (passaDaRenda(ctx) ? 'revisar' : 'lembrete'),
  },
  {
    // coerência (seção 4): as contas passam do que entra; o agente avisa com calma e oferece revisar
    id: 'revisar',
    falas: (ctx) => falas(ctx, [`Hm, {nome}, essas contas dão ${reais(totalDe(ctx))} e entram ${reais(ctx.dados.renda)} por mês.`, 'Quer revisar a lista ou está certo assim?']),
    resposta: {
      tipo: 'botoes',
      opcoes: [
        { valor: 'contas', rotulo: 'Revisar contas' },
        { valor: 'ok', rotulo: 'Está certo' },
      ],
    },
    proximo: (v) => (v === 'contas' ? 'contas' : 'lembrete'),
  },
  {
    id: 'lembrete',
    falas: (ctx) => {
      const n = contasDoChat(ctx).length;
      const pergunta = n === 1 ? 'Quer que eu te lembre um dia antes dela vencer?' : 'Quer que eu te lembre um dia antes de cada uma vencer?';
      if (txt(ctx, 'revisar') === 'ok' && passaDaRenda(ctx)) return ['Tudo bem. A gente começa do jeito que está e ajusta com o tempo.', pergunta];
      return [`Anotei: ${quantas(n)}, ${reais(totalDe(ctx))} por mês.`, pergunta];
    },
    resposta: {
      tipo: 'botoes',
      opcoes: [
        { valor: 'sim', rotulo: 'Sim' },
        { valor: 'nao', rotulo: 'Não' },
      ],
    },
    proximo: 'resultado',
  },
  fim('resultado', (ctx) =>
    falas(ctx, [
      'Pronto, {nome}. Agora você sabe o que vence e quando.',
      comLembrete(ctx) ? (contasDoChat(ctx).length === 1 ? 'Um dia antes dela vencer, eu te aviso.' : 'Um dia antes de cada conta, eu te aviso.') : 'Se quiser lembrete depois, é só me chamar.',
    ])
  ),
];

export const ROTEIRO_CONTAS: Roteiro = {
  id: 'contas',
  agente: 'bansir',
  titulo: 'Contas em dia',
  primeiro: 'abertura',
  passos,
  resultado: (ctx) => {
    const contas = contasDoChat(ctx);
    const prox = proximaConta(contas, ctx.dados.hoje);
    const linhas = [
      contas.length ? `${quantas(contas.length)} · ${reais(totalDe(ctx))} por mês` : 'Nenhuma conta anotada ainda',
      prox ? `Próxima: ${quandoVence(prox)}` : null,
      comLembrete(ctx) ? (contas.length === 1 ? 'Lembrete um dia antes dela' : 'Lembrete um dia antes de cada uma') : 'Sem lembrete · você confere em Missões',
    ].filter((l): l is string => Boolean(l));
    return {
      titulo: 'Seu plano com Bansir',
      linhas: linhas.slice(0, 3).map((l, i) => `${i + 1}. ${l}`),
      lista: contas.map((c) => `${c.nome} · dia ${c.dia} · ${reais(c.valor)}`),
      agentes: ['bansir'],
    };
  },
  concluir: (ctx, conversa) => {
    // os ids de verdade saem antes dos passos: a missão e as contas salvas usam os mesmos
    const finais = idsFinais(ctx);
    const total = custoEssencial(finais);
    const mes = ctx.dados.mes;
    return {
      missoes: [
        novaMissao(
          {
            agente: 'bansir',
            conversa,
            titulo: 'Contas em dia',
            tipo: 'contas',
            recorrente: true,
            metaValor: 0,
            valorInicial: 0,
            valorMensal: total,
            dataInicio: ctx.dados.hoje,
            lembrarVespera: comLembrete(ctx),
            editarPasso: 'contas',
            passos: finais.map((c, i) => ({ id: `conta:${c.id}`, ordem: i + 1, titulo: `Pagar ${c.nome} · dia ${c.dia}`, acao: 'conferir' as const, valor: null })),
            notas: passaDaRenda(ctx) ? 'As contas passam do que entra hoje. A gente ajusta com o tempo.' : undefined,
          },
          ctx.dados.hoje
        ),
      ],
      ativar: ['bansir'],
      efeitos: () => saveBills(juntarContas(loadBills(), finais, mes)),
    };
  },
};
