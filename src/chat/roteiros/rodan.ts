// Roteiro 6.7 — Rodan: dinheiro extra (13º, bônus, freela). Quanto entrou e de onde veio; a sugestão sai pela
// prioridade (dívida > reserva > investir) com 10% pra pessoa aproveitar sem culpa (financas.divisaoExtra), e dá pra
// ajustar a divisão nos sliders (soma sempre 100%). Nenhuma parte passa do que falta: a dívida vai até quitar e a
// reserva até completar; o que passa desce pra próxima da fila.
//
// Não cria missão. Ao tocar no botão do cartão, cada parte entra na missão ativa do tipo dela (dívida, reserva,
// investir) e o destino fica anotado em 'gs-rodan-destino' (o selo "Destino certo"). A parte "pra você" só fica
// anotada. As partes sem missão ativa aparecem no cartão com o agente que começa a missão (ou como "pausada").

import { divisaoExtra, podeInvestir } from '../../lib/financas';
import { dividasRestantes, registrado, valorAtual, type Missao } from '../../missoes';
import { registrarNaMissao } from '../../missoesAcoes';
import { brl, num, txt, type AgenteId, type Ctx, type Passo, type Roteiro, type Valor } from '../engine';
import { falas, fim, missaoAtiva, NOMES } from './comum';

/** Onde fica o último destino dado (o selo "Destino certo" lê daqui). */
export const DESTINO_KEY = 'gs-rodan-destino';

export type Parte = 'divida' | 'reserva' | 'investir' | 'voce';
export type Partes = Record<Parte, number>;

/** A ordem de prioridade (e a do cartão). */
const ORDEM: Parte[] = ['divida', 'reserva', 'investir', 'voce'];

/** Cada parte: o rótulo do slider, como entra na frase, a missão que recebe e quem começa essa missão. */
const PARTES: Record<Parte, { rotulo: string; frase: string; tipo: Missao['tipo'] | null; agente: AgenteId | null }> = {
  divida: { rotulo: 'Dívida', frase: 'pra dívida', tipo: 'divida', agente: 'dabasir' },
  reserva: { rotulo: 'Reserva', frase: 'pra reserva', tipo: 'reserva', agente: 'arkad' },
  investir: { rotulo: 'Investir', frase: 'pra investir', tipo: 'investir', agente: 'sharru' },
  voce: { rotulo: 'Pra você', frase: 'pra você', tipo: null, agente: null },
};

const ORIGENS = [
  { valor: '13', rotulo: '13º' },
  { valor: 'bonus', rotulo: 'Bônus' },
  { valor: 'freela', rotulo: 'Freela ou bico' },
  { valor: 'outro', rotulo: 'Outro' },
];

const centavos = (n: number) => Math.round(n * 100) / 100;
const zeradas = (): Partes => ({ divida: 0, reserva: 0, investir: 0, voce: 0 });
/** Aparece no cartão e nas falas: o que dá pelo menos R$ 1 (sobra de centavos não vira linha). */
const aparece = (v: number) => Math.round(v) >= 1;

/* ---------- a situação da pessoa ---------- */

export const totalDe = (ctx: Ctx) => Math.max(0, num(ctx, 'valor'));

/** A missão do tipo que está valendo: a ativa; senão a pausada (a pessoa ainda tem aquilo, só deu um tempo). */
const ativaOuPausada = (ctx: Ctx, tipo: Missao['tipo']) => missaoAtiva(ctx, tipo) ?? ctx.dados.missoes.find((m) => m.tipo === tipo && m.status === 'pausada') ?? null;

/**
 * A reserva está completa? A mesma regra do Sharru Nada: pela missão de reserva (a ativa; senão a concluída; senão a
 * pausada), concluída ou com o valor atual na meta. Sem missão, pelo guardado e a meta que o app conhece.
 */
function reservaCompletaDe(ctx: Ctx): boolean {
  const reservas = ctx.dados.missoes.filter((m) => m.tipo === 'reserva');
  const r = reservas.find((m) => m.status === 'ativa') ?? reservas.find((m) => m.status === 'concluida') ?? reservas.find((m) => m.status === 'pausada');
  if (r) return r.status === 'concluida' || podeInvestir(valorAtual(r), r.metaValor);
  return podeInvestir(ctx.dados.guardado, ctx.dados.reservaMeta);
}

