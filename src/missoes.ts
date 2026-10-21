// Missões (spec v2, seção 3 "missoes" e "missao_passos", 7.3): o que cada agente combinou com a pessoa, com meta,
// valor por mês, passos e o que foi guardado ou pago em cada mês. Ficam no estado sincronizado ('gs-missoes'):
// o site e o WhatsApp leem a mesma lista.
//
// Regras:
// - Uma missão ativa por tipo. Uma missão nova do mesmo tipo arquiva a antiga, e isso só acontece quando o chat
//   que criou a nova termina ("o plano antigo só é substituído quando o novo chat termina").
// - Apagar uma missão marca deletedAt (dá pra desfazer). Pausar não apaga nada.
// - Nunca registrar mês futuro.

import { addMonths, currentMonth, monthOf, todaySP } from './coachChat/months';
import { mesesRestantes, PRIORIDADE, progresso, simularQuitacao, type DividaCalc, type MetodoDivida, type TipoMissao } from './lib/financas';
import { gravarJSON, lerJSON, novoId } from './lib/armazem';
import type { AgenteId } from './chat/engine';

export const MISSOES_KEY = 'gs-missoes';

export type StatusMissao = 'ativa' | 'concluida' | 'pausada' | 'arquivada';
export type AcaoPasso = 'guardar' | 'pagar' | 'cancelar' | 'conferir' | 'conversar';

export interface PassoMissao {
  id: string;
  ordem: number;
  titulo: string;
  valor?: number | null;
  dataAlvo?: string | null; // 'AAAA-MM-DD' ou 'AAAA-MM'
  concluidoEm?: string | null; // ISO
  acao?: AcaoPasso;
}

export interface Registro {
  mes: string; // 'AAAA-MM' (nunca futuro)
  valor: number;
  em: string; // 'AAAA-MM-DD'
  origem: 'site' | 'whatsapp';
}

export interface Missao {
  id: string;
  agente: AgenteId;
  conversa?: string; // a conversa que criou a missão (gs-conversas)
  titulo: string;
  tipo: TipoMissao;
  metaValor: number;
  valorInicial: number; // o que já havia no começo (ex.: dinheiro já guardado)
  valorMensal: number;
  dataInicio: string; // 'AAAA-MM-DD'
  dataPrevista: string | null; // 'AAAA-MM'
  previsaoOriginal: string | null; // a data do dia em que a missão começou (pra dizer se está em dia)
  prioridade: number;
  status: StatusMissao;
  recorrente?: boolean; // contas do mês (Bansir): recomeça todo mês
  passos: PassoMissao[];
  registros: Registro[];
  dividas?: DividaCalc[]; // missão de dívida: as dívidas e o saldo de cada uma no começo
  metodo?: MetodoDivida;
  limites?: Record<string, number>; // missão de gastos: teto por categoria
  economiaMensal?: number; // missão de gastos: quanto deixa de gastar por mês
  notas?: string; // uma frase do agente
  editarPasso?: string; // o passo da conversa que "Editar respostas" reabre
  lembrarVespera?: boolean; // contas (Bansir): lembrar um dia antes de cada conta vencer
  createdAt: string;
  updatedAt: string;
  concluidaEm?: string | null;
  arquivadaEm?: string | null;
  deletedAt?: string | null;
}

/* ---------- leitura e gravação ---------- */

export function lerTodasMissoes(): Missao[] {
  const v = lerJSON<Missao[]>(MISSOES_KEY, []);
  return Array.isArray(v) ? v.filter((m) => m && typeof m.id === 'string') : [];
}

/** As que aparecem: não apagadas. */
export const lerMissoes = (): Missao[] => lerTodasMissoes().filter((m) => !m.deletedAt);

export function gravarMissoes(list: Missao[]) {
  // apagadas há mais de 30 dias saem de vez
  const limite = Date.now() - 30 * 24 * 60 * 60 * 1000;
  gravarJSON(MISSOES_KEY, list.filter((m) => !m.deletedAt || new Date(m.deletedAt).getTime() > limite));
}

export function atualizarMissao(id: string, patch: Partial<Missao> | ((m: Missao) => Missao)) {
  const all = lerTodasMissoes();
  gravarMissoes(all.map((m) => (m.id === id ? { ...(typeof patch === 'function' ? patch(m) : { ...m, ...patch }), updatedAt: new Date().toISOString() } : m)));
}

/** Guarda missões novas. Cada uma arquiva a ativa do mesmo tipo (o plano antigo sai só agora). */
export function salvarNovasMissoes(novas: Missao[], agora = new Date()): void {
  const tipos = new Set(novas.map((m) => m.tipo));
  const ts = agora.toISOString();
  const antigas = lerTodasMissoes().map((m) =>
    !m.deletedAt && tipos.has(m.tipo) && (m.status === 'ativa' || m.status === 'pausada') ? { ...m, status: 'arquivada' as const, arquivadaEm: ts, updatedAt: ts } : m
  );
  gravarMissoes([...antigas, ...novas]);
}

