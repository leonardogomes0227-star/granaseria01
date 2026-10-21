// Roteiro 6.9 — Check-in do mês. Vale pra qualquer agente com missão ativa: aparece no começo do mês (o mês que
// passou, até o dia 10) e pelo card do Início (o mês atual). Nunca mês futuro, nunca antes de a missão existir.
//
// "Começou outubro. Conseguiu guardar R$ 400 em setembro?" [Fiz tudo] [Fiz uma parte] [Não deu]
// - Fiz tudo: comemora e mostra a sequência ("Mais um mês na conta. Sequência: 3 meses.").
// - Fiz uma parte: quanto deu, e a previsão nova.
// - Não deu: a previsão nova, e manter ou ajustar o valor por mês.
//
// Não cria missão. Ao tocar em "Confirmar", o valor entra na missão naquele mês (só o que falta, se a pessoa já tinha
// marcado uma parte) e o valor por mês novo passa a valer. O id do roteiro (e da conversa) é 'checkin:{missão}:{mês}'.
// As contas (o que registrar, o valor novo, a previsão) são funções puras exportadas; só salvarCheckin mexe no estado.

import { addMonths, checkinMonths, isMonth, monthName, monthOf, todaySP } from '../../coachChat/months';
import { mesesGuardados, sequencia } from '../../lib/sequencia';
import { atualizarMissao, dividasRestantes, lerMissoes, previsao, proximoPasso, registrar, registrouNoMes, type Missao } from '../../missoes';
import { sincronizarLembretes } from '../../missoesAcoes';
import { brl, brlCurto, num, respondeu, txt, type AgenteId, type Ctx, type Passo, type Resultado, type Roteiro } from '../engine';
import { falas, mesCurto, NOMES } from './comum';

export const CHECKIN = 'checkin';

/** O id do roteiro, que vira o id da conversa: um check-in por missão e por mês. */
export const idDoCheckin = (missaoId: string, mes: string) => `${CHECKIN}:${missaoId}:${mes}`;

/** Dá pra fazer o check-in desse mês hoje? O atual e, até o dia 10, o anterior (horário de Brasília). Nunca futuro. */
export const mesDoCheckinValido = (mes: string, now: Date = new Date()) => isMonth(mes) && checkinMonths(mes, now).includes(mes);

const centavos = (n: number) => Math.round(n * 100) / 100;
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const meses = (n: number) => (n === 1 ? '1 mês' : `${n} meses`);

/* ---------- a missão ---------- */

type Tipo = Missao['tipo'];

/** Reserva e investir: o que conta na sequência ("meses seguidos guardando"). */
const guarda = (m: Missao) => m.tipo === 'reserva' || m.tipo === 'investir';
/** Missão de um valor por mês que dá pra ajustar (guardar ou pagar dívida). */
const ajustavel = (m: Missao) => guarda(m) || m.tipo === 'divida';
/** Tem meta: dá pra falar de previsão. Contas e gastos são do mês, sem data de chegada. */
const temPrevisao = (m: Missao) => m.metaValor > 0;

/** O verbo do "Quanto você conseguiu ...?". */
const VERBO: Record<Tipo, string> = { reserva: 'guardar', investir: 'guardar', divida: 'pagar', contas: 'pagar', gastos: 'economizar', extra: '' };
/** O que foi feito no mês, no cartão: "Guardou R$ 400", "Pagou R$ 400 nas dívidas". */
const FEITO: Record<Tipo, (v: string) => string> = {
  reserva: (v) => `Guardou ${v}`,
  investir: (v) => `Guardou ${v}`,
  divida: (v) => `Pagou ${v} nas dívidas`,
  contas: (v) => `Pagou ${v} das contas`,
  gastos: (v) => `Economizou ${v}`,
  extra: (v) => `Fez ${v} do plano`,
};

/** Quanto já tinha sido marcado na missão naquele mês (pelo "Guardei"/"Paguei" ou por outro check-in). */
export const jaNoMes = (m: Missao, mes: string) => centavos(m.registros.filter((r) => r.mes === mes).reduce((t, r) => t + r.valor, 0));

export type EstadoCheckin = 'ok' | 'sem_missao' | 'outro_agente' | 'antes' | 'futuro';
export interface Situacao {
  estado: EstadoCheckin;
  missao: Missao | null; // só vem em 'ok', 'outro_agente' e 'antes'
}

