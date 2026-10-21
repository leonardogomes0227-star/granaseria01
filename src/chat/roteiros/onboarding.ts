// Roteiro 6.1 — "Montar plano com o coach" (onboarding). O mesmo roteiro para os três agentes principais
// (Arkad, Dabasir, Nomasir); só o tom das falas muda. No fim: cartão com até 3 linhas e, ao Começar, as missões.

import { addMonths, daysInMonth, monthAbbr } from '../../coachChat/months';
import {
  aporteSugerido,
  coerencia,
  divisaoDabasir,
  metaReserva,
  metodoPadrao,
  ordemDividas,
  porDia,
  simularQuitacao,
  sobraTeorica,
  type DividaCalc,
} from '../../lib/financas';
import { novaMissao, type Missao } from '../../missoes';
import { brl, comNome, lista, num, respondeu, txt, varios, type AgenteId, type Ctx, type Conclusao, type Passo, type Resultado, type Roteiro } from '../engine';

export const ONBOARDING = 'onboarding';
export const AGENTES_PRINCIPAIS: AgenteId[] = ['arkad', 'dabasir', 'nomasir'];

type Tom = Partial<Record<AgenteId, string[]>> & { padrao: string[] };
/** As falas no tom do agente da conversa (com {nome}). */
const tom = (ctx: Ctx, t: Tom): string[] => (t[ctx.agente] ?? t.padrao).map((s) => comNome(s, ctx.nome));

/* ---------- leitura das respostas ---------- */

export function dividasDe(ctx: Ctx): DividaCalc[] {
  if (txt(ctx, 'tem_divida') !== 'tenho') return [];
  return lista(ctx, 'lista_dividas')
    .map((it, i) => ({
      id: String(it.id ?? `d${i + 1}`),
      nome: String(it.nome ?? '').trim() || `Dívida ${i + 1}`,
      saldo: Number(it.saldo) || 0,
      parcela: Number(it.parcela) || 0,
      jurosMes: it.juros === null || it.juros === undefined || it.juros === '' ? null : Number(it.juros),
    }))
    .filter((d) => d.saldo > 0);
}

const somaParcelas = (ds: DividaCalc[]) => ds.reduce((t, d) => t + d.parcela, 0);

/** Quanto vai pras dívidas por mês: os 20% do Dabasir, e nunca menos que a soma das parcelas. */
export function pagamentoDividas(ctx: Ctx): number {
  const ds = dividasDe(ctx);
  if (ds.length === 0) return 0;
  return Math.max(divisaoDabasir(num(ctx, 'renda'), num(ctx, 'fixos')).dividas, Math.round(somaParcelas(ds)));
}

/** A sugestão de quanto guardar: 10% da renda; com dívida, 10% do que sobra depois dos fixos. */
export function sugestaoGuardar(ctx: Ctx): number {
  const temDivida = dividasDe(ctx).length > 0;
  const s = aporteSugerido(num(ctx, 'renda'), { temDivida, sobraDepoisDosFixos: Math.max(0, num(ctx, 'renda') - num(ctx, 'fixos')) });
  // nunca sugere mais do que sobra
  return Math.max(0, Math.min(s, Math.floor(sobraTeorica(num(ctx, 'renda'), num(ctx, 'fixos'), temDivida ? pagamentoDividas(ctx) : 0))));
}

const reservaJaCompleta = (ctx: Ctx) => num(ctx, 'fixos') > 0 && num(ctx, 'guardado') >= metaReserva(num(ctx, 'fixos'));

/* ---------- passos ---------- */

