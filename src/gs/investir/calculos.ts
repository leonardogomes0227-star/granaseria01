// Contas da aba Investir (puras, com teste): juros compostos, perfil de risco, prioridade e a mesa de simulação.

import { arred, brl0 } from '../datas';
import { atrasosAbertos } from '../atrasosBase';
import { patrimonioGuardado, reservaMeta } from '../selectores';
import { saldoAtual, totalDividas } from '../dividas';
import type { Estado, OperacaoFechada, PerfilRisco, Posicao } from '../tipos';

/* ---------- juros compostos ---------- */
export interface Composto {
  investido: number;
  final: number;
  juros: number;
  poderDeCompra: number | null; // o valor final em reais de hoje (descontada a inflação), se a inflação for conhecida
}
export function jurosCompostos(p: { aporteMensal: number; meses: number; taxaMensalPct: number; inflacaoMensalPct?: number | null; inicial?: number }): Composto {
  const i = p.taxaMensalPct / 100;
  const n = Math.max(0, Math.round(p.meses));
  const inicial = Math.max(0, p.inicial ?? 0);
  const a = Math.max(0, p.aporteMensal);
  const fator = (1 + i) ** n;
  const final = inicial * fator + (i === 0 ? a * n : (a * (fator - 1)) / i);
  const investido = inicial + a * n;
  const pc = p.inflacaoMensalPct != null ? final / (1 + p.inflacaoMensalPct / 100) ** n : null;
  return { investido: arred(investido), final: arred(final), juros: arred(final - investido), poderDeCompra: pc === null ? null : arred(pc) };
}
export const taxaMensalDeAnual = (anualPct: number) => ((1 + anualPct / 100) ** (1 / 12) - 1) * 100;

/* ---------- perfil de risco ---------- */
export interface Pergunta {
  id: string;
  texto: string;
  opcoes: { rotulo: string; pontos: number }[];
}
export const QUIZ: Pergunta[] = [
  { id: 'prazo', texto: 'Em quanto tempo você vai precisar desse dinheiro?', opcoes: [{ rotulo: 'Em menos de 1 ano', pontos: 0 }, { rotulo: 'De 1 a 5 anos', pontos: 1 }, { rotulo: 'De 5 a 10 anos', pontos: 2 }, { rotulo: 'Mais de 10 anos', pontos: 3 }] },
  { id: 'queda', texto: 'O que você faria se o investimento caísse 20% num mês?', opcoes: [{ rotulo: 'Tiraria tudo', pontos: 0 }, { rotulo: 'Ficaria preocupado e tiraria parte', pontos: 1 }, { rotulo: 'Esperaria voltar', pontos: 2 }, { rotulo: 'Aproveitaria pra comprar mais', pontos: 3 }] },
  { id: 'experiencia', texto: 'Qual a sua experiência com investimentos?', opcoes: [{ rotulo: 'Nenhuma', pontos: 0 }, { rotulo: 'Só poupança', pontos: 1 }, { rotulo: 'Renda fixa (CDB, Tesouro)', pontos: 2 }, { rotulo: 'Ações, fundos ou cripto', pontos: 3 }] },
  { id: 'dependencia', texto: 'Você depende desse dinheiro pra pagar as contas?', opcoes: [{ rotulo: 'Sim, totalmente', pontos: 0 }, { rotulo: 'Em parte', pontos: 1 }, { rotulo: 'Pouco', pontos: 2 }, { rotulo: 'Não, é sobra', pontos: 3 }] },
  { id: 'perda', texto: 'Que parte da sua renda você poderia perder sem se abalar?', opcoes: [{ rotulo: 'Nenhuma', pontos: 0 }, { rotulo: 'Até 5%', pontos: 1 }, { rotulo: 'Até 10%', pontos: 2 }, { rotulo: 'Mais de 10%', pontos: 3 }] },
];
export function perfilDoQuiz(respostas: number[]): PerfilRisco {
  const pontos = respostas.reduce((t, i, k) => t + (QUIZ[k]?.opcoes[i]?.pontos ?? 0), 0);
  return pontos <= 5 ? 'conservador' : pontos <= 10 ? 'moderado' : 'arrojado';
}

/** Exemplo educativo: cripto e derivativos ficam sempre numa parcela pequena (até 10%). */
export const DISTRIBUICAO: Record<PerfilRisco, { rotulo: string; pct: number }[]> = {
  conservador: [{ rotulo: 'Reserva e liquidez diária', pct: 60 }, { rotulo: 'Renda fixa', pct: 35 }, { rotulo: 'Renda variável', pct: 5 }, { rotulo: 'Cripto', pct: 0 }],
  moderado: [{ rotulo: 'Reserva e liquidez diária', pct: 30 }, { rotulo: 'Renda fixa', pct: 45 }, { rotulo: 'Renda variável', pct: 20 }, { rotulo: 'Cripto', pct: 5 }],
  arrojado: [{ rotulo: 'Reserva e liquidez diária', pct: 20 }, { rotulo: 'Renda fixa', pct: 30 }, { rotulo: 'Renda variável', pct: 40 }, { rotulo: 'Cripto', pct: 10 }],
};
export const distribuir = (perfil: PerfilRisco, aporte: number) => DISTRIBUICAO[perfil].map((d) => ({ ...d, valor: arred((aporte * d.pct) / 100) }));

