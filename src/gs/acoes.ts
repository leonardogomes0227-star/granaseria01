// Mudanças no estado: cada uma valida a entrada e salva na hora. Nada negativo, nada vazio.

import { atualizar, getEstado } from './store';
import { arred, novoId, hoje as hojeSP, vencimentoNoMes } from './datas';
import { aplicarCompra, aplicarPagamento } from './cartaoLogica';
import { cfgAtrasos, deOndeSai, type Atraso } from './atrasosLogica';
import type { Estado, OutroCartao, Meta, Receita, Transferencia, ContaBancaria, Aporte, AtrasoManual, AtrasosCfg, AgenteCustom, Assinatura, Desejo, Divida, GastoFixo, Lancamento, OrigemAporte, PlanoDividas } from './tipos';
import { terminoDaEspera } from './ferramentas';
import { apagarNoServidor, restaurarNoServidor } from './servidor';

const ok = (n: number) => Number.isFinite(n) && n > 0;

/* ---------- contas fixas ---------- */
export function salvarGastoFixo(g: Omit<GastoFixo, 'id' | 'pagamentos'> & { id?: string }): boolean {
  if (!g.nome.trim() || !ok(g.valor) || !(g.diaVencimento >= 1 && g.diaVencimento <= 31)) return false;
  atualizar((e) => {
    const dados = { nome: g.nome.trim().slice(0, 60), valor: arred(g.valor), diaVencimento: Math.round(g.diaVencimento), categoria: g.categoria };
    return g.id ? { ...e, gastosFixos: e.gastosFixos.map((x) => (x.id === g.id ? { ...x, ...dados } : x)) } : { ...e, gastosFixos: [...e.gastosFixos, { id: novoId('gf'), pagamentos: {}, criadaEm: hojeSP(), ...dados }] };
  });
  return true;
}
export const removerGastoFixo = (id: string) => atualizar((e) => ({ ...e, gastosFixos: e.gastosFixos.filter((g) => g.id !== id) }));
export const restaurarGastoFixo = (g: GastoFixo) => atualizar((e) => (e.gastosFixos.some((x) => x.id === g.id) ? e : { ...e, gastosFixos: [...e.gastosFixos, g] }));

export function darBaixa(id: string, mes: string, valorPago: number, pagoEm = hojeSP()): boolean {
  if (!ok(valorPago)) return false;
  atualizar((e) => ({ ...e, gastosFixos: e.gastosFixos.map((g) => (g.id === id ? { ...g, pagamentos: { ...g.pagamentos, [mes]: { valorPago: arred(valorPago), pagoEm } } } : g)) }));
  return true;
}
export const desfazerBaixa = (id: string, mes: string) =>
  atualizar((e) => ({ ...e, gastosFixos: e.gastosFixos.map((g) => (g.id === id ? { ...g, pagamentos: Object.fromEntries(Object.entries(g.pagamentos).filter(([m]) => m !== mes)) } : g)) }));

/* ---------- dia a dia ---------- */
export function salvarLancamento(l: Omit<Lancamento, 'id'> & { id?: string }): boolean {
  if (!ok(l.valor) || !l.categoria || !/^\d{4}-\d{2}-\d{2}$/.test(l.data) || l.data > hojeSP()) return false;
  atualizar((e) => {
    const dados = { descricao: l.descricao.trim().slice(0, 80) || l.categoria, valor: arred(l.valor), data: l.data, categoria: l.categoria, ...(l.forma ? { forma: l.forma.slice(0, 20) } : {}), ...(l.contaId ? { contaId: l.contaId } : {}) };
    return l.id ? { ...e, lancamentos: e.lancamentos.map((x) => (x.id === l.id ? { ...x, ...dados } : x)) } : { ...e, lancamentos: [...e.lancamentos, { id: novoId('l'), ...dados }] };
  });
  return true;
}
export function removerLancamento(id: string) {
  const l = getEstado().lancamentos.find((x) => x.id === id);
  if (l?.serverId) apagarNoServidor(l.serverId);
  atualizar((e) => ({ ...e, lancamentos: e.lancamentos.filter((x) => x.id !== id) }));
}
export function restaurarLancamento(l: Lancamento) {
  if (l.serverId) restaurarNoServidor(l.serverId);
  atualizar((e) => (e.lancamentos.some((x) => x.id === l.id) ? e : { ...e, lancamentos: [...e.lancamentos, l] }));
}