/**
 * Quanto falta pagar das dívidas (Infinity quando não dá pra saber). Com missão de dívida (ativa ou pausada): o saldo
 * que ainda resta nela. Sem missão: a soma das dívidas que o app conhece (do diagnóstico).
 */
export function faltaDivida(ctx: Ctx): number {
  const m = ativaOuPausada(ctx, 'divida');
  if (m) {
    if (m.dividas?.length) return centavos(dividasRestantes(m).reduce((t, d) => t + d.saldo, 0));
    return m.metaValor > 0 ? centavos(Math.max(0, m.metaValor - registrado(m))) : Infinity;
  }
  const soma = ctx.dados.dividas.reduce((t, d) => t + Math.max(0, Number(d.saldo) || 0), 0);
  return soma > 0 ? centavos(soma) : Infinity;
}

/** Quanto falta pra reserva completar (0 se já está completa; Infinity quando não dá pra saber). */
export function faltaReserva(ctx: Ctx): number {
  if (reservaCompletaDe(ctx)) return 0;
  const m = ativaOuPausada(ctx, 'reserva');
  if (m) return m.metaValor > 0 ? centavos(Math.max(0, m.metaValor - valorAtual(m))) : Infinity;
  return ctx.dados.reservaMeta > 0 ? centavos(Math.max(0, ctx.dados.reservaMeta - ctx.dados.guardado)) : Infinity;
}

/**
 * Tem dívida? Uma missão de dívida ativa ou pausada (com saldo a pagar) ou as dívidas que o app conhece (do
 * diagnóstico). Se a missão de dívida já foi concluída e não há outra valendo, as do diagnóstico ficaram pra trás.
 */
function temDividaDe(ctx: Ctx): boolean {
  if (ativaOuPausada(ctx, 'divida')) return faltaDivida(ctx) > 0;
  const quitou = ctx.dados.missoes.some((m) => m.tipo === 'divida' && m.status === 'concluida');
  return !quitou && ctx.dados.dividas.length > 0;
}

export const situacao = (ctx: Ctx) => ({ temDivida: temDividaDe(ctx), reservaCompleta: reservaCompletaDe(ctx) });

/* ---------- a divisão ---------- */

type Guardavel = Exclude<Parte, 'voce'>;
const PRIORIDADE: Guardavel[] = ['divida', 'reserva', 'investir'];

/** O máximo que cada parte recebe: a dívida até quitar, a reserva até completar; investir não tem teto. */
function tetos(ctx: Ctx): Record<Guardavel, number> {
  const s = situacao(ctx);
  return { divida: s.temDivida ? faltaDivida(ctx) : 0, reserva: faltaReserva(ctx), investir: Infinity };
}

/**
 * A sugestão do Rodan: financas.divisaoExtra sobre os reais inteiros. Nenhuma parte passa do que falta nela (não dá
 * pra pagar mais do que se deve); o que passa desce pela prioridade (dívida > reserva > investir). Os centavos do
 * total (se tiver) ficam com a pessoa: a soma bate com o total.
 */
export function sugestao(ctx: Ctx): Partes {
  const total = totalDe(ctx);
  const teto = tetos(ctx);
  const v: Partes = { ...zeradas(), ...divisaoExtra(Math.floor(total), situacao(ctx)) };
  let sobra = 0;
  for (const p of PRIORIDADE) {
    if (v[p] > teto[p]) {
      sobra += v[p] - teto[p];
      v[p] = teto[p];
    }
  }
  for (const p of PRIORIDADE) {
    const cabe = Math.min(sobra, teto[p] - v[p]);
    if (cabe > 0) {
      v[p] = centavos(v[p] + cabe);
      sobra = centavos(sobra - cabe);
    }
  }
  v.voce = centavos(total - v.divida - v.reserva - v.investir);
  return v;
}

/**
 * As partes do ajuste: dívida só se tem dívida; investir só com a reserva completa (ou quando a sugestão já manda
 * uma parte pra lá, porque este dinheiro completa a reserva); reserva e "pra você" sempre.
 */
export function partesDoAjuste(ctx: Ctx): Parte[] {
  const s = situacao(ctx);
  const sug = sugestao(ctx);
  return ORDEM.filter((p) => (p === 'divida' ? s.temDivida : p === 'investir' ? s.reservaCompleta || sug.investir > 0 : true));
}

/** No ajuste, a dívida vai no máximo até quitar (o resto do arredondamento fica com a pessoa). */
const tetoDoAjuste = (ctx: Ctx): Partial<Partes> => ({ divida: faltaDivida(ctx) });

