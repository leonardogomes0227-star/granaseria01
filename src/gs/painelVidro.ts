// Painel denso do Início. Só lê o estado que já existe: não guarda nada e não inventa mês sem registro.

import { arred, diasNoMes, mesDe, somaMes } from './datas.js';
import { saldoAtual } from './dividas.js';
import { progressoMeta, serieMensal, type MesSerie } from './evolucaoLogica.js';
import { linhasDeCategoria } from './orcamento.js';
import { contasDoMes, detalheDisponivel, guardadoNoMes, receitasDoMes, totalFixos, totalVariaveis, type ContaDoMes } from './selectores.js';
import type { Estado, Lancamento } from './tipos.js';

export type Sentido = 'sobe' | 'desce' | 'igual';
export type TomCategoria = 'ok' | 'aviso' | 'perigo' | 'sem';

export interface Delta {
  valor: number;
  pct: number | null;
  sentido: Sentido;
}

export interface Ponto {
  mes: string;
  valor: number;
}

export interface Kpi {
  id: 'saldo' | 'receitas' | 'despesas' | 'guardado' | 'divida' | 'patrimonio';
  rotulo: string;
  valor: number | null;
  /** Texto curto debaixo do número (origem do dado). */
  nota: string | null;
  vazio: string | null;
  delta: Delta | null;
  /** O que a seta compara, quando existe. */
  deltaRotulo: string | null;
  serie: Ponto[];
  bomQuando: 'sobe' | 'desce';
  extra: string | null;
}

export interface PassoFunil {
  id: 'receita' | 'fixos' | 'variaveis' | 'sobrou';
  rotulo: string;
  valor: number;
  nota: string | null;
}

export interface Funil {
  passos: [PassoFunil, PassoFunil, PassoFunil, PassoFunil];
  /** % que segue de um passo para o próximo. null quando a base é zero ou negativa. */
  segue: [number | null, number | null, number | null];
}

export interface CardCategoria {
  categoria: string;
  gasto: number;
  limite: number | null;
  pct: number | null;
  tom: TomCategoria;
  pilula: 'ok' | 'atenção' | 'estourou' | 'sem limite';
  lancamentos: number;
  topo: string | null;
}

export interface DiaCalor {
  data: string;
  dia: number;
  /** 0 = segunda … 6 = domingo. */
  semana: number;
  valor: number;
  futuro: boolean;
  itens: { id: string; descricao: string; categoria: string; valor: number }[];
}

export interface ContaLista {
  id: string;
  nome: string;
  valor: number;
  dias: number;
  pilula: string;
  tom: 'ok' | 'aviso' | 'perigo';
}

export interface LancamentoLista {
  id: string;
  descricao: string;
  categoria: string;
  data: string;
  valor: number;
}

export interface MetaLista {
  id: string;
  nome: string;
  guardado: number;
  alvo: number;
  pct: number;
  falta: number;
}

export interface DividaLista {
  id: string;
  nome: string;
  saldo: number;
  original: number;
  pctPago: number;
}

export interface Painel {
  kpis: Kpi[];
  dias: { data: string; dia: number; despesa: number; receita: number; futuro: boolean }[];
  categorias: CardCategoria[];
  funil: Funil | null;
  calor: DiaCalor[];
  contas: ContaLista[];
  ultimos: LancamentoLista[];
  maiores: LancamentoLista[];
  metas: MetaLista[];
  dividas: DividaLista[];
}

const PILULA: Record<TomCategoria, CardCategoria['pilula']> = { ok: 'ok', aviso: 'atenção', perigo: 'estourou', sem: 'sem limite' };

const soma = (xs: number[]) => xs.reduce((t, n) => t + n, 0);

function deltaDe(atual: number, anterior: number | null): Delta | null {
  if (anterior === null) return null;
  const valor = arred(atual - anterior);
  const pct = Math.abs(anterior) > 0.004 ? (valor / Math.abs(anterior)) * 100 : null;
  const sentido: Sentido = Math.abs(valor) < 0.5 ? 'igual' : valor > 0 ? 'sobe' : 'desce';
  return { valor, pct, sentido };
}

function receitasRegistradas(e: Estado, mes: string): number {
  return arred(soma(receitasDoMes(e, mes).map((r) => r.valor)));
}