/** Traz os lançamentos do WhatsApp (uma vez cada, pelo id do servidor). */
export function importarDoServidor(entradas: { id: number; kind: 'out' | 'in'; amount: number; category: string; description: string; created_at: string }[]) {
  const saidas = entradas.filter((x) => x.kind === 'out' && x.category !== 'Guardado' && x.amount > 0);
  const guardados = entradas.filter((x) => x.kind === 'out' && x.category === 'Guardado' && x.amount > 0);
  atualizar((e) => {
    const vistosL = new Set(e.lancamentos.map((l) => l.serverId));
    const vistosA = new Set(e.aportes.map((a) => a.id));
    const novos: Lancamento[] = saidas
      .filter((x) => !vistosL.has(x.id))
      .map((x) => ({ id: `srv-${x.id}`, serverId: x.id, descricao: x.description || x.category, valor: arred(x.amount), data: x.created_at.slice(0, 10), categoria: x.category }));
    const vistosR = new Set(e.receitas.map((r) => r.serverId));
    const receitas: Receita[] = entradas
      .filter((x) => x.kind === 'in' && x.amount > 0 && !vistosR.has(x.id))
      .map((x) => ({ id: `srv-in-${x.id}`, serverId: x.id, descricao: x.description || x.category || 'Receita', valor: arred(x.amount), data: x.created_at.slice(0, 10), tipo: /sal[aá]rio|holerite|pagamento mensal/i.test(`${x.description} ${x.category}`) ? ('salario' as const) : ('extra' as const) }));
    const aportes: Aporte[] = guardados.filter((x) => !vistosA.has(`srv-${x.id}`)).map((x) => ({ id: `srv-${x.id}`, data: x.created_at.slice(0, 10), valor: arred(x.amount), origem: 'manual' }));
    return novos.length || aportes.length || receitas.length ? { ...e, lancamentos: [...e.lancamentos, ...novos], aportes: [...e.aportes, ...aportes], receitas: [...e.receitas, ...receitas] } : e;
  });
}

/* ---------- guardado ---------- */
export function guardar(valor: number, origem: OrigemAporte = 'manual', agenteId?: string, data = hojeSP()): string | null {
  if (!ok(valor)) return null;
  const id = novoId('ap');
  atualizar((e) => ({ ...e, aportes: [...e.aportes, { id, data, valor: arred(valor), origem, agenteId }] }));
  return id;
}
/** Usou a reserva: entra como saída (valor negativo) pra não apagar o histórico. */
export function usarReserva(valor: number, data = hojeSP()): string | null {
  if (!ok(valor)) return null;
  const id = novoId('ap');
  atualizar((e) => ({ ...e, aportes: [...e.aportes, { id, data, valor: -arred(valor), origem: 'saque' as OrigemAporte }] }));
  return id;
}
export const removerAporte = (id: string) => atualizar((e) => ({ ...e, aportes: e.aportes.filter((a) => a.id !== id) }));

/* ---------- dívidas ---------- */
export function salvarDivida(d: Omit<Divida, 'id' | 'pagamentos'> & { id?: string }): boolean {
  if (!d.nome.trim() || !ok(d.saldo) || d.jurosMensal < 0 || d.parcelaMinima < 0) return false;
  atualizar((e) => {
    const dia = d.venceDia && Number.isInteger(d.venceDia) && d.venceDia >= 1 && d.venceDia <= 31 ? d.venceDia : undefined;
    const dados = { nome: d.nome.trim().slice(0, 60), saldo: arred(d.saldo), jurosMensal: Math.round(d.jurosMensal * 100) / 100, parcelaMinima: arred(d.parcelaMinima), venceDia: dia, tipo: d.tipo, estimado: d.estimado ? true : undefined, parcelasRestantes: d.parcelasRestantes && d.parcelasRestantes > 0 ? Math.round(d.parcelasRestantes) : undefined };
    return d.id ? { ...e, dividas: e.dividas.map((x) => (x.id === d.id ? { ...x, ...dados } : x)) } : { ...e, dividas: [...e.dividas, { id: novoId('dv'), pagamentos: [], cadastradaEm: hojeSP(), ...dados }] };
  });
  return true;
}
export const removerDivida = (id: string) => atualizar((e) => ({ ...e, dividas: e.dividas.filter((d) => d.id !== id) }));
export const restaurarDivida = (d: Divida) => atualizar((e) => (e.dividas.some((x) => x.id === d.id) ? e : { ...e, dividas: [...e.dividas, d] }));
export function pagarDivida(id: string, valor: number, data = hojeSP()): boolean {
  if (!ok(valor)) return false;
  atualizar((e) => ({ ...e, dividas: e.dividas.map((d) => (d.id === id ? { ...d, pagamentos: [...d.pagamentos, { data, valor: arred(valor) }] } : d)) }));
  return true;
}
export const desfazerPagamentoDivida = (id: string, data: string, valor: number) =>
  atualizar((e) => ({
    ...e,
    dividas: e.dividas.map((d) => {
      if (d.id !== id) return d;
      const i = d.pagamentos.findIndex((p) => p.data === data && p.valor === valor);
      return i < 0 ? d : { ...d, pagamentos: d.pagamentos.filter((_, k) => k !== i) };
    }),
  }));
export const salvarPlanoDividas = (p: PlanoDividas | null) => atualizar((e) => ({ ...e, planoDividas: p }));

