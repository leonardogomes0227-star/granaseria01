// Sair do atraso: contas e parcelas que ficaram pra trás, a ordem de pagar e o plano mês a mês. Pura, com teste.
// Quando uma parcela atrasa, o mês seguinte vem com duas. Aqui a gente acha o que ficou pra trás,
// estima a multa e os juros, decide o que pagar primeiro e mostra quando tudo fica em dia com o que sobra por mês.

import { arred, brl, diasEntre, mesDe, somaMes, vencimentoNoMes } from './datas.js';
import { gastoMensalMedio } from './selectores.js';
import { saldoAtual } from './dividas.js';
import type { AtrasosCfg, Estado } from './tipos.js';

/** Multa e juros de atraso mais comuns (a multa de contas de consumo e financiamentos vai até 2%). É estimativa. */
export const MULTA_PCT = 2;
export const MORA_MES_PCT = 1;
export const MESES_OLHAR = 12; // conta fixa: não procura atraso mais antigo que isso
export const LIMITE_PLANO = 24; // meses

export const cfgAtrasos = (e: Estado): AtrasosCfg => e.atrasos ?? { separado: 0, saidas: {}, ignorados: [] };

export type Fonte = 'conta' | 'divida';
export interface Atraso {
  chave: string; // 'gf:<id>:<mês>' ou 'dv:<id>:<mês>'
  fonte: Fonte;
  refId: string;
  nome: string;
  mes: string; // mês da conta/parcela que ficou pra trás
  vencimento: string;
  valor: number; // o que faltou pagar (sem multa)
  dias: number; // dias de atraso
  encargos: number; // multa + juros estimados até hoje
  total: number;
  nivel: number; // 1 = pagar primeiro
}

export const encargos = (valor: number, dias: number) => (dias <= 0 ? 0 : arred(valor * (MULTA_PCT / 100 + (MORA_MES_PCT / 100) * (dias / 30))));

/* ---------- o que pagar primeiro ---------- */
export const NIVEIS: Record<number, { nome: string; motivo: string }> = {
  1: { nome: 'Moradia', motivo: 'É onde você mora. Vem primeiro.' },
  2: { nome: 'Luz, água e gás', motivo: 'Pode ser cortada. Entra assim que couber.' },
  3: { nome: 'Financiamento', motivo: 'Atraso longo pode fazer você perder o bem.' },
  4: { nome: 'Outras contas', motivo: 'Quanto mais atrasa, mais multa e mais risco de sujar o nome.' },
  5: { nome: 'Cartão e empréstimo', motivo: 'Dá pra negociar, e costuma ter desconto pra pagar o atrasado.' },
};
const sem = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Pelo nome e pela categoria: moradia, luz/água, financiamento de bem, outras, cartão/empréstimo. */
export function nivelDe(nome: string, categoria?: string): number {
  const n = sem(nome);
  if (/alugu|\bcasa\b|apart|\bapto\b|imovel|habitac|condomin|moradia/.test(n) || categoria === 'Aluguel') return 1;
  if (/\bluz\b|energia|\bagua\b|\bgas\b|esgoto|saneamento/.test(n) || categoria === 'Luz' || categoria === 'Água') return 2;
  if (/cartao|emprestimo|crediario|cheque|\bloja\b/.test(n) || categoria === 'Cartão') return 5;
  if (/\bmoto\b|carro|veicul|caminhao|financ|consorcio/.test(n) || categoria === 'Carro' || categoria === 'Financiamento') return 3;
  return 4;
}

