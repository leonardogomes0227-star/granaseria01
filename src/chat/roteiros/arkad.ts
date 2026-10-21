// Roteiro 6.2 — Arkad: reserva de emergência. Meta = 6x os gastos essenciais (pré-preenchidos com as contas fixas),
// valor por mês (sugestão: 10% da renda) e o dia em que o salário cai (o lembrete vem nesse dia).

import { aporteSugerido, mesesRestantes, metaReserva } from '../../lib/financas';
import { novaMissao } from '../../missoes';
import { brl, num, txt, type Ctx, type Passo, type Roteiro } from '../engine';
import { falas, fim, quandoEm } from './comum';

const custoDe = (ctx: Ctx) => (txt(ctx, 'custo_ok') === 'outro' || ctx.dados.custoEssencial <= 0 ? num(ctx, 'custo') : ctx.dados.custoEssencial);
export const metaDe = (ctx: Ctx) => (txt(ctx, 'meta') === 'outro' ? num(ctx, 'meta_valor') : metaReserva(custoDe(ctx)));
const atualDe = (ctx: Ctx) => num(ctx, 'atual');
const mensalDe = (ctx: Ctx) => num(ctx, 'mensal');
const meses = (ctx: Ctx) => mesesRestantes(metaDe(ctx), atualDe(ctx), mensalDe(ctx));

const passos: Passo[] = [
  {
    id: 'abertura',
    falas: (ctx) => falas(ctx, ['Uma reserva é o que separa um imprevisto de uma crise.']),
    resposta: { tipo: 'nenhuma' },
    proximo: 'atual',
  },
  {
    id: 'atual',
    falas: (ctx) => (ctx.dados.guardado > 0 ? [`Hoje você tem ${brl(ctx.dados.guardado)} guardado. Vamos ver quanto falta?`, 'Confirma quanto você tem guardado hoje?'] : ['Quanto você tem guardado hoje? Pode ser zero.']),
    resposta: (ctx) => ({ tipo: 'dinheiro', min: 0, max: 100_000_000, sugestao: () => (ctx.dados.guardado > 0 ? { valor: ctx.dados.guardado, rotulo: `${brl(ctx.dados.guardado)} (é isso)` } : null) }),
    proximo: (_v, ctx) => (ctx.dados.custoEssencial > 0 ? 'custo_ok' : 'custo'),
  },
  {
    id: 'custo_ok',
    falas: (ctx) => [`Seus gastos essenciais dão ${brl(ctx.dados.custoEssencial)} por mês. Está certo?`],
    resposta: {
      tipo: 'botoes',
      opcoes: [
        { valor: 'sim', rotulo: 'Está certo' },
        { valor: 'outro', rotulo: 'É outro valor' },
      ],
    },
    proximo: (v) => (v === 'outro' ? 'custo' : 'meta'),
  },
  {
    id: 'custo',
    falas: ['Quanto dão seus gastos essenciais por mês? Aluguel, contas, mercado, transporte.'],
    resposta: { tipo: 'dinheiro', min: 1, max: 10_000_000 },
    proximo: 'meta',
  },
  {
    id: 'meta',
    falas: (ctx) => {
      const custo = custoDe(ctx);
      return [`Seus gastos essenciais dão ${brl(custo)} por mês. Seis meses disso seria ${brl(metaReserva(custo))}. Quer usar essa meta?`];
    },
    resposta: (ctx) => ({
      tipo: 'botoes',
      opcoes: [
        { valor: 'usar', rotulo: `Usar ${brl(metaReserva(custoDe(ctx)))}` },
        { valor: 'outro', rotulo: 'Prefiro outro valor' },
      ],
    }),
    proximo: (v, ctx) => (v === 'outro' ? 'meta_valor' : atualDe(ctx) >= metaReserva(custoDe(ctx)) ? 'completa' : 'mensal'),
  },
  {
    id: 'meta_valor',
    falas: ['Qual valor você quer ter na reserva?'],
    resposta: { tipo: 'dinheiro', min: 1, max: 100_000_000 },
    proximo: (_v, ctx) => (atualDe(ctx) >= metaDe(ctx) ? 'completa' : 'mensal'),
  },
  {
    id: 'mensal',
    falas: (ctx) => {
      const sug = aporteSugerido(ctx.dados.renda);
      return sug > 0
        ? ['De cada dez moedas que entram, uma fica com você.', `Pra você, isso seria ${brl(sug)} por mês. Quanto você consegue guardar, de verdade?`]
        : ['Quanto você consegue guardar por mês, de verdade? Melhor um valor pequeno que você cumpre.'];
    },
    resposta: (ctx) => ({
      tipo: 'dinheiro',
      min: 1,
      max: 10_000_000,
      sugestao: () => {
        const s = aporteSugerido(ctx.dados.renda);
        return s > 0 ? { valor: s, rotulo: `${brl(s)} (10%)` } : null;
      },
    }),
    validar: (v, ctx) => (ctx.dados.renda > 0 && Number(v) > ctx.dados.renda ? 'Isso é mais do que entra por mês. Prefiro um valor que você consiga cumprir.' : null),
    proximo: 'dia',
  },
  {
    id: 'dia',
    falas: ['Quando o salário cai, em que dia? Eu te lembro de guardar nesse dia, antes de gastar.'],
    resposta: { tipo: 'dia' },
    proximo: 'resultado',
  },
  fim('resultado', (ctx) => falas(ctx, [`Pronto, {nome}. Guardando ${brl(mensalDe(ctx))} por mês, sua reserva fica pronta em ${quandoEm(ctx.dados.mes, meses(ctx)) ?? 'breve'}.`])),
  fim('completa', (ctx) => falas(ctx, [`Sua reserva já tem ${brl(atualDe(ctx))}, mais que a meta. Muito bem, {nome}.`, 'Agora é a vez do Sharru Nada: ele te mostra como fazer esse ouro trabalhar.'])),
];