/* ---------- posso comprar isso? ---------- */
export function esperar72h(item: string, valor: number, agora = new Date()): string | null {
  if (!ok(valor)) return null;
  const id = novoId('dj');
  const criadoEm = agora.toISOString();
  atualizar((e) => ({ ...e, desejos: [{ id, item: item.trim().slice(0, 60) || 'Compra', valor: arred(valor), criadoEm, terminaEm: terminoDaEspera(criadoEm), status: 'esperando' } as Desejo, ...e.desejos] }));
  return id;
}
export const decidirDesejo = (id: string, status: 'comprou' | 'desistiu') => atualizar((e) => ({ ...e, desejos: e.desejos.map((d) => (d.id === id ? { ...d, status } : d)) }));

/* ---------- assinaturas ---------- */
export function salvarAssinatura(a: Omit<Assinatura, 'id'> & { id?: string }): boolean {
  if (!a.nome.trim() || !ok(a.valor)) return false;
  atualizar((e) => {
    const dados = { nome: a.nome.trim().slice(0, 60), valor: arred(a.valor), ativa: a.ativa, personalizada: a.personalizada, canceladaEm: a.canceladaEm, ...(a.uso ? { uso: a.uso, revisadaEm: a.revisadaEm } : {}) };
    return a.id ? { ...e, assinaturas: e.assinaturas.map((x) => (x.id === a.id ? { ...x, ...dados } : x)) } : { ...e, assinaturas: [...e.assinaturas, { id: novoId('as'), ...dados }] };
  });
  return true;
}
export const marcarUsoAssinatura = (id: string, uso: 'sim' | 'pouco' | 'nao') => atualizar((e) => ({ ...e, assinaturas: e.assinaturas.map((a) => (a.id === id ? { ...a, uso, revisadaEm: hojeSP() } : a)) }));
export const cancelarAssinatura = (id: string) => atualizar((e) => ({ ...e, assinaturas: e.assinaturas.map((a) => (a.id === id ? { ...a, ativa: false, canceladaEm: hojeSP() } : a)) }));
export const reativarAssinatura = (id: string) => atualizar((e) => ({ ...e, assinaturas: e.assinaturas.map((a) => (a.id === id ? { ...a, ativa: true, canceladaEm: undefined } : a)) }));
export const removerAssinatura = (id: string) => atualizar((e) => ({ ...e, assinaturas: e.assinaturas.filter((a) => a.id !== id) }));

/* ---------- assistentes ---------- */
export const ligarAssistente = (id: string, ativo: boolean) => atualizar((e) => ({ ...e, agentes: { ...e.agentes, [id]: { config: e.agentes[id]?.config ?? {}, ativo } } }));
export const configurarAssistente = (id: string, config: Record<string, number | string | boolean>) => atualizar((e) => ({ ...e, agentes: { ...e.agentes, [id]: { ativo: e.agentes[id]?.ativo ?? true, config: { ...e.agentes[id]?.config, ...config } } } }));

export const LIMITE_AGENTES = 10;
export function criarAgente(a: Omit<AgenteCustom, 'id' | 'criadoEm' | 'progresso' | 'ativo'>): string | null {
  let id: string | null = null;
  atualizar((e) => {
    if (e.agentesCustom.length >= LIMITE_AGENTES) return e;
    id = novoId('ag');
    return { ...e, agentesCustom: [...e.agentesCustom, { ...a, id, criadoEm: hojeSP(), progresso: [], ativo: true }] };
  });
  return id;
}
export const atualizarAgente = (id: string, fn: (a: AgenteCustom) => AgenteCustom) => atualizar((e) => ({ ...e, agentesCustom: e.agentesCustom.map((a) => (a.id === id ? fn(a) : a)) }));
export const removerAgente = (id: string) =>
  atualizar((e) => ({ ...e, agentesCustom: e.agentesCustom.filter((a) => a.id !== id), aportes: e.aportes.filter((p) => p.agenteId !== id) }));

/** Registra um valor num agente de meta: vira progresso e aporte (um só, ligado ao agente). */
export function registrarNoAgente(id: string, valor: number, data = hojeSP()): boolean {
  if (!ok(valor)) return false;
  atualizar((e) => {
    const ag = e.agentesCustom.find((a) => a.id === id);
    if (!ag) return e;
    const proximo: AgenteCustom = { ...ag, progresso: [...ag.progresso, { data, valor: arred(valor) }] };
    const conta = ag.tipo === 'juntar';
    const aporte: Aporte = { id: `ap-${id}-${ag.progresso.length}-${data}`, data, valor: arred(valor), origem: 'meta', agenteId: id };
    return { ...e, agentesCustom: e.agentesCustom.map((a) => (a.id === id ? proximo : a)), aportes: conta ? [...e.aportes, aporte] : e.aportes };
  });
  return true;
}
export function desfazerRegistroAgente(id: string) {
  atualizar((e) => {
    const ag = e.agentesCustom.find((a) => a.id === id);
    if (!ag || ag.progresso.length === 0) return e;
    const prog = ag.progresso.slice(0, -1);
    const idAporte = `ap-${id}-${prog.length}-${ag.progresso[ag.progresso.length - 1].data}`;
    return { ...e, agentesCustom: e.agentesCustom.map((a) => (a.id === id ? { ...a, progresso: prog, concluidoEm: undefined } : a)), aportes: e.aportes.filter((p) => p.id !== idAporte) };
  });
}

