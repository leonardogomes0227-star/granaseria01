// Dicas do Midas: regras puras sobre o estado que já está no aparelho. Sem rede e sem chave de IA.
// A prioridade maior fala primeiro. A espera evita repetir a mesma frase o tempo todo.

import { brl0, diasNoMes, mesDe, somaDias } from './datas';
import { saldoAtual } from './dividas';
import { gastoPorCategoria, mediaPorCategoria } from './orcamento';
import { contasDoMes, detalheDisponivel, lancamentosDoMes, sequenciaDeDias } from './selectores';
import type { Estado, Lancamento } from './tipos';

export type TomDica = 'perigo' | 'aviso' | 'ok' | 'neutro';
export type HumorMidas = 'feliz' | 'orgulhoso' | 'preocupado' | 'pensando' | 'surpreso' | 'festa' | 'neutro';

export interface Dica {
  id: string;
  regra: string;
  prioridade: number;
  texto: string;
  rota: string;
  rotulo: string;
  tom: TomDica;
  humor: HumorMidas;
  icone: string;
  /** Quanto tempo, em ms, a mesma dica fica quieta depois de ser mostrada. */
  espera: number;
}

const PERIGO = new Set(['conta-atrasada', 'orcamento-estouro']);
const AVISO = new Set(['conta-hoje', 'conta-amanha', 'orcamento-ritmo', 'dias-dinheiro', 'pico', 'nada-hoje', 'divida-sem-plano']);
const OK = new Set(['sequencia', 'meta', 'divida-progresso', 'calmo']);

export function tomDaRegra(regra: string): TomDica {
  if (PERIGO.has(regra)) return 'perigo';
  if (AVISO.has(regra)) return 'aviso';
  if (OK.has(regra)) return 'ok';
  return 'neutro';
}

export function humorDaRegra(regra: string): HumorMidas {
  if (regra === 'conta-atrasada' || regra === 'orcamento-estouro' || regra === 'dias-dinheiro') return 'preocupado';
  if (regra === 'conta-hoje' || regra === 'pico' || regra === 'conta-amanha') return 'surpreso';
  if (regra === 'orcamento-ritmo' || regra === 'nada-hoje' || regra === 'divida-sem-plano') return 'preocupado';
  if (regra === 'sequencia' || regra === 'meta' || regra === 'divida-progresso') return 'orgulhoso';
  if (regra === 'calmo') return 'feliz';
  if (regra === 'decimo' || regra === 'comecar') return 'pensando';
  return 'feliz';
}

export function iconeDaRegra(regra: string): string {
  if (regra.startsWith('conta') || regra === 'conta-atrasada') return '📅';
  if (regra === 'orcamento-estouro' || regra === 'orcamento-ritmo' || regra === 'pico') return '📊';
  if (regra === 'dias-dinheiro') return '⏳';
  if (regra === 'divida-progresso' || regra === 'divida-sem-plano') return '💳';
  if (regra === 'meta') return '🎯';
  if (regra === 'sequencia' || regra === 'calmo') return '✨';
  if (regra === 'decimo') return '🎁';
  if (regra === 'nada-hoje') return '✏️';
  return '💡';
}

const dica = (parcial: Omit<Dica, 'tom' | 'humor' | 'icone'>): Dica => ({
  ...parcial,
  tom: tomDaRegra(parcial.regra),
  humor: humorDaRegra(parcial.regra),
  icone: iconeDaRegra(parcial.regra),
});

const HORA = 60 * 60 * 1000;
const DELIVERY = /delivery|i\s?food|rappi|uber\s*eats|aiqfome|zé\s*delivery|ze\s*delivery/i;

const segundaDe = (iso: string) => {
  const dia = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return somaDias(iso, -((dia + 6) % 7));
};

const vazio = (e: Estado) => e.config.renda <= 0 && e.lancamentos.length === 0 && e.gastosFixos.length === 0 && e.dividas.length === 0 && e.metas.length === 0;

/** Lista ordenada. `vistas` é id → instante em que a dica foi mostrada; some quem ainda está na espera. */
export function dicasDoMidas(e: Estado, hoje: string, vistas: Record<string, number> = {}, agora = 0): Dica[] {
  const lista = todasAsDicas(e, hoje);
  return lista
    .filter((d) => agora - (vistas[d.id] ?? -1e15) >= d.espera)
    .sort((a, b) => b.prioridade - a.prioridade || a.texto.localeCompare(b.texto, 'pt-BR'));
}

