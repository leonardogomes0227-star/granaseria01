// Modo Recuperação: a lógica do plano de saída. Pura e testada. Reaproveita o que já existe (atrasos, dívidas, disponível)
// e só junta numa trilha: tudo que devo → o que pagar primeiro → quanto cabe → quando fico em dia → o passo de hoje.

import { diasEntre, mesDe, somaDias } from './datas';
import { situacaoAtrasos } from './atrasosLogica';
import { paraSim, saldoAtual, simular } from './dividas';
import { contasDoMes, detalheDisponivel, folgaMensal, valorDoMes } from './selectores';
import type { Estado } from './tipos';

/** Contas fixas que não dá para cortar: moradia e básicas. */
export const FIXAS_ESSENCIAIS = ['Aluguel', 'Luz', 'Água', 'Internet', 'Financiamento'];
/** Gastos do dia a dia essenciais; o resto (lazer, compras, comida fora, assinaturas) é supérfluo. */
export const DIA_ESSENCIAL = ['Mercado', 'Saúde', 'Transporte', 'Casa'];
export const JURO_ALTO = 8; // % ao mês a partir do qual a dívida passa na frente das menores

export type GrupoTriagem = 1 | 2 | 3;
export interface ItemTriagem {
  chave: string;
  tipo: 'atraso' | 'divida';
  nome: string;
  valor: number; // atraso: com multa e juros estimados · dívida: saldo
  parcela?: number;
  juros?: number;
  grupo: GrupoTriagem;
  motivo: string;
  estimado: boolean;
  atrasada: boolean;
  rota: string;
}

const categoriaDoAtraso = (e: Estado, chave: string, refId: string): string | undefined => {
  if (chave.startsWith('gf:')) return e.gastosFixos.find((g) => g.id === refId)?.categoria;
  if (chave.startsWith('mn:')) {
    const m = e.atrasos?.manuais?.find((x) => x.id === refId);
    return m?.categoria ?? e.gastosFixos.find((g) => g.id === m?.gastoId)?.categoria;
  }
  return undefined;
};

/** O que pagar primeiro: (1) essenciais atrasados, (2) o que acumula mais juros, (3) o resto. Com o porquê de cada um. */
export function triagem(e: Estado, hoje: string): ItemTriagem[] {
  const s = situacaoAtrasos(e, hoje);
  const itens: ItemTriagem[] = [];
  const dividasAtrasadas = new Set(s.atrasos.filter((a) => a.chave.startsWith('dv:')).map((a) => a.refId));
  for (const a of s.atrasos) {
    if (a.chave.startsWith('dv:')) continue; // a parcela atrasada aparece na própria dívida
    const cat = categoriaDoAtraso(e, a.chave, a.refId);
    const essencial = Boolean(cat && FIXAS_ESSENCIAIS.includes(cat));
    const estimado = a.chave.startsWith('mn:') && Boolean(e.atrasos?.manuais?.find((m) => m.id === a.refId)?.estimado);
    itens.push({ chave: a.chave, tipo: 'atraso', nome: a.nome, valor: a.total, grupo: essencial ? 1 : 2, motivo: essencial ? 'Conta essencial: moradia e contas básicas vêm primeiro.' : `Já está ${a.dias} ${a.dias === 1 ? 'dia' : 'dias'} atrasada e acumulando multa e juros.`, estimado, atrasada: true, rota: '/plano/atrasos' });
  }
  // conta do mês que já venceu e ainda não entrou na lista de atrasos (ex.: cadastrada hoje, com vencimento já passado)
  const mes = mesDe(hoje);
  for (const c of contasDoMes(e, mes, hoje)) {
    if (c.estado !== 'atrasada' || s.atrasos.some((a) => a.chave === `gf:${c.gasto.id}:${mes}`)) continue;
    const essencial = FIXAS_ESSENCIAIS.includes(c.gasto.categoria);
    itens.push({ chave: `gf:${c.gasto.id}:${mes}`, tipo: 'atraso', nome: c.gasto.nome, valor: c.valor, grupo: essencial ? 1 : 2, motivo: essencial ? 'Conta essencial: moradia e contas básicas vêm primeiro.' : `Já está ${-c.dias} ${-c.dias === 1 ? 'dia' : 'dias'} atrasada.`, estimado: false, atrasada: true, rota: '/lancamentos?aba=contas' });
  }
  for (const d of e.dividas) {
    const saldo = saldoAtual(d);
    if (saldo <= 0) continue;
    const alto = d.jurosMensal >= JURO_ALTO;
    itens.push({ chave: `dv:${d.id}`, tipo: 'divida', nome: d.nome, valor: saldo, parcela: d.parcelaMinima, juros: d.jurosMensal, grupo: alto ? 2 : 3, motivo: alto ? `Juros altos (${String(d.jurosMensal).replace('.', ',')}% ao mês): cada mês parada custa mais.` : 'Juros menores: pague a parcela em dia e deixe para depois.', estimado: Boolean(d.estimado), atrasada: dividasAtrasadas.has(d.id), rota: '/plano/dividas' });
  }
  return itens.sort((a, b) => a.grupo - b.grupo || Number(b.atrasada) - Number(a.atrasada) || (b.juros ?? 0) - (a.juros ?? 0) || a.valor - b.valor);
}

