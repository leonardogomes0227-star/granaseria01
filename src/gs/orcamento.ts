// Orçamento: o quanto de cada categoria já foi e a regra 50/30/20 com os números da pessoa. Pura, com teste.

import { COR_CATEGORIA, GRUPO, PARTE_SUGERIDA } from './categorias';
import { arred, brl0, diasNoMes, diasRestantes, somaMes } from './datas';
import { atrasoNoMes, folgaMensal, guardarNoMes, lancamentosDoMes, limiteDiario, livreParaGastar, totalFixos, totalVariaveis } from './selectores';
import type { Estado } from './tipos';

export interface LinhaCategoria {
  categoria: string;
  gasto: number;
  limite: number | null;
  pct: number | null;
  tom: 'ok' | 'aviso' | 'perigo' | 'sem';
}

export function gastoPorCategoria(e: Estado, mes: string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const l of lancamentosDoMes(e, mes)) m[l.categoria] = arred((m[l.categoria] ?? 0) + l.valor);
  return m;
}

/** Normal abaixo de 80%, âmbar de 80% a 100%, vermelho acima. Sem limite: nunca mostra barra cheia. */
export function linhasDeCategoria(e: Estado, mes: string): LinhaCategoria[] {
  const g = gastoPorCategoria(e, mes);
  const nomes = [...new Set([...Object.keys(COR_CATEGORIA), ...Object.keys(g)])].filter((c) => c !== 'Casa' || (g.Casa ?? 0) > 0 || e.limites.Casa);
  return nomes
    .map((categoria) => {
      const gasto = g[categoria] ?? 0;
      const limite = e.limites[categoria] ?? null;
      const pct = limite ? (gasto / limite) * 100 : null;
      const tom: LinhaCategoria['tom'] = pct === null ? 'sem' : pct > 100 ? 'perigo' : pct >= 80 ? 'aviso' : 'ok';
      return { categoria, gasto, limite, pct, tom };
    })
    .sort((a, b) => b.gasto - a.gasto);
}

export interface Regra {
  nome: string;
  pct: number;
  ideal: number;
  menorMelhor: boolean;
  ok: boolean;
}
export function regra503020(e: Estado, mes: string): Regra[] {
  const renda = e.config.renda;
  if (renda <= 0) return [];
  const g = gastoPorCategoria(e, mes);
  const fixas = totalFixos(e, mes);
  let nec = fixas;
  let des = 0;
  for (const [c, v] of Object.entries(g)) {
    if (GRUPO[c] === 'desejos') des += v;
    else nec += v;
  }
  const guardar = Math.max(0, renda - nec - des);
  const mk = (nome: string, valor: number, ideal: number, menorMelhor: boolean): Regra => {
    const pct = (valor / renda) * 100;
    return { nome, pct, ideal, menorMelhor, ok: menorMelhor ? pct <= ideal : pct >= ideal };
  };
  return [mk('Necessidades', nec, 50, true), mk('Desejos', des, 30, true), mk('Guardar', guardar, 20, false)];
}

/* ---------- painel do mês: ritmo, o que fazer agora e meses sem estourar ---------- */


export interface ResumoMes {
  gastoVar: number;
  livre: number;
  orcamento: number; // renda - fixos - guardado: o que o dia a dia pode gastar no mês
  pctUsado: number;
  pctMes: number;
  porDia: number;
  restam: number; // dias
  ritmo: number; // gasto projetado pro mês inteiro, no ritmo de agora
  sobraProjetada: number;
}
export function resumoDoMes(e: Estado, mes: string, hoje: string): ResumoMes {
  const gastoVar = totalVariaveis(e, mes);
  const livre = livreParaGastar(e, mes);
  const orcamento = Math.max(0, arred(livre + gastoVar));
  const dn = diasNoMes(mes);
  const passados = mes === hoje.slice(0, 7) ? Math.max(1, Number(hoje.slice(8, 10))) : dn;
  const ritmo = arred((gastoVar / passados) * dn);
  return {
    gastoVar,
    livre,
    orcamento,
    pctUsado: orcamento > 0 ? Math.min(100, (gastoVar / orcamento) * 100) : gastoVar > 0 ? 100 : 0,
    pctMes: (passados / dn) * 100,
    porDia: limiteDiario(e, mes, hoje),
    restam: diasRestantes(mes, hoje),
    ritmo,
    sobraProjetada: arred(orcamento - ritmo),
  };
}