/* ---------- o que ficou pra trás ---------- */
/** Contas fixas sem baixa e parcelas de dívida sem pagamento, com o vencimento já passado. Na ordem de pagar. */
export function atrasosAbertos(e: Estado, hoje: string): Atraso[] {
  const cfg = cfgAtrasos(e);
  const ign = new Set(cfg.ignorados);
  const atual = mesDe(hoje);
  const out: Atraso[] = [];
  const add = (fonte: Fonte, refId: string, nome: string, mes: string, vencimento: string, valor: number, categoria?: string) => {
    if (valor <= 0.005) return;
    const dias = diasEntre(vencimento, hoje);
    const enc = encargos(valor, dias);
    out.push({ chave: `${fonte === 'conta' ? 'gf' : 'dv'}:${refId}:${mes}`, fonte, refId, nome, mes, vencimento, valor: arred(valor), dias, encargos: enc, total: arred(valor + enc), nivel: nivelDe(nome, categoria) });
  };

  for (const g of e.gastosFixos) {
    // sem data de cadastro (contas antigas): a partir do primeiro mês pago; sem nenhum pagamento, só o mês atual
    const primeiroPago = Object.keys(g.pagamentos).sort()[0];
    const inicio = g.criadaEm ?? (primeiroPago ? `${primeiroPago}-01` : `${atual}-01`);
    let m = mesDe(inicio) < somaMes(atual, -(MESES_OLHAR - 1)) ? somaMes(atual, -(MESES_OLHAR - 1)) : mesDe(inicio);
    for (; m <= atual; m = somaMes(m, 1)) {
      const venc = vencimentoNoMes(m, g.diaVencimento);
      if (venc < inicio || venc >= hoje || g.pagamentos[m] || ign.has(`gf:${g.id}:${m}`)) continue;
      add('conta', g.id, g.nome, m, venc, g.valor, g.categoria);
    }
  }

  for (const d of e.dividas) {
    if (!d.venceDia || !(d.parcelaMinima > 0) || !d.cadastradaEm || d.tipo === 'rotativa') continue;
    let restante = saldoAtual(d);
    if (restante <= 0.005) continue;
    const inicio = d.cadastradaEm;
    const devidos: { m: string; venc: string }[] = [];
    for (let m = mesDe(inicio), i = 0; m <= atual && i < 600; m = somaMes(m, 1), i++) {
      const venc = vencimentoNoMes(m, d.venceDia);
      if (venc >= inicio && venc < hoje) devidos.push({ m, venc });
    }
    if (d.parcelasRestantes) devidos.splice(d.parcelasRestantes);
    // o que foi pago cobre primeiro a parcela mais antiga
    let pago = d.pagamentos.filter((p) => p.data >= inicio).reduce((t, p) => t + p.valor, 0);
    for (const { m, venc } of devidos) {
      if (ign.has(`dv:${d.id}:${m}`)) continue;
      const cobre = Math.min(pago, d.parcelaMinima);
      pago -= cobre;
      const falta = Math.min(restante, d.parcelaMinima - cobre);
      restante -= Math.max(0, falta);
      add('divida', d.id, d.nome, m, venc, falta);
    }
  }

  return out.sort((a, b) => a.nivel - b.nivel || a.vencimento.localeCompare(b.vencimento) || a.nome.localeCompare(b.nome));
}

/* ---------- quanto sobra por mês ---------- */
export interface Folga {
  renda: number;
  gastos: number; // contas fixas + média do dia a dia
  parcelas: number; // parcelas das dívidas que não estão nas contas fixas
  folga: number; // pode ser negativa
}
export function folgaMensal(e: Estado, mes: string): Folga {
  const fixos = new Set(e.gastosFixos.map((g) => sem(g.nome.trim())));
  const parcelas = arred(e.dividas.filter((d) => !fixos.has(sem(d.nome.trim()))).reduce((t, d) => t + Math.min(d.parcelaMinima, saldoAtual(d)), 0));
  const gastos = gastoMensalMedio(e, mes);
  return { renda: e.config.renda, gastos, parcelas, folga: arred(e.config.renda - gastos - parcelas) };
}

/* ---------- o plano mês a mês ---------- */
export interface Pagar {
  chave: string;
  nome: string;
  mesRef: string;
  valor: number; // com a multa e os juros estimados no mês do pagamento
}
export interface PassoPlano {
  mes: string;
  entra: number; // o que entra no caixa do atraso neste mês
  pagar: Pagar[];
  guardado: number; // o que fica separado no fim do mês
}
export interface PlanoAtraso {
  passos: PassoPlano[];
  emDiaEm: string | null; // mês em que tudo fica em dia (null = não fica em LIMITE_PLANO meses)
  meses: number;
}

/** Cada mês entra o que a pessoa separa; paga na ordem (moradia, luz e água, financiamento, o resto).
 *  Luz, água e moradia entram assim que couberem; as outras esperam a vez. Parcelas da mesma conta, da mais antiga pra mais nova.
 *  No mês atual, a conta deste mês que atrasou já está no orçamento: o valor dela entra no caixa. */
