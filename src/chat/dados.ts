// O que os chats sabem do app (as falas usam: "Seus gastos essenciais dão R$ X", "Hoje você tem R$ Y guardado").
// lerDados() lê o estado deste navegador; dadosDeEstado() faz o mesmo a partir de um JSON (testes e servidor).

import { monthOf, todaySP } from '../coachChat/months';
import { custoEssencial, type DividaCalc } from '../lib/financas';
import type { Missao } from '../missoes';
import type { Eu } from '../eu';

export interface ContaFixa {
  id: string;
  nome: string;
  valor: number;
  dia: number;
}

export interface DadosDoApp {
  hoje: string; // 'AAAA-MM-DD' em Brasília
  mes: string;
  nome: string;
  renda: number; // declarada (perfil) ou do diagnóstico
  rendaVariavel: boolean;
  diaSalario: number | null;
  contas: ContaFixa[]; // gastos fixos cadastrados (sem as parcelas de dívida)
  custoEssencial: number; // soma das contas, ou o que a pessoa disse no onboarding
  dividas: DividaCalc[]; // as da missão de dívida ativa; senão as do diagnóstico
  guardado: number; // na reserva (missão ativa) ou o que o diagnóstico diz
  reservaMeta: number;
  missoes: Missao[]; // não apagadas
  agentesAtivos: string[];
  eu: Eu;
}

function parse<T>(raw: string | undefined | null, padrao: T): T {
  if (!raw) return padrao;
  try {
    return (JSON.parse(raw) as T) ?? padrao;
  } catch {
    return padrao;
  }
}

interface BillRaw {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  installments?: number;
}
interface DiagRaw {
  data?: { monthlyIncome?: number; emergencyFund?: number; debts?: { id: string; description: string; value: number; installment?: number; interestRate?: number; paidOff?: boolean }[] };
}

export function dadosDeEstado(state: Record<string, string | undefined>, now: Date = new Date()): DadosDoApp {
  const hoje = todaySP(now);
  const eu = parse<Eu>(state['gs-eu'], {});
  const diag = parse<DiagRaw>(state['selos-wizard-progress'], {}).data ?? {};
  const bills = parse<BillRaw[]>(state['gs-contas'], []);
  const missoes = parse<Missao[]>(state['gs-missoes'], []).filter((m) => m && !m.deletedAt);
  const contas = (Array.isArray(bills) ? bills : []).filter((b) => b && !b.installments && b.amount > 0).map((b) => ({ id: b.id, nome: b.name, valor: b.amount, dia: b.dueDay }));
  const somaContas = custoEssencial(contas);
  const dividaAtiva = missoes.find((m) => m.tipo === 'divida' && m.status === 'ativa');
  const reserva = missoes.find((m) => m.tipo === 'reserva' && (m.status === 'ativa' || m.status === 'concluida'));
  const dividasDiag: DividaCalc[] = (diag.debts ?? [])
    .filter((d) => d && d.value > 0 && !d.paidOff)
    .map((d) => ({ id: d.id, nome: d.description || 'Dívida', saldo: d.value, parcela: d.installment ?? 0, jurosMes: d.interestRate ?? null }));
  const registradoReserva = reserva ? reserva.registros.reduce((t, r) => t + r.valor, 0) + reserva.valorInicial : null;
  const agentes = parse<string[]>(state['gs-agentes'], []);
  return {
    hoje,
    mes: monthOf(hoje),
    nome: (state['gs-nome'] ?? '').trim(),
    renda: eu.renda ?? diag.monthlyIncome ?? 0,
    rendaVariavel: Boolean(eu.rendaVariavel),
    diaSalario: eu.diaSalario ?? null,
    contas,
    custoEssencial: somaContas > 0 ? somaContas : eu.custoEssencial ?? 0,
    dividas: dividaAtiva?.dividas?.length ? dividaAtiva.dividas : dividasDiag,
    guardado: registradoReserva ?? diag.emergencyFund ?? 0,
    reservaMeta: reserva?.metaValor ?? 0,
    missoes,
    agentesAtivos: Array.isArray(agentes) ? agentes : [],
    eu,
  };
}

const KEYS = ['gs-eu', 'selos-wizard-progress', 'gs-contas', 'gs-missoes', 'gs-nome', 'gs-agentes'];

export function lerDados(now: Date = new Date()): DadosDoApp {
  const state: Record<string, string | undefined> = {};
  try {
    for (const k of KEYS) state[k] = localStorage.getItem(k) ?? undefined;
  } catch {
    // sem localStorage: dados vazios
  }
  return dadosDeEstado(state, now);
}