/** A missão do check-in, lida dos dados do app. Só 'ok' segue a conversa. */
export function situacao(ctx: Ctx, missaoId: string, mes: string): Situacao {
  if (!isMonth(mes) || mes > ctx.dados.mes) return { estado: 'futuro', missao: null };
  const m = ctx.dados.missoes.find((x) => x.id === missaoId && !x.deletedAt) ?? null;
  if (!m || m.status !== 'ativa') return { estado: 'sem_missao', missao: null };
  if (m.agente !== ctx.agente) return { estado: 'outro_agente', missao: m };
  if (mes < monthOf(m.dataInicio)) return { estado: 'antes', missao: m };
  return { estado: 'ok', missao: m };
}

/** "gastar no máximo R$ 300 com delivery", a partir do título do passo (sem o "· dia 5" e sem o "este mês"). */
export function acaoDoPasso(titulo: string): string {
  const t = titulo.split(' · ')[0].replace(/\s+este mês$/i, '').trim();
  return t ? t.charAt(0).toLocaleLowerCase('pt-BR') + t.slice(1) : '';
}

/** O {ação} da pergunta: "guardar R$ 400", "pagar R$ 400 nas dívidas" ou o próximo passo da missão. */
export function acaoDe(m: Missao, hoje: string): string {
  if (guarda(m) && m.valorMensal > 0) return `guardar ${brl(m.valorMensal)}`;
  if (m.tipo === 'divida' && m.valorMensal > 0) return `pagar ${brl(m.valorMensal)} nas dívidas`;
  if (m.tipo === 'contas') return 'pagar as contas';
  const p = proximoPasso(m, hoje);
  return (p && acaoDoPasso(p.titulo)) || 'seguir o plano';
}

/* ---------- o que o check-in muda (puro) ---------- */

export interface Mudanca {
  totalNoMes: number; // quanto a pessoa diz que guardou/pagou no mês, no total (0: não deu)
  valorMensal: number | null; // o valor por mês novo (null: não mudou)
}

/** O que as respostas dizem: Fiz tudo = o valor do mês; Fiz uma parte = o que a pessoa digitou; Não deu = nada. */
export function mudancaDe(ctx: Ctx, m: Missao): Mudanca {
  const como = txt(ctx, 'como_foi');
  const total = como === 'tudo' ? m.valorMensal : como === 'parte' ? num(ctx, 'quanto') : 0;
  const ajustou = como === 'nao' && txt(ctx, 'nao_deu') === 'ajustar' && respondeu(ctx, 'novo_valor');
  return { totalNoMes: Math.max(0, centavos(total)), valorMensal: ajustou ? num(ctx, 'novo_valor') : null };
}

/** O que entra na missão: o total do mês menos o que já estava marcado nele (nunca negativo, nunca em dobro). */
export const valorARegistrar = (m: Missao, mes: string, totalNoMes: number) => Math.max(0, centavos(totalNoMes - jaNoMes(m, mes)));

/**
 * A previsão depois do check-in. Se o check-in é do mês atual e ele ficou sem nada ("Não deu"), a conta começa no mês
 * que vem; nos outros casos é a previsão de sempre (financas/missoes).
 */