/** O maior % que a dívida aceita no ajuste (o primeiro que já quita), ou null se não tem teto. */
export function maxPctDivida(ctx: Ctx): number | null {
  const falta = faltaDivida(ctx);
  const total = totalDe(ctx);
  if (!Number.isFinite(falta) || !(total > 0)) return null;
  const max = Math.ceil((falta * 100) / total - 1e-9);
  return max >= 100 ? null : Math.max(0, max);
}

/** Valores em % inteiros que somam 100 (maiores restos), na ordem das partes. */
export function percentuais(valores: Partes, total: number, ids: Parte[]): Record<string, number> {
  if (!(total > 0) || ids.length === 0) return Object.fromEntries(ids.map((id) => [id, id === 'voce' ? 100 : 0]));
  const itens = ids.map((id) => {
    const bruto = (Math.max(0, valores[id]) / total) * 100;
    return { id, bruto, pct: Math.floor(bruto) };
  });
  let falta = 100 - itens.reduce((t, i) => t + i.pct, 0);
  const porResto = [...itens].sort((a, b) => b.bruto - b.pct - (a.bruto - a.pct) || ORDEM.indexOf(a.id) - ORDEM.indexOf(b.id));
  for (let k = 0; falta > 0 && porResto.length > 0; k = (k + 1) % porResto.length, falta--) porResto[k].pct++;
  return Object.fromEntries(itens.map((i) => [i.id, i.pct]));
}

/**
 * O total dividido pelos %: dívida, reserva e investir em reais inteiros (pra baixo), nenhuma acima do teto dela
 * (a dívida vai até quitar), e o resto fica com a pessoa. A soma é sempre exatamente o total.
 */
export function dividir(total: number, pct: Record<string, number>, ids: Parte[], teto: Partial<Partes> = {}): Partes {
  const v = zeradas();
  for (const id of ids) if (id !== 'voce') v[id] = Math.min(teto[id] ?? Infinity, Math.floor((total * Math.max(0, Number(pct[id]) || 0)) / 100 + 1e-9));
  v.voce = centavos(total - v.divida - v.reserva - v.investir);
  return v;
}

const pctDe = (valor: Valor | undefined): Record<string, number> => (valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, number>) : {});

const ajustou = (ctx: Ctx) => txt(ctx, 'sugestao') === 'ajustar';

/** Os valores finais: a sugestão ou o ajuste da pessoa. */
export function valores(ctx: Ctx): Partes {
  if (!ajustou(ctx)) return sugestao(ctx);
  return dividir(totalDe(ctx), pctDe(ctx.respostas.ajuste), partesDoAjuste(ctx), tetoDoAjuste(ctx));
}

/* ---------- pra onde vai cada parte ---------- */

export interface Destino {
  parte: Parte;
  valor: number;
  missao: Missao | null; // a missão ativa que recebe (null: "pra você", ou não tem missão ativa)
  pausada?: Missao | null; // sem missão ativa, mas com uma pausada do tipo (não recebe até voltar a valer)
}

/** As partes que aparecem, em ordem de prioridade, com a missão que recebe cada uma. */
export function destinos(ctx: Ctx): Destino[] {
  const v = valores(ctx);
  return ORDEM.filter((p) => aparece(v[p])).map((parte) => {
    const tipo = PARTES[parte].tipo;
    const missao = tipo ? missaoAtiva(ctx, tipo) : null;
    const pausada = tipo && !missao ? ativaOuPausada(ctx, tipo) : null;
    return { parte, valor: v[parte], missao, pausada };
  });
}

/** O que o botão do cartão lança: cada parte com missão ativa, no valor dela. */
export const lancamentos = (ctx: Ctx) => destinos(ctx).flatMap((d) => (d.missao && d.valor > 0 ? [{ missao: d.missao.id, parte: d.parte, valor: d.valor }] : []));

/** O que fica anotado pro selo "Destino certo". */
export const registroDoDestino = (ctx: Ctx) => ({ em: ctx.dados.hoje, total: totalDe(ctx), partes: valores(ctx) });

const juntar = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);

/** "R$ 1.400 pra dívida, R$ 400 pra reserva e R$ 200 pra você aproveitar sem culpa" (sem as partes zeradas). */
export function fraseDaDivisao(v: Partes): string {
  return juntar(ORDEM.filter((p) => aparece(v[p])).map((p) => `${brl(v[p])} ${p === 'voce' ? 'pra você aproveitar sem culpa' : PARTES[p].frase}`));
}