const passos: Passo[] = [
  {
    id: 'boas_vindas',
    falas: (ctx) =>
      tom(ctx, {
        padrao: ['Que bom ter você aqui, {nome}.', 'Vamos montar o seu plano com calma. São poucas perguntas, e você pode corrigir qualquer resposta depois.'],
        dabasir: ['Que bom que você veio, {nome}. Eu sei o peso de dever pra meio mundo.', 'Vamos montar o seu caminho juntos. São poucas perguntas, e você pode corrigir qualquer resposta depois.'],
        nomasir: ['Fala, {nome}. Vou ser direto: são poucas perguntas.', 'No fim você sai com um plano. E pode corrigir qualquer resposta depois.'],
      }),
    resposta: { tipo: 'nenhuma' },
    proximo: 'renda',
  },
  {
    id: 'renda',
    falas: (ctx) =>
      respondeu(ctx, 'renda_variavel')
        ? ['Certo. Quanto entra por mês, em média?']
        : tom(ctx, {
            padrao: ['Primeiro: quanto entra por mês, em média, já descontado o que sai direto do pagamento?'],
            nomasir: ['Quanto entra por mês, em média? Já descontado o que sai direto do pagamento.'],
          }),
    resposta: (ctx) => ({
      tipo: 'dinheiro',
      min: 0,
      max: 10_000_000,
      sugestao: () => (ctx.dados.renda > 0 ? { valor: ctx.dados.renda, rotulo: `${brl(ctx.dados.renda)} (o que você já informou)` } : null),
    }),
    validar: (v) => (Number(v) <= 0 ? 'Sem renda agora? Tudo bem. Coloque o valor que entra, mesmo que seja pouco ou irregular.' : null),
    // revisando a renda (fixos maiores que ela): volta direto pra conferência
    proximo: (_v, ctx) => (respondeu(ctx, 'fixos') ? 'confere_fixos' : respondeu(ctx, 'renda_variavel') ? 'fixos' : 'renda_variavel'),
  },
  {
    id: 'renda_variavel',
    falas: ['Esse valor é o mesmo todo mês ou muda bastante?'],
    resposta: {
      tipo: 'botoes',
      opcoes: [
        { valor: 'fixa', rotulo: 'Fixa todo mês' },
        { valor: 'varia', rotulo: 'Varia bastante' },
      ],
    },
    proximo: 'fixos',
  },
  {
    id: 'fixos',
    falas: (ctx) => {
      if (respondeu(ctx, 'fixos')) return ['Quanto dão os gastos que se repetem todo mês?'];
      const base = txt(ctx, 'renda_variavel') === 'varia' ? ['Então vamos usar um mês fraco como base. Melhor sobrar do que faltar.'] : [];
      return [...base, 'Agora os gastos que se repetem todo mês: aluguel, contas, mercado, transporte.', 'Quanto isso dá, mais ou menos?'];
    },
    resposta: (ctx) => ({
      tipo: 'dinheiro',
      min: 0,
      max: 10_000_000,
      sugestao: () => (ctx.dados.custoEssencial > 0 ? { valor: ctx.dados.custoEssencial, rotulo: `${brl(ctx.dados.custoEssencial)} (seus gastos fixos)` } : null),
    }),
    proximo: 'confere_fixos',
  },
  {
    // passo sem fala: só decide o caminho
    id: 'confere_fixos',
    falas: [],
    resposta: { tipo: 'nenhuma' },
    proximo: (_v, ctx) => (coerencia({ renda: num(ctx, 'renda'), custo: num(ctx, 'fixos') }).fixosPassamDaRenda && txt(ctx, 'fixos_revisar') !== 'ok' ? 'fixos_revisar' : 'sobra'),
  },
  {
    id: 'fixos_revisar',
    falas: (ctx) => [comNome('Hm, {nome}, isso passa do que entra. Quer revisar algum dos dois?', ctx.nome)],
    resposta: {
      tipo: 'botoes',
      opcoes: [
        { valor: 'renda', rotulo: 'Revisar renda' },
        { valor: 'fixos', rotulo: 'Revisar gastos' },
        { valor: 'ok', rotulo: 'Está certo mesmo' },
      ],
    },
    proximo: (v) => (v === 'renda' ? 'renda' : v === 'fixos' ? 'fixos' : 'sobra'),
  },
  {
    id: 'sobra',
    falas: (ctx) =>
      txt(ctx, 'fixos_revisar') === 'ok' && coerencia({ renda: num(ctx, 'renda'), custo: num(ctx, 'fixos') }).fixosPassamDaRenda
        ? ['Tudo bem. A gente começa do jeito que está e ajusta com o tempo.', 'E no fim do mês, costuma sobrar quanto? Pode ser zero, sem problema.']
        : ['E no fim do mês, costuma sobrar quanto? Pode ser zero, sem problema.'],
    resposta: { tipo: 'dinheiro', min: 0, max: 10_000_000 },
    proximo: (_v, ctx) => {
      const c = coerencia({ renda: num(ctx, 'renda'), custo: num(ctx, 'fixos'), sobraInformada: num(ctx, 'sobra') });
      return c.diferenca !== null && c.diferenca > 0 ? 'sobra_destino' : 'tem_divida';
    },
  },
  {
    id: 'sobra_destino',
    falas: (ctx) => {
      const c = coerencia({ renda: num(ctx, 'renda'), custo: num(ctx, 'fixos'), sobraInformada: num(ctx, 'sobra') });
      return [`Pela conta, sobrariam uns ${brl(c.diferenca ?? 0)} a mais. Pra onde costuma ir esse dinheiro?`];
    },
    resposta: {
      tipo: 'multiplo',
      opcoes: [
        { valor: 'lanches', rotulo: 'Lanches e delivery' },
        { valor: 'compras', rotulo: 'Compras' },
        { valor: 'cartao', rotulo: 'Cartão e parcelas' },
        { valor: 'ajudo', rotulo: 'Ajudo alguém' },
        { valor: 'naosei', rotulo: 'Não sei' },
      ],
    },
    proximo: 'tem_divida',
  },
  {
    id: 'tem_divida',
    falas: (ctx) => {
      const escapa = varios(ctx, 'sobra_destino').includes('naosei')
        ? [ctx.agente === 'nomasir' ? 'Esse é o dinheiro que escapa sem a gente ver. É comigo mesmo: vou ficar de olho.' : 'Esse é o dinheiro que escapa sem a gente ver. O Nomasir é ótimo nisso. Vou deixar ele de olho.']
        : [];
      return [...escapa, 'Você tem alguma dívida hoje? Cartão, empréstimo, financiamento…'];
    },
    resposta: {
      tipo: 'botoes',
      opcoes: [
        { valor: 'tenho', rotulo: 'Tenho' },
        { valor: 'nao', rotulo: 'Não tenho' },
      ],
    },
    proximo: (v) => (v === 'tenho' ? 'lista_dividas' : 'guardado'),
  },
  {
    id: 'lista_dividas',
    falas: (ctx) =>
      tom(ctx, {
        padrao: ['Entendo. Vamos cuidar disso primeiro, uma coisa de cada vez.', 'Me conta cada uma. Se não souber os juros, pode deixar em branco.'],
        dabasir: ['Eu sei como é. Vamos cuidar disso primeiro, uma de cada vez.', 'Me conta cada uma. Se não souber os juros, pode deixar em branco.'],
      }),
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
    proximo: 'guardado',
  },
  {
    id: 'guardado',
    falas: (ctx) => {
      const dabasir =
        dividasDe(ctx).length > 0
          ? [ctx.agente === 'dabasir' ? 'Ok. Eu já passei por isso e sei o caminho. Vou cuidar das dívidas com você.' : 'Ok. O Dabasir já passou por isso e sabe o caminho. Ele vai cuidar das dívidas com você.']
          : [];
      return [...dabasir, 'Você já tem algum dinheiro guardado hoje?'];
    },
    resposta: (ctx) => ({
      tipo: 'dinheiro',
      min: 0,
      max: 100_000_000,
      sugestao: () => (ctx.dados.guardado > 0 ? { valor: ctx.dados.guardado, rotulo: `${brl(ctx.dados.guardado)} (o que você já tem)` } : null),
    }),
    proximo: 'quanto_guardar',
  },
  {
    id: 'quanto_guardar',
    falas: (ctx) => {
      const sug = sugestaoGuardar(ctx);
      if (dividasDe(ctx).length > 0) {
        return [
          'Com dívida, a conta é a do Dabasir: do que sobra depois das contas fixas, 7 partes são pra viver, 2 pra pagar quem você deve e 1 fica com você.',
          `Pra você, isso seria ${brl(sug)} por mês. Quanto você consegue guardar, de verdade?`,
        ];
      }
      return tom(ctx, {
        padrao: ['Na Babilônia aprendi uma regra simples: de cada dez moedas que entram, uma fica com você.', `Pra você, isso seria ${brl(sug)}. Quanto você consegue guardar por mês, de verdade?`],
        dabasir: ['Uma lição que eu aprendi tarde: de cada dez moedas que entram, uma é sua, antes de qualquer conta.', `Pra você, isso seria ${brl(sug)}. Quanto você consegue guardar por mês, de verdade?`],
        nomasir: ['Meu pai me ensinou e eu demorei a ouvir: de cada dez moedas que entram, uma fica com você.', `Pra você, isso seria ${brl(sug)}. Quanto você consegue guardar por mês, de verdade?`],
      });
    },
    resposta: (ctx) => ({
      tipo: 'dinheiro',
      min: 0,
      max: 10_000_000,
      sugestao: () => {
        const s = sugestaoGuardar(ctx);
        return s > 0 ? { valor: s, rotulo: `${brl(s)} (${dividasDe(ctx).length > 0 ? 'Dabasir' : '10%'})` } : null;
      },
    }),
    validar: (v, ctx) => {
      const sobra = sobraTeorica(num(ctx, 'renda'), num(ctx, 'fixos'), pagamentoDividas(ctx));
      return Number(v) > 0 && Number(v) > Math.max(0, sobra) ? 'Isso é mais do que sobra hoje. Prefiro um valor menor que você consiga cumprir. Quer ajustar?' : null;
    },
    proximo: 'resultado',
  },
  {
    id: 'resultado',
    falas: (ctx) => [comNome('Pronto, {nome}. Preparei seu plano.', ctx.nome)],
    resposta: { tipo: 'nenhuma' },
    proximo: null,
  },
];