/* ---------- dados ---------- */
export const salvarConfig = (patch: Partial<import('./tipos').Config>) => atualizar((e) => ({ ...e, config: { ...e.config, ...patch } }));

/* ---------- orçamento e cartão ---------- */
export const definirLimite = (categoria: string, valor: number) =>
  atualizar((e) => {
    const limites = { ...e.limites };
    if (valor > 0) limites[categoria] = arred(valor);
    else delete limites[categoria];
    return { ...e, limites };
  });
export function comprarNoCartao(compra: { descricao: string; valor: number; parcelas: number }): boolean {
  if (!ok(compra.valor)) return false;
  const id = novoId('pc');
  let feito = false;
  atualizar((e) => {
    if (!e.cartao) return e;
    feito = true;
    return { ...e, cartao: aplicarCompra(e.cartao, compra, id) };
  });
  return feito;
}
export function pagarFaturaCartao(): Estado['cartao'] {
  let antes: Estado['cartao'] = null;
  atualizar((e) => {
    antes = e.cartao;
    return e.cartao ? { ...e, cartao: aplicarPagamento(e.cartao, hojeSP()) } : e;
  });
  return antes;
}
export const salvarCartao = (c: import('./tipos').Cartao | null) => atualizar((e) => ({ ...e, cartao: c && c.limite > 0 ? { ...c, usado: Math.max(0, c.usado) } : null }));

/* ---------- sair do atraso ---------- */
const comAtrasos = (e: Estado, fn: (c: AtrasosCfg) => AtrasosCfg): Estado => ({ ...e, atrasos: fn(cfgAtrasos(e)) });
const somaSaida = (c: AtrasosCfg, mes: string, v: number): AtrasosCfg => {
  const saidas = { ...c.saidas, [mes]: arred((c.saidas[mes] ?? 0) + v) };
  if (Math.abs(saidas[mes]) < 0.005) delete saidas[mes];
  return { ...c, saidas };
};

export const definirPorMesAtraso = (valor: number | undefined) => atualizar((e) => comAtrasos(e, (c) => ({ ...c, porMes: valor === undefined ? undefined : Math.max(0, arred(valor)) })));

/** Separou dinheiro pro atraso: sai do mês (o "pode gastar" desce) e fica guardado pra pagar. */
export function separarParaAtraso(valor: number, mes = hojeSP().slice(0, 7)): boolean {
  if (!ok(valor)) return false;
  atualizar((e) => comAtrasos(e, (c) => somaSaida({ ...c, separado: arred(c.separado + valor) }, mes, valor)));
  return true;
}
/** Dinheiro extra guardado pra uma conta atrasada: vai pro separado, sem mexer no dinheiro do mês. */
export function separarExtraParaAtraso(valor: number): Desfazer | null {
  if (!ok(valor)) return null;
  atualizar((e) => comAtrasos(e, (c) => ({ ...c, separado: arred(c.separado + valor) })));
  return { desfazer: () => atualizar((e) => comAtrasos(e, (c) => ({ ...c, separado: Math.max(0, arred(c.separado - valor)) }))) };
}
export const desfazerSeparar = (valor: number, mes: string) => atualizar((e) => comAtrasos(e, (c) => somaSaida({ ...c, separado: Math.max(0, arred(c.separado - valor)) }, mes, -valor)));

/** Tudo em dia e sobrou dinheiro separado: ele volta pro mês. */
export function liberarSeparado(mes = hojeSP().slice(0, 7)): number {
  let v = 0;
  atualizar((e) => comAtrasos(e, (c) => {
    v = c.separado;
    return somaSaida({ ...c, separado: 0 }, mes, -v);
  }));
  return v;
}

