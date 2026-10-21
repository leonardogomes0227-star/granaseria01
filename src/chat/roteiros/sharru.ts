// Roteiro 6.8 — Sharru Nada: investir e viver de renda (6ª cura: garanta renda futura; 7ª: aumente sua capacidade
// de ganhar). Investir só começa com a reserva completa. Antes disso, Sharru diz quantos meses faltam e a pessoa
// escolhe esperar (ele fica de olho) ou investir mesmo assim (com um aviso calmo, e a missão anota isso).
//
// Caminho normal: quanto quer ter por mês pra viver sem trabalhar → quanto precisaria investido (0,5% ao mês) →
// quanto consegue investir por mês (sugestão: 10% da renda) → se quer aumentar o que entra (curso, freela, aumento).
// O cartão mostra a projeção em 5, 10 e 20 anos (com gráfico) e cria a missão "Fazer o ouro trabalhar".

import { aporteSugerido, patrimonioParaViverDeRenda, podeInvestir, projecaoInvestimento } from '../../lib/financas';
import { novaMissao, valorAtual, type PassoMissao } from '../../missoes';
import { brl, num, txt, varios, type Ctx, type Opcao, type Passo, type Resultado, type Roteiro, type Valor } from '../engine';
import { falas, fim, mesesAteReserva, missaoAtiva, NOMES } from './comum';

/* ---------- a reserva ---------- */

/**
 * A reserva está completa? Pela missão de reserva (a ativa; senão a concluída; senão a pausada): concluída ou com o
 * valor atual na meta. Sem missão, pelo guardado e a meta que o app conhece.
 */
export function reservaCompleta(ctx: Ctx): boolean {
  const reservas = ctx.dados.missoes.filter((m) => m.tipo === 'reserva');
  const r = reservas.find((m) => m.status === 'ativa') ?? reservas.find((m) => m.status === 'concluida') ?? reservas.find((m) => m.status === 'pausada');
  if (r) return r.status === 'concluida' || podeInvestir(valorAtual(r), r.metaValor);
  return podeInvestir(ctx.dados.guardado, ctx.dados.reservaMeta);
}

/** A pessoa quis investir antes de a reserva completar. */
export const forcou = (ctx: Ctx) => !reservaCompleta(ctx) && txt(ctx, 'espera') === 'forcar';

/** Pode seguir pro plano de investir (reserva completa, ou a pessoa escolheu seguir mesmo assim). */
export const liberado = (ctx: Ctx) => reservaCompleta(ctx) || podeInvestir(0, 0, txt(ctx, 'espera') === 'forcar');

/** "Faltam 9 meses." / "Falta 1 mês." (null: sem previsão). */
export const faltam = (meses: number | null) => (meses === null ? null : meses === 1 ? 'Falta 1 mês.' : `Faltam ${meses} meses.`);

/* ---------- os números do plano ---------- */

export const custoDe = (ctx: Ctx) => Math.max(0, num(ctx, 'custo'));
/** Quanto precisaria investido pra viver de renda (0,5% ao mês). */
export const metaDe = (ctx: Ctx) => patrimonioParaViverDeRenda(custoDe(ctx));
export const mensalDe = (ctx: Ctx) => Math.max(0, num(ctx, 'mensal'));
/** O primeiro marco: 10% da meta, na centena. */
export const marcoDe = (ctx: Ctx) => Math.round((metaDe(ctx) * 0.1) / 100) * 100;

export const ANOS = [5, 10, 20] as const;

/** Quanto teria investindo o valor do mês, em 5, 10 e 20 anos (rendendo 0,5% ao mês). */
export const projecoes = (ctx: Ctx) => ANOS.map((anos) => ({ anos, valor: projecaoInvestimento(0, mensalDe(ctx), anos * 12) }));

/* ---------- 7ª cura: aumentar o que entra ---------- */

const CURAS: (Opcao & { passo: string })[] = [
  { valor: 'curso', rotulo: 'Fazer um curso', passo: 'Procurar um curso que aumente sua renda' },
  { valor: 'freela', rotulo: 'Freela ou bico', passo: 'Conseguir um freela ou bico' },
  { valor: 'aumento', rotulo: 'Pedir aumento', passo: 'Pedir aumento: anote o que você entregou este ano' },
];
const AGORA_NAO: Opcao = { valor: 'nao', rotulo: 'Agora não' };

/** As escolhidas, na ordem dos botões. "Agora não" junto com outras vale como nenhuma. */
export function curasDe(ctx: Ctx) {
  const v = varios(ctx, 'renda');
  if (v.includes(AGORA_NAO.valor)) return [];
  return CURAS.filter((c) => v.includes(c.valor));
}