/* ---------- o plano (puro: o cartão e as missões saem das mesmas contas) ---------- */

export interface PlanoOnboarding {
  dividas: DividaCalc[];
  pagamentoDividas: number;
  quitacao: ReturnType<typeof simularQuitacao> | null;
  meta: number;
  guardado: number;
  guardar: number;
  reservaCompleta: boolean;
  porDia: number;
  agentes: AgenteId[];
}

export function planoDe(ctx: Ctx): PlanoOnboarding {
  const ds = dividasDe(ctx);
  const pagamento = pagamentoDividas(ctx);
  const quitacao = ds.length ? simularQuitacao(ds, pagamento, metodoPadrao(ds)) : null;
  const meta = metaReserva(num(ctx, 'fixos'));
  const guardar = Math.max(0, num(ctx, 'quanto_guardar'));
  const livre = num(ctx, 'renda') - num(ctx, 'fixos') - guardar - pagamento;
  const agentes = new Set<AgenteId>([ctx.agente]);
  if (ds.length) agentes.add('dabasir');
  if (!reservaJaCompleta(ctx)) agentes.add('arkad');
  else agentes.add('sharru');
  if (varios(ctx, 'sobra_destino').includes('naosei')) agentes.add('nomasir');
  return {
    dividas: ds,
    pagamentoDividas: pagamento,
    quitacao,
    meta,
    guardado: num(ctx, 'guardado'),
    guardar,
    reservaCompleta: reservaJaCompleta(ctx),
    porDia: porDia(livre, daysInMonth(ctx.dados.mes)),
    agentes: [...agentes],
  };
}

