// Roteiro 6.3 — Dabasir: sair das dívidas. Revisa a lista, escolhe a ordem (juros mais altos ou menor primeiro),
// combina "nada de dívida nova" e monta a missão com a quitação mês a mês (os 20% do método 70/20/10).

import { divisaoDabasir, ordemDividas, simularQuitacao, type DividaCalc, type MetodoDivida } from '../../lib/financas';
import { novaMissao } from '../../missoes';
import { brl, lista, num, txt, type Ctx, type Passo, type Roteiro } from '../engine';
import { falas, fim, quandoEm } from './comum';

const rendaDe = (ctx: Ctx) => (ctx.dados.renda > 0 ? ctx.dados.renda : num(ctx, 'renda'));
const fixosDe = (ctx: Ctx) => (ctx.dados.custoEssencial > 0 ? ctx.dados.custoEssencial : num(ctx, 'fixos'));

export function dividasDoChat(ctx: Ctx): DividaCalc[] {
  return lista(ctx, 'lista')
    .map((it, i) => ({
      id: String(it.id ?? `d${i + 1}`),
      nome: String(it.nome ?? '').trim() || `Dívida ${i + 1}`,
      saldo: Number(it.saldo) || 0,
      parcela: Number(it.parcela) || 0,
      jurosMes: it.juros === null || it.juros === undefined || it.juros === '' ? null : Number(it.juros),
    }))
    .filter((d) => d.saldo > 0);
}

const metodoDe = (ctx: Ctx): MetodoDivida => (txt(ctx, 'ordem') === 'menor' ? 'menor' : 'juros');

export function pagamentoMensal(ctx: Ctx): number {
  const ds = dividasDoChat(ctx);
  return Math.max(divisaoDabasir(rendaDe(ctx), fixosDe(ctx)).dividas, Math.round(ds.reduce((t, d) => t + d.parcela, 0)));
}

function plano(ctx: Ctx) {
  const ds = ordemDividas(dividasDoChat(ctx), metodoDe(ctx));
  const valor = pagamentoMensal(ctx);
  const q = simularQuitacao(ds, valor, metodoDe(ctx));
  const primeira = ds[0];
  const outras = ds.slice(1).reduce((t, d) => t + d.parcela, 0);
  const naPrimeira = primeira ? Math.max(primeira.parcela, valor - outras) : 0;
  const fimPrimeira = primeira ? q.porDivida.find((d) => d.id === primeira.id)?.mes ?? null : null;
  return { ds, valor, q, primeira, naPrimeira, fimPrimeira };
}

const passos: Passo[] = [
  {
    id: 'abertura',
    falas: (ctx) => falas(ctx, ['Eu já devi pra meio mundo, {nome}. Sei como pesa.', 'A saída que encontrei foi simples: de tudo que sobra, 7 partes pra viver, 2 pra pagar quem eu devo e 1 pra guardar.']),
    resposta: { tipo: 'nenhuma' },
    proximo: (_v, ctx) => (ctx.dados.renda > 0 ? (ctx.dados.custoEssencial > 0 ? 'lista' : 'fixos') : 'renda'),
  },
  {
    id: 'renda',
    falas: ['Pra fazer a conta, quanto entra por mês, em média?'],
    resposta: { tipo: 'dinheiro', min: 1, max: 10_000_000 },
    proximo: (_v, ctx) => (ctx.dados.custoEssencial > 0 ? 'lista' : 'fixos'),
  },
  {
    id: 'fixos',
    falas: ['E quanto dão os gastos que se repetem todo mês? Aluguel, contas, mercado, transporte.'],
    resposta: { tipo: 'dinheiro', min: 0, max: 10_000_000 },
    proximo: 'lista',
  },
  {
    id: 'lista',
    falas: (ctx) => (ctx.dados.dividas.length ? ['Essas são as dívidas que eu tenho anotadas. Corrija o que mudou e adicione as que faltam.'] : ['Me conta cada dívida. Se não souber os juros, pode deixar em branco.']),
    resposta: (ctx) => ({
      tipo: 'lista',
      rotuloItem: 'dívida',
      minItens: 1,
      campos: [
        { id: 'nome', rotulo: 'Nome', tipo: 'texto', placeholder: 'Ex.: cartão Nubank', max: 40 },
        { id: 'saldo', rotulo: 'Quanto deve', tipo: 'dinheiro' },
        { id: 'parcela', rotulo: 'Parcela por mês', tipo: 'dinheiro', opcional: true },
        { id: 'juros', rotulo: 'Juros ao mês (%)', tipo: 'percentual', opcional: true, placeholder: 'Se souber' },
      ],
      inicial: ctx.dados.dividas.map((d) => ({ id: d.id, nome: d.nome, saldo: d.saldo, parcela: d.parcela || null, juros: d.jurosMes ?? null })),
    }),
    proximo: (_v, ctx) => (dividasDoChat(ctx).length > 1 ? 'ordem' : 'regra'),
  },
  {
    id: 'ordem',
    falas: ['Quer começar pela que tem os juros mais altos (economiza mais) ou pela menor (dá ânimo ver uma acabar logo)?'],
    resposta: {
      tipo: 'botoes',
      opcoes: [
        { valor: 'juros', rotulo: 'Juros mais altos' },
        { valor: 'menor', rotulo: 'Menor primeiro' },
      ],
    },
    proximo: 'regra',
  },
  {
    id: 'regra',
    falas: ['Uma regra: enquanto a gente paga, nada de dívida nova. Combinado?'],
    resposta: { tipo: 'botoes', opcoes: [{ valor: 'ok', rotulo: 'Combinado' }] },
    proximo: 'resultado',
  },
  fim('resultado', (ctx) => {
    const p = plano(ctx);
    if (p.q.travou) return ['Vou ser sincero: com o que sobra hoje, os juros andam mais rápido que o pagamento.', 'O primeiro passo é renegociar. Eu te ajudo a pedir.'];
    return falas(ctx, [`Pronto, {nome}. Com ${brl(p.valor)} por mês, você fica livre em ${quandoEm(ctx.dados.mes, p.q.meses) ?? '—'}.`]);
  }),
];

