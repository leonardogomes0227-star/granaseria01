// O coach por regras: situação financeira, recomendações explicáveis e a missão do dia.
// Tudo calculado dos dados reais da pessoa (nada inventado); cada recomendação diz o porquê. Puro, com teste.
// A conversa com IA (api/conselheiro.ts) é outra camada: sem chave, só isto funciona.

import { brl0, diasEntre, mesCurto, mesDe, somaDias, somaMes } from './datas.js';
import { atrasosAbertos } from './atrasosBase.js';
import { proximaData } from './cartaoLogica.js';
import { totalDividas } from './dividas.js';
import { contasDoMes, detalheDisponivel, guardadoNoMes, patrimonioGuardado, reservaMeta, salarioConfirmado } from './selectores.js';
import type { Estado } from './tipos.js';

export type Situacao = 'sem-dados' | 'endividado' | 'atencao' | 'organizado';
export type Tom = 'perigo' | 'aviso' | 'info' | 'ok';
export type TipoAviso = 'vencimento' | 'orcamento' | 'coach';

export interface Recomendacao {
  id: string;
  tom: Tom;
  tipo: TipoAviso;
  prioridade: number; // maior = primeiro
  titulo: string;
  texto: string;
  porque: string; // "por que estou te dizendo isso": os números que sustentam
  acao?: { rotulo: string; rota?: string; abrir?: 'adicionar' };
}

const gastoAte = (e: Estado, mes: string, ateDia: number) =>
  e.lancamentos.filter((l) => mesDe(l.data) === mes && Number(l.data.slice(8, 10)) <= ateDia).reduce((t, l) => t + l.valor, 0);
const porCategoriaAte = (e: Estado, mes: string, ateDia: number) => {
  const m = new Map<string, number>();
  for (const l of e.lancamentos) if (mesDe(l.data) === mes && Number(l.data.slice(8, 10)) <= ateDia) m.set(l.categoria, (m.get(l.categoria) ?? 0) + l.valor);
  return m;
};

export function situacaoFinanceira(e: Estado, hoje: string): Situacao {
  const mes = mesDe(hoje);
  const semDados = e.config.renda <= 0 && !e.config.saldoInformado && e.lancamentos.length === 0 && e.gastosFixos.length === 0 && e.receitas.length === 0;
  if (semDados) return 'sem-dados';
  if (atrasosAbertos(e, hoje).some((a) => a.mes < mes) || totalDividas(e.dividas) > 0) return 'endividado';
  const d = detalheDisponivel(e, mes, hoje);
  if (d.modo !== 'incompleto' && d.livre < 0) return 'atencao';
  if (contasDoMes(e, mes, hoje).some((c) => c.estado === 'atrasada')) return 'atencao';
  return 'organizado';
}