/* ---------- passos ---------- */

const passos: Passo[] = [
  {
    id: 'abertura',
    falas: (ctx) => {
      if (!reservaCompleta(ctx)) return falas(ctx, ['Que bom ter você aqui, {nome}. Eu cuido do ouro que trabalha por você.']);
      return falas(ctx, [
        'Sua reserva está completa, {nome}. Agora a gente faz o ouro trabalhar.',
        'Dinheiro guardado trabalha. Dinheiro parado dorme.',
        missaoAtiva(ctx, 'investir') ? 'Vamos rever o seu plano. O atual continua valendo até você terminar.' : '',
      ]);
    },
    resposta: { tipo: 'nenhuma' },
    proximo: (_v, ctx) => (reservaCompleta(ctx) ? 'custo' : 'espera'),
  },
  {
    id: 'espera',
    falas: (ctx) => {
      const quanto = faltam(mesesAteReserva(ctx));
      if (quanto) return [`Primeiro a reserva, depois a gente faz o ouro trabalhar. ${quanto}`, 'Com a reserva pronta, um imprevisto não mexe no que você investiu.'];
      return [
        'Primeiro a reserva, depois a gente faz o ouro trabalhar.',
        missaoAtiva(ctx, 'reserva') ? `Converse com o ${NOMES.arkad} pra definir quanto guardar por mês. Aí eu sei quando chega a hora.` : `O ${NOMES.arkad} te ajuda a montar a sua. Vale conversar com ele.`,
      ];
    },
    resposta: {
      tipo: 'botoes',
      opcoes: [
        { valor: 'avisar', rotulo: 'Me avisa quando chegar a hora' },
        { valor: 'forcar', rotulo: 'Quero investir mesmo assim' },
      ],
    },
    proximo: (v) => (v === 'forcar' ? 'aviso' : 'avisar'),
  },
  {
    id: 'aviso',
    falas: [
      'Tudo bem, a escolha é sua.',
      'Só um cuidado: sem reserva, um imprevisto pode te fazer vender o investimento numa hora ruim.',
      'Então começamos com calma, e você segue guardando na reserva também.',
    ],
    resposta: { tipo: 'nenhuma' },
    proximo: 'custo',
  },
  {
    id: 'custo',
    falas: ['Quanto você gostaria de ter por mês pra viver, sem trabalhar?'],
    resposta: (ctx) => ({
      tipo: 'dinheiro',
      min: 1,
      max: 10_000_000,
      sugestao: () => (ctx.dados.custoEssencial > 0 ? { valor: Math.round(ctx.dados.custoEssencial), rotulo: `${brl(ctx.dados.custoEssencial)} (seus gastos de hoje)` } : null),
    }),
    proximo: 'meta',
  },
  {
    id: 'meta',
    falas: (ctx) => [
      `Pra viver de renda com ${brl(custoDe(ctx))}/mês, você precisaria de aproximadamente ${brl(metaDe(ctx))} investidos (estimativa conservadora de 0,5% ao mês).`,
      'Parece muito? Todo tesouro começou com uma moeda. O tempo faz a maior parte do trabalho.',
    ],
    resposta: { tipo: 'nenhuma' },
    proximo: 'mensal',
  },
  {
    id: 'mensal',
    falas: (ctx) => {
      const sug = aporteSugerido(ctx.dados.renda);
      const dica = sug <= 0 ? '' : reservaCompleta(ctx) ? `Os 10% que iam pra reserva podem vir pra cá: ${brl(sug)}.` : `Uma boa base é 10% do que entra: ${brl(sug)}. Se apertar, comece com menos.`;
      return [dica, 'Quanto você consegue investir por mês?'];
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
    validar: (v, ctx) => (ctx.dados.renda > 0 && Number(v) > ctx.dados.renda ? 'Isso é mais do que entra por mês. Prefiro um valor que você consiga manter.' : null),
    proximo: 'renda',
  },
  {
    id: 'renda',
    falas: ['Tem outro jeito de chegar lá mais rápido: ganhar mais.', 'Quer aumentar o que entra?'],
    resposta: { tipo: 'multiplo', opcoes: [...CURAS.map(({ valor, rotulo }) => ({ valor, rotulo })), AGORA_NAO] },
    // "Agora não" junto com outras vale como nenhuma: o balão mostra isso
    rotulo: (v: Valor) => {
      const lista = Array.isArray(v) ? (v as string[]) : [];
      if (lista.length === 0 || lista.includes(AGORA_NAO.valor)) return AGORA_NAO.rotulo;
      return CURAS.filter((c) => lista.includes(c.valor)).map((c) => c.rotulo).join(', ');
    },
    proximo: 'resultado',
  },
  fim('resultado', (ctx) => {
    const vinte = projecoes(ctx)[2].valor;
    return falas(ctx, [
      `Pronto, {nome}. Investindo ${brl(mensalDe(ctx))} por mês, em 20 anos você teria cerca de ${brl(vinte)}.`,
      curasDe(ctx).length ? 'E ganhando mais, você chega lá antes. Deixei os passos na sua missão.' : 'Quando quiser aumentar o que entra, é só me chamar.',
    ]);
  }),
  fim('avisar', (ctx) =>
    falas(ctx, [
      'Pode deixar, {nome}. Quando a reserva completar, é a hora do ouro trabalhar.',
      missaoAtiva(ctx, 'reserva') ? 'Enquanto isso, cada mês guardado com o Arkad te deixa mais perto.' : 'Enquanto isso, o Arkad te ajuda a montar a reserva.',
    ])
  ),
];

/* ---------- cartão e missão ---------- */

/** Escolheu esperar a reserva (o cartão é o da espera, sem missão). */
const esperou = (ctx: Ctx) => !liberado(ctx);

function cartaoDaEspera(ctx: Ctx): Resultado {
  const meses = mesesAteReserva(ctx);
  const linha = meses === null ? `Reserva primeiro: converse com o ${NOMES.arkad}` : meses === 1 ? 'Reserva primeiro: falta 1 mês' : `Reserva primeiro: faltam ${meses} meses`;
  return {
    titulo: 'Primeiro a reserva',
    linhas: [`1. ${linha}`],
    agentes: ['sharru'],
    rodape: 'Sharru Nada fica nos seus agentes, esperando a hora certa.',
    botao: 'Combinado',
  };
}

export const ROTEIRO_INVESTIR: Roteiro = {
  id: 'investir',
  agente: 'sharru',
  titulo: 'Investir e viver de renda',
  primeiro: 'abertura',
  passos,
  resultado: (ctx) => {
    if (esperou(ctx)) return cartaoDaEspera(ctx);
    const ps = projecoes(ctx);
    return {
      titulo: 'Seu plano com Sharru Nada',
      linhas: ps.map((p, i) => `${i + 1}. Em ${p.anos} anos: ${brl(p.valor)}`),
      grafico: ps.map((p) => ({ rotulo: `${p.anos} anos`, valor: p.valor })),
      lista: [
        `Pra viver de renda: ${brl(metaDe(ctx))} investidos`,
        ...curasDe(ctx).map((c) => c.passo),
        ...(forcou(ctx) ? ['A reserva ainda está completando. Siga guardando nela também.'] : []),
      ],
      agentes: ['sharru'],
      rodape: 'Estimativa. Não é recomendação de investimento.',
      botao: 'Começar missão',
    };
  },
  concluir: (ctx, conversa) => {
    if (esperou(ctx)) return { missoes: [], ativar: ['sharru'] };
    const meta = metaDe(ctx);
    const mensal = mensalDe(ctx);
    const marco = marcoDe(ctx);
    const curas = curasDe(ctx);
    const lista: Omit<PassoMissao, 'ordem'>[] = [
      { id: '', titulo: `Investir ${brl(mensal)} este mês`, acao: 'guardar', dataAlvo: ctx.dados.mes },
      // com meta muito pequena, o marco de 10% some (não fica um passo de R$ 0)
      ...(marco > 0 && marco < meta ? [{ id: '', titulo: `Chegar a ${brl(marco)}`, valor: marco }] : []),
      ...curas.map((c) => ({ id: '', titulo: c.passo, acao: 'conferir' as const })),
      { id: '', titulo: `Viver de renda: ${brl(meta)}`, valor: meta },
    ];
    return {
      missoes: [
        novaMissao(
          {
            agente: 'sharru',
            conversa,
            titulo: 'Fazer o ouro trabalhar',
            tipo: 'investir',
            metaValor: meta,
            valorInicial: 0,
            valorMensal: mensal,
            dataInicio: ctx.dados.hoje,
            editarPasso: 'mensal',
            passos: lista.map((p, i) => ({ ...p, id: `p${i + 1}`, ordem: i + 1 })),
            notas: forcou(ctx) ? 'Começou antes da reserva completar.' : undefined,
          },
          ctx.dados.hoje
        ),
      ],
      ativar: ['sharru'],
    };
  },
};
