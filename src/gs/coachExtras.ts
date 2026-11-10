// Mais orientações do coach por regras: previsão de falta de dinheiro, gastos recorrentes, meta atrasada,
// renda extra, cartão no limite, reserva baixa e evolução positiva. Cada uma só aparece com dados suficientes
// e explica o porquê. Puro, com teste (coachExtras.test.ts).

import { brl0, diasEntre, mesCurto, mesDe, somaDias, somaMes } from './datas.js';
import { gastoMensalMedio, patrimonioGuardado } from './selectores.js';
import type { Disponivel } from './selectores.js';
import type { Recomendacao } from './coachRegras.js';
import type { Estado } from './tipos.js';

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

export function regrasExtras(e: Estado, hoje: string, disp: Disponivel): Recomendacao[] {
  const mes = mesDe(hoje);
  const dia = Number(hoje.slice(8, 10));
  const ant = somaMes(mes, -1);
  const out: Recomendacao[] = [];
  const doMes = e.lancamentos.filter((l) => mesDe(l.data) === mes);

  // 1) previsão: no ritmo de gastos de agora, o dinheiro livre dura até o fim do mês?
  if (disp.modo !== 'incompleto' && disp.livre > 0 && dia >= 6 && doMes.length >= 5 && disp.diasRestantes > 1) {
    const total = doMes.reduce((t, l) => t + l.valor, 0);
    const porDia = total / dia;
    const previsto = porDia * disp.diasRestantes;
    if (previsto > disp.livre * 1.05) {
      const falta = previsto - disp.livre;
      out.push({ id: 'previsao-falta', tom: 'aviso', tipo: 'orcamento', prioridade: 85, titulo: 'No ritmo atual, o dinheiro pode faltar antes do fim do mês', texto: `Você gasta cerca de ${brl0(porDia)} por dia. Mantendo isso, faltariam uns ${brl0(falta)} até o último dia. Reduzir um pouco já muda o resultado.`, porque: `Gastos do dia a dia no mês: ${brl0(total)} em ${dia} dias (${brl0(porDia)}/dia). Faltam ${disp.diasRestantes} dias e o livre é ${brl0(disp.livre)}; ${brl0(porDia)} × ${disp.diasRestantes} = ${brl0(previsto)}.${disp.temEstimativa ? ' O livre tem partes estimadas.' : ''}`, acao: { rotulo: 'Ver orçamento', rota: '/plano/orcamento' } });
    }
  }

  // 2) gasto recorrente: mesma descrição em 2+ meses com valores parecidos (assinaturas e afins)
  const desde = somaDias(hoje, -100);
  const grupos = new Map<string, { nome: string; meses: Set<string>; valores: number[] }>();
  for (const l of e.lancamentos) {
    if (l.data < desde || !l.descricao.trim() || l.descricao === l.categoria) continue;
    const k = norm(l.descricao);
    const g = grupos.get(k) ?? { nome: l.descricao, meses: new Set(), valores: [] };
    g.meses.add(mesDe(l.data));
    g.valores.push(l.valor);
    grupos.set(k, g);
  }
  const rec = [...grupos.values()].filter((g) => g.meses.size >= 2 && Math.max(...g.valores) <= Math.min(...g.valores) * 1.15).sort((a, b) => b.valores[0] - a.valores[0])[0];
  if (rec) {
    const v = rec.valores[rec.valores.length - 1];
    out.push({ id: `recorrente-${norm(rec.nome)}`, tom: 'info', tipo: 'coach', prioridade: 40, titulo: `${rec.nome} parece um gasto que se repete todo mês`, texto: `Cerca de ${brl0(v)} por mês, ${brl0(v * 12)} por ano. Vale conferir se você ainda usa e se compensa.`, porque: `Apareceu em ${rec.meses.size} meses diferentes, com valores parecidos (${rec.valores.map((x) => brl0(x)).join(', ')}).`, acao: { rotulo: 'Revisar gastos escondidos', rota: '/plano/assinaturas' } });
  }

  // 3) meta com prazo atrasada em relação ao ritmo esperado
  for (const m of e.metas) {
    if (!m.prazo || m.prazo <= hoje) continue;
    const guardado = m.guardados.reduce((t, g) => t + g.valor, 0);
    if (guardado >= m.alvo) continue;
    const total = diasEntre(m.criadaEm, m.prazo);
    const passou = diasEntre(m.criadaEm, hoje);
    if (total < 30 || passou < 21) continue;
    const esperado = m.alvo * (passou / total);
    if (guardado < esperado * 0.7) {
      const meses = Math.max(1, Math.ceil(diasEntre(hoje, m.prazo) / 30));
      out.push({ id: `meta-atrasada-${m.id}`, tom: 'aviso', tipo: 'coach', prioridade: 62, titulo: `A meta ${m.nome} está atrasada`, texto: `Para chegar a tempo, guarde cerca de ${brl0((m.alvo - guardado) / meses)} por mês. Se não couber, vale ajustar o prazo ou o valor, sem culpa.`, porque: `Até hoje já passou ${Math.round((passou / total) * 100)}% do prazo e você guardou ${brl0(guardado)} (${Math.round((guardado / m.alvo) * 100)}% de ${brl0(m.alvo)}). O ritmo esperado seria ${brl0(esperado)}.`, acao: { rotulo: 'Ver metas', rota: '/plano#metas' } });
      break;
    }
  }

  // 4) renda extra recebida no mês: dar um destino
  const extras = e.receitas.filter((r) => mesDe(r.data) === mes && r.tipo === 'extra').reduce((t, r) => t + r.valor, 0);
  if (extras >= 50) {
    out.push({ id: 'renda-extra', tom: 'info', tipo: 'coach', prioridade: 58, titulo: `Entrou ${brl0(extras)} de renda extra neste mês`, texto: 'Dinheiro que não faz parte do salário pode ir direto para o que mais pesa: dívida cara, reserva ou uma meta. Quer ver o melhor destino?', porque: `Receitas extras registradas em ${mesCurto(mes)}: ${brl0(extras)}.`, acao: { rotulo: 'Escolher o destino', rota: '/plano/extras' } });
  }

  // 5) cartão perto do limite
  if (e.cartao && e.cartao.limite > 0) {
    const uso = (e.cartao.usado / e.cartao.limite) * 100;
    if (uso >= 70) out.push({ id: 'cartao-limite', tom: uso >= 90 ? 'perigo' : 'aviso', tipo: 'orcamento', prioridade: uso >= 90 ? 88 : 76, titulo: `Você usou ${Math.round(uso)}% do limite do cartão`, texto: 'Segurar novas compras no cartão até a fatura virar evita aperto e juros do rotativo.', porque: `Fatura aberta de ${brl0(e.cartao.usado)} para um limite de ${brl0(e.cartao.limite)}.`, acao: { rotulo: 'Ver cartão', rota: '/plano/cartao' } });
  }

  // 6) reserva abaixo de 3 meses de gastos (já começou, falta crescer)
  const gastoMedio = gastoMensalMedio(e, mes);
  const reserva = patrimonioGuardado(e);
  if (reserva > 0 && gastoMedio > 0 && reserva < gastoMedio * 3 && !out.some((r) => r.tom === 'perigo')) {
    out.push({ id: 'reserva-baixa', tom: 'info', tipo: 'coach', prioridade: 29, titulo: 'Sua reserva ainda cobre menos de 3 meses de gastos', texto: `Você tem ${brl0(reserva)}, o que cobre ${(reserva / gastoMedio).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mês de gastos. Cada valor guardado aproxima da meta.`, porque: `Reserva ${brl0(reserva)} ÷ gasto mensal médio ${brl0(gastoMedio)}.`, acao: { rotulo: 'Ver reserva', rota: '/plano/reserva' } });
  }

  // 7) evolução positiva: gastando menos que no mesmo período do mês passado
  const ate = (m: string) => e.lancamentos.filter((l) => mesDe(l.data) === m && Number(l.data.slice(8, 10)) <= dia).reduce((t, l) => t + l.valor, 0);
  const antes = ate(ant);
  const agora = ate(mes);
  if (dia >= 8 && antes >= 100 && agora <= antes * 0.85) {
    out.push({ id: 'gastando-menos', tom: 'ok', tipo: 'coach', prioridade: 24, titulo: `Você está gastando ${Math.round((1 - agora / antes) * 100)}% menos que no mês passado`, texto: 'Bom sinal. Que tal direcionar a diferença para sua reserva ou uma meta?', porque: `Até o dia ${dia}: ${brl0(agora)} agora contra ${brl0(antes)} em ${mesCurto(ant)}.`, acao: { rotulo: 'Guardar a diferença', rota: '/plano/reserva' } });
  }
  return out;
}