export function recomendacoes(e: Estado, hoje: string): Recomendacao[] {
  const mes = mesDe(hoje);
  const dia = Number(hoje.slice(8, 10));
  const lista: Recomendacao[] = [];
  const add = (r: Recomendacao) => lista.push(r);
  const disp = detalheDisponivel(e, mes, hoje);
  const contas = contasDoMes(e, mes, hoje);

  const atrasoAnt = atrasosAbertos(e, hoje).filter((a) => a.mes < mes);
  if (atrasoAnt.length > 0) {
    const total = atrasoAnt.reduce((t, a) => t + a.total, 0);
    add({ id: 'atraso', tom: 'perigo', tipo: 'vencimento', prioridade: 100, titulo: 'Vamos colocar as contas atrasadas em dia', texto: `${atrasoAnt.length === 1 ? 'Uma conta ficou' : `${atrasoAnt.length} contas ficaram`} pra trás. Com um plano, dá pra resolver sem aperto.`, porque: `${atrasoAnt.length} conta(s) de meses anteriores sem pagamento, cerca de ${brl0(total)} com multa e juros estimados.`, acao: { rotulo: 'Ver o plano', rota: '/plano/atrasos' } });
  }
  const atrasadas = contas.filter((c) => c.estado === 'atrasada');
  if (atrasadas.length > 0 && atrasoAnt.length === 0) {
    const c = atrasadas[0];
    add({ id: 'conta-atrasada', tom: 'perigo', tipo: 'vencimento', prioridade: 95, titulo: `${c.gasto.nome} venceu`, texto: `Venceu há ${-c.dias} ${-c.dias === 1 ? 'dia' : 'dias'}. Quanto antes pagar, menos juros.`, porque: `Vencimento em ${c.vencimento.split('-').reverse().join('/')}, valor ${brl0(c.valor)}, sem baixa registrada.`, acao: { rotulo: 'Resolver agora', rota: '/mes' } });
  }
  if (disp.modo !== 'incompleto' && disp.livre < 0) {
    add({ id: 'acima-da-renda', tom: 'perigo', tipo: 'orcamento', prioridade: 90, titulo: 'Você está gastando mais do que tem', texto: `Faltam ${brl0(-disp.livre)} para fechar o mês no zero. Vamos olhar onde dá pra ajustar?`, porque: `Entradas menos compromissos e gastos do mês dá ${brl0(disp.livre)}.`, acao: { rotulo: 'Ver orçamento', rota: '/plano/orcamento' } });
  }
  const logo = contas.filter((c) => c.estado === 'vence-logo');
  if (logo.length > 0) {
    const total = logo.reduce((t, c) => t + c.valor, 0);
    add({ id: 'vence-logo', tom: 'aviso', tipo: 'vencimento', prioridade: 80, titulo: logo.length === 1 ? `${logo[0].gasto.nome} vence ${logo[0].dias === 0 ? 'hoje' : logo[0].dias === 1 ? 'amanhã' : `em ${logo[0].dias} dias`}` : `${logo.length} contas vencem nos próximos dias`, texto: `São ${brl0(total)} nos próximos 3 dias. Que tal organizar esses pagamentos?`, porque: logo.map((c) => `${c.gasto.nome} ${brl0(c.valor)} (${c.vencimento.slice(8)}/${c.vencimento.slice(5, 7)})`).join(', '), acao: { rotulo: 'Dar baixa', rota: '/mes' } });
  }
  if (e.cartao && e.cartao.limite > 0) {
    const v = proximaData(e.cartao.venceDia, hoje);
    if (e.cartao.usado > 0 && v.dias <= 5) add({ id: 'fatura', tom: 'aviso', tipo: 'vencimento', prioridade: 78, titulo: 'Sua fatura precisa de atenção', texto: `A fatura de ${brl0(e.cartao.usado)} vence ${v.dias === 0 ? 'hoje' : `em ${v.dias} ${v.dias === 1 ? 'dia' : 'dias'}`}. Pagando o total você evita o rotativo.`, porque: `Fatura aberta de ${brl0(e.cartao.usado)}; vencimento dia ${e.cartao.venceDia}.`, acao: { rotulo: 'Ver cartão', rota: '/plano/cartao' } });
  }
  // categoria que subiu: mesmo período do mês anterior, só com base mínima
  const ant = somaMes(mes, -1);
  const atuais = porCategoriaAte(e, mes, dia);
  const antes = porCategoriaAte(e, ant, dia);
  if (dia >= 7) {
    const subiu = [...atuais.entries()]
      .map(([cat, v]) => ({ cat, v, antes: antes.get(cat) ?? 0 }))
      .filter((x) => x.antes >= 100 && x.v >= x.antes * 1.25 && x.v - x.antes >= 50)
      .sort((a, b) => b.v - b.antes - (a.v - a.antes))[0];
    if (subiu) {
      const pct = Math.round((subiu.v / subiu.antes - 1) * 100);
      add({ id: `subiu-${subiu.cat}`, tom: 'aviso', tipo: 'orcamento', prioridade: 60, titulo: `${subiu.cat} subiu ${pct}% em relação ao mês passado`, texto: `Você já gastou ${brl0(subiu.v - subiu.antes)} a mais com ${subiu.cat.toLowerCase()} nos mesmos dias do mês passado. Vale uma olhada?`, porque: `Até o dia ${dia}: ${brl0(subiu.v)} agora contra ${brl0(subiu.antes)} em ${mesCurto(ant)}.`, acao: { rotulo: 'Ver gastos', rota: '/mes?aba=dia' } });
    }
  }
  const estouros = Object.entries(e.limites).filter(([cat, lim]) => lim > 0 && (atuais.get(cat) ?? 0) >= 0 && gastoAte(e, mes, 31) >= 0 && e.lancamentos.filter((l) => mesDe(l.data) === mes && l.categoria === cat).reduce((t, l) => t + l.valor, 0) > lim);
  if (estouros.length > 0) {
    const [cat, lim] = estouros[0];
    add({ id: `limite-${cat}`, tom: 'aviso', tipo: 'orcamento', prioridade: 65, titulo: `O limite de ${cat} foi ultrapassado`, texto: `Você definiu ${brl0(lim)} para ${cat.toLowerCase()} neste mês e já passou. Dá pra segurar o resto do mês?`, porque: `Limite ${brl0(lim)} definido por você em Orçamento.`, acao: { rotulo: 'Ver orçamento', rota: '/plano/orcamento' } });
  }
  // salário que deveria ter caído e não foi registrado
  if (e.config.renda > 0 && e.config.diaSalario && dia >= e.config.diaSalario && !salarioConfirmado(e, mes) && disp.modo === 'renda') {
    add({ id: 'registrar-salario', tom: 'info', tipo: 'coach', prioridade: 55, titulo: 'Seu salário já caiu?', texto: 'Registre a receita para eu trabalhar com o valor que você realmente recebeu, e não com uma estimativa.', porque: `Você informou que o salário cai dia ${e.config.diaSalario} e não há receita registrada neste mês.`, acao: { rotulo: 'Registrar salário', abrir: 'adicionar' } });
  }
  const meta = reservaMeta(e, mes);
  const semAtraso = atrasoFree(lista);
  if (semAtraso && patrimonioGuardado(e) <= 0 && e.config.renda > 0 && lista.length === 0) {
    add({ id: 'comecar-reserva', tom: 'info', tipo: 'coach', prioridade: 30, titulo: 'Você pode começar sua reserva de emergência', texto: `Guardar ${brl0((e.config.renda * e.config.reservaPct) / 100)} por mês já cria um colchão para imprevistos.`, porque: 'Nenhum valor guardado até agora e nenhuma pendência urgente.', acao: { rotulo: 'Começar reserva', rota: '/plano/reserva' } });
  }
  const prev = somaMes(mes, -1);
  if (guardadoNoMes(e, prev) > 0 && guardadoNoMes(e, mes) === 0 && semAtraso && lista.length === 0 && meta > 0) {
    add({ id: 'guardar-de-novo', tom: 'info', tipo: 'coach', prioridade: 28, titulo: 'Que tal guardar neste mês também?', texto: `No mês passado você guardou ${brl0(guardadoNoMes(e, prev))}. Manter o hábito é o que faz a reserva crescer.`, porque: `Guardado em ${mesCurto(prev)}: ${brl0(guardadoNoMes(e, prev))}; neste mês, ainda nada.`, acao: { rotulo: 'Guardar agora', rota: '/plano/reserva' } });
  }
  const metaEmAndamento = e.metas.find((m) => m.guardados.reduce((t, g) => t + g.valor, 0) > 0 && m.guardados.reduce((t, g) => t + g.valor, 0) < m.alvo);
  if (metaEmAndamento && lista.every((r) => r.tom !== 'perigo')) {
    const g = metaEmAndamento.guardados.reduce((t, x) => t + x.valor, 0);
    add({ id: 'meta-evolui', tom: 'ok', tipo: 'coach', prioridade: 20, titulo: `Você está evoluindo na meta ${metaEmAndamento.nome}`, texto: `Já são ${brl0(g)} de ${brl0(metaEmAndamento.alvo)} (${Math.round((g / metaEmAndamento.alvo) * 100)}%). Continue assim.`, porque: `Soma dos valores que você guardou nesta meta.`, acao: { rotulo: 'Ver metas', rota: '/evolucao' } });
  }
  if (situacaoFinanceira(e, hoje) === 'sem-dados') {
    add({ id: 'comecar', tom: 'info', tipo: 'coach', prioridade: 10, titulo: 'Vamos começar pelo básico', texto: 'Me conte sua renda e anote o primeiro gasto. Com isso já consigo te mostrar quanto você pode gastar hoje.', porque: 'Ainda não há dados suficientes para uma análise.', acao: { rotulo: 'Adicionar movimentação', abrir: 'adicionar' } });
  }
  if (lista.length === 0) {
    add({ id: 'tudo-certo', tom: 'ok', tipo: 'coach', prioridade: 1, titulo: 'Está tudo em ordem por aqui', texto: 'Nada urgente agora. Continue anotando seus gastos para eu enxergar seus padrões.', porque: 'Sem contas atrasadas, sem vencimentos próximos e dentro do orçamento.', acao: { rotulo: 'Ver minha evolução', rota: '/evolucao' } });
  }
  const off = new Set(e.config.avisosDesligados ?? []);
  return lista.filter((r) => !off.has(r.tipo) || r.tom === 'perigo').sort((a, b) => b.prioridade - a.prioridade);
}
const atrasoFree = (l: Recomendacao[]) => !l.some((r) => r.tom === 'perigo' || r.tom === 'aviso');