/** O nome da missão só entra quando diz algo a mais ("Reserva de emergência" já é "pra reserva"). */
const nomeRepete = (m: Missao, parte: Parte) => m.titulo.toLocaleLowerCase('pt-BR').startsWith(PARTES[parte].rotulo.toLocaleLowerCase('pt-BR'));

/**
 * Uma linha do cartão: "R$ 1.400 pra dívida (Sair das dívidas)", "R$ 400 pra reserva (comece a missão com o
 * Arkad)", "R$ 400 pra reserva (missão pausada)".
 */
export function linhaDoDestino(d: Destino): string {
  const base = `${brl(d.valor)} ${PARTES[d.parte].frase}`;
  const agente = PARTES[d.parte].agente;
  if (!agente) return base;
  if (d.missao) return nomeRepete(d.missao, d.parte) ? base : `${base} (${d.missao.titulo})`;
  if (d.pausada) return nomeRepete(d.pausada, d.parte) ? `${base} (missão pausada)` : `${base} (${d.pausada.titulo}, pausada)`;
  return `${base} (comece a missão com o ${NOMES[agente]})`;
}

/* ---------- falas ---------- */

const REACAO: Record<string, string> = {
  '13': 'O 13º vem uma vez por ano. Merece um destino à altura.',
  bonus: 'Bônus é o reconhecimento do seu trabalho. Vamos fazer ele durar.',
  freela: 'Freela é esforço a mais seu. Merece virar algo que fica.',
  outro: 'Dinheiro que chega fora da rotina some fácil. Com destino, ele fica.',
};

/** Por que a sugestão é essa (uma frase: o que ela quita ou completa; senão, pela parte que leva mais). */
function porque(v: Partes, ctx: Ctx): string {
  const { temDivida, reservaCompleta } = situacao(ctx);
  const quita = temDivida && v.divida > 0 && v.divida >= faltaDivida(ctx) - 0.005;
  const completa = !reservaCompleta && v.reserva > 0 && v.reserva >= faltaReserva(ctx) - 0.005;
  if (quita && completa) return 'Com isso a dívida fica quitada e a reserva fica completa. Que passo!';
  if (quita) return 'Com isso a sua dívida fica quitada. Que alívio!';
  if (completa) return v.investir > 0 ? 'Com isso a sua reserva fica completa, e o resto já pode trabalhar pra você.' : 'Com isso a sua reserva fica completa.';
  if (v.divida > 0 && v.reserva > 0) return 'Primeiro a dívida, que cobra juros. Um pouco vai pra reserva, pra um imprevisto não virar dívida nova.';
  if (v.divida > 0) return reservaCompleta ? 'Sua reserva já está completa, então quase tudo vai pra dívida.' : 'Primeiro a dívida, que cobra juros.';
  if (v.reserva > 0) return 'Sem dívida, o que mais te protege agora é a reserva.';
  if (v.investir > 0) return 'Sem dívida e com a reserva completa, agora o ouro pode trabalhar pra você.';
  return '';
}

/* ---------- passos ---------- */