export function planoDeRecuperacao(atrasos: Atraso[], p: { porMes: number; separado: number; jaSaiuNoMes: number; hoje: string }): PlanoAtraso {
  const atual = mesDe(p.hoje);
  const fila = [...atrasos];
  const passos: PassoPlano[] = [];
  let caixa = Math.max(0, p.separado);
  for (let k = 0; k < LIMITE_PLANO && fila.length > 0; k++) {
    const mes = somaMes(atual, k);
    const doMes = k === 0 ? fila.filter((a) => a.mes === atual).reduce((t, a) => t + a.valor, 0) : 0;
    const entra = arred((k === 0 ? Math.max(0, p.porMes - p.jaSaiuNoMes) : Math.max(0, p.porMes)) + doMes);
    caixa = arred(caixa + entra);
    const pagar: Pagar[] = [];
    const travadas = new Set<string>();
    let travou = false;
    for (const a of [...fila]) {
      if (travadas.has(a.refId) || (travou && a.nivel > 2)) continue;
      const valor = arred(a.valor + encargos(a.valor, a.dias + 30 * k));
      if (caixa + 0.005 >= valor) {
        caixa = arred(caixa - valor);
        pagar.push({ chave: a.chave, nome: a.nome, mesRef: a.mes, valor });
        fila.splice(fila.indexOf(a), 1);
      } else {
        travadas.add(a.refId);
        travou = true;
      }
    }
    passos.push({ mes, entra, pagar, guardado: caixa });
  }
  const emDiaEm = fila.length === 0 ? (passos.length ? passos[passos.length - 1].mes : atual) : null;
  return { passos, emDiaEm, meses: emDiaEm ? passos.length : LIMITE_PLANO };
}

/* ---------- tudo junto, pra tela, pro Início e pras ferramentas ---------- */
export interface SituacaoAtrasos {
  atrasos: Atraso[];
  anteriores: Atraso[]; // de meses anteriores (a bola de neve de verdade)
  total: number; // com multa e juros estimados
  folga: Folga;
  porMes: number;
  porMesSugerido: number;
  separado: number;
  saiuNoMes: number;
  plano: PlanoAtraso;
}
export function situacaoAtrasos(e: Estado, hoje: string): SituacaoAtrasos {
  const mes = mesDe(hoje);
  const cfg = cfgAtrasos(e);
  const atrasos = atrasosAbertos(e, hoje);
  const folga = folgaMensal(e, mes);
  const porMesSugerido = Math.max(0, Math.floor(folga.folga / 10) * 10);
  const porMes = cfg.porMes ?? porMesSugerido;
  const saiuNoMes = Math.max(0, cfg.saidas[mes] ?? 0);
  return {
    atrasos,
    anteriores: atrasos.filter((a) => a.mes < mes),
    total: arred(atrasos.reduce((t, a) => t + a.total, 0)),
    folga,
    porMes,
    porMesSugerido,
    separado: cfg.separado,
    saiuNoMes,
    plano: planoDeRecuperacao(atrasos, { porMes, separado: cfg.separado, jaSaiuNoMes: saiuNoMes, hoje }),
  };
}

/** Pagar um atraso: o que vem do dinheiro separado e o que sai do mês. A conta deste mês é orçamento normal. */
export function deOndeSai(valor: number, separado: number, mesDoAtraso: string, mesAtual: string): { doSeparado: number; doMes: number } {
  if (mesDoAtraso >= mesAtual) return { doSeparado: 0, doMes: 0 };
  const doSeparado = arred(Math.min(Math.max(0, separado), valor));
  return { doSeparado, doMes: arred(valor - doSeparado) };
}

/** Mensagem pronta pra quem você deve: pedir pra jogar a parcela pro fim, tirar a multa ou dividir o atrasado. */
export type PedidoAtraso = 'fim' | 'dividir' | 'multa';
export const PEDIDOS_ATRASO: { id: PedidoAtraso; nome: string }[] = [
  { id: 'fim', nome: 'Jogar pro fim do contrato' },
  { id: 'dividir', nome: 'Dividir o atrasado' },
  { id: 'multa', nome: 'Tirar a multa' },
];
export function mensagemAtraso(p: { nome?: string; credor: string; valor: number; meses: number; pedido: PedidoAtraso; porMes?: number }): string {
  const f = brl;
  const quem = p.nome?.trim() ? ` Meu nome é ${p.nome.trim()}.` : '';
  const qtas = p.meses > 1 ? `${p.meses} parcelas atrasadas` : 'uma parcela atrasada';
  const base = `Olá, tudo bem?${quem} Estou com ${qtas} de ${p.credor} (${f(p.valor)}) e quero colocar em dia.`;
  if (p.pedido === 'fim') return `${base} Consigo pagar as próximas parcelas normalmente. Vocês podem passar a parcela atrasada pro final do contrato? Podem me mandar a proposta por escrito? Obrigado.`;
  if (p.pedido === 'dividir') return `${base} Não consigo pagar tudo de uma vez, mas consigo pagar mais ${f(p.porMes ?? 0)} por mês, junto com a parcela normal. Podem dividir o valor atrasado assim? Podem me mandar a proposta por escrito? Obrigado.`;
  return `${base} Consigo pagar o valor atrasado agora. Vocês podem tirar a multa e os juros de atraso? Podem me mandar o boleto atualizado por escrito? Obrigado.`;
}