const quando = (mesAtual: string, meses: number | null) => (meses === null ? null : monthAbbr(addMonths(mesAtual, Math.max(0, meses - 1))));

function resultado(ctx: Ctx): Resultado {
  const p = planoDe(ctx);
  const mes = ctx.dados.mes;
  const linhas: string[] = [];
  if (p.dividas.length) {
    const onde = p.dividas.length === 1 ? `em ${p.dividas[0].nome}` : 'nas dívidas';
    const fim = p.quitacao?.travou ? 'precisa renegociar' : p.quitacao?.meses ? `quitado em ${quando(mes, p.quitacao.meses)}` : '';
    linhas.push(`Pagar ${brl(p.pagamentoDividas)}/mês ${onde}${fim ? ` · ${fim}` : ''}`);
  }
  if (p.reservaCompleta) linhas.push('Reserva completa · hora de fazer o ouro trabalhar');
  else if (p.guardar > 0) {
    // com dívida, a reserva cresce devagar (o grosso vai pras dívidas); a data conta só o que você guarda
    const meses = Math.ceil(Math.max(0, p.meta - p.guardado) / p.guardar);
    linhas.push(`Guardar ${brl(p.guardar)}/mês · reserva em ${quando(mes, meses)}`);
  } else linhas.push(`Montar a reserva de ${brl(p.meta)} quando der`);
  linhas.push(p.porDia > 0 ? `Gastar até ${brl(p.porDia)} por dia` : 'Revisar os gastos fixos: hoje o mês não fecha');
  return {
    titulo: `Seu plano com ${NOMES[ctx.agente]}`,
    linhas: linhas.slice(0, 3).map((l, i) => `${i + 1}. ${l}`),
    agentes: p.agentes,
    rodape: 'Estimativa com os seus números. Não é recomendação de investimento.',
    botao: 'Começar',
  };
}

const NOMES: Record<AgenteId, string> = { arkad: 'Arkad', bansir: 'Bansir', nomasir: 'Nomasir', dabasir: 'Dabasir', mathon: 'Mathon', rodan: 'Rodan', sharru: 'Sharru Nada' };