const passos: Passo[] = [
  {
    id: 'abertura',
    falas: ['Recebeu um dinheiro a mais? Vamos dar destino a ele antes que ele suma.', 'Quando ganhei 50 moedas de ouro do rei, aprendi: dinheiro sem destino escapa rápido.'],
    resposta: { tipo: 'nenhuma' },
    proximo: 'valor',
  },
  {
    id: 'valor',
    falas: ['Quanto entrou?'],
    resposta: { tipo: 'dinheiro', min: 1, max: 100_000_000 },
    proximo: 'origem',
  },
  {
    id: 'origem',
    falas: (ctx) => falas(ctx, [`Que bom, {nome}. ${brl(totalDe(ctx))} a mais faz diferença.`, 'De onde veio?']),
    resposta: { tipo: 'botoes', opcoes: ORIGENS },
    proximo: 'sugestao',
  },
  {
    id: 'sugestao',
    falas: (ctx) => {
      const v = sugestao(ctx);
      return [REACAO[txt(ctx, 'origem')] ?? REACAO.outro, `Minha sugestão: ${fraseDaDivisao(v)}.`, porque(v, ctx)];
    },
    resposta: {
      tipo: 'botoes',
      opcoes: [
        { valor: 'usar', rotulo: 'Usar a sugestão' },
        { valor: 'ajustar', rotulo: 'Ajustar' },
      ],
    },
    proximo: (v) => (v === 'ajustar' ? 'ajuste' : 'resultado'),
  },
  {
    id: 'ajuste',
    falas: ['Fique à vontade. Mexa nas partes do jeito que fizer sentido pra você.', 'A soma fica sempre em 100%.'],
    resposta: (ctx) => {
      const ids = partesDoAjuste(ctx);
      const total = totalDe(ctx);
      return { tipo: 'divisao', total, partes: ids.map((id) => ({ id, rotulo: PARTES[id].rotulo })), inicial: percentuais(sugestao(ctx), total, ids) };
    },
    validar: (v, ctx) => {
      const pct = pctDe(v);
      if (Object.values(pct).some((p) => !(Number(p) >= 0 && Number(p) <= 100))) return 'Cada parte vai de 0% a 100%.';
      // não dá pra pagar mais do que se deve
      const max = partesDoAjuste(ctx).includes('divida') ? maxPctDivida(ctx) : null;
      if (max !== null && (Number(pct.divida) || 0) > max) return `Pra quitar a dívida, faltam só ${brl(faltaDivida(ctx))}. Coloque até ${max}% nela e mande o resto pra outra parte.`;
      return null;
    },
    // o balão da pessoa mostra os mesmos valores do cartão
    rotulo: (v, ctx) => {
      const ids = partesDoAjuste(ctx);
      const d = dividir(totalDe(ctx), pctDe(v), ids, tetoDoAjuste(ctx));
      return ids.filter((id) => aparece(d[id])).map((id) => `${PARTES[id].rotulo}: ${brl(d[id])}`).join(' · ') || brl(totalDe(ctx));
    },
    proximo: 'resultado',
  },
  fim('resultado', (ctx) => {
    const v = valores(ctx);
    return falas(ctx, [
      'Pronto, {nome}. Cada real do seu dinheiro extra já tem destino.',
      aparece(v.voce) ? `E os ${brl(v.voce)} pra você são pra aproveitar sem culpa.` : 'Tudo vai trabalhar a seu favor. Bela escolha.',
    ]);
  }),
];

/** O que acontece ao tocar no botão: depende de quantas partes têm missão pra receber. */
function rodapeDe(ds: Destino[]): string {
  const comMissao = ds.filter((d) => d.missao).length;
  const semMissao = ds.filter((d) => d.parte !== 'voce' && !d.missao).length;
  if (comMissao > 0 && semMissao === 0) return 'Ao lançar, cada parte entra na missão dela neste mês.';
  if (comMissao > 0) return 'Ao lançar, as partes com missão ativa entram nela neste mês. As outras ficam anotadas.';
  if (semMissao > 0) return 'Ao lançar, o destino fica anotado. Quando a missão estiver ativa, é só registrar lá.';
  return 'Ao lançar, o destino fica anotado.';
}

export const ROTEIRO_EXTRA: Roteiro = {
  id: 'extra',
  agente: 'rodan',
  titulo: 'Dinheiro extra',
  primeiro: 'abertura',
  passos,
  resultado: (ctx) => {
    const ds = destinos(ctx);
    const linhas = ds.map(linhaDoDestino);
    return {
      titulo: 'Destino do seu dinheiro extra',
      linhas: linhas.slice(0, 3).map((l, i) => `${i + 1}. ${l}`),
      // com as quatro partes, o cartão mostra três linhas e a lista tem todas
      lista: linhas.length > 3 ? linhas : undefined,
      agentes: ['rodan'],
      rodape: rodapeDe(ds),
      botao: 'Lançar nas missões',
    };
  },
  concluir: (ctx) => {
    const lancar = lancamentos(ctx);
    const registro = registroDoDestino(ctx);
    return {
      missoes: [],
      ativar: ['rodan'],
      efeitos: () => {
        try {
          localStorage.setItem(DESTINO_KEY, JSON.stringify(registro));
        } catch {
          // sem localStorage: o selo espera a próxima vez
        }
        // semGuardado: o dinheiro extra não sai da renda do mês, então não conta no "Pague-se primeiro" (gs-guardado),
        // que tira do "quanto posso gastar hoje"
        for (const l of lancar) registrarNaMissao(l.missao, l.valor, { semGuardado: true });
      },
    };
  },
};