export const ROTEIRO_RESERVA: Roteiro = {
  id: 'reserva',
  agente: 'arkad',
  titulo: 'Reserva de emergência',
  primeiro: 'abertura',
  passos,
  resultado: (ctx) => {
    if (atualDe(ctx) >= metaDe(ctx))
      return { titulo: 'Sua reserva está completa', linhas: [`1. Reserva: ${brl(atualDe(ctx))} de ${brl(metaDe(ctx))}`, '2. Próximo: investir com o Sharru Nada'], agentes: ['arkad', 'sharru'], botao: 'Falar com Sharru Nada' };
    const m = meses(ctx);
    const dia = num(ctx, 'dia');
    return {
      titulo: 'Seu plano com Arkad',
      linhas: [`1. Guardar ${brl(mensalDe(ctx))} no dia ${dia}`, `2. Chegar a ${brl(Math.round(metaDe(ctx) / 2 / 100) * 100)} (metade)`, `3. Reserva completa em ${quandoEm(ctx.dados.mes, m) ?? '—'}`],
      agentes: ['arkad'],
      rodape: 'Estimativa com os seus números. Não é recomendação de investimento.',
    };
  },
  concluir: (ctx, conversa) => {
    const meta = metaDe(ctx);
    const atual = atualDe(ctx);
    if (atual >= meta) return { missoes: [], ativar: ['arkad', 'sharru'], destino: '/agentes/sharru/chat' };
    const mensal = mensalDe(ctx);
    const dia = num(ctx, 'dia');
    const metade = Math.round(meta / 2 / 100) * 100;
    const m = meses(ctx);
    return {
      missoes: [
        novaMissao(
          {
            agente: 'arkad',
            conversa,
            titulo: 'Reserva de emergência',
            tipo: 'reserva',
            metaValor: meta,
            valorInicial: atual,
            valorMensal: mensal,
            dataInicio: ctx.dados.hoje,
            editarPasso: 'mensal',
            passos: [
              { id: 'p1', ordem: 1, titulo: `Guardar ${brl(mensal)} no dia ${dia}`, acao: 'guardar', dataAlvo: ctx.dados.mes },
              ...(atual < metade ? [{ id: 'p2', ordem: 2, titulo: `Chegar a ${brl(metade)} (metade)`, valor: metade }] : []),
              { id: 'p3', ordem: 3, titulo: `Reserva completa em ${quandoEm(ctx.dados.mes, m) ?? '—'}`, valor: meta },
            ],
          },
          ctx.dados.hoje
        ),
      ],
      ativar: ['arkad'],
      eu: { diaSalario: dia, ...(ctx.dados.custoEssencial <= 0 || txt(ctx, 'custo_ok') === 'outro' ? { custoEssencial: custoDe(ctx) } : {}) },
    };
  },
};