export interface AcaoOrcamento {
  tom: 'ok' | 'aviso' | 'perigo';
  texto: string;
  rota?: string;
}
/** A coisa mais importante agora: estouro, quase estouro, ritmo alto, começar ou seguir. */
export function acaoOrcamento(e: Estado, mes: string, hoje: string): AcaoOrcamento {
  const linhas = linhasDeCategoria(e, mes);
  const r = resumoDoMes(e, mes, hoje);
  const estourada = linhas.filter((l) => l.tom === 'perigo').sort((a, b) => b.gasto - b.limite! - (a.gasto - a.limite!))[0];
  if (estourada) return { tom: 'perigo', texto: `${estourada.categoria} passou ${brl0(estourada.gasto - estourada.limite!)} do limite. Segure o resto do mês.` };
  const quase = linhas.filter((l) => l.tom === 'aviso').sort((a, b) => b.pct! - a.pct!)[0];
  if (quase) {
    const sobra = quase.limite! - quase.gasto;
    return { tom: 'aviso', texto: `${quase.categoria} já usou ${Math.round(quase.pct!)}%. Restam ${brl0(sobra)} pra ${r.restam} ${r.restam === 1 ? 'dia' : 'dias'} (${brl0(sobra / r.restam)} por dia).` };
  }
  if (e.lancamentos.filter((l) => l.data.slice(0, 7) === mes).length === 0) return { tom: 'aviso', texto: 'Ainda não tem gasto anotado neste mês. Anote o primeiro pelo WhatsApp ou aqui no app.', rota: '/mes?aba=dia' };
  if (!linhas.some((l) => l.limite)) return { tom: 'aviso', texto: 'Defina limites pelas categorias. Com 1 toque eu sugiro os valores.' };
  if (r.orcamento > 0 && r.sobraProjetada < 0) return { tom: 'aviso', texto: `No ritmo de agora você passa ${brl0(-r.sobraProjetada)} do que sobra no mês. Gaste uns ${brl0(Math.max(0, r.porDia))} por dia daqui pra frente.` };
  return { tom: 'ok', texto: r.orcamento > 0 ? `No trilho. Você pode gastar ${brl0(Math.max(0, r.porDia))} por dia até o fim do mês.` : 'No trilho.' };
}

/** Meses seguidos sem passar de nenhum limite (com gasto anotado). O mês atual conta se ainda não estourou. */
export function mesesNoLimite(e: Estado, mes: string): number {
  const limites = Object.entries(e.limites).filter(([, v]) => v > 0);
  if (limites.length === 0) return 0;
  const dentro = (m: string) => {
    const g = gastoPorCategoria(e, m);
    return Object.keys(g).length > 0 && limites.every(([c, l]) => (g[c] ?? 0) <= l);
  };
  const voltar = (m: string) => {
    const [a, n] = m.split('-').map(Number);
    return n === 1 ? `${a - 1}-12` : `${a}-${String(n - 1).padStart(2, '0')}`;
  };
  let m = dentro(mes) ? mes : voltar(mes);
  let n = 0;
  while (n < 60 && dentro(m)) {
    n++;
    m = voltar(m);
  }
  return n;
}

/* ---------- envelopes: quanto dá pro dia a dia, como dividir e quando cada um acaba ---------- */
export interface BaseDoMes {
  renda: number;
  fixos: number; // contas fixas do mês
  parcelas: number; // parcelas de dívida que não estão nas contas fixas
  guardar: number; // o que vai pra reserva (pausado quando há conta atrasada)
  atraso: number; // o que vai pra conta atrasada
  diaADia: number; // o que sobra pros gastos do dia a dia
}
export function baseDoMes(e: Estado, mes: string): BaseDoMes {
  const renda = e.config.renda;
  const fixos = totalFixos(e, mes);
  const parcelas = folgaMensal(e, mes).parcelas;
  const atraso = atrasoNoMes(e, mes);
  const guardar = guardarNoMes(e, mes);
  return { renda, fixos, parcelas, guardar, atraso, diaADia: Math.max(0, arred(renda - fixos - parcelas - guardar - atraso)) };
}

export const CATEGORIAS_ENVELOPE = ['Mercado', 'Transporte', 'Comida', 'Saúde', 'Lazer', 'Compras', 'Casa', 'Outros'];