/** Ao tocar em Começar: as missões do plano (as antigas do mesmo tipo só são arquivadas agora). */
export function concluirOnboarding(ctx: Ctx, conversa: string): Conclusao {
  const p = planoDe(ctx);
  const hoje = ctx.dados.hoje;
  const mes = ctx.dados.mes;
  const missoes: Missao[] = [];
  if (p.dividas.length) {
    const metodo = metodoPadrao(p.dividas);
    const ordem = ordemDividas(p.dividas, metodo);
    const primeira = ordem[0];
    const outras = ordem.slice(1).reduce((t, d) => t + d.parcela, 0);
    const naPrimeira = Math.max(primeira.parcela, p.pagamentoDividas - outras);
    const fimPrimeira = p.quitacao?.porDivida.find((d) => d.id === primeira.id)?.mes ?? null;
    const total = p.dividas.reduce((t, d) => t + d.saldo, 0);
    missoes.push(
      novaMissao(
        {
          agente: 'dabasir',
          conversa,
          titulo: 'Sair das dívidas',
          tipo: 'divida',
          editarPasso: 'lista_dividas',
          metaValor: Math.round(total),
          valorInicial: 0,
          valorMensal: p.pagamentoDividas,
          dataInicio: hoje,
          dividas: ordem,
          metodo,
          passos: [
            { id: 'p1', ordem: 1, titulo: `Pagar ${brl(naPrimeira)} em ${primeira.nome} este mês`, valor: null, acao: 'pagar', dataAlvo: mes },
            { id: 'p2', ordem: 2, titulo: `Quitar ${primeira.nome}${fimPrimeira ? ` até ${quando(mes, fimPrimeira)}` : ''}`, valor: Math.round(primeira.saldo) },
            { id: 'p3', ordem: 3, titulo: p.quitacao?.meses ? `Livre das dívidas em ${quando(mes, p.quitacao.meses)}` : 'Livre das dívidas', valor: Math.round(total) },
          ],
          notas: p.quitacao?.travou ? 'O valor de hoje não cobre os juros. Renegociar é o próximo passo.' : undefined,
        },
        hoje
      )
    );
  }
  if (p.reservaCompleta) {
    missoes.push(
      novaMissao(
        {
          agente: 'sharru',
          conversa,
          titulo: 'Fazer o ouro trabalhar',
          tipo: 'investir',
          editarPasso: 'quanto_guardar',
          metaValor: 0,
          valorInicial: 0,
          valorMensal: p.guardar,
          dataInicio: hoje,
          passos: [{ id: 'p1', ordem: 1, titulo: 'Conversar com Sharru Nada sobre investir', acao: 'conversar' }],
        },
        hoje
      )
    );
  } else if (p.meta > 0) {
    const metade = Math.round(p.meta / 2 / 100) * 100;
    const meses = p.guardar > 0 ? Math.ceil(Math.max(0, p.meta - p.guardado) / p.guardar) : null;
    missoes.push(
      novaMissao(
        {
          agente: 'arkad',
          conversa,
          titulo: 'Reserva de emergência',
          tipo: 'reserva',
          editarPasso: 'quanto_guardar',
          metaValor: p.meta,
          valorInicial: p.guardado,
          valorMensal: p.guardar,
          dataInicio: hoje,
          passos: [
            { id: 'p1', ordem: 1, titulo: p.guardar > 0 ? `Guardar ${brl(p.guardar)} este mês` : 'Guardar o que der este mês', acao: 'guardar', dataAlvo: mes },
            ...(p.guardado < metade ? [{ id: 'p2', ordem: 2, titulo: `Chegar a ${brl(metade)} (metade)`, valor: metade }] : []),
            { id: 'p3', ordem: 3, titulo: meses ? `Reserva completa em ${quando(mes, meses)}` : `Reserva completa: ${brl(p.meta)}`, valor: p.meta },
          ],
        },
        hoje
      )
    );
  }
  return {
    missoes,
    ativar: p.agentes,
    eu: {
      renda: num(ctx, 'renda'),
      rendaVariavel: txt(ctx, 'renda_variavel') === 'varia',
      custoEssencial: num(ctx, 'fixos'),
      agentePrincipal: ctx.agente,
      onboardingConcluido: true,
    },
  };
}

export const ROTEIRO_ONBOARDING = (agente: AgenteId): Roteiro => ({
  id: ONBOARDING,
  agente,
  titulo: 'Montar plano',
  primeiro: 'boas_vindas',
  passos,
  resultado,
  concluir: concluirOnboarding,
});