export interface PlanoDeSaida {
  totalDevido: number;
  capacidade: number; // quanto sobra por mês para pagar dívidas (pode ser 0)
  emDiaEm: string | null; // 'AAAA-MM'; null = não dá pra calcular com o que sobra hoje
  temEstimativa: boolean;
  semHistorico: boolean; // sem gastos anotados, a sobra é otimista
  nItens: number;
}
export function planoDeSaida(e: Estado, hoje: string): PlanoDeSaida {
  const mes = mesDe(hoje);
  const s = situacaoAtrasos(e, hoje);
  const itens = triagem(e, hoje);
  const folga = folgaMensal(e, mes);
  const capacidade = Math.max(0, Math.floor(folga.folga));
  const totalDevido = Math.round(itens.reduce((t, i) => t + i.valor, 0) * 100) / 100;
  const abertas = e.dividas.filter((d) => saldoAtual(d) > 0);
  let fimDividas: string | null = null;
  let dividasOk = true;
  if (abertas.length > 0) {
    const minimo = abertas.reduce((t, d) => t + Math.min(d.parcelaMinima, saldoAtual(d)), 0);
    const r = simular(paraSim(abertas), Math.max(minimo, capacidade), 'maior-juro');
    fimDividas = r.dataFinal ?? null;
    dividasOk = Boolean(r.dataFinal);
  }
  const fimAtrasos = s.atrasos.some((a) => !a.chave.startsWith('dv:')) ? s.plano.emDiaEm ?? null : null;
  const temAtraso = s.atrasos.some((a) => !a.chave.startsWith('dv:'));
  const calculavel = dividasOk && (!temAtraso || Boolean(s.plano.emDiaEm));
  const datas = [fimDividas, fimAtrasos].filter((x): x is string => Boolean(x));
  const emDiaEm = calculavel && datas.length > 0 ? datas.sort()[datas.length - 1] : null;
  return { totalDevido, capacidade, emDiaEm, temEstimativa: itens.some((i) => i.estimado) || folga.semHistorico, semHistorico: folga.semHistorico, nItens: itens.length };
}

export interface Sobrevivencia {
  essenciais: number; // fixas essenciais + dia a dia essencial do mês
  outrasFixas: number;
  superfluos: number;
}
/** Separa o que é preciso do que dá para cortar, no mês. */
export function sobrevivencia(e: Estado, mes: string): Sobrevivencia {
  const fixas = e.gastosFixos.map((g) => ({ cat: g.categoria, v: valorDoMes(g, mes) }));
  const essFixas = fixas.filter((f) => FIXAS_ESSENCIAIS.includes(f.cat)).reduce((t, f) => t + f.v, 0);
  const outras = fixas.filter((f) => !FIXAS_ESSENCIAIS.includes(f.cat)).reduce((t, f) => t + f.v, 0);
  const dia = e.lancamentos.filter((l) => mesDe(l.data) === mes);
  const essDia = dia.filter((l) => DIA_ESSENCIAL.includes(l.categoria)).reduce((t, l) => t + l.valor, 0);
  const sup = dia.filter((l) => !DIA_ESSENCIAL.includes(l.categoria)).reduce((t, l) => t + l.valor, 0);
  const r = (n: number) => Math.round(n * 100) / 100;
  return { essenciais: r(essFixas + essDia), outrasFixas: r(outras), superfluos: r(sup) };
}