/* ---------- antes de investir ---------- */
export interface Prioridade {
  passo: 'atraso' | 'dividas' | 'reserva' | 'investir';
  frase: string;
  detalhe: string;
  rota?: string;
}
/** Contas de meses anteriores que ficaram pra trás (o "Sair do atraso"). */
const atrasadas = (e: Estado, mes: string) => atrasosAbertos(e, `${mes}-01`).filter((a) => a.mes < mes);

export function prioridadeAntesDeInvestir(e: Estado, mes: string, cdiMensalPct: number | null): Prioridade {
  const atr = atrasadas(e, mes);
  if (atr.length > 0) {
    return { passo: 'atraso', frase: 'Primeiro, pôr as contas em dia.', detalhe: `${atr.length === 1 ? 'Uma conta ficou' : `${atr.length} contas ficaram`} pra trás (${brl0(atr.reduce((t, a) => t + a.total, 0))} com multa). A multa e os juros custam mais do que qualquer investimento rende.`, rota: '/plano/atrasos' };
  }
  const abertas = e.dividas.filter((d) => saldoAtual(d) > 0);
  const maior = abertas.reduce((m, d) => Math.max(m, d.jurosMensal), 0);
  if (abertas.length > 0 && (cdiMensalPct === null || maior > cdiMensalPct)) {
    return {
      passo: 'dividas',
      frase: 'Quitar rende mais que investir.',
      detalhe: cdiMensalPct === null ? 'Você tem dívidas com juros. Sem os dados de mercado agora, vale a regra: juro de dívida quase sempre custa mais do que um investimento rende.' : `Sua dívida cobra até ${maior.toLocaleString('pt-BR')}% ao mês e o CDI rende ${cdiMensalPct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%. Total em aberto: ${totalDividas(e.dividas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}.`,
      rota: '/plano/dividas',
    };
  }
  const meta = reservaMeta(e, mes);
  const guardado = patrimonioGuardado(e);
  if (meta <= 0 || guardado < meta) {
    return { passo: 'reserva', frase: 'Primeiro a reserva de emergência.', detalhe: meta > 0 ? `Você tem ${guardado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} de ${meta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} (6 meses de gastos). Guarde em liquidez diária.` : 'Cadastre suas contas fixas pra eu calcular a meta de 6 meses de gastos. Guarde em liquidez diária.', rota: '/plano/reserva' };
  }
  return { passo: 'investir', frase: 'Reserva pronta: agora o excedente pode render.', detalhe: 'Sem dívidas caras e com a reserva completa, o que sobra pode ir pra investimentos, no ritmo do seu perfil.' };
}

/* ---------- mesa de simulação (dinheiro de mentirinha) ---------- */
export const SALDO_INICIAL = 10000;
export const ALAVANCAGEM_MAX = 10;

export function resultadoPosicao(p: Pick<Posicao, 'lado' | 'margem' | 'alavancagem' | 'precoEntrada'>, precoAtual: number): number {
  if (!(p.precoEntrada > 0) || !(precoAtual > 0)) return 0;
  return arred((precoAtual / p.precoEntrada - 1) * p.margem * p.alavancagem * (p.lado === 'long' ? 1 : -1));
}
export type EstadoPosicao = 'aberta' | 'liquidada' | 'stop' | 'alvo';
export function avaliarPosicao(p: Posicao, precoAtual: number): { estado: EstadoPosicao; resultado: number } {
  const bruto = resultadoPosicao(p, precoAtual);
  if (bruto <= -p.margem + 0.005) return { estado: 'liquidada', resultado: -p.margem };
  const long = p.lado === 'long';
  if (p.stop && (long ? precoAtual <= p.stop : precoAtual >= p.stop)) return { estado: 'stop', resultado: Math.max(bruto, -p.margem) };
  if (p.alvo && (long ? precoAtual >= p.alvo : precoAtual <= p.alvo)) return { estado: 'alvo', resultado: bruto };
  return { estado: 'aberta', resultado: bruto };
}
export function fechar(p: Posicao, precoSaida: number, motivo: OperacaoFechada['motivo'], quando: string): { op: OperacaoFechada; devolver: number } {
  const resultado = Math.max(resultadoPosicao(p, precoSaida), -p.margem);
  return { op: { id: p.id, ativo: p.ativo, lado: p.lado, margem: p.margem, alavancagem: p.alavancagem, precoEntrada: p.precoEntrada, precoSaida, resultado, motivo, abertaEm: p.abertaEm, fechadaEm: quando }, devolver: arred(p.margem + resultado) };
}
export function estatisticas(h: OperacaoFechada[]) {
  const total = h.length;
  const acertos = h.filter((o) => o.resultado > 0).length;
  return { total, taxaAcerto: total ? Math.round((acertos / total) * 100) : 0, acumulado: arred(h.reduce((t, o) => t + o.resultado, 0)), maiorPerda: h.reduce((m, o) => Math.min(m, o.resultado), 0) };
}