export interface Desfazer {
  desfazer: () => void;
}
/** Pagou uma conta ou parcela atrasada: dá baixa (ou registra na dívida) e usa primeiro o dinheiro separado. */
/** `extra`: pago com dinheiro extra (13º, bônus): não mexe no separado nem no dinheiro do mês. */
export function pagarAtraso(a: Atraso, valor: number, data = hojeSP(), opts: { extra?: boolean } = {}): Desfazer | null {
  if (!ok(valor)) return null;
  const mes = data.slice(0, 7);
  let uso = { doSeparado: 0, doMes: 0 };
  // parcela de dívida de mês anterior fica no mês dela: assim o Quitar dívidas não acha que a deste mês já foi paga
  const dataDivida = a.mes < mes ? a.vencimento : data;
  const guardado = a.fonte === 'manual' ? (cfgAtrasos(getEstado()).manuais ?? []).find((m) => m.id === a.refId) : undefined;
  atualizar((e) => {
    uso = opts.extra ? { doSeparado: 0, doMes: 0 } : deOndeSai(arred(valor), cfgAtrasos(e).separado, a.mes, mes);
    const manual = a.fonte === 'manual' ? (cfgAtrasos(e).manuais ?? []).find((m) => m.id === a.refId) : undefined;
    const pago: Estado = manual
      ? {
          ...comAtrasos(e, (c) => ({ ...c, manuais: (c.manuais ?? []).filter((m) => m.id !== a.refId) })),
          gastosFixos: e.gastosFixos.map((g) => (manual.gastoId && g.id === manual.gastoId ? { ...g, pagamentos: { ...g.pagamentos, [a.mes]: { valorPago: arred(valor), pagoEm: data } } } : g)),
        }
      : a.fonte === 'conta'
        ? { ...e, gastosFixos: e.gastosFixos.map((g) => (g.id === a.refId ? { ...g, pagamentos: { ...g.pagamentos, [a.mes]: { valorPago: arred(valor), pagoEm: data } } } : g)) }
        : { ...e, dividas: e.dividas.map((d) => (d.id === a.refId ? { ...d, pagamentos: [...d.pagamentos, { data: dataDivida, valor: arred(valor) }] } : d)) };
    return uso.doSeparado || uso.doMes ? comAtrasos(pago, (c) => somaSaida({ ...c, separado: arred(c.separado - uso.doSeparado) }, mes, uso.doMes)) : pago;
  });
  return {
    desfazer: () =>
      atualizar((e) => {
        if (a.fonte === 'manual' && guardado) {
          const m = guardado;
          const c0 = cfgAtrasos(e);
          const volta: Estado = {
            ...e,
            atrasos: { ...c0, manuais: [...(c0.manuais ?? []).filter((x) => x.id !== m.id), m] },
            gastosFixos: e.gastosFixos.map((g) => (m.gastoId && g.id === m.gastoId ? { ...g, pagamentos: Object.fromEntries(Object.entries(g.pagamentos).filter(([k]) => k !== m.mes)) } : g)),
          };
          return uso.doSeparado || uso.doMes ? comAtrasos(volta, (c) => somaSaida({ ...c, separado: arred(c.separado + uso.doSeparado) }, mes, -uso.doMes)) : volta;
        }
        const sem: Estado = a.fonte === 'conta' ? { ...e, gastosFixos: e.gastosFixos.map((g) => (g.id === a.refId ? { ...g, pagamentos: Object.fromEntries(Object.entries(g.pagamentos).filter(([m]) => m !== a.mes)) } : g)) } : e;
        if (a.fonte === 'divida') {
          const d = e.dividas.find((x) => x.id === a.refId);
          const i = d ? d.pagamentos.findIndex((p) => p.data === dataDivida && p.valor === arred(valor)) : -1;
          if (d && i >= 0) sem.dividas = e.dividas.map((x) => (x.id === a.refId ? { ...x, pagamentos: x.pagamentos.filter((_, k) => k !== i) } : x));
        }
        return uso.doSeparado || uso.doMes ? comAtrasos(sem, (c) => somaSaida({ ...c, separado: arred(c.separado + uso.doSeparado) }, mes, -uso.doMes)) : sem;
      }),
  };
}

/** Anota parcelas que ficaram pra trás (uma por mês). Devolve as anotadas, pra desfazer. */
export function anotarAtraso(p: { nome: string; valor: number; diaVencimento: number; meses: string[]; categoria?: string; gastoId?: string; estimado?: boolean }): AtrasoManual[] {
  if (!p.nome.trim() || !ok(p.valor) || !(p.diaVencimento >= 1 && p.diaVencimento <= 31) || p.meses.length === 0) return [];
  const novos: AtrasoManual[] = p.meses.map((mes) => ({ id: novoId('at'), nome: p.nome.trim().slice(0, 60), valor: arred(p.valor), mes, vencimento: vencimentoNoMes(mes, Math.round(p.diaVencimento)), categoria: p.categoria, gastoId: p.gastoId, ...(p.estimado ? { estimado: true } : {}) }));
  atualizar((e) => comAtrasos(e, (c) => ({ ...c, manuais: [...(c.manuais ?? []), ...novos].slice(-100) })));
  return novos;
}
export const removerAnotados = (ids: string[]) => atualizar((e) => comAtrasos(e, (c) => ({ ...c, manuais: (c.manuais ?? []).filter((m) => !ids.includes(m.id)) })));
const restaurarAnotado = (m: AtrasoManual) => atualizar((e) => comAtrasos(e, (c) => ((c.manuais ?? []).some((x) => x.id === m.id) ? c : { ...c, manuais: [...(c.manuais ?? []), m] })));