export function todasAsDicas(e: Estado, hoje: string): Dica[] {
  if (vazio(e)) {
    return [dica({ id: 'comecar', regra: 'comecar', prioridade: 10, texto: 'Me conta sua renda e eu calculo quanto você pode gastar hoje.', rota: '/dados', rotulo: 'Informar renda', espera: 6 * HORA })];
  }
  const mes = mesDe(hoje);
  const dia = Number(hoje.slice(8, 10));
  const lista: Dica[] = [];

  for (const c of contasDoMes(e, mes, hoje)) {
    if (c.estado === 'paga') continue;
    if (c.dias < 0) {
      lista.push(dica({ id: `atraso-${c.gasto.id}`, regra: 'conta-atrasada', prioridade: 96, texto: `${c.gasto.nome} está atrasada (${brl0(c.valor)}).`, rota: '/pagar', rotulo: 'Ver contas', espera: 4 * HORA }));
    } else if (c.dias === 0) {
      lista.push(dica({ id: `hoje-${c.gasto.id}`, regra: 'conta-hoje', prioridade: 94, texto: `${c.gasto.nome} vence hoje (${brl0(c.valor)}).`, rota: '/pagar', rotulo: 'Pagar', espera: 4 * HORA }));
    } else if (c.dias === 1) {
      lista.push(dica({ id: `amanha-${c.gasto.id}`, regra: 'conta-amanha', prioridade: 90, texto: `${c.gasto.nome} vence amanhã (${brl0(c.valor)}).`, rota: '/pagar', rotulo: 'Ver conta', espera: 8 * HORA }));
    }
  }

  const gastos = gastoPorCategoria(e, mes);
  for (const [categoria, limite] of Object.entries(e.limites)) {
    if (!(limite > 0)) continue;
    const gasto = gastos[categoria] ?? 0;
    const pct = Math.round((gasto / limite) * 100);
    if (pct >= 100) {
      lista.push(dica({ id: `teto-${categoria}`, regra: 'orcamento-estouro', prioridade: 88, texto: `${categoria} passou do orçamento: ${brl0(gasto)} de ${brl0(limite)}.`, rota: '/plano/orcamento', rotulo: 'Ver orçamento', espera: 8 * HORA }));
    } else if (pct >= 80 && dia <= 24) {
      lista.push(dica({ id: `ritmo-${categoria}`, regra: 'orcamento-ritmo', prioridade: 84, texto: `Já foi ${pct}% do orçamento de ${categoria.toLowerCase()} e ainda é dia ${dia}.`, rota: '/plano/orcamento', rotulo: 'Ver orçamento', espera: 10 * HORA }));
    }
  }

  const disp = detalheDisponivel(e, mes, hoje);
  const gastoMes = lancamentosDoMes(e, mes).reduce((t, l) => t + l.valor, 0);
  if (gastoMes > 0 && disp.livre > 0 && dia >= 3) {
    const ritmo = gastoMes / dia;
    const dura = Math.max(0, Math.floor(disp.livre / ritmo));
    const restam = Math.max(0, diasNoMes(mes) - dia);
    if (dura < restam) {
      lista.push(dica({ id: 'dura', regra: 'dias-dinheiro', prioridade: 76, texto: `Nesse ritmo, o que sobra dura ${dura} ${dura === 1 ? 'dia' : 'dias'} e o mês ainda tem ${restam}.`, rota: '/lancamentos', rotulo: 'Ver gastos', espera: 12 * HORA }));
    }
  }

  const media = mediaPorCategoria(e, mes);
  for (const [categoria, medio] of Object.entries(media)) {
    const gasto = gastos[categoria] ?? 0;
    if (medio >= 80 && gasto >= medio * 1.6 && gasto - medio >= 40) {
      lista.push(dica({ id: `pico-${categoria}`, regra: 'pico', prioridade: 72, texto: `${categoria} este mês está ${brl0(gasto - medio)} acima do que você costuma.`, rota: '/lancamentos', rotulo: 'Ver categoria', espera: 20 * HORA }));
    }
  }

  const abertas = e.dividas.filter((d) => saldoAtual(d) > 0);
  if (abertas.length > 0) {
    const original = e.dividas.reduce((t, d) => t + d.saldo, 0);
    const atual = e.dividas.reduce((t, d) => t + saldoAtual(d), 0);
    const pago = original > 0 ? Math.round((1 - atual / original) * 100) : 0;
    if (e.planoDividas && pago > 0) {
      lista.push(dica({ id: 'divida-plano', regra: 'divida-progresso', prioridade: 68, texto: `O plano das dívidas já baixou ${pago}%. Faltam ${brl0(atual)}.`, rota: '/plano/dividas', rotulo: 'Ver plano', espera: 20 * HORA }));
    } else if (e.planoDividas) {
      lista.push(dica({ id: 'divida-plano', regra: 'divida-progresso', prioridade: 64, texto: `O plano está montado. Faltam ${brl0(atual)} para zerar.`, rota: '/plano/dividas', rotulo: 'Ver plano', espera: 20 * HORA }));
    } else {
      lista.push(dica({ id: 'divida-sem-plano', regra: 'divida-sem-plano', prioridade: 58, texto: `Tem ${brl0(atual)} em dívidas sem um plano. Eu monto o caminho.`, rota: '/plano/dividas', rotulo: 'Montar plano', espera: 24 * HORA }));
    }
  }

  const metas = e.metas
    .map((m) => ({ m, guardado: m.guardados.reduce((t, g) => t + g.valor, 0) }))
    .filter((x) => x.m.alvo > 0 && x.guardado < x.m.alvo)
    .sort((a, b) => b.guardado / b.m.alvo - a.guardado / a.m.alvo);
  if (metas[0] && metas[0].guardado > 0) {
    const pct = Math.round((metas[0].guardado / metas[0].m.alvo) * 100);
    lista.push(dica({ id: `meta-${metas[0].m.id}`, regra: 'meta', prioridade: 60, texto: `${metas[0].m.nome}: ${pct}% do caminho. Faltam ${brl0(metas[0].m.alvo - metas[0].guardado)}.`, rota: '/guardar', rotulo: 'Ver meta', espera: 20 * HORA }));
  }

  const seq = sequenciaDeDias(e, hoje);
  if (seq >= 3) {
    lista.push(dica({ id: 'sequencia', regra: 'sequencia', prioridade: 36, texto: `${seq} dias seguidos anotando. É assim que o número fica confiável.`, rota: '/lancamentos', rotulo: 'Ver histórico', espera: 24 * HORA }));
  }

  const recentes = e.lancamentos.some((l) => l.data >= somaDias(hoje, -14) && l.data < hoje);
  const anotouHoje = e.lancamentos.some((l) => l.data === hoje);
  if (recentes && !anotouHoje && dia > 1) {
    lista.push(dica({ id: 'nada-hoje', regra: 'nada-hoje', prioridade: 52, texto: 'Você ainda não anotou nada hoje. Um gasto esquecido muda o que dá pra gastar.', rota: '/lancamentos', rotulo: 'Anotar gasto', espera: 8 * HORA }));
  }

  const mesNum = Number(mes.slice(5, 7));
  if ((mesNum === 11 || mesNum === 12) && e.config.renda > 0) {
    lista.push(dica({ id: `decimo-${mes}`, regra: 'decimo', prioridade: 44, texto: mesNum === 11 ? 'Novembro é mês de 13º. Se cair, eu mostro se rende mais na dívida ou na reserva.' : 'O 13º de dezembro ainda dá para ter destino antes do ano virar.', rota: '/plano/extras', rotulo: 'Ver destino', espera: 48 * HORA }));
  }

  if (lista.length === 0 && e.config.renda > 0) {
    lista.push(dica({ id: 'calmo', regra: 'calmo', prioridade: 8, texto: 'Nada urgente agora. O mês está andando no ritmo.', rota: '/', rotulo: 'Ver início', espera: 12 * HORA }));
  }
  return lista;
}