export interface Passo {
  tipo: 'pagar' | 'segurar' | 'informar';
  titulo: string;
  texto: string;
  rota?: string;
}
/** O passo de hoje: um só. Paga o essencial atrasado; senão, o que vence logo; senão, o teto do dia. */
export function passoDoDia(e: Estado, hoje: string): Passo {
  const mes = mesDe(hoje);
  const t = triagem(e, hoje);
  const ess = t.find((i) => i.tipo === 'atraso' && i.grupo === 1);
  const brl = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`;
  if (ess) return { tipo: 'pagar', titulo: `Pague ${ess.nome}`, texto: `${brl(ess.valor)} com multa e juros estimados. Essencial vem primeiro.`, rota: '/plano/atrasos' };
  const logo = contasDoMes(e, mes, hoje).filter((c) => c.estado === 'vence-logo' || c.estado === 'atrasada').sort((a, b) => a.dias - b.dias)[0];
  if (logo) return { tipo: 'pagar', titulo: `${logo.gasto.nome} ${logo.dias < 0 ? 'está atrasada' : logo.dias === 0 ? 'vence hoje' : `vence em ${logo.dias} ${logo.dias === 1 ? 'dia' : 'dias'}`}`, texto: `${brl(logo.valor)}. Pague e dê baixa.`, rota: '/lancamentos?aba=contas' };
  const primeiro = t[0];
  if (primeiro && primeiro.atrasada) return { tipo: 'pagar', titulo: `Resolva ${primeiro.nome}`, texto: `${brl(primeiro.valor)}. ${primeiro.motivo}`, rota: primeiro.rota };
  const d = detalheDisponivel(e, mes, hoje);
  if (d.modo === 'incompleto') return { tipo: 'informar', titulo: 'Informe sua renda', texto: 'Sem ela eu não consigo calcular quanto você pode gastar.', rota: '/dados' };
  return { tipo: 'segurar', titulo: `Hoje, gaste no máximo ${brl(d.porDia)}`, texto: d.livre < 0 ? 'Seus compromissos já passam do que você tem. Gaste só o essencial.' : 'Esse é o teto do dia sem piorar o seu mês.' };
}

export interface Vitorias {
  pago: number; // total já pago em dívidas
  quitadas: number;
  diasSemSuperfluo: number;
}
export function vitorias(e: Estado, hoje: string): Vitorias {
  const pago = Math.round(e.dividas.flatMap((d) => d.pagamentos).reduce((t, p) => t + p.valor, 0) * 100) / 100;
  const quitadas = e.dividas.filter((d) => saldoAtual(d) <= 0).length;
  const sup = new Set(e.lancamentos.filter((l) => !DIA_ESSENCIAL.includes(l.categoria)).map((l) => l.data));
  const desde = e.recuperacao.desde ?? hoje;
  let n = 0;
  let d = hoje;
  while (d >= desde && n < 365 && !sup.has(d)) {
    n++;
    d = somaDias(d, -1);
  }
  return { pago, quitadas, diasSemSuperfluo: diasEntre(desde, hoje) >= 0 ? n : 0 };
}

/** Maiores gastos supérfluos do mês, por categoria, e as assinaturas ativas: o que dá para cortar primeiro. */
export interface OndeCortar {
  categorias: { categoria: string; valor: number }[];
  assinaturas: { total: number; n: number };
}
export function ondeCortar(e: Estado, mes: string): OndeCortar {
  const m = new Map<string, number>();
  for (const l of e.lancamentos) if (mesDe(l.data) === mes && !DIA_ESSENCIAL.includes(l.categoria)) m.set(l.categoria, (m.get(l.categoria) ?? 0) + l.valor);
  const categorias = [...m.entries()].map(([categoria, valor]) => ({ categoria, valor: Math.round(valor * 100) / 100 })).sort((a, b) => b.valor - a.valor).slice(0, 3);
  const ativas = (e.assinaturas ?? []).filter((a) => a.ativa);
  return { categorias, assinaturas: { total: Math.round(ativas.reduce((t, a) => t + a.valor, 0) * 100) / 100, n: ativas.length } };
}

export interface Marco {
  id: string;
  titulo: string;
  texto: string;
}
/** Conquistas da recuperação, em ordem. A tela comemora as que ainda não foram comemoradas (`recuperacao.marcos`). */
export function marcosConquistados(e: Estado, hoje: string): Marco[] {
  const v = vitorias(e, hoje);
  const m: Marco[] = [];
  if (e.recuperacao.raioXFeito) m.push({ id: 'raiox', titulo: 'Primeiro passo dado', texto: 'Você mapeou tudo o que deve. A parte mais difícil é olhar para o problema, e você olhou.' });
  if (v.pago > 0) m.push({ id: 'primeiro-pagamento', titulo: 'Primeiro pagamento feito', texto: 'Qualquer valor conta. Agora a dívida é menor do que ontem.' });
  if (v.quitadas >= 1) m.push({ id: 'primeira-quitada', titulo: 'Uma dívida quitada', texto: 'Uma a menos para se preocupar. Siga a ordem do plano para a próxima.' });
  // só comemora se a pessoa está anotando: sem nenhum gasto registrado, "7 dias sem supérfluo" não prova nada
  if (v.diasSemSuperfluo >= 7 && e.lancamentos.some((l) => l.data >= somaDias(hoje, -7))) m.push({ id: 'sete-dias', titulo: '7 dias sem gasto supérfluo', texto: 'Uma semana inteira só no essencial. Isso libera dinheiro para as dívidas.' });
  return m;
}