/** Já tinha pago e só não marcou: registra no dia do vencimento, sem mexer no dinheiro do mês. */
export function marcarJaPago(a: Atraso): Desfazer {
  if (a.fonte === 'manual') {
    const m = (cfgAtrasos(getEstado()).manuais ?? []).find((x) => x.id === a.refId);
    removerAnotados([a.refId]);
    return { desfazer: () => m && restaurarAnotado(m) };
  }
  if (a.fonte === 'conta') {
    darBaixa(a.refId, a.mes, a.valor, a.vencimento);
    return { desfazer: () => desfazerBaixa(a.refId, a.mes) };
  }
  pagarDivida(a.refId, a.valor, a.vencimento);
  return { desfazer: () => desfazerPagamentoDivida(a.refId, a.vencimento, arred(a.valor)) };
}

/** "Não devo essa": a conta não existia nesse mês, ou foi cancelada. */
/** "Não devo essa". Anotação à mão some; o que o app achou sozinho fica na lista de ignorados. */
export function naoDevo(a: Atraso): Desfazer {
  if (a.fonte === 'manual') return marcarJaPago(a);
  ignorarAtraso(a.chave);
  return { desfazer: () => voltarAtraso(a.chave) };
}
export const ignorarAtraso = (chave: string) => atualizar((e) => comAtrasos(e, (c) => ({ ...c, ignorados: [...new Set([...c.ignorados, chave])].slice(-200) })));
export const voltarAtraso = (chave: string) => atualizar((e) => comAtrasos(e, (c) => ({ ...c, ignorados: c.ignorados.filter((k) => k !== chave) })));

/* ---------- receitas, saldo e metas ---------- */
export function salvarReceita(r: Omit<Receita, 'id'> & { id?: string }): boolean {
  if (!ok(r.valor) || !/^\d{4}-\d{2}-\d{2}$/.test(r.data) || r.data > hojeSP()) return false;
  atualizar((e) => {
    const dados = { descricao: r.descricao.trim().slice(0, 80) || (r.tipo === 'salario' ? 'Salário' : 'Receita'), valor: arred(r.valor), data: r.data, tipo: r.tipo, ...(r.contaId ? { contaId: r.contaId } : {}) };
    return r.id ? { ...e, receitas: e.receitas.map((x) => (x.id === r.id ? { ...x, ...dados } : x)) } : { ...e, receitas: [...e.receitas, { id: novoId('r'), ...dados }] };
  });
  return true;
}
export const removerReceita = (id: string) => atualizar((e) => ({ ...e, receitas: e.receitas.filter((x) => x.id !== id) }));
export const restaurarReceita = (r: Receita) => atualizar((e) => (e.receitas.some((x) => x.id === r.id) ? e : { ...e, receitas: [...e.receitas, r] }));

/** "Quanto você tem na conta agora?" — a base confirmada do "pode gastar". undefined apaga. */
export const informarSaldo = (valor: number | undefined, data = hojeSP()) =>
  atualizar((e) => ({ ...e, config: { ...e.config, saldoInformado: valor === undefined || !Number.isFinite(valor) ? undefined : { valor: arred(valor), data } } }));

export function criarMeta(m: { nome: string; alvo: number; prazo?: string }): string | null {
  const nome = m.nome.trim().slice(0, 40);
  if (!nome || !ok(m.alvo) || getEstado().metas.length >= 20) return null;
  const id = novoId('m');
  atualizar((e) => ({ ...e, metas: [...e.metas, { id, nome, alvo: arred(m.alvo), criadaEm: hojeSP(), prazo: m.prazo || undefined, guardados: [] }] }));
  return id;
}
/** Guardar para uma meta: entra na meta e sai do "pode gastar" (é um aporte, mas fora da reserva de emergência). */
export function guardarNaMeta(id: string, valor: number, data = hojeSP()): boolean {
  if (!ok(valor)) return false;
  atualizar((e) => ({
    ...e,
    metas: e.metas.map((m) => (m.id === id ? { ...m, guardados: [...m.guardados, { data, valor: arred(valor) }] } : m)),
    aportes: [...e.aportes, { id: novoId('a'), data, valor: arred(valor), origem: 'meta' as const, agenteId: `meta:${id}` }],
  }));
  return true;
}
export const desfazerGuardarNaMeta = (id: string, data: string, valor: number) =>
  atualizar((e) => {
    const i = e.aportes.findIndex((a) => a.agenteId === `meta:${id}` && a.data === data && a.valor === valor);
    return {
      ...e,
      aportes: i < 0 ? e.aportes : e.aportes.filter((_, k) => k !== i),
      metas: e.metas.map((m) => { if (m.id !== id) return m; const j = m.guardados.findIndex((g) => g.data === data && g.valor === valor); return j < 0 ? m : { ...m, guardados: m.guardados.filter((_, k) => k !== j) }; }),
    };
  });
/** Excluir a meta: o que já foi guardado nela passa para a reserva (o dinheiro não some). */
export const removerMeta = (id: string) => atualizar((e) => ({ ...e, metas: e.metas.filter((m) => m.id !== id), aportes: e.aportes.map((a) => (a.agenteId === `meta:${id}` ? { ...a, agenteId: undefined, origem: 'reserva' as const } : a)) }));
export const restaurarMeta = (m: Meta) => atualizar((e) => (e.metas.some((x) => x.id === m.id) ? e : { ...e, metas: [...e.metas, m] }));
export const desligarAviso = (tipo: string, desligar: boolean) =>
  atualizar((e) => { const set = new Set(e.config.avisosDesligados ?? []); if (desligar) set.add(tipo); else set.delete(tipo); return { ...e, config: { ...e.config, avisosDesligados: [...set] } }; });

