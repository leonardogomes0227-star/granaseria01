// O que merece aviso hoje: contas perto de vencer e lembretes dos agentes que você criou. Pura, com teste.

import { brl0, diaCurto, diasEntre } from './datas';
import { contasDoMes } from './selectores';
import { proximaRepeticao } from './ferramentas';
import { assistenteAtivo } from './insights';
import { proximaAcao } from './painelDividas';
import { saldoAtual } from './dividas';
import { linhasDeCategoria } from './orcamento';
import { acaoReserva } from './reservaLogica';
import { acaoCartao } from './cartaoLogica';
import { situacaoAtrasos } from './atrasosLogica';
import { mesCurto } from './datas';
import { passoDoDia } from './recuperacaoLogica';
import type { Estado } from './tipos';

export interface Aviso {
  id: string;
  texto: string;
  rota?: string;
}

export function avisosPendentes(e: Estado, hoje: string): Aviso[] {
  const out: Aviso[] = [];
  // Modo Recuperação: o passo do dia vira o aviso do dia (notificação do navegador, se a pessoa deixou)
  if (e.recuperacao.ativo && e.recuperacao.raioXFeito) {
    const p = passoDoDia(e, hoje);
    out.push({ id: `recup-${hoje}`, texto: `Seu passo de hoje: ${p.titulo}`, rota: p.rota ?? '/recuperacao' });
  }
  if (assistenteAtivo(e, 'contas')) {
    for (const c of contasDoMes(e, hoje.slice(0, 7), hoje)) {
      if (c.estado === 'paga') continue;
      if (c.dias < 0) out.push({ id: `conta-${c.gasto.id}`, texto: `${c.gasto.nome} está atrasada desde ${diaCurto(c.vencimento)} (${brl0(c.valor)})`, rota: '/lancamentos?aba=contas' });
      else if (c.dias <= e.config.avisos.antecedenciaDias) out.push({ id: `conta-${c.gasto.id}`, texto: `${c.gasto.nome} vence ${c.dias === 0 ? 'hoje' : c.dias === 1 ? 'amanhã' : `em ${c.dias} dias`} (${brl0(c.valor)})`, rota: '/lancamentos?aba=contas' });
    }
  }
  if (assistenteAtivo(e, 'gastos')) {
    for (const l of linhasDeCategoria(e, hoje.slice(0, 7)))
      if (l.tom === 'perigo') out.push({ id: `orc-${l.categoria}-${hoje.slice(0, 7)}`, texto: `${l.categoria} passou do limite: ${brl0(l.gasto)} de ${brl0(l.limite!)}`, rota: '/plano/orcamento' });
  }
  // conta de mês anterior atrasada: o salário vai primeiro pro atraso, então o aviso de guardar espera
  const atraso = assistenteAtivo(e, 'contas') ? situacaoAtrasos(e, hoje) : null;
  if (atraso && atraso.anteriores.length > 0) {
    const a = atraso.anteriores[0];
    const texto = atraso.anteriores.length === 1 ? `${a.nome} de ${mesCurto(a.mes)} ficou pra trás` : `${atraso.anteriores.length} contas de meses anteriores ficaram pra trás`;
    out.push({ id: `atraso-${hoje.slice(0, 7)}`, texto, rota: '/plano/atrasos' });
  }
  if (!atraso?.anteriores.length && assistenteAtivo(e, 'reserva') && e.config.diaSalario && Number(hoje.slice(8, 10)) >= e.config.diaSalario) {
    const r = acaoReserva(e, hoje.slice(0, 7), hoje);
    if (r.tipo === 'comecar') out.push({ id: `reserva-${hoje.slice(0, 7)}`, texto: r.texto, rota: '/plano/reserva' });
  }
  if (e.cartao && assistenteAtivo(e, 'contas')) {
    const a = acaoCartao(e.cartao, hoje);
    if (a.pagar && a.tom !== 'ok' && /vence/.test(a.texto)) out.push({ id: `cartao-${hoje.slice(0, 7)}`, texto: a.texto, rota: '/plano/cartao' });
  }
  if (assistenteAtivo(e, 'dividas')) {
    const abertas = e.dividas.filter((d) => saldoAtual(d) > 0);
    const a = proximaAcao(abertas, e.planoDividas?.pagamentoMensal ?? 0, hoje);
    if (a.tipo === 'vence' && a.divida) out.push({ id: `divida-${a.divida.id}-${hoje.slice(0, 7)}`, texto: a.texto, rota: '/plano/dividas' });
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
