// Mudanças no estado: cada uma valida a entrada e salva na hora. Nada negativo, nada vazio.

import { atualizar, getEstado } from './store';
import { arred, novoId, hoje as hojeSP } from './datas';
import { aplicarCompra, aplicarPagamento } from './cartaoLogica';
import type { Estado, Aporte, AgenteCustom, Assinatura, Desejo, Divida, GastoFixo, Lancamento, OrigemAporte, PlanoDividas } from './tipos';
import { terminoDaEspera } from './ferramentas';
import { apagarNoServidor, restaurarNoServidor } from './servidor';

const ok = (n: number) => Number.isFinite(n) && n > 0;

/* ---------- contas fixas ---------- */
export function salvarGastoFixo(g: Omit<GastoFixo, 'id' | 'pagamentos'> & { id?: string }): boolean {
  if (!g.nome.trim() || !ok(g.valor) || !(g.diaVencimento >= 1 && g.diaVencimento <= 31)) return false;
  atualizar((e) => {
    const dados = { nome: g.nome.trim().slice(0, 60), valor: arred(g.valor), diaVencimento: Math.round(g.diaVencimento), categoria: g.categoria };
    return g.id ? { ...e, gastosFixos: e.gastosFixos.map((x) => (x.id === g.id ? { ...x, ...dados } : x)) } : { ...e, gastosFixos: [...e.gastosFixos, { id: novoId('gf'), pagamentos: {}, ...dados }] };
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
    const dados = { descricao: l.descricao.trim().slice(0, 80) || l.categoria, valor: arred(l.valor), data: l.data, categoria: l.categoria };
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
    const aportes: Aporte[] = guardados.filter((x) => !vistosA.has(`srv-${x.id}`)).map((x) => ({ id: `srv-${x.id}`, data: x.created_at.slice(0, 10), valor: arred(x.amount), origem: 'manual' }));
    return novos.length || aportes.length ? { ...e, lancamentos: [...e.lancamentos, ...novos], aportes: [...e.aportes, ...aportes] } : e;
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
    const dados = { nome: d.nome.trim().slice(0, 60), saldo: arred(d.saldo), jurosMensal: Math.round(d.jurosMensal * 100) / 100, parcelaMinima: arred(d.parcelaMinima), venceDia: dia };
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
    const dados = { nome: a.nome.trim().slice(0, 60), valor: arred(a.valor), ativa: a.ativa, personalizada: a.personalizada, canceladaEm: a.canceladaEm };
    return a.id ? { ...e, assinaturas: e.assinaturas.map((x) => (x.id === a.id ? { ...x, ...dados } : x)) } : { ...e, assinaturas: [...e.assinaturas, { id: novoId('as'), ...dados }] };
  });
  return true;
}
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