export interface Missao {
  id: string;
  titulo: string;
  texto: string;
  feita: boolean;
  acao?: Recomendacao['acao'];
}
/** A missão financeira do dia: uma coisa só, a mais útil agora. Sem pontos nem jogo: é disciplina. */
export function missaoDoDia(e: Estado, hoje: string): Missao {
  const recs = recomendacoes(e, hoje);
  const top = recs.find((r) => r.tom === 'perigo' || r.tom === 'aviso');
  if (top) return { id: top.id, titulo: top.id.startsWith('limite') || top.id.startsWith('subiu') ? 'Revisar o orçamento' : top.id === 'fatura' ? 'Conferir a fatura do cartão' : top.id === 'acima-da-renda' ? 'Equilibrar o mês' : 'Resolver a prioridade do dia', texto: 'Reserve alguns minutos hoje para isso. Um passo de cada vez já resolve.', feita: false, acao: top.acao };
  const anotouRecente = e.lancamentos.some((l) => l.data >= somaDias(hoje, -1));
  if (!anotouRecente && e.config.renda > 0) return { id: 'registrar', titulo: 'Registrar suas despesas', texto: 'Você não anotou nada nos últimos dois dias. Leva poucos segundos.', feita: false, acao: { rotulo: 'Adicionar movimentação', abrir: 'adicionar' } };
  if (e.metas.length > 0 && !e.metas.some((m) => m.guardados.some((g) => g.data === hoje))) return { id: 'guardar', titulo: 'Guardar um pouco para sua meta', texto: `Qualquer valor para ${e.metas[0].nome} ajuda a criar o hábito.`, feita: false, acao: { rotulo: 'Ver metas', rota: '/evolucao' } };
  if (diasEntre(hoje, somaDias(hoje, 0)) === 0 && e.lancamentos.some((l) => l.data === hoje)) return { id: 'ok', titulo: 'Missão cumprida hoje', texto: 'Você registrou seus gastos e não há pendências urgentes.', feita: true };
  return { id: 'revisar', titulo: 'Revisar a semana', texto: 'Dê uma olhada em como foram seus gastos nos últimos dias.', feita: false, acao: { rotulo: 'Ver evolução', rota: '/evolucao' } };
}