export const ROTEIRO_DIVIDAS: Roteiro = {
  id: 'dividas',
  agente: 'dabasir',
  titulo: 'Sair das dívidas',
  primeiro: 'abertura',
  passos,
  resultado: (ctx) => {
    const p = plano(ctx);
    const mes = ctx.dados.mes;
    return {
      titulo: 'Seu plano com Dabasir',
      linhas: [
        `1. Pagar ${brl(p.naPrimeira)} em ${p.primeira?.nome ?? 'dívida'} este mês`,
        p.q.travou ? '2. Pedir renegociação ao credor' : `2. Quitar ${p.primeira?.nome ?? 'a primeira'} até ${quandoEm(mes, p.fimPrimeira) ?? '—'}`,
        p.q.travou ? '3. Voltar a falar comigo com a proposta nova' : `3. Livre das dívidas em ${quandoEm(mes, p.q.meses) ?? '—'}`,
      ],
      // mini linha do tempo: quando cada uma acaba
      lista: p.q.travou ? undefined : p.ds.map((d) => `${d.nome} · quitada em ${quandoEm(mes, p.q.porDivida.find((x) => x.id === d.id)?.mes ?? null) ?? '—'}`),
      agentes: ['dabasir'],
      rodape: 'Estimativa com os seus números e os juros informados.',
    };
  },
  concluir: (ctx, conversa) => {
    const p = plano(ctx);
    const total = Math.round(p.ds.reduce((t, d) => t + d.saldo, 0));
    const mes = ctx.dados.mes;
    return {
      missoes: [
        novaMissao(
          {
            agente: 'dabasir',
            conversa,
            titulo: 'Sair das dívidas',
            tipo: 'divida',
            metaValor: total,
            valorInicial: 0,
            valorMensal: p.valor,
            dataInicio: ctx.dados.hoje,
            dividas: p.ds,
            metodo: metodoDe(ctx),
            editarPasso: 'lista',
            passos: p.q.travou
              ? [
                  { id: 'p1', ordem: 1, titulo: `Pagar ${brl(p.naPrimeira)} em ${p.primeira?.nome ?? 'dívida'} este mês`, acao: 'pagar', dataAlvo: mes },
                  { id: 'p2', ordem: 2, titulo: `Pedir renegociação de ${p.primeira?.nome ?? 'dívida'}`, acao: 'conferir' },
                  { id: 'p3', ordem: 3, titulo: 'Livre das dívidas', valor: total },
                ]
              : [
                  { id: 'p1', ordem: 1, titulo: `Pagar ${brl(p.naPrimeira)} em ${p.primeira?.nome ?? 'dívida'} este mês`, acao: 'pagar', dataAlvo: mes },
                  { id: 'p2', ordem: 2, titulo: `Quitar ${p.primeira?.nome ?? 'a primeira'} até ${quandoEm(mes, p.fimPrimeira) ?? '—'}`, valor: Math.round(p.primeira?.saldo ?? 0) },
                  { id: 'p3', ordem: 3, titulo: `Livre das dívidas em ${quandoEm(mes, p.q.meses) ?? '—'}`, valor: total },
                ],
            notas: p.q.travou ? 'O valor de hoje não cobre os juros. Renegociar é o próximo passo.' : undefined,
          },
          ctx.dados.hoje
        ),
      ],
      ativar: ['dabasir'],
      eu: {
        ...(ctx.dados.renda <= 0 ? { renda: num(ctx, 'renda') } : {}),
        ...(ctx.dados.custoEssencial <= 0 && num(ctx, 'fixos') > 0 ? { custoEssencial: num(ctx, 'fixos') } : {}),
      },
    };
  },
};
