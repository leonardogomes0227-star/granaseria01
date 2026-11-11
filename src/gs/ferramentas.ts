// Contas das ferramentas do app (sem tela): compra, espera de 72h, assinaturas, empréstimo, extras, renda, metas e métodos.

import { arred, diasEntre, somaDias } from './datas.js';

/* ---------- Posso comprar isso? ---------- */
export type Veredito = 'cabe' | 'aperta' | 'nao-cabe';
export interface AnaliseCompra {
  horas: number;
  dias: number; // dias de trabalho (8 h)
  pctLivre: number | null; // % do livre que a compra consome (null se não há livre)
  veredito: Veredito;
  frase: string;
}
export const horasDeTrabalho = (valor: number, renda: number, horasMes: number) => (renda > 0 && horasMes > 0 ? valor / (renda / horasMes) : 0);

export function analisarCompra(p: { valor: number; renda: number; horasMes: number; livre: number }): AnaliseCompra {
  const horas = Math.round(horasDeTrabalho(p.valor, p.renda, p.horasMes) * 10) / 10;
  const dias = Math.round((horas / 8) * 10) / 10;
  const pctLivre = p.livre > 0 ? (p.valor / p.livre) * 100 : null;
  const veredito: Veredito = p.livre <= 0 || p.valor > p.livre || (pctLivre ?? 100) > 50 ? 'nao-cabe' : (pctLivre ?? 100) > 20 ? 'aperta' : 'cabe';
  const h = Math.round(horas);
  const quanto = dias >= 1 ? `, quase ${Math.round(dias)} ${Math.round(dias) === 1 ? 'dia' : 'dias'}` : '';
  const frase = p.renda > 0 ? `Isso custa ${h} ${h === 1 ? 'hora' : 'horas'} do seu trabalho${quanto}.` : 'Informe sua renda pra ver quanto isso custa em horas de trabalho.';
  return { horas, dias, pctLivre, veredito, frase };
}

