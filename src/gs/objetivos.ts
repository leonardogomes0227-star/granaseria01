// Os objetivos da pessoa, para o Início e para a carteira: reserva, metas, dívidas e liberdade financeira.
// Tudo vem do que ela anotou no app (não há ligação com banco): o foco é o futuro, não o saldo da conta.
import { mesDe, somaMes } from './datas';
import { evolucaoDividas, patrimonioPorMes } from './evolucaoLogica';
import { TAXA_RENDA_PADRAO } from './ferramentas';
import { rendimentoMensal } from './rendaLogica';
import { gastoMensalMedio, patrimonioGuardado, reservaMeta } from './selectores';
import { saldoAtual } from './dividas';
import type { Estado } from './tipos';

export interface Objetivo {
  id: string;
  tipo: 'reserva' | 'meta' | 'divida' | 'liberdade';
  nome: string;
  /** O número grande do cartão (já formatado em reais ou em %). */
  valor: number;
  formato: 'brl' | 'pct';
  /** Quanto do caminho já foi andado, de 0 a 100. */
  pct: number;
  nota: string;
  serie: number[];
  rota: string;
}

export function objetivosDaPessoa(e: Estado, hoje: string): Objetivo[] {
  const mes = mesDe(hoje);
  const lista: Objetivo[] = [];
  const guardado = Math.max(0, patrimonioGuardado(e));
  const meta = reservaMeta(e, mes);
  const pat = patrimonioPorMes(e, hoje);
  lista.push({ id: 'reserva', tipo: 'reserva', nome: 'Reserva de emergência', valor: guardado, formato: 'brl', pct: meta > 0 ? Math.min(100, (guardado / meta) * 100) : 0, nota: meta > 0 ? `meta de ${Math.round(meta).toLocaleString('pt-BR')}` : 'defina quanto você gasta por mês', serie: pat ? pat.map((p) => p.valor) : [], rota: '/plano/reserva' });

  for (const m of e.metas) {
    const total = m.guardados.reduce((t, g) => t + g.valor, 0);
    const meses = Array.from({ length: 6 }, (_, i) => somaMes(mes, i - 5));
    const serie = meses.map((mm) => m.guardados.filter((g) => mesDe(g.data) <= mm).reduce((t, g) => t + g.valor, 0));
    lista.push({ id: `meta-${m.id}`, tipo: 'meta', nome: m.nome, valor: total, formato: 'brl', pct: m.alvo > 0 ? Math.min(100, (total / m.alvo) * 100) : 0, nota: m.alvo > 0 ? `de ${m.alvo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}` : '', serie: serie.some((v) => v > 0) ? serie : [], rota: '/guardar#metas' });
  }

  const abertas = e.dividas.filter((d) => saldoAtual(d) > 0);
  if (e.dividas.length) {
    const original = e.dividas.reduce((t, d) => t + d.saldo, 0);
    const devendo = e.dividas.reduce((t, d) => t + saldoAtual(d), 0);
    const ev = evolucaoDividas(e, hoje);
    let acum = 0;
    const serie = ev ? ev.porMes.map((x) => (acum += x.pago)) : [];
    lista.push({ id: 'dividas', tipo: 'divida', nome: abertas.length ? 'Dívidas' : 'Dívidas quitadas', valor: devendo, formato: 'brl', pct: original > 0 ? Math.min(100, ((original - devendo) / original) * 100) : 100, nota: abertas.length ? `${abertas.length} em aberto` : 'tudo pago', serie: serie.some((v) => v > 0) ? serie : [], rota: '/plano/dividas' });
  }

  // liberdade financeira: quanto do que a pessoa gasta por mês o patrimônio guardado já pagaria sozinho
  const gasto = e.config.rendaAlvo ?? Math.round(gastoMensalMedio(e, mes));
  if (gasto > 0) {
    const rende = rendimentoMensal(guardado, TAXA_RENDA_PADRAO);
    lista.push({ id: 'liberdade', tipo: 'liberdade', nome: 'Liberdade financeira', valor: Math.min(100, (rende / gasto) * 100), formato: 'pct', pct: Math.min(100, (rende / gasto) * 100), nota: 'do seu gasto mensal já seria pago pelo rendimento', serie: pat ? pat.map((p) => (rendimentoMensal(p.valor, TAXA_RENDA_PADRAO) / gasto) * 100) : [], rota: '/plano/renda' });
  }
  return lista;
}