function comecou(e: Estado): boolean {
  return e.config.renda > 0
    || e.config.saldoInformado !== undefined
    || e.lancamentos.length > 0
    || e.receitas.length > 0
    || e.gastosFixos.length > 0
    || e.dividas.length > 0
    || e.aportes.length > 0
    || e.metas.length > 0;
}

function topoDaCategoria(itens: Lancamento[]): string | null {
  const mapa = new Map<string, { nome: string; valor: number }>();
  for (const l of itens) {
    const nome = l.descricao.trim();
    if (!nome) continue;
    const chave = nome.toLocaleLowerCase('pt-BR');
    const atual = mapa.get(chave) ?? { nome, valor: 0 };
    atual.valor += l.valor;
    mapa.set(chave, atual);
  }
  const maior = [...mapa.values()].sort((a, b) => b.valor - a.valor)[0];
  return maior?.nome ?? null;
}

function pilulaConta(c: ContaDoMes): { pilula: string; tom: ContaLista['tom'] } {
  if (c.estado === 'atrasada' || c.dias < 0) return { pilula: c.dias === -1 ? 'atrasada 1 dia' : `atrasada ${-c.dias} dias`, tom: 'perigo' };
  if (c.dias === 0) return { pilula: 'vence hoje', tom: 'aviso' };
  if (c.dias === 1) return { pilula: 'amanhã', tom: 'aviso' };
  return { pilula: `em ${c.dias} dias`, tom: 'ok' };
}

function patrimonioAte(e: Estado, mes: string): number {
  return arred(soma(e.aportes.filter((a) => mesDe(a.data) <= mes).map((a) => a.valor)));
}

