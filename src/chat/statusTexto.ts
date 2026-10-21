// O que o card de cada agente diz (spec v2, seção 2): o status real da missão dele, nunca um texto genérico,
// e "Próximo lembrete: 22 out" (nunca só "Aviso: 22 out").

import { AGENTS } from '../agents';
import { andamento, dividasRestantes, type Missao } from '../missoes';
import { monthStatus, monthOf, type Bill } from '../bills';
import { dayAbbr, monthAbbr } from '../coachChat/months';
import type { CoachTask } from '../coach';
import { brl } from './engine';
import { statusAgente, type StatusAgente } from './agentes';
import type { AgenteId } from './engine';

export interface StatusCard {
  estado: StatusAgente;
  texto: string;
  selo?: 'cumprida' | 'pausado' | null;
}

/** A missão "dele" que vale mostrar: a ativa mais importante, ou a última cumprida/pausada. */
export function missaoDoAgente(id: AgenteId, missoes: Missao[]): Missao | null {
  const dele = missoes.filter((m) => m.agente === id && !m.deletedAt && m.status !== 'arquivada');
  return dele.find((m) => m.status === 'ativa') ?? dele.find((m) => m.status === 'pausada') ?? dele.find((m) => m.status === 'concluida') ?? null;
}

export function statusTexto(id: AgenteId, missoes: Missao[], ativos: string[], bills: Bill[], hoje: string, fallback: string): StatusCard {
  const estado = statusAgente(id, missoes, ativos);
  const m = missaoDoAgente(id, missoes);
  if (!m) return { estado, texto: fallback, selo: null };
  if (m.status === 'concluida') return { estado, texto: 'Missão cumprida', selo: 'cumprida' };
  if (m.status === 'pausada') return { estado, texto: `${m.titulo}: pausada`, selo: 'pausado' };
  const a = andamento(m, hoje);
  const quando = a.previsao ? ` · ${monthAbbr(a.previsao)}` : '';
  switch (m.tipo) {
    case 'divida': {
      const resto = dividasRestantes(m);
      const primeira = resto[0];
      if (!primeira) return { estado, texto: 'Livre das dívidas' };
      return { estado, texto: resto.length === 1 ? `Faltam ${brl(primeira.saldo)} pra quitar ${primeira.nome.toLowerCase().startsWith('o ') ? primeira.nome : `o ${primeira.nome.toLowerCase()}`}` : `Faltam ${brl(a.falta)} nas dívidas${quando}` };
    }
    case 'reserva':
      return { estado, texto: a.falta > 0 ? `Faltam ${brl(a.falta)} pra reserva${quando}` : 'Reserva completa' };
    case 'investir':
      return { estado, texto: m.valorMensal > 0 ? `Investindo ${brl(m.valorMensal)} por mês` : 'Pronto pra investir' };
    case 'contas': {
      const st = monthStatus(bills, monthOf(hoje), hoje);
      const abertas = st.filter((s) => s.left > 0.009);
      return { estado, texto: st.length === 0 ? 'Cadastre seus gastos fixos' : abertas.length === 0 ? 'Todas as contas do mês pagas' : `${abertas.length} a pagar · faltam ${brl(abertas.reduce((t, s) => t + s.left, 0))}` };
    }
    case 'gastos':
      return { estado, texto: (m.economiaMensal ?? 0) > 0 ? `Economia de ${brl(m.economiaMensal ?? 0)} por mês` : 'De olho nos limites' };
    default:
      return { estado, texto: m.titulo };
  }
}

/** "Próximo lembrete: 22 out" — o aviso aberto mais perto, da ferramenta do agente. */
export function proximoLembrete(id: AgenteId, tasks: CoachTask[], hoje: string): string | null {
  const tool = AGENTS.find((a) => a.id === id)?.tool;
  const t = tasks
    .filter((x) => !x.done && (x.source === tool || (tool === 'tracker' && x.source === 'plano')))
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  if (!t) return null;
  return t.due <= hoje ? 'Próximo lembrete: hoje' : `Próximo lembrete: ${dayAbbr(t.due)}`;
}