/* ---------- contas de uma missão (puras) ---------- */

/** Quanto já foi guardado/pago desde o começo da missão (sem contar o valor inicial). */
export const registrado = (m: Missao) => m.registros.reduce((t, r) => t + r.valor, 0);

/** O valor atual: reserva/investir = inicial + registrado; dívida = quanto já foi pago. */
export const valorAtual = (m: Missao) => Math.round((m.valorInicial + registrado(m)) * 100) / 100;

export const progressoMissao = (m: Missao) => progresso(valorAtual(m), m.metaValor);

/** As dívidas com o que já foi pago abatido (na ordem de pagamento). */
export function dividasRestantes(m: Missao): DividaCalc[] {
  const dividas = (m.dividas ?? []).map((d) => ({ ...d }));
  let pago = registrado(m);
  // o pagamento abate as dívidas na ordem da fila
  for (const d of dividas) {
    if (pago <= 0) break;
    const abate = Math.min(d.saldo, pago);
    d.saldo = Math.round((d.saldo - abate) * 100) / 100;
    pago -= abate;
  }
  return dividas.filter((d) => d.saldo > 0);
}

/** Já registrou este mês? */
export const registrouNoMes = (m: Missao, mes: string) => m.registros.some((r) => r.mes === mes);

/**
 * Previsão ('AAAA-MM'): quanto falta dividido pelo valor do mês. Se este mês ainda não foi registrado, ele conta;
 * se já foi, a conta começa no mês que vem. Dívida usa a simulação com juros (financas.simularQuitacao).
 */
export function previsao(m: Missao, hoje = todaySP()): string | null {
  const mes = monthOf(hoje);
  const inicio = registrouNoMes(m, mes) ? addMonths(mes, 1) : mes;
  if (m.tipo === 'divida' && m.dividas?.length) {
    const resto = dividasRestantes(m);
    if (resto.length === 0) return mes;
    const q = simularQuitacao(resto, m.valorMensal, m.metodo ?? 'juros');
    return q.meses === null ? null : addMonths(inicio, q.meses - 1);
  }
  const meses = mesesRestantes(m.metaValor, valorAtual(m), m.valorMensal);
  if (meses === null) return null;
  if (meses === 0) return mes;
  return addMonths(inicio, meses - 1);
}

export interface Andamento {
  previsao: string | null;
  emDia: boolean;
  atras: number; // quanto está atrás do combinado até agora (0 se em dia)
  falta: number; // quanto falta pra meta
  pct: number;
}

/** Em dia (verde) ou "R$ X atrás · nova data" (âmbar). Meses que já passaram contam; o atual ainda não. */
export function andamento(m: Missao, hoje = todaySP()): Andamento {
  const mes = monthOf(hoje);
  const inicio = monthOf(m.dataInicio);
  let mesesPassados = 0;
  for (let x = inicio; x < mes; x = addMonths(x, 1)) mesesPassados++;
  const esperado = m.valorMensal * mesesPassados;
  const feito = registrado(m);
  const atras = Math.max(0, Math.round(esperado - feito));
  const p = previsao(m, hoje);
  const emDia = atras < 1 || (m.previsaoOriginal !== null && p !== null && p <= m.previsaoOriginal);
  const falta = m.tipo === 'divida' ? dividasRestantes(m).reduce((t, d) => t + d.saldo, 0) : Math.max(0, m.metaValor - valorAtual(m));
  return { previsao: p, emDia, atras: emDia ? 0 : atras, falta: Math.round(falta), pct: progressoMissao(m) };
}

/* ---------- ações ---------- */

/**
 * Registra quanto guardou/pagou num mês (soma ao que já tinha no mês). Nunca mês futuro.
 * Quando a meta é batida, a missão fica concluída.
 */
export function registrar(m: Missao, valor: number, opts: { mes?: string; hoje?: string; origem?: 'site' | 'whatsapp' } = {}): Missao {
  const hoje = opts.hoje ?? todaySP();
  const mes = opts.mes ?? monthOf(hoje);
  if (mes > monthOf(hoje) || !(valor > 0)) return m;
  const registros = [...m.registros, { mes, valor: Math.round(valor * 100) / 100, em: hoje, origem: opts.origem ?? 'site' }];
  let next: Missao = { ...m, registros, updatedAt: new Date().toISOString() };
  // o passo de "guardar/pagar este mês" fica feito
  next = { ...next, passos: next.passos.map((p) => (!p.concluidoEm && (p.acao === 'guardar' || p.acao === 'pagar') ? { ...p, concluidoEm: new Date().toISOString() } : p)) };
  next = { ...next, passos: marcarMarcos(next) };
  next.dataPrevista = previsao(next, hoje);
  if (m.tipo !== 'contas' && m.tipo !== 'gastos' && m.metaValor > 0 && andamento(next, hoje).falta <= 0) {
    next = { ...next, status: 'concluida', concluidaEm: new Date().toISOString() };
  }
  return next;
}