/** O que o mês mostra no Início. `hoje` é AAAA-MM-DD. */
export function painelVidro(e: Estado, hoje: string): Painel {
  const mes = mesDe(hoje);
  const anterior = somaMes(mes, -1);
  const serie = serieMensal(e, hoje, 6);
  const meses = new Set(serie.map((s) => s.mes));
  const doMes = (m: string) => serie.find((s) => s.mes === m) ?? null;
  const antes = meses.has(anterior) ? doMes(anterior) : null;
  const disp = detalheDisponivel(e, mes, hoje);
  const registrada = receitasRegistradas(e, mes);
  const registradaAntes = antes ? receitasRegistradas(e, anterior) : null;
  const rendaInformada = registrada <= 0 && e.config.renda > 0;
  const despesaAtual = arred((doMes(mes)?.despesas) ?? (totalVariaveis(e, mes)));
  const despesaAntes = antes ? antes.despesas : null;
  const guardado = guardadoNoMes(e, mes);
  const guardadoAntes = antes ? antes.guardado : null;
  const baseReceita = registrada > 0 ? registrada : rendaInformada ? e.config.renda : 0;
  const pctGuardado = baseReceita > 0 ? (guardado / baseReceita) * 100 : null;
  const dividasAbertas = e.dividas.map((d) => ({ d, saldo: saldoAtual(d) }));
  const dividaTotal = e.dividas.length ? arred(soma(dividasAbertas.map((x) => x.saldo))) : null;
  const pagoNo = (m: string) => arred(soma(e.dividas.flatMap((d) => d.pagamentos.filter((p) => mesDe(p.data) === m).map((p) => p.valor))));
  const patrimonio = e.aportes.length || e.metas.length ? patrimonioAte(e, mes) : null;
  const patrimonioAntes = antes && (e.aportes.some((a) => mesDe(a.data) <= anterior) || e.metas.length) ? patrimonioAte(e, anterior) : null;
  const ativo = comecou(e);

  const serieDe = (pegar: (s: MesSerie) => number): Ponto[] => serie.filter((s) => s.temDados || s.mes === mes).map((s) => ({ mes: s.mes, valor: pegar(s) }));

  const saldoValor = disp.modo === 'incompleto' ? null : disp.livre;
  const sobraAntes = antes && (antes.temDados || antes.receitas > 0) ? arred(antes.receitas - antes.despesas) : null;

  const kpis: Kpi[] = [
    {
      id: 'saldo',
      rotulo: 'Saldo do mês',
      valor: saldoValor,
      nota: saldoValor === null ? null : disp.modo === 'saldo' ? 'a partir do saldo que você informou' : disp.temEstimativa ? 'parte ainda é estimada' : 'com o que já está anotado',
      vazio: saldoValor === null ? 'Informe a renda ou o saldo de hoje para eu fechar o mês.' : null,
      delta: saldoValor === null ? null : deltaDe(saldoValor, sobraAntes),
      deltaRotulo: 'vs. mês passado',
      serie: saldoValor === null ? [] : [...serie.filter((s) => s.mes !== mes && (s.temDados || s.receitas > 0)).map((s) => ({ mes: s.mes, valor: arred(s.receitas - s.despesas) })), { mes, valor: saldoValor }],
      bomQuando: 'sobe',
      extra: saldoValor !== null && saldoValor > 0 && disp.porDia > 0 ? `${disp.diasRestantes} dias · o dia a dia sai daqui` : null,
    },
    {
      id: 'receitas',
      rotulo: 'Receitas',
      valor: registrada > 0 ? registrada : rendaInformada ? e.config.renda : null,
      nota: registrada > 0 ? 'registradas neste mês' : rendaInformada ? 'renda informada, ainda não registrada' : null,
      vazio: registrada > 0 || rendaInformada ? null : 'Nenhuma receita neste mês.',
      delta: registrada > 0 && registradaAntes !== null && registradaAntes > 0 ? deltaDe(registrada, registradaAntes) : null,
      deltaRotulo: 'vs. mês passado',
      serie: serie.filter((s) => receitasRegistradas(e, s.mes) > 0).map((s) => ({ mes: s.mes, valor: receitasRegistradas(e, s.mes) })),
      bomQuando: 'sobe',
      extra: null,
    },
    {
      id: 'despesas',
      rotulo: 'Despesas',
      valor: ativo ? despesaAtual : null,
      nota: ativo ? 'dia a dia + contas já pagas' : null,
      vazio: ativo ? null : 'Os gastos do mês aparecem aqui.',
      delta: ativo ? deltaDe(despesaAtual, despesaAntes) : null,
      deltaRotulo: 'vs. mês passado',
      serie: ativo ? serieDe((s) => s.despesas) : [],
      bomQuando: 'desce',
      extra: !ativo || despesaAtual > 0 ? null : 'nada anotado neste mês',
    },
    {
      id: 'guardado',
      rotulo: 'Guardado',
      valor: ativo ? guardado : null,
      nota: ativo ? 'saiu da renda deste mês' : null,
      vazio: ativo ? null : 'O que você separar no mês aparece aqui.',
      delta: ativo ? deltaDe(guardado, guardadoAntes) : null,
      deltaRotulo: 'vs. mês passado',
      serie: ativo ? serieDe((s) => s.guardado) : [],
      bomQuando: 'sobe',
      extra: pctGuardado === null ? null : `${Math.round(pctGuardado)}% da receita`,
    },
    {
      id: 'divida',
      rotulo: 'Dívida total',
      valor: dividaTotal,
      nota: dividaTotal === null ? null : dividaTotal === 0 ? 'tudo quitado' : 'saldo em aberto',
      vazio: 'Nenhuma dívida cadastrada.',
      delta: dividaTotal === null ? null : deltaDe(pagoNo(mes), antes ? pagoNo(anterior) : null),
      deltaRotulo: 'pago vs. mês passado',
      serie: dividaTotal === null ? [] : serie.map((s) => ({ mes: s.mes, valor: pagoNo(s.mes) })),
      bomQuando: 'sobe',
      extra: null,
    },
    {
      id: 'patrimonio',
      rotulo: 'Patrimônio',
      valor: patrimonio,
      nota: patrimonio === null ? null : e.metas.length ? 'reserva + metas' : 'o que está guardado',
      vazio: 'Guarde na reserva ou crie uma meta.',
      delta: patrimonio === null ? null : deltaDe(patrimonio, patrimonioAntes),
      deltaRotulo: 'vs. mês passado',
      serie: patrimonio === null ? [] : serie.map((s) => ({ mes: s.mes, valor: patrimonioAte(e, s.mes) })),
      bomQuando: 'sobe',
      extra: null,
    },
  ];

  const fixos = totalFixos(e, mes);
  const variaveis = totalVariaveis(e, mes);
  const receitaFunil = registrada > 0 ? registrada : rendaInformada ? e.config.renda : 0;
  const funil: Funil | null = receitaFunil <= 0 && fixos <= 0 && variaveis <= 0 ? null : (() => {
    const depoisFixos = arred(receitaFunil - fixos);
    const sobrou = arred(depoisFixos - variaveis);
    const segue1 = receitaFunil > 0 ? (depoisFixos / receitaFunil) * 100 : null;
    const segue2 = depoisFixos > 0 ? (sobrou / depoisFixos) * 100 : null;
    const segue3 = receitaFunil > 0 ? (sobrou / receitaFunil) * 100 : null;
    return {
      passos: [
        { id: 'receita', rotulo: 'Receita', valor: receitaFunil, nota: rendaInformada && registrada <= 0 ? 'informada' : null },
        { id: 'fixos', rotulo: 'Contas fixas', valor: fixos, nota: null },
        { id: 'variaveis', rotulo: 'Variáveis', valor: variaveis, nota: null },
        { id: 'sobrou', rotulo: sobrou < 0 ? 'Faltou' : 'Sobrou', valor: sobrou, nota: null },
      ],
      segue: [segue1, segue2, segue3],
    };
  })();

  const doDia = e.lancamentos.filter((l) => mesDe(l.data) === mes);
  const categorias: CardCategoria[] = linhasDeCategoria(e, mes)
    .filter((l) => l.gasto > 0 || (l.limite ?? 0) > 0)
    .map((l) => {
      const itens = doDia.filter((x) => x.categoria === l.categoria);
      return { categoria: l.categoria, gasto: l.gasto, limite: l.limite, pct: l.pct, tom: l.tom, pilula: PILULA[l.tom], lancamentos: itens.length, topo: topoDaCategoria(itens) };
    });

  const dn = diasNoMes(mes);
  const calor: DiaCalor[] = Array.from({ length: dn }, (_, i) => {
    const dia = i + 1;
    const data = `${mes}-${String(dia).padStart(2, '0')}`;
    const futuro = data > hoje;
    const itens = futuro ? [] : e.lancamentos.filter((l) => l.data === data).map((l) => ({ id: l.id, descricao: l.descricao.trim() || l.categoria, categoria: l.categoria, valor: l.valor }));
    return { data, dia, semana: (new Date(`${data}T12:00:00Z`).getUTCDay() + 6) % 7, valor: futuro ? 0 : arred(soma(itens.map((x) => x.valor))), futuro, itens };
  });

  const dias = calor.map((c) => ({
    data: c.data,
    dia: c.dia,
    despesa: c.valor,
    receita: c.futuro ? 0 : arred(soma(e.receitas.filter((r) => r.data === c.data).map((r) => r.valor))),
    futuro: c.futuro,
  }));

  const contas = contasDoMes(e, mes, hoje)
    .filter((c) => c.estado !== 'paga')
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 5)
    .map((c) => ({ id: c.gasto.id, nome: c.gasto.nome, valor: c.valor, dias: c.dias, ...pilulaConta(c) }));

  const linha = (l: Lancamento): LancamentoLista => ({ id: l.id, descricao: l.descricao.trim() || l.categoria, categoria: l.categoria, data: l.data, valor: l.valor });
  const ultimos = [...e.lancamentos].sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id)).slice(0, 6).map(linha);
  const maiores = doDia.slice().sort((a, b) => b.valor - a.valor || a.descricao.localeCompare(b.descricao)).slice(0, 5).map(linha);
  const metas = e.metas.map((m) => ({ id: m.id, nome: m.nome, alvo: m.alvo, ...progressoMeta(m) }));
  const dividas = e.dividas.map((d) => {
    const saldo = saldoAtual(d);
    const original = d.saldo;
    const pctPago = original > 0 ? Math.max(0, Math.min(100, (1 - saldo / original) * 100)) : saldo === 0 ? 100 : 0;
    return { id: d.id, nome: d.nome, saldo, original, pctPago };
  });

  return { kpis, dias, categorias, funil, calor, contas, ultimos, maiores, metas, dividas };
}
