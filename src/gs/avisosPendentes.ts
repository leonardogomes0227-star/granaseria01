// O que merece aviso hoje: contas perto de vencer e lembretes dos agentes que você criou. Pura, com teste.

import { brl0, diaCurto, diasEntre } from './datas';
import { contasDoMes } from './selectores';
import { proximaRepeticao } from './ferramentas';
import { assistenteAtivo } from './insights';
import type { Estado } from './tipos';

export interface Aviso {
  id: string;
  texto: string;
  rota?: string;
}

export function avisosPendentes(e: Estado, hoje: string): Aviso[] {
  const out: Aviso[] = [];
  if (assistenteAtivo(e, 'contas')) {
    for (const c of contasDoMes(e, hoje.slice(0, 7), hoje)) {
      if (c.estado === 'paga') continue;
      if (c.dias < 0) out.push({ id: `conta-${c.gasto.id}`, texto: `${c.gasto.nome} está atrasada desde ${diaCurto(c.vencimento)} (${brl0(c.valor)})`, rota: '/mes' });
      else if (c.dias <= e.config.avisos.antecedenciaDias) out.push({ id: `conta-${c.gasto.id}`, texto: `${c.gasto.nome} vence ${c.dias === 0 ? 'hoje' : c.dias === 1 ? 'amanhã' : `em ${c.dias} dias`} (${brl0(c.valor)})`, rota: '/mes' });
    }
  }
  for (const a of e.agentesCustom) {
    if (!a.ativo || a.tipo !== 'lembrar') continue;
    const prox = proximaRepeticao(String(a.config.data ?? ''), (String(a.config.repete ?? 'unica') as 'unica' | 'diaria' | 'semanal' | 'mensal'), hoje);
    const antes = Number(a.config.antecedencia ?? 0);
    if (prox && diasEntre(hoje, prox) <= antes && !(a.progresso.some((p) => p.data === prox) || (String(a.config.repete ?? 'unica') === 'unica' && a.progresso.length > 0)))
      out.push({ id: `lembrete-${a.id}-${prox}`, texto: `${String(a.config.descricao ?? a.nome)} · ${prox === hoje ? 'hoje' : diaCurto(prox)}`, rota: '/assistentes' });
  }
  return out;
}
