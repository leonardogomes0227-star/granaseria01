// O que as telas fazem com as missões (registrar, pausar, apagar), num lugar só, pra tudo ficar ligado:
// - guardar numa missão de reserva também entra no "Pague-se primeiro" (gs-guardado), que o Meu mês já desconta;
// - o próximo passo de cada missão vira lembrete no WhatsApp (gs-tarefas, com a origem da ferramenta do agente).

import { AGENTS } from './agents';
import { addDays, daysBetween, todayBRT, type NewTask } from './coach';
import { setToolTasks } from './results';
import { loadSaved, saveSaved, type SavedEntry } from './bills';
import { lerEu } from './eu';
import { daysInMonth } from './coachChat/months';
import type { ToolId } from './tools';
import {
  ativas,
  atualizarMissao,
  desfazerUltimoRegistro,
  lerMissoes,
  lerTodasMissoes,
  gravarMissoes,
  proximoPasso,
  registrar,
  salvarNovasMissoes,
  type Missao,
} from './missoes';
import type { AgenteId } from './chat/engine';

const toolDe = (agente: AgenteId): ToolId | null => (AGENTS.find((a) => a.id === agente)?.tool as ToolId | undefined) ?? null;

/** Em quantos dias lembrar de um passo do mês: no dia do salário (se ainda vem este mês) ou no último dia do mês. */
function diasAte(hoje: string, mesAlvo?: string | null): number {
  const mes = mesAlvo && /^\d{4}-\d{2}$/.test(mesAlvo) ? mesAlvo : hoje.slice(0, 7);
  const ultimo = `${mes}-${String(daysInMonth(mes)).padStart(2, '0')}`;
  const dia = lerEu().diaSalario;
  if (dia && mes === hoje.slice(0, 7)) {
    const doSalario = `${mes}-${String(Math.min(dia, daysInMonth(mes))).padStart(2, '0')}`;
    if (doSalario >= hoje) return daysBetween(hoje, doSalario);
  }
  return Math.max(0, daysBetween(hoje, ultimo));
}

/** O próximo passo de cada missão ativa vira lembrete (os agentes sem missão ficam como estão). */
export function sincronizarLembretes(): void {
  const hoje = todayBRT();
  const todas = lerMissoes();
  const comMissao = new Set(todas.map((m) => m.agente));
  const porTool = new Map<ToolId, NewTask[]>();
  for (const a of comMissao) {
    const t = toolDe(a);
    if (t) porTool.set(t, []);
  }
  for (const m of ativas(todas)) {
    const p = proximoPasso(m, hoje);
    const tool = toolDe(m.agente);
    if (!p || !tool) continue;
    const mensal = p.acao === 'guardar' || p.acao === 'pagar';
    porTool.get(tool)?.push({ text: p.titulo, inDays: diasAte(hoje, typeof p.dataAlvo === 'string' ? p.dataAlvo.slice(0, 7) : null), ...(mensal ? { repeat: 'monthly' as const } : {}) });
  }
  for (const [tool, tasks] of porTool) setToolTasks(tool, tasks);
}

/** Missões novas (fim de uma conversa): grava, arquiva as antigas do mesmo tipo e atualiza os lembretes. */
export function comecarMissoes(novas: Missao[]) {
  salvarNovasMissoes(novas);
  sincronizarLembretes();
}

const guardaNaReserva = (m: Missao) => m.tipo === 'reserva' || m.tipo === 'investir';

/**
 * "Guardei" / "Paguei": registra o valor no mês atual. Devolve como desfazer.
 * semGuardado: quem chama já gravou no Pague-se primeiro (o "Guardei" de Gastos fixos).
 */
export function registrarNaMissao(id: string, valor: number, opts: { semGuardado?: boolean } = {}): { missao: Missao; desfazer: () => void } | null {
  const m = lerMissoes().find((x) => x.id === id);
  if (!m || !(valor > 0)) return null;
  const depois = registrar(m, valor);
  if (depois === m) return null;
  atualizarMissao(id, () => depois);
  let entrada: SavedEntry | null = null;
  if (guardaNaReserva(m) && !opts.semGuardado) {
    entrada = { on: todayBRT(), amount: Math.round(valor * 100) / 100, missao: id };
    saveSaved([...loadSaved(), entrada]);
  }
  sincronizarLembretes();
  return {
    missao: depois,
    desfazer: () => {
      atualizarMissao(id, (x) => desfazerUltimoRegistro(x));
      if (entrada) {
        const list = loadSaved();
        const i = list.findIndex((e) => e.missao === id && e.on === entrada!.on && e.amount === entrada!.amount);
        if (i >= 0) saveSaved(list.filter((_, j) => j !== i));
      }
      sincronizarLembretes();
    },
  };
}

/** A missão de reserva ativa (pro "Guardei" do Pague-se primeiro contar nela). */
export const reservaAtiva = (): Missao | null => ativas(lerMissoes()).find((m) => m.tipo === 'reserva') ?? null;

export function pausarMissao(id: string, pausar: boolean) {
  atualizarMissao(id, { status: pausar ? 'pausada' : 'ativa' });
  sincronizarLembretes();
}

/** Apagar (com "Desfazer"): marca deletedAt; desfazer tira a marca. */
export function apagarMissao(id: string): () => void {
  const agora = new Date().toISOString();
  atualizarMissao(id, { deletedAt: agora });
  sincronizarLembretes();
  return () => {
    gravarMissoes(lerTodasMissoes().map((m) => (m.id === id ? { ...m, deletedAt: null } : m)));
    sincronizarLembretes();
  };
}

/** Um passo sem valor (cancelar, conferir) feito ou desfeito. */
export function marcarPasso(id: string, passoId: string, feito: boolean) {
  atualizarMissao(id, (m) => ({ ...m, passos: m.passos.map((p) => (p.id === passoId ? { ...p, concluidoEm: feito ? new Date().toISOString() : null } : p)) }));
  sincronizarLembretes();
}

export const prazoTexto = (hoje: string, dias: number) => addDays(hoje, dias);
