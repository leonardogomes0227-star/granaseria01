// O bot enxerga o app novo (src/gs): contas fixas e dívidas que a pessoa cadastrou no site.
//  "contas" · "dívidas" · "paguei o aluguel" · "paguei 450 no rotativo"
// Tudo aqui é puro: recebe o perfil (texto por chave) e devolve a resposta e o perfil novo.
// Nada de banco nem de navegador, pra testar fácil. A gravação fica com api/whatsapp.ts.

import type { StateSnapshot } from '../account/db.js';
import { migrar } from '../../src/gs/migracao.js';
import { arred, brl, brl0, mesCurto, mesDe, somaMes, mesAtual } from '../../src/gs/datas.js';
import { contasDoMes, faltaPagar, totalFixos } from '../../src/gs/selectores.js';
import { ordenar, paraSim, saldoAtual, simular } from '../../src/gs/dividas.js';
import type { Estado } from '../../src/gs/tipos.js';

export const APP_KEY = 'grana-seria:v1';

export type ComandoApp = { kind: 'contas' } | { kind: 'dividas' } | { kind: 'pagou'; alvo: string; valor: number | null };

const sem = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[!?.,]+$/g, '').replace(/\s+/g, ' ').trim();
const FILLER = new Set(['de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'em', 'o', 'a', 'os', 'as', 'meu', 'minha', 'r$', 'reais', 'real', 'pro', 'pra', 'para', 'um', 'uma']);

/** Primeiro número da frase: "450", "1.500", "1500,50", "R$ 450". */
function achaValor(t: string): { valor: number; resto: string } | null {
  const m = t.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s*(?:reais|real))?/);
  if (!m) return null;
  const valor = Number(m[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return { valor, resto: (t.slice(0, m.index) + ' ' + t.slice((m.index ?? 0) + m[0].length)).replace(/\s+/g, ' ').trim() };
}

export function comandoApp(texto: string): ComandoApp | null {
  const t = sem(texto);
  if (/^(contas|minhas contas|contas fixas|contas do mes|o que vence|o que vence essa semana|o que vence hoje|o que falta pagar|calendario|calendario de contas|o que (eu )?pago primeiro|o que pagar primeiro|quais contas faltam|que contas faltam|o que (eu )?tenho (que|pra) pagar|contas a pagar|contas atrasadas|o que ta atrasado|o que esta atrasado|proximas contas|proximos vencimentos)$/.test(t)) return { kind: 'contas' };
  if (/^(dividas|minhas dividas|quanto devo|quanto eu devo|o que eu devo|situacao das dividas|quando (eu )?fico livre|quando (eu )?saio das dividas|quando (eu )?quito)$/.test(t)) return { kind: 'dividas' };
  const m = t.match(/^(?:paguei|pago|quitei|pagamos)\s+(.+)$/);
  if (!m) return null;
  const v = achaValor(m[1]);
  const resto = (v ? v.resto : m[1]).split(' ').filter((w) => w && !FILLER.has(w)).join(' ');
  if (resto.length < 3) return null; // "paguei 35" sem dizer o quê: continua sendo gasto
  return { kind: 'pagou', alvo: resto, valor: v?.valor ?? null };
}

export function lerApp(perfil: StateSnapshot): Estado | null {
  const bruto = perfil[APP_KEY];
  if (typeof bruto !== 'string') return null;
  try {
    const e = migrar(JSON.parse(bruto));
    return e.gastosFixos.length > 0 || e.dividas.length > 0 ? e : null;
  } catch {
    return null;
  }
}

export const hojeBRT = (agora: Date) => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

const combina = (nome: string, alvo: string) => {
  const n = sem(nome);
  return n.length >= 3 && (n.includes(alvo) || alvo.includes(n) || alvo.split(' ').every((p) => n.includes(p)));
};

export interface RespostaApp {
  reply: string;
  perfil?: StateSnapshot; // quando mudou algo
}

const ICONE = { paga: '✅', atrasada: '🔴', 'vence-logo': '🟡', 'em-dia': '⚪' } as const;
const dia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function listaContas(e: Estado, agora: Date): string {
  const hoje = hojeBRT(agora);
  const mes = mesDe(hoje);
  const cs = contasDoMes(e, mes, hoje);
  if (cs.length === 0) return '📅 Você ainda não cadastrou contas fixas. Cadastre em *Meu mês* no site (mande *painel* pra abrir) e eu passo a te avisar por aqui.';
  const linhas = cs.map((c) => `${ICONE[c.estado]} *${c.gasto.nome}* · ${brl(c.valor)} · ${c.estado === 'paga' ? 'paga' : c.estado === 'atrasada' ? `venceu dia ${dia(c.vencimento)}` : `vence dia ${dia(c.vencimento)}`}`);
  const falta = faltaPagar(e, mes);
  return [`📅 *Contas de ${mesCurto(mes)}*`, ...linhas, '', falta > 0 ? `Falta pagar *${brl(falta)}* de ${brl(totalFixos(e, mes))}.` : '🎉 Tudo pago este mês.', falta > 0 ? 'Pagou uma? Mande, por exemplo, *paguei o aluguel*.' : ''].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n').trim();
}

function listaDividas(e: Estado): string {
  const abertas = e.dividas.filter((d) => saldoAtual(d) > 0);
  if (abertas.length === 0) return e.dividas.length ? '🎉 Você não tem nenhuma dívida em aberto. Quando surgir uma, cadastre no site em *Quitar dívidas*.' : '💳 Você ainda não cadastrou dívidas. Cadastre no site em *Quitar dívidas* (mande *painel* pra abrir) e eu acompanho por aqui.';
  const sim = paraSim(e.dividas);
  const plano = e.planoDividas;
  const res = plano ? simular(sim, plano.pagamentoMensal, plano.estrategia) : null;
  const ord = ordenar(sim, plano?.estrategia ?? 'maior-juro').map((d) => d.id);
  const linhas = [...abertas].sort((a, b) => ord.indexOf(a.id) - ord.indexOf(b.id)).map((d, i) => {
    const q = res?.quitaEm[d.id];
    return `${i + 1}ª *${d.nome}* · ${brl(saldoAtual(d))}${d.jurosMensal > 0 ? ` · ${String(d.jurosMensal).replace('.', ',')}% ao mês` : ''}${q ? ` · quita ${mesCurto(somaMes(mesAtual(), q))}` : ''}`;
  });
  const total = abertas.reduce((t, d) => t + saldoAtual(d), 0);
  return [`💳 *Suas dívidas:* ${brl(total)} no total`, ...linhas, '', res?.quita && !res.insuficiente && res.dataFinal ? `Pelo seu plano (${brl0(plano!.pagamentoMensal)} por mês), você fica livre em *${mesCurto(res.dataFinal)}*.` : res?.insuficiente ? '⚠️ O valor do plano não cobre os juros: a dívida está crescendo. Abra o site em *Quitar dívidas* pra ajustar.' : '', 'Pagou? Mande, por exemplo, *paguei 450 no rotativo*.'].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n').trim();
}

function comPagamentoDeConta(e: Estado, id: string, mes: string, valor: number, pagoEm: string): Estado {
  return { ...e, gastosFixos: e.gastosFixos.map((g) => (g.id === id ? { ...g, pagamentos: { ...g.pagamentos, [mes]: { valorPago: arred(valor), pagoEm } } } : g)) };
}
function comPagamentoDeDivida(e: Estado, id: string, valor: number, data: string): Estado {
  return { ...e, dividas: e.dividas.map((d) => (d.id === id ? { ...d, pagamentos: [...d.pagamentos, { data, valor: arred(valor) }] } : d)) };
}
const guardar = (perfil: StateSnapshot, e: Estado): StateSnapshot => ({ ...perfil, [APP_KEY]: JSON.stringify(e) });

/** null = não é comigo (a mensagem segue o caminho de sempre, ex.: "paguei 35 no mercado" é um gasto). */
export function rodarApp(cmd: ComandoApp, perfil: StateSnapshot, agora: Date): RespostaApp | null {
  const e = lerApp(perfil);
  if (!e) return cmd.kind === 'contas' ? { reply: listaContas(migrar(null), agora) } : null;
  if (cmd.kind === 'contas') return { reply: listaContas(e, agora) };
  if (cmd.kind === 'dividas') return { reply: listaDividas(e) };

  const alvo = sem(cmd.alvo);
  const hoje = hojeBRT(agora);
  const mes = mesDe(hoje);
  const contas = e.gastosFixos.filter((g) => combina(g.nome, alvo));
  const dividas = e.dividas.filter((d) => saldoAtual(d) > 0 && combina(d.nome, alvo));
  // "paguei 450 no rotativo": com valor, uma dívida ganha de uma conta; sem valor, a conta ganha
  const querDivida = cmd.valor !== null && dividas.length > 0;
  if (contas.length + dividas.length === 0) return null;

  if (!querDivida && contas.length > 0) {
    if (contas.length > 1) return { reply: `Achei mais de uma conta com esse nome: ${contas.map((c) => `*${c.nome}*`).join(', ')}. Mande o nome inteiro, por exemplo *paguei ${contas[0].nome.toLowerCase()}*.` };
    const c = contas[0];
    const ja = c.pagamentos[mes];
    if (ja) return { reply: `✅ *${c.nome}* já estava paga este mês (${brl(ja.valorPago)}). Se foi engano, desfaça no site em *Meu mês*.` };
    const valor = cmd.valor ?? contas[0].valor;
    const novo = comPagamentoDeConta(e, c.id, mes, valor, hoje);
    const falta = faltaPagar(novo, mes);
    return { reply: `✅ *${c.nome}* marcada como paga (${brl(valor)}).\n${falta > 0 ? `Ainda falta pagar ${brl(falta)} em contas este mês.` : '🎉 Todas as contas do mês estão pagas.'}`, perfil: guardar(perfil, novo) };
  }

  const alvoDividas = dividas;
  if (alvoDividas.length > 1) return { reply: `Achei mais de uma dívida com esse nome: ${alvoDividas.map((d) => `*${d.nome}*`).join(', ')}. Mande o nome inteiro, por exemplo *paguei ${cmd.valor ?? 100} no ${alvoDividas[0].nome.toLowerCase()}*.` };
  const d = alvoDividas[0];
  if (cmd.valor === null) return { reply: `Quanto você pagou em *${d.nome}*? Mande, por exemplo, *paguei 450 no ${d.nome.toLowerCase()}*.` };
  const saldo = saldoAtual(d);
  const valor = Math.min(cmd.valor, saldo);
  const novo = comPagamentoDeDivida(e, d.id, valor, hoje);
  const resta = saldoAtual(novo.dividas.find((x) => x.id === d.id)!);
  const aviso = cmd.valor > saldo ? ` (o saldo era ${brl(saldo)}, anotei só isso)` : '';
  if (resta <= 0) {
    const proxima = ordenar(paraSim(novo.dividas), novo.planoDividas?.estrategia ?? 'maior-juro')[0];
    return { reply: `🎉 *${d.nome}* quitada!${aviso} Foram ${brl(d.saldo)} a menos na sua lista.\n${proxima ? `Agora o valor dela vai pra *${proxima.nome}* (${brl(proxima.saldo)}).` : 'Foi a última dívida. Agora guarde o mesmo valor todo mês, começando pela reserva de emergência.'}`, perfil: guardar(perfil, novo) };
  }
  return { reply: `✅ Anotei ${brl(valor)} em *${d.nome}*.${aviso}\nFalta ${brl(resta)}.`, perfil: guardar(perfil, novo) };
}