/* ---------- Esperar 72 h (o fim vem de um carimbo, nunca de contador em memória) ---------- */
export const HORAS_ESPERA = 72;
export const terminoDaEspera = (criadoEmISO: string) => new Date(Date.parse(criadoEmISO) + HORAS_ESPERA * 3600_000).toISOString();
export const msRestantes = (terminaEm: string, agoraMs: number) => Math.max(0, Date.parse(terminaEm) - agoraMs);
export function contagem(ms: number): string {
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min`;
}

/* ---------- Assinaturas ---------- */
export const SUGESTOES_ASSINATURAS: { nome: string; valor: number }[] = [
  { nome: 'Streaming de vídeo', valor: 40 },
  { nome: 'Streaming de música', valor: 22 },
  { nome: 'Nuvem (armazenamento)', valor: 15 },
  { nome: 'Academia', valor: 110 },
  { nome: 'Clube de delivery', valor: 20 },
  { nome: 'Jogos', valor: 35 },
  { nome: 'Assistente de IA', valor: 100 },
  { nome: 'Apps e aplicativos', valor: 20 },
  { nome: 'Revistas e jornais', valor: 30 },
  { nome: 'Antivírus', valor: 15 },
];
export const TAXA_PADRAO_ASSINATURAS = 0.8; // % ao mês, editável

/** Soma simples por N anos. */
export const acumulado = (valorMensal: number, anos: number) => arred(valorMensal * 12 * anos);
/** Valor futuro de aportes mensais (fim de cada mês) a uma taxa % ao mês. */
export function valorFuturo(aporteMensal: number, taxaMensalPct: number, meses: number): number {
  const i = taxaMensalPct / 100;
  if (meses <= 0 || aporteMensal <= 0) return 0;
  return arred(i === 0 ? aporteMensal * meses : (aporteMensal * ((1 + i) ** meses - 1)) / i);
}
export const ANOS_PROJECAO = [1, 5, 10] as const;
export const projecaoAnos = (valorMensal: number, taxaMensalPct: number) => ANOS_PROJECAO.map((anos) => ({ anos, simples: acumulado(valorMensal, anos), investido: valorFuturo(valorMensal, taxaMensalPct, anos * 12) }));

/* ---------- Empréstimos ---------- */
export interface Oferta {
  valor: number;
  parcelas: number;
  parcela: number;
}
export interface CustoOferta extends Oferta {
  total: number;
  juros: number;
  taxaMensal: number | null; // % ao mês efetiva
}
/** Taxa mensal (decimal) que iguala valor = parcela × (1 − (1+i)^−n) / i. Bisseção. */
export function taxaEfetiva(valor: number, n: number, parcela: number): number | null {
  if (!(valor > 0) || !(n > 0) || !(parcela > 0)) return null;
  if (parcela * n <= valor + 0.005) return 0;
  const pv = (i: number) => (i === 0 ? parcela * n : (parcela * (1 - (1 + i) ** -n)) / i);
  let lo = 0;
  let hi = 1;
  while (pv(hi) > valor && hi < 1000) hi *= 2;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > valor) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
export function custoDaOferta(o: Oferta): CustoOferta {
  const total = arred(o.parcela * o.parcelas);
  const t = taxaEfetiva(o.valor, o.parcelas, o.parcela);
  return { ...o, total, juros: arred(total - o.valor), taxaMensal: t === null ? null : Math.round(t * 100 * 100) / 100 };
}
export function compararOfertas(os: Oferta[]): { custos: CustoOferta[]; melhor: number; diferenca: number } {
  const custos = os.map(custoDaOferta);
  if (custos.length === 0) return { custos, melhor: -1, diferenca: 0 };
  let melhor = 0;
  custos.forEach((c, i) => {
    if (c.juros < custos[melhor].juros) melhor = i;
  });
  const pior = Math.max(...custos.map((c) => c.juros));
  return { custos, melhor, diferenca: arred(pior - custos[melhor].juros) };
}

/* ---------- Extras (13º, bônus) ---------- */
export interface DivisaoExtra {
  divida: number;
  reserva: number;
  lazer: number;
}
export function dividirExtra(total: number, temDivida: boolean, pcts = { divida: 50, reserva: 30, lazer: 20 }): DivisaoExtra {
  const t = Math.max(0, total);
  const soma = pcts.divida + pcts.reserva + pcts.lazer || 1;
  const lazer = arred((t * pcts.lazer) / soma);
  const divida = temDivida ? arred((t * pcts.divida) / soma) : 0; // sem dívida, a parte dela vai pra reserva
  return { divida, reserva: arred(t - divida - lazer), lazer };
}

/* ---------- Liberdade de renda ---------- */
export const TAXA_RENDA_PADRAO = 0.7; // % ao mês, editável
export const patrimonioParaRenda = (gastoMensal: number, taxaMensalPct: number) => (taxaMensalPct > 0 ? arred(gastoMensal / (taxaMensalPct / 100)) : 0);
export const progressoRenda = (guardado: number, alvo: number) => (alvo > 0 ? Math.min(100, (guardado / alvo) * 100) : 0);

/* ---------- Meta de juntar dinheiro ---------- */
export interface PlanoMeta {
  falta: number;
  metaBatida: boolean;
  prazoVencido: boolean;
  meses: number; // meses até o prazo (mínimo 1)
  porMes: number;
  porSemana: number;
}
export function planoDaMeta(p: { alvo: number; jaGuardado: number; prazo: string; hoje: string }): PlanoMeta {
  const falta = Math.max(0, arred(p.alvo - p.jaGuardado));
  const dias = diasEntre(p.hoje, p.prazo);
  const meses = Math.max(1, Math.ceil(dias / 30.4375));
  const semanas = Math.max(1, Math.round(dias / 7));
  return { falta, metaBatida: falta <= 0, prazoVencido: dias < 0 && falta > 0, meses, porMes: arred(falta / meses), porSemana: arred(falta / semanas) };
}

/* ---------- Métodos ---------- */
export type Metodo = '50-30-20' | 'pague-se-primeiro' | 'envelopes' | '52-semanas';
export const METODOS: { id: Metodo; nome: string; descricao: string }[] = [
  { id: '50-30-20', nome: '50/30/20', descricao: '50% necessidades, 30% desejos, 20% guardar.' },
  { id: 'pague-se-primeiro', nome: 'Pague-se primeiro', descricao: 'Separe 10% assim que o dinheiro cair.' },
  { id: 'envelopes', nome: 'Envelopes', descricao: 'Cada gasto tem seu envelope com valor fixo.' },
  { id: '52-semanas', nome: 'Desafio das 52 semanas', descricao: 'Guarde um pouco mais a cada semana.' },
];
export const PCT_PADRAO: Record<Metodo, number[]> = { '50-30-20': [50, 30, 20], 'pague-se-primeiro': [90, 10], envelopes: [40, 20, 15, 15, 10], '52-semanas': [] };
export const ROTULOS_METODO: Record<Metodo, string[]> = { '50-30-20': ['Necessidades', 'Desejos', 'Guardar'], 'pague-se-primeiro': ['Pra viver', 'Pra você (guardar)'], envelopes: ['Casa', 'Comida', 'Transporte', 'Lazer', 'Imprevistos'], '52-semanas': [] };
export function dividirMetodo(renda: number, pcts: number[]): number[] {
  const soma = pcts.reduce((t, x) => t + x, 0) || 1;
  const v = pcts.map((p) => arred((renda * p) / soma));
  const resto = arred(renda - v.reduce((t, x) => t + x, 0));
  if (v.length > 0) v[v.length - 1] = arred(v[v.length - 1] + resto);
  return v;
}
/** Desafio das 52 semanas: na semana n guarda n × base. */
export const valorDaSemana = (n: number, base: number) => arred(Math.min(52, Math.max(1, n)) * base);
export const totalDesafio52 = (base: number) => arred(base * (52 * 53) / 2);
export const semanaDoDesafio = (inicio: string, hoje: string) => Math.min(52, Math.max(1, Math.floor(diasEntre(inicio, hoje) / 7) + 1));
export const proximaRepeticao = (data: string, repete: 'unica' | 'diaria' | 'semanal' | 'mensal', hoje: string): string | null => {
  if (data >= hoje) return data;
  if (repete === 'unica') return null;
  const passo = repete === 'diaria' ? 1 : repete === 'semanal' ? 7 : 0;
  if (passo) {
    const faltam = Math.ceil(diasEntre(data, hoje) / passo);
    return somaDias(data, faltam * passo);
  }
  let d = data;
  for (let i = 0; i < 1200 && d < hoje; i++) {
    const [y, m, dia] = d.split('-').map(Number);
    const t = y * 12 + m;
    const ny = Math.floor(t / 12);
    const nm = (t % 12) + 1;
    const ultimo = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
    d = `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(Number(data.slice(8, 10)) || dia, ultimo)).padStart(2, '0')}`;
  }
  return d;
};
