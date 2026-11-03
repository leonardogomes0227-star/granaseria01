// Sair do atraso, a parte que acha o que ficou pra trás. Separada pra que o "pode gastar" (selectores) use sem importar em círculo.

import { arred, diasEntre, mesDe, somaMes, vencimentoNoMes } from './datas.js';
import { saldoAtual } from './dividas.js';
import type { AtrasosCfg, Estado } from './tipos.js';

/** Multa e juros de atraso mais comuns (a multa de contas de consumo e financiamentos vai até 2%). É estimativa. */
export const MULTA_PCT = 2;
export const MORA_MES_PCT = 1;
export const MESES_OLHAR = 12; // conta fixa: não procura atraso mais antigo que isso

export const cfgAtrasos = (e: Estado): AtrasosCfg => e.atrasos ?? { separado: 0, saidas: {}, ignorados: [] };

export type Fonte = 'conta' | 'divida' | 'manual';
export interface Atraso {
  chave: string; // 'gf:<id>:<mês>', 'dv:<id>:<mês>' ou 'mn:<id>'
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
export const sem = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

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
    out.push({ chave: fonte === 'manual' ? `mn:${refId}` : `${fonte === 'conta' ? 'gf' : 'dv'}:${refId}:${mes}`, fonte, refId, nome, mes, vencimento, valor: arred(valor), dias, encargos: enc, total: arred(valor + enc), nivel: nivelDe(nome, categoria) });
  };

  // o que a pessoa anotou à mão (ex.: começou a usar o app já com a parcela do mês passado atrasada)
  const manuais = cfg.manuais ?? [];
  const anotado = new Set(manuais.filter((m) => m.gastoId).map((m) => `${m.gastoId}:${m.mes}`));
  for (const m of manuais) {
    const g = m.gastoId ? e.gastosFixos.find((x) => x.id === m.gastoId) : undefined;
    if (g?.pagamentos[m.mes]) continue; // deu baixa no Meu mês
    add('manual', m.id, m.nome, m.mes, m.vencimento, m.valor, m.categoria ?? g?.categoria);
  }

  for (const g of e.gastosFixos) {
    // sem data de cadastro (contas antigas): a partir do primeiro mês pago; sem nenhum pagamento, só o mês atual
    const primeiroPago = Object.keys(g.pagamentos).sort()[0];
    const inicio = g.criadaEm ?? (primeiroPago ? `${primeiroPago}-01` : `${atual}-01`);
    let m = mesDe(inicio) < somaMes(atual, -(MESES_OLHAR - 1)) ? somaMes(atual, -(MESES_OLHAR - 1)) : mesDe(inicio);
    for (; m <= atual; m = somaMes(m, 1)) {
      const venc = vencimentoNoMes(m, g.diaVencimento);
      if (venc < inicio || venc >= hoje || g.pagamentos[m] || ign.has(`gf:${g.id}:${m}`) || anotado.has(`${g.id}:${m}`)) continue;
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