/* ---------- contas e transferências (organização; não mudam o "pode gastar") ---------- */
export function criarConta(nome: string): string | null {
  const n = nome.trim().slice(0, 30);
  const e = getEstado();
  if (!n || e.contas.length >= 12 || e.contas.some((c) => c.nome.toLowerCase() === n.toLowerCase())) return null;
  const id = novoId('cc');
  atualizar((x) => ({ ...x, contas: [...x.contas, { id, nome: n }] }));
  return id;
}
export const renomearConta = (id: string, nome: string) => {
  const n = nome.trim().slice(0, 30);
  if (!n) return false;
  atualizar((x) => ({ ...x, contas: x.contas.map((c) => (c.id === id ? { ...c, nome: n } : c)) }));
  return true;
};
/** Só remove conta sem transferências (não apaga histórico); os lançamentos dela ficam "sem conta". */
export function removerConta(id: string): boolean {
  if (getEstado().transferencias.some((t) => t.de === id || t.para === id)) return false;
  atualizar((x) => ({ ...x, contas: x.contas.filter((c) => c.id !== id), lancamentos: x.lancamentos.map((l) => (l.contaId === id ? { ...l, contaId: undefined } : l)), receitas: x.receitas.map((r) => (r.contaId === id ? { ...r, contaId: undefined } : r)) }));
  return true;
}
export function salvarTransferencia(t: Omit<Transferencia, 'id'> & { id?: string }): boolean {
  const e = getEstado();
  const ids = new Set(e.contas.map((c: ContaBancaria) => c.id));
  if (!ok(t.valor) || t.de === t.para || !ids.has(t.de) || !ids.has(t.para) || !/^\d{4}-\d{2}-\d{2}$/.test(t.data) || t.data > hojeSP()) return false;
  atualizar((x) => {
    const dados = { data: t.data, valor: arred(t.valor), de: t.de, para: t.para, ...(t.descricao?.trim() ? { descricao: t.descricao.trim().slice(0, 80) } : {}) };
    return t.id ? { ...x, transferencias: x.transferencias.map((y) => (y.id === t.id ? { ...y, ...dados } : y)) } : { ...x, transferencias: [...x.transferencias, { id: novoId('tr'), ...dados }] };
  });
  return true;
}
export const removerTransferencia = (id: string) => atualizar((x) => ({ ...x, transferencias: x.transferencias.filter((t) => t.id !== id) }));
export const restaurarTransferencia = (t: Transferencia) => atualizar((x) => (x.transferencias.some((y) => y.id === t.id) ? x : { ...x, transferencias: [...x.transferencias, t] }));

/* ---------- Modo Recuperação ---------- */
export const definirRecuperacao = (patch: Partial<import('./tipos').Recuperacao>) =>
  atualizar((e) => ({ ...e, recuperacao: { ...e.recuperacao, ...patch } }));

/** "Adiar": esconde um aviso do Início por alguns dias (não paga nem muda a conta). */
export const adiarAviso = (chave: string, ate: string) =>
  atualizar((e) => ({ ...e, config: { ...e.config, adiados: { ...Object.fromEntries(Object.entries(e.config.adiados ?? {}).filter(([, v]) => v >= hojeSP())), [chave]: ate } } }));
export const desfazerAdiar = (chave: string) =>
  atualizar((e) => { const a = { ...(e.config.adiados ?? {}) }; delete a[chave]; return { ...e, config: { ...e.config, adiados: a } }; });
/** Revisão da semana já vista (guarda a segunda-feira da semana). */
export const marcarSemanaVista = (segunda: string) => atualizar((e) => ({ ...e, semanaVista: segunda }));
export const registrarMarco = (id: string) =>
  atualizar((e) => (e.recuperacao.marcos?.includes(id) ? e : { ...e, recuperacao: { ...e.recuperacao, marcos: [...(e.recuperacao.marcos ?? []), id] } }));

/* ---------- outros cartões (fatura e vencimento) ---------- */
export function salvarOutroCartao(c: Omit<OutroCartao, 'id'> & { id?: string }): boolean {
  const nome = c.nome.trim().slice(0, 30);
  if (!nome || c.usado < 0 || c.limite < 0 || !(c.venceDia >= 1 && c.venceDia <= 31)) return false;
  if (!c.id && getEstado().outrosCartoes.length >= 6) return false;
  atualizar((e) => {
    const dados = { nome, limite: arred(c.limite), usado: arred(c.usado), venceDia: Math.round(c.venceDia) };
    return c.id ? { ...e, outrosCartoes: e.outrosCartoes.map((x) => (x.id === c.id ? { ...x, ...dados } : x)) } : { ...e, outrosCartoes: [...e.outrosCartoes, { id: novoId('oc'), ...dados }] };
  });
  return true;
}
export const removerOutroCartao = (id: string) => atualizar((e) => ({ ...e, outrosCartoes: e.outrosCartoes.filter((c) => c.id !== id) }));
export const restaurarOutroCartao = (c: OutroCartao) => atualizar((e) => (e.outrosCartoes.some((x) => x.id === c.id) ? e : { ...e, outrosCartoes: [...e.outrosCartoes, c] }));