export function previsaoDoCheckin(m: Missao, mes: string, hoje: string): string | null {
  const atual = monthOf(hoje);
  const pula = mes === atual && !registrouNoMes(m, atual);
  return previsao(m, pula ? `${addMonths(atual, 1)}-01` : hoje);
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** O valor por mês novo, e os passos de guardar/pagar que citavam o valor antigo ("Guardar R$ 400 no dia 5"). */
function trocarValorMensal(m: Missao, novo: number): Missao {
  const antes = new RegExp(`${escapar(brl(m.valorMensal))}(?![\\d]|[.,]\\d)`, 'g');
  const passos = m.passos.map((p) => (p.acao === 'guardar' || p.acao === 'pagar' ? { ...p, titulo: p.titulo.replace(antes, brl(novo)) } : p));
  return { ...m, valorMensal: novo, passos };
}

/** A missão depois do check-in (pura). Nunca registra mês futuro. Aplicar duas vezes não registra em dobro. */
export function aplicarCheckin(m: Missao, mud: Mudanca, mes: string, hoje: string): Missao {
  if (!isMonth(mes) || mes > monthOf(hoje)) return m;
  let next = mud.valorMensal !== null && mud.valorMensal > 0 && mud.valorMensal !== m.valorMensal ? trocarValorMensal(m, mud.valorMensal) : m;
  const valor = valorARegistrar(next, mes, mud.totalNoMes);
  if (valor > 0) next = registrar(next, valor, { mes, hoje });
  const dataPrevista = previsaoDoCheckin(next, mes, hoje);
  if (next === m && dataPrevista === m.dataPrevista) return m;
  return { ...next, dataPrevista };
}

const depoisDe = (ctx: Ctx, m: Missao, mes: string) => aplicarCheckin(m, mudancaDe(ctx, m), mes, ctx.dados.hoje);

/** A sequência de meses guardando, já contando este check-in. */
export function sequenciaDepois(ctx: Ctx, m: Missao, mes: string): number {
  const depois = depoisDe(ctx, m, mes);
  return sequencia(mesesGuardados(ctx.dados.missoes.map((x) => (x.id === m.id ? depois : x))), ctx.dados.hoje);
}

/** Grava o check-in (o botão "Confirmar"): relê a missão, aplica, salva e atualiza os lembretes. */
export function salvarCheckin(missaoId: string, mes: string, mud: Mudanca, hoje = todaySP()): Missao | null {
  const m = lerMissoes().find((x) => x.id === missaoId);
  if (!m || m.status !== 'ativa') return null;
  const next = aplicarCheckin(m, mud, mes, hoje);
  if (next !== m) atualizarMissao(missaoId, () => next);
  sincronizarLembretes();
  return next;
}

/* ---------- falas ---------- */

/** O tom de cada agente, de leve: a saudação e a comemoração. */
const SAUDACAO: Record<AgenteId, string> = {
  arkad: 'Oi, {nome}. Vamos olhar a sua bolsa com calma.',
  bansir: 'E aí, {nome}? Vamos ver como andam as coisas.',
  nomasir: 'Oi, {nome}. Vou direto ao ponto, como sempre.',
  dabasir: 'Oi, {nome}. Vamos ver como anda a caminhada.',
  mathon: 'Oi, {nome}. Vim conferir se o seu ouro está protegido.',
  rodan: 'Oi, {nome}! Vamos ver como está o seu ouro.',
  sharru: 'Oi, {nome}. Vamos ver como anda o seu ouro.',
};
const COMEMORA: Record<AgenteId, string> = {
  arkad: 'Mais uma moeda na sua bolsa.',
  bansir: 'Conta em dia é sono tranquilo.',
  nomasir: 'Gasto segurado é ouro que fica com você.',
  dabasir: 'Cada pagamento é um peso a menos.',
  mathon: 'Ouro bem protegido.',
  rodan: 'Ouro com destino não escapa.',
  sharru: 'Seu ouro já está trabalhando.',
};
const CADA_REAL: Record<Tipo, string> = {
  reserva: 'Cada real guardado conta.',
  investir: 'Cada real guardado conta.',
  divida: 'Cada real pago tira um pouco do peso.',
  contas: 'Cada conta paga é um alívio.',
  gastos: 'Cada real segurado conta.',
  extra: 'Cada pedaço conta.',
};
const COMPLETA = 'E com isso a missão está completa. Que conquista!';

/** "Mais um mês na conta." + a sequência (só reserva e investir, que contam nela). */
function linhaDaConta(ctx: Ctx, m: Missao, mes: string): string {
  const n = guarda(m) ? sequenciaDepois(ctx, m, mes) : 0;
  return n >= 1 ? `Mais um mês na conta. Sequência: ${meses(n)}.` : 'Mais um mês na conta.';
}

const frasePrevisao = (prev: string | null) => (prev ? `Sua nova previsão é ${mesCurto(prev)}.` : 'Com esse valor, ainda não dá pra prever a data.');

function falasIndisponivel(s: Situacao, mes: string): string[] {
  if (s.estado === 'outro_agente' && s.missao) return [`Essa missão é com o ${NOMES[s.missao.agente]}. O check-in dela é com ele.`];
  if (s.estado === 'antes' && s.missao) return [`Essa missão começou em ${monthName(monthOf(s.missao.dataInicio))}, então não tem check-in de ${monthName(mes)}.`];
  if (s.estado === 'futuro') return [isMonth(mes) ? `${maiuscula(monthName(mes))} ainda não chegou. O check-in fica pra quando o mês começar.` : 'Não encontrei esse mês.'];
  return ['Não encontrei essa missão ativa. Ela pode ter sido pausada, concluída ou apagada.', 'Em Missões você vê o que está valendo agora.'];
}

/* ---------- passos ---------- */

function passosDo(missaoId: string, mes: string): Passo[] {
  const nomeMes = isMonth(mes) ? monthName(mes) : mes;
  /** A missão, quando o check-in vale (os passos depois da abertura só existem nesse caso). */
  const missao = (ctx: Ctx) => {
    const s = situacao(ctx, missaoId, mes);
    return s.estado === 'ok' ? s.missao : null;
  };
  const noMes = (ctx: Ctx) => (mes < ctx.dados.mes ? `em ${nomeMes}` : 'este mês');

  return [
    {
      id: 'abertura',
      falas: (ctx) => {
        const s = situacao(ctx, missaoId, mes);
        return s.estado === 'ok' ? falas(ctx, [SAUDACAO[ctx.agente]]) : falasIndisponivel(s, mes);
      },
      resposta: { tipo: 'nenhuma' },
      // sem a missão (ou fora do mês dela), a conversa termina aqui, sem cartão
      proximo: (_v, ctx) => (missao(ctx) ? 'como_foi' : null),
    },
    {
      id: 'como_foi',
      falas: (ctx) => {
        const m = missao(ctx);
        if (!m) return [];
        const acao = acaoDe(m, ctx.dados.hoje);
        const ja = jaNoMes(m, mes);
        return [
          mes < ctx.dados.mes ? `Começou ${monthName(ctx.dados.mes)}. Conseguiu ${acao} em ${nomeMes}?` : `Como está ${nomeMes}? Conseguiu ${acao}?`,
          ja > 0 ? `Até agora você marcou ${brl(ja)} ${noMes(ctx)}.` : '',
        ];
      },
      resposta: (ctx) => {
        const m = missao(ctx);
        return {
          tipo: 'botoes',
          opcoes: [
            { valor: 'tudo', rotulo: 'Fiz tudo' },
            // sem valor por mês, não tem "uma parte" de quê
            ...(m && m.valorMensal > 0 ? [{ valor: 'parte', rotulo: 'Fiz uma parte' }] : []),
            { valor: 'nao', rotulo: 'Não deu' },
          ],
        };
      },
      proximo: (v, ctx) => {
        if (v === 'tudo') return 'tudo';
        if (v === 'parte') return 'quanto';
        const m = missao(ctx);
        return m && ajustavel(m) ? 'nao_deu' : 'nao_deu_fim';
      },
    },
    {
      id: 'tudo',
      falas: (ctx) => {
        const m = missao(ctx);
        if (!m) return [];
        return falas(ctx, [`Muito bem, {nome}! ${COMEMORA[ctx.agente]}`, linhaDaConta(ctx, m, mes), depoisDe(ctx, m, mes).status === 'concluida' ? COMPLETA : '']);
      },
      resposta: { tipo: 'nenhuma' },
      proximo: null,
    },
    {
      id: 'quanto',
      falas: (ctx) => {
        const m = missao(ctx);
        if (!m) return [];
        const q = VERBO[m.tipo] ? `Quanto você conseguiu ${VERBO[m.tipo]}` : 'Quanto você conseguiu';
        const ja = jaNoMes(m, mes);
        return [ja > 0 ? `${q} no total, contando os ${brl(ja)} que já marcou?` : `${q}?`];
      },
      resposta: { tipo: 'dinheiro', min: 0, max: 10_000_000 },
      validar: (v, ctx) => {
        const m = missao(ctx);
        if (!m) return null;
        const n = Number(v);
        if (!(n > 0)) return 'Se não deu nada, tudo bem. Toque na sua resposta acima e troque por "Não deu".';
        if (n >= m.valorMensal) return `${brl(m.valorMensal)} é o valor todo. Se você fez tudo, toque na sua resposta acima e troque por "Fiz tudo".`;
        const ja = jaNoMes(m, mes);
        if (n < ja) return `Você já marcou ${brl(ja)} ${noMes(ctx)}. Coloque o total, contando esse valor.`;
        return null;
      },
      proximo: 'parte_fim',
    },
    {
      id: 'parte_fim',
      falas: (ctx) => {
        const m = missao(ctx);
        if (!m) return [];
        const depois = depoisDe(ctx, m, mes);
        const fecho = depois.status === 'concluida' ? COMPLETA : temPrevisao(m) ? frasePrevisao(depois.dataPrevista) : '';
        return falas(ctx, [`Já é um passo, {nome}. ${CADA_REAL[m.tipo]}`, guarda(m) ? linhaDaConta(ctx, m, mes) : '', fecho]);
      },
      resposta: { tipo: 'nenhuma' },
      proximo: null,
    },
    {
      id: 'nao_deu',
      falas: (ctx) => {
        const m = missao(ctx);
        if (!m) return [];
        const prev = previsaoDoCheckin(m, mes, ctx.dados.hoje);
        const primeira = temPrevisao(m) ? (prev ? `Acontece. Sua nova previsão é ${mesCurto(prev)}.` : 'Acontece. Ainda não dá pra prever a data.') : 'Acontece. Sem problema nenhum.';
        return [primeira, m.valorMensal > 0 ? `Quer manter o valor de ${brl(m.valorMensal)} por mês ou ajustar?` : 'Quer manter assim ou definir um valor por mês?'];
      },
      resposta: {
        tipo: 'botoes',
        opcoes: [
          { valor: 'manter', rotulo: 'Manter' },
          { valor: 'ajustar', rotulo: 'Ajustar valor' },
        ],
      },
      proximo: (v) => (v === 'ajustar' ? 'novo_valor' : 'manter_fim'),
    },
    {
      id: 'manter_fim',
      falas: (ctx) => {
        const m = missao(ctx);
        if (!m) return [];
        return [m.valorMensal > 0 ? `Tudo certo. Seguimos com ${brl(m.valorMensal)} por mês.` : 'Tudo certo. Seguimos assim.', `Este mês é uma nova chance. Eu te lembro na hora de ${m.tipo === 'divida' ? 'pagar' : 'guardar'}.`];
      },
      resposta: { tipo: 'nenhuma' },
      proximo: null,
    },
    {
      id: 'novo_valor',
      falas: ['Melhor um valor menor que você cumpre do que um maior que pesa.', 'Qual valor cabe por mês?'],
      resposta: { tipo: 'dinheiro', min: 1, max: 10_000_000 },
      validar: (v, ctx) => {
        const m = missao(ctx);
        if (!m) return null;
        const n = Number(v);
        if (ctx.dados.renda > 0 && n > ctx.dados.renda) return 'Isso é mais do que entra por mês. Prefiro um valor que você consiga cumprir.';
        // as parcelas são o mínimo: abaixo delas a simulação usaria as parcelas mesmo assim
        const parcelas = m.tipo === 'divida' ? Math.round(dividasRestantes(m).reduce((t, d) => t + Math.max(0, d.parcela), 0)) : 0;
        if (parcelas > 0 && n < parcelas) return `As parcelas das suas dívidas somam ${brl(parcelas)} por mês. Coloque pelo menos esse valor.`;
        if (m.tipo === 'divida' && temPrevisao(m) && previsaoDoCheckin({ ...m, valorMensal: n }, mes, ctx.dados.hoje) === null)
          return 'Com esse valor, os juros crescem mais rápido que o pagamento. Tente um valor um pouco maior.';
        return null;
      },
      proximo: 'ajuste_fim',
    },
    {
      id: 'ajuste_fim',
      falas: (ctx) => {
        const m = missao(ctx);
        if (!m) return [];
        const novo = num(ctx, 'novo_valor');
        const prev = depoisDe(ctx, m, mes).dataPrevista;
        return [temPrevisao(m) && prev ? `Pronto. Com ${brl(novo)} por mês, sua previsão fica para ${mesCurto(prev)}.` : `Pronto. Seguimos com ${brl(novo)} por mês.`, 'Este mês é uma nova chance. Eu sigo com você.'];
      },
      resposta: { tipo: 'nenhuma' },
      proximo: null,
    },
    {
      id: 'nao_deu_fim',
      falas: ['Acontece. O plano continua valendo.', 'Este mês é uma nova chance. Eu sigo com você.'],
      resposta: { tipo: 'nenhuma' },
      proximo: null,
    },
  ];
}

/* ---------- o cartão ---------- */

/** A linha do mês: "Guardou R$ 400 em setembro", "Setembro: não deu desta vez". */
function linhaDoMes(m: Missao, como: string, total: number, mes: string): string {
  const nome = monthName(mes);
  const ja = jaNoMes(m, mes);
  if (como === 'nao') return ja > 0 ? `${FEITO[m.tipo](brl(ja))} em ${nome}` : `${maiuscula(nome)}: não deu desta vez`;
  if (total > 0) return `${FEITO[m.tipo](brl(Math.max(total, ja)))} em ${nome}`;
  return como === 'tudo' ? `Fez tudo em ${nome}` : `Fez uma parte em ${nome}`;
}

/** O que acontece ao tocar em "Confirmar" (spec 11: sempre dizer o que vem depois). */
function rodapeDe(m: Missao, mud: Mudanca, mes: string): string {
  const valor = valorARegistrar(m, mes, mud.totalNoMes);
  const acao =
    valor > 0
      ? `Ao confirmar, ${brlCurto(valor)} entram na missão em ${monthName(mes)}.`
      : mud.valorMensal !== null
        ? 'Ao confirmar, o novo valor por mês passa a valer.'
        : temPrevisao(m)
          ? 'Ao confirmar, a missão segue com a data nova.'
          : 'Ao confirmar, o plano segue valendo.';
  return temPrevisao(m) ? `${acao} A data é uma estimativa com os seus números.` : acao;
}

/** O cartão do fim, ou null quando o check-in não vale (sem missão): a tela só mostra o cartão quando vem um. */
export function cartaoDoCheckin(ctx: Ctx, missaoId: string, mes: string): Resultado | null {
  const s = situacao(ctx, missaoId, mes);
  if (s.estado !== 'ok' || !s.missao) return null;
  const m = s.missao;
  const mud = mudancaDe(ctx, m);
  const depois = aplicarCheckin(m, mud, mes, ctx.dados.hoje);
  const linhas = [linhaDoMes(m, txt(ctx, 'como_foi'), mud.totalNoMes, mes)];
  if (depois.status === 'concluida') linhas.push('Missão completa');
  else if (mud.valorMensal !== null) linhas.push(`Novo valor: ${brl(mud.valorMensal)} por mês${temPrevisao(m) ? ` · previsão ${mesCurto(depois.dataPrevista)}` : ''}`);
  else if (temPrevisao(m)) linhas.push(`Previsão: ${mesCurto(depois.dataPrevista)}`);
  return {
    titulo: `Check-in de ${monthName(mes)}`,
    linhas: linhas.map((l, i) => `${i + 1}. ${l}`),
    agentes: [m.agente],
    rodape: rodapeDe(m, mud, mes),
    botao: 'Confirmar',
  };
}

/* ---------- o roteiro ---------- */

/**
 * O check-in de uma missão num mês. null quando o mês não vale hoje: formato errado, futuro, ou o anterior depois do
 * dia 10. (Se a missão existe e é desse agente, quem diz são os passos, com os dados do app.)
 */
export function ROTEIRO_CHECKIN(agente: AgenteId, missaoId: string, mes: string, now: Date = new Date()): Roteiro | null {
  if (!(agente in NOMES) || typeof missaoId !== 'string' || !/^[^\s:]+$/.test(missaoId)) return null;
  if (!mesDoCheckinValido(mes, now)) return null;
  return {
    id: idDoCheckin(missaoId, mes),
    agente,
    titulo: `Check-in de ${monthName(mes)}`,
    primeiro: 'abertura',
    passos: passosDo(missaoId, mes),
    // sem missão o cartão vem null: o chat termina só com as falas (a tela confere antes de mostrar)
    resultado: (ctx) => cartaoDoCheckin(ctx, missaoId, mes) as Resultado,
    concluir: (ctx) => {
      const s = situacao(ctx, missaoId, mes);
      if (s.estado !== 'ok' || !s.missao) return { missoes: [], ativar: [] };
      const mud = mudancaDe(ctx, s.missao);
      return { missoes: [], ativar: [], efeitos: () => void salvarCheckin(missaoId, mes, mud) };
    },
  };
}