/** Média por categoria nos 3 meses antes deste (só os meses com gasto anotado). */
export function mediaPorCategoria(e: Estado, mes: string): Record<string, number> {
  const meses = [1, 2, 3].map((n) => somaMes(mes, -n)).filter((m) => lancamentosDoMes(e, m).length > 0);
  const out: Record<string, number> = {};
  for (const m of meses) for (const [c, v] of Object.entries(gastoPorCategoria(e, m))) out[c] = (out[c] ?? 0) + v / meses.length;
  return Object.fromEntries(Object.entries(out).map(([c, v]) => [c, arred(v)]));
}

export interface PlanoOrcamento {
  base: BaseDoMes;
  itens: { categoria: string; valor: number }[];
  fonte: 'historico' | 'renda';
  costuma: number; // quanto costuma gastar no dia a dia (média), 0 sem histórico
  sobra: number; // o que fica sem envelope (quando dá mais do que costuma gastar)
}
const desce10 = (n: number) => Math.max(0, Math.floor(n / 10) * 10);

/** Divide o que dá pro dia a dia entre as categorias: pelo que a pessoa costuma gastar ou, sem histórico, por partes da renda.
 *  Se costuma gastar mais do que dá, corta na mesma proporção. Se dá mais, o resto fica de sobra (pra guardar ou imprevisto). */
export function planoDeOrcamento(e: Estado, mes: string): PlanoOrcamento {
  const base = baseDoMes(e, mes);
  const media = mediaPorCategoria(e, mes);
  const costuma = arred(Object.values(media).reduce((t, v) => t + v, 0));
  const fonte: PlanoOrcamento['fonte'] = costuma > 0 ? 'historico' : 'renda';
  const pesos: Record<string, number> = fonte === 'historico' ? { ...media, Outros: Math.max(media.Outros ?? 0, costuma * 0.05) } : { ...PARTE_SUGERIDA };
  const alvo = fonte === 'historico' ? Math.min(base.diaADia, Object.values(pesos).reduce((t, v) => t + v, 0)) : base.diaADia;
  const somaPesos = Object.values(pesos).reduce((t, v) => t + v, 0) || 1;
  const ordem = [...new Set([...CATEGORIAS_ENVELOPE, ...Object.keys(pesos)])].filter((c) => (pesos[c] ?? 0) > 0);
  const itens = ordem.map((categoria) => ({ categoria, valor: desce10((alvo * pesos[categoria]) / somaPesos) })).filter((i) => i.valor > 0);
  const usado = itens.reduce((t, i) => t + i.valor, 0);
  // o que sobrou do arredondamento vai pro maior envelope (sem passar do que dá)
  if (itens.length && alvo - usado >= 10) {
    const maior = itens.reduce((m, i) => (i.valor > m.valor ? i : m), itens[0]);
    maior.valor += desce10(alvo - usado);
  }
  itens.sort((a, b) => b.valor - a.valor);
  return { base, itens, fonte, costuma, sobra: Math.max(0, arred(base.diaADia - itens.reduce((t, i) => t + i.valor, 0))) };
}

export interface Envelope {
  categoria: string;
  limite: number;
  gasto: number;
  resta: number; // negativo = passou
  porDia: number;
  acabaDia: number | null; // no ritmo de agora, o dia do mês em que acaba (só se acabar antes do fim)
  tom: 'ok' | 'aviso' | 'perigo';
}
export function envelopes(e: Estado, mes: string, hoje: string): Envelope[] {
  const dn = diasNoMes(mes);
  const atual = mes === hoje.slice(0, 7);
  const passados = atual ? Math.max(1, Number(hoje.slice(8, 10))) : dn;
  const restam = diasRestantes(mes, hoje);
  return linhasDeCategoria(e, mes)
    .filter((l) => l.limite)
    .map((l) => {
      const limite = l.limite!;
      const resta = arred(limite - l.gasto);
      const ritmoDia = l.gasto / passados;
      const acaba = atual && ritmoDia > 0 && resta > 0 ? Math.floor(limite / ritmoDia) : null;
      const acabaDia = acaba !== null && acaba < dn ? Math.max(Number(hoje.slice(8, 10)), acaba) : null;
      const tom: Envelope['tom'] = resta < 0 ? 'perigo' : acabaDia !== null || (l.pct ?? 0) >= 80 ? 'aviso' : 'ok';
      return { categoria: l.categoria, limite, gasto: l.gasto, resta, porDia: arred(Math.max(0, resta) / restam), acabaDia, tom };
    })
    .sort((a, b) => ({ perigo: 0, aviso: 1, ok: 2 })[a.tom] - ({ perigo: 0, aviso: 1, ok: 2 })[b.tom] || b.limite - a.limite);
}