/* ---------- O Caminho: passos colocados pelas ferramentas e pelo Coach, o que foi escondido e onde a pessoa parou ---------- */
const comCaminho = (e: Estado, fn: (c: Estado['caminho']) => Estado['caminho']): Estado => ({ ...e, caminho: fn(e.caminho) });

/** "Colocar no meu caminho": cria um passo no plano do mês. O mesmo título da mesma origem não entra duas vezes. */
export function colocarNoCaminho(p: { titulo: string; detalhe: string; rota?: string; origem: string; lembrarEm?: string }): string | null {
  const titulo = p.titulo.trim().slice(0, 120);
  if (!titulo) return null;
  const igual = getEstado().caminho.passos.find((x) => !x.feitoEm && x.origem === p.origem && x.titulo === titulo);
  if (igual) return igual.id;
  const id = novoId('ps');
  atualizar((e) => comCaminho(e, (c) => ({ ...c, passos: [...c.passos, { id, titulo, detalhe: p.detalhe.trim().slice(0, 300), rota: p.rota, origem: p.origem, criadoEm: hojeSP(), lembrarEm: p.lembrarEm }].slice(-40) })));
  return id;
}
export const concluirPasso = (id: string, feito = true) => atualizar((e) => comCaminho(e, (c) => ({ ...c, passos: c.passos.map((p) => (p.id === id ? { ...p, feitoEm: feito ? hojeSP() : undefined } : p)) })));
export const editarPasso = (id: string, patch: { titulo?: string; detalhe?: string }) => atualizar((e) => comCaminho(e, (c) => ({ ...c, passos: c.passos.map((p) => (p.id === id ? { ...p, titulo: patch.titulo?.trim().slice(0, 120) || p.titulo, detalhe: patch.detalhe?.trim().slice(0, 300) ?? p.detalhe } : p)) })));
export const removerPasso = (id: string) => atualizar((e) => comCaminho(e, (c) => ({ ...c, passos: c.passos.filter((p) => p.id !== id) })));
/** Esconde um passo até o fim do mês (ele volta no mês seguinte, se ainda fizer sentido). */
export const ocultarPasso = (id: string, mes = hojeSP().slice(0, 7)) => atualizar((e) => comCaminho(e, (c) => ({ ...c, ocultos: { ...c.ocultos, [id]: mes } })));
export const mostrarPasso = (id: string) => atualizar((e) => comCaminho(e, (c) => ({ ...c, ocultos: Object.fromEntries(Object.entries(c.ocultos).filter(([k]) => k !== id)) })));
/** Recomeçar: volta tudo o que foi escondido e desmarca o que foi colocado à mão. */
export const recomecarPassos = () => atualizar((e) => comCaminho(e, (c) => ({ ...c, ocultos: {}, passos: c.passos.map((p) => ({ ...p, feitoEm: undefined })) })));
export const registrarVisita = (ultimoPasso?: string, agora = new Date()) => atualizar((e) => comCaminho(e, (c) => ({ ...c, ultimaVisita: agora.toISOString(), ultimoPasso: ultimoPasso ?? c.ultimoPasso, voltaDispensada: undefined })));
export const dispensarVolta = (agora = new Date()) => atualizar((e) => comCaminho(e, (c) => ({ ...c, voltaDispensada: agora.toISOString(), ultimaVisita: agora.toISOString() })));
export const comemorarMarcos = (ids: string[]) => atualizar((e) => comCaminho(e, (c) => ({ ...c, marcosFeitos: [...new Set([...c.marcosFeitos, ...ids])].slice(0, 20) })));
/** Ferramenta de várias etapas: guarda onde a pessoa parou (0 = terminou ou não começou). */
export const salvarEtapa = (ferramentaId: string, etapa: number) => atualizar((e) => (e.caminho.etapas[ferramentaId] === etapa || (!etapa && !(ferramentaId in e.caminho.etapas)) ? e : comCaminho(e, (c) => ({ ...c, etapas: etapa > 0 ? { ...c.etapas, [ferramentaId]: etapa } : Object.fromEntries(Object.entries(c.etapas).filter(([k]) => k !== ferramentaId)) }))));
export const escolherMetodoQuitacao = (m: 'bola-de-neve' | 'maior-juro') => atualizar((e) => (e.planoDividas ? { ...e, planoDividas: { ...e.planoDividas, estrategia: m } } : comCaminho(e, (c) => ({ ...c, metodoQuitacao: m }))));