/** Frase depois de salvar um gasto, com o que esse lançamento significa na semana. */
export function comentarioDoGasto(e: Estado, hoje: string, lancamento?: Lancamento | null): string | null {
  const l = lancamento ?? [...e.lancamentos].reverse().find((x) => x.data === hoje) ?? e.lancamentos[e.lancamentos.length - 1];
  if (!l) return null;
  const inicio = segundaDe(l.data);
  const fim = somaDias(inicio, 6);
  const naSemana = e.lancamentos.filter((x) => x.data >= inicio && x.data <= fim);
  const delivery = DELIVERY.test(l.descricao);
  const iguais = naSemana.filter((x) => (delivery ? DELIVERY.test(x.descricao) : x.categoria === l.categoria));
  const n = Math.max(1, iguais.length);
  const nome = delivery ? 'delivery' : l.categoria.toLowerCase();
  const base = n === 1 ? `Primeiro ${nome} da semana.` : `Esse foi o ${n}º ${nome} da semana.`;
  const limite = e.limites[l.categoria];
  if (limite && limite > 0) {
    const gasto = gastoPorCategoria(e, mesDe(l.data))[l.categoria] ?? 0;
    const pct = Math.round((gasto / limite) * 100);
    if (pct >= 80) return `${base} ${l.categoria} já foi ${pct}% do orçamento.`;
  }
  return base;
}

/** A IA só substitui a frase se couber numa fala e não apagar os números. Sem resposta, fica a regra. */
export function textoSeCouber(original: string, resposta: string | null | undefined): string {
  const t = (resposta ?? '').replace(/\s+/g, ' ').trim();
  if (t.length < 8 || t.length > 140) return original;
  if (/\d/.test(original) && !/\d/.test(t)) return original;
  return t;
}
