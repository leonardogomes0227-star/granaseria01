// Sair do atraso: contas e parcelas que ficaram pra trás, a ordem de pagar e o plano mês a mês. Pura, com teste.
// Quando uma parcela atrasa, o mês seguinte vem com duas. Aqui a gente acha o que ficou pra trás,
// estima a multa e os juros, decide o que pagar primeiro e mostra quando tudo fica em dia com o que sobra por mês.

import { arred, brl, mesDe, somaMes } from './datas.js';
import { folgaMensal, type Folga } from './selectores.js';
import { atrasosAbertos, cfgAtrasos, encargos, type Atraso } from './atrasosBase.js';
import type { Estado } from './tipos.js';

export * from './atrasosBase.js';
export { folgaMensal, type Folga } from './selectores.js';

export const LIMITE_PLANO = 24; // meses
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
  confirmar: boolean; // sem gastos do dia a dia anotados: pergunta quanto sobra de verdade antes de montar o plano
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
    confirmar: folga.semHistorico && cfg.porMes === undefined,
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

/** Os meses que dá pra anotar como atrasados: os N meses antes deste, do mais antigo pro mais novo. */
export const mesesAtras = (hoje: string, n: number) => Array.from({ length: Math.max(0, n) }, (_, i) => somaMes(mesDe(hoje), -(n - i)));