/** Desfaz o último registro (o "Desfazer" do toast). */
export function desfazerUltimoRegistro(m: Missao): Missao {
  const registros = m.registros.slice(0, -1);
  const next: Missao = { ...m, registros, status: m.status === 'concluida' ? 'ativa' : m.status, concluidaEm: m.status === 'concluida' ? null : m.concluidaEm };
  return { ...next, dataPrevista: previsao(next) };
}

/** Passos de marco (metade, meta) ficam feitos quando o valor chega lá. */
function marcarMarcos(m: Missao): PassoMissao[] {
  const atual = m.tipo === 'divida' ? registrado(m) : valorAtual(m);
  return m.passos.map((p) => {
    if (p.concluidoEm || p.valor === null || p.valor === undefined || p.acao) return p;
    return atual >= p.valor ? { ...p, concluidoEm: new Date().toISOString() } : p;
  });
}

/**
 * O passo está feito? Os de ação (guardar/pagar este mês) valem pelo mês: voltam a ficar pendentes no mês seguinte,
 * até a meta ser batida. Os marcos (metade, meta) e os outros ficam feitos de vez.
 */
export function passoFeito(m: Missao, p: PassoMissao, hoje = todaySP()): boolean {
  if (p.acao === 'guardar' || p.acao === 'pagar') return m.status === 'concluida' || registrouNoMes(m, monthOf(hoje));
  return Boolean(p.concluidoEm);
}

/** O passo pendente mais importante (o primeiro não feito). */
export const proximoPasso = (m: Missao, hoje = todaySP()): PassoMissao | null => [...m.passos].sort((a, b) => a.ordem - b.ordem).find((p) => !passoFeito(m, p, hoje)) ?? null;

/** Concluir um passo sem valor (cancelar assinatura, conferir, conversar). */
export const concluirPasso = (m: Missao, passoId: string): Missao => ({
  ...m,
  passos: m.passos.map((p) => (p.id === passoId ? { ...p, concluidoEm: new Date().toISOString() } : p)),
  updatedAt: new Date().toISOString(),
});
export const reabrirPasso = (m: Missao, passoId: string): Missao => ({ ...m, passos: m.passos.map((p) => (p.id === passoId ? { ...p, concluidoEm: null } : p)) });

/** "E se": quanto antes termina guardando/pagando um pouco a mais por mês. null se não muda a data. */
export function eSe(m: Missao, extra = 100, hoje = todaySP()): { extra: number; previsao: string } | null {
  if (m.status !== 'ativa' || !(m.metaValor > 0)) return null;
  const agora = previsao(m, hoje);
  const com = previsao({ ...m, valorMensal: m.valorMensal + extra }, hoje);
  if (!com || (agora && com >= agora)) return null;
  return { extra, previsao: com };
}

export const ativas = (list: Missao[]) => list.filter((m) => m.status === 'ativa').sort((a, b) => a.prioridade - b.prioridade || a.createdAt.localeCompare(b.createdAt));

/** Recomeça a missão recorrente das contas no mês novo (os passos voltam a ficar pendentes). */
export function virarMesRecorrente(m: Missao, hoje = todaySP()): Missao {
  if (!m.recorrente) return m;
  const mes = monthOf(hoje);
  const passos = m.passos.map((p) => (p.concluidoEm && p.concluidoEm.slice(0, 7) < mes ? { ...p, concluidoEm: null } : p));
  return passos.some((p, i) => p !== m.passos[i]) ? { ...m, passos } : m;
}

/* ---------- criar ---------- */

export function novaMissao(p: Omit<Missao, 'id' | 'createdAt' | 'updatedAt' | 'prioridade' | 'status' | 'registros' | 'dataPrevista' | 'previsaoOriginal'> & { prioridade?: number }, hoje = todaySP()): Missao {
  const agora = new Date().toISOString();
  const m: Missao = {
    ...p,
    id: novoId('m'),
    prioridade: p.prioridade ?? PRIORIDADE[p.tipo],
    status: 'ativa',
    registros: [],
    dataPrevista: null,
    previsaoOriginal: null,
    createdAt: agora,
    updatedAt: agora,
  };
  const prev = previsao(m, hoje);
  return { ...m, dataPrevista: prev, previsaoOriginal: prev };
}

export const mesAtual = () => currentMonth();