/* ---------- o caminho até investir: um passo de cada vez ---------- */
export type IdPasso = 'atraso' | 'dividas' | 'reserva' | 'perfil' | 'investir';
export interface PassoCaminho {
  id: IdPasso;
  titulo: string;
  estado: 'feito' | 'agora' | 'depois';
  resumo: string;
}
export const NOME_PERFIL: Record<PerfilRisco, string> = { conservador: 'Conservador', moderado: 'Moderado', arrojado: 'Arrojado' };

/** Atraso (se houver) → dívida cara → reserva → perfil → investir. O primeiro que falta é o "agora". */
export function caminhoInvestir(e: Estado, mes: string, cdiMensalPct: number | null): PassoCaminho[] {
  const passos: (Omit<PassoCaminho, 'estado'> & { feito: boolean })[] = [];
  const atr = atrasadas(e, mes);
  if (atr.length > 0)
    passos.push({ id: 'atraso', titulo: 'Pôr as contas em dia', feito: false, resumo: `${atr.length === 1 ? '1 conta atrasada' : `${atr.length} contas atrasadas`}: ${brl0(atr.reduce((t, a) => t + a.total, 0))} com multa. Isso vem antes de tudo.` });
  const abertas = e.dividas.filter((d) => saldoAtual(d) > 0);
  const caras = abertas.filter((d) => d.jurosMensal > 0 && (cdiMensalPct === null || d.jurosMensal > cdiMensalPct));
  const maior = caras.reduce((m, d) => Math.max(m, d.jurosMensal), 0);
  passos.push({
    id: 'dividas',
    titulo: 'Quitar a dívida cara',
    feito: caras.length === 0,
    resumo: caras.length ? `Sua dívida cobra até ${maior.toLocaleString('pt-BR')}% ao mês. Nenhum investimento rende isso: quitar é o melhor "investimento" agora.` : abertas.length ? 'Suas dívidas cobram menos do que a renda fixa rende. Pode seguir.' : 'Nenhuma dívida cara.',
  });
  const meta = reservaMeta(e, mes);
  const guardado = patrimonioGuardado(e);
  const nMeses = e.config.reservaMeses ?? 6;
  passos.push({
    id: 'reserva',
    titulo: 'Montar a reserva de emergência',
    feito: meta > 0 && guardado >= meta,
    resumo: meta > 0 ? (guardado >= meta ? `Pronta: ${brl0(guardado)} (${nMeses} meses de gastos).` : `${brl0(guardado)} de ${brl0(meta)} (${nMeses} meses de gastos). Faltam ${brl0(meta - guardado)}.`) : 'Cadastre suas contas fixas pra eu calcular quanto é.',
  });
  passos.push({ id: 'perfil', titulo: 'Descobrir o seu perfil', feito: Boolean(e.investir.perfilRisco), resumo: e.investir.perfilRisco ? `Você é ${NOME_PERFIL[e.investir.perfilRisco].toLowerCase()}.` : '5 perguntas, 1 minuto. Diz quanto sobe e desce você aguenta.' });
  const aporte = e.investir.aporteMensalPlanejado;
  passos.push({ id: 'investir', titulo: 'Investir todo mês', feito: false, resumo: aporte ? `Seu plano: ${brl0(aporte)} por mês.` : 'Quanto por mês, onde colocar e quanto isso vira.' });
  let achou = false;
  return passos.map(({ feito, ...p }) => {
    if (feito) return { ...p, estado: 'feito' as const };
    if (!achou) {
      achou = true;
      return { ...p, estado: 'agora' as const };
    }
    return { ...p, estado: 'depois' as const };
  });
}

/** Onde colocar cada parte, em palavras do dia a dia (exemplos educativos, não recomendação). */
export const ONDE: Record<string, string> = {
  'Reserva e liquidez diária': 'Tesouro Selic ou CDB com liquidez diária',
  'Renda fixa': 'CDB, LCI/LCA ou Tesouro IPCA+',
  'Renda variável': 'Fundos de índice (ETF) ou fundos imobiliários',
  Cripto: 'Bitcoin, só uma parte pequena',
};
