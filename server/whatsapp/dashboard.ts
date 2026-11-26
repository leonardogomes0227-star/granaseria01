// A "dashboardzinha" do WhatsApp: entrou, saiu, para onde foi (com barras), o que mais pesou e o que dá para cortar.
// Função pura: recebe os registros do mês e devolve o texto. Os registros são os mesmos do site (uma tabela só),
// então o que a pessoa anota aqui ou no site aparece igual nos dois.

import type { Expense, Income } from './db.js';
import { categoryEmoji } from './parse.js';
import { siteLink } from './site.js';
import { ehGastoDeCorte } from '../../src/gs/gastosDeCorte.js';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl0 = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const soma = (rows: { amount: number }[]) => rows.reduce((t, r) => t + r.amount, 0);
const pct = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

/** Barra de 10 quadradinhos. Pelo menos 1 quando há gasto, para a categoria pequena não sumir. */
export function barra(parte: number, total: number): string {
  const cheios = parte > 0 ? Math.max(1, Math.min(10, Math.round((parte / Math.max(total, 1)) * 10))) : 0;
  return '▓'.repeat(cheios) + '░'.repeat(10 - cheios);
}

export { ehGastoDeCorte };

function agrupar(rows: Expense[], chave: (r: Expense) => string): { nome: string; total: number; vezes: number }[] {
  const m = new Map<string, { total: number; vezes: number }>();
  for (const r of rows) {
    const k = chave(r);
    const a = m.get(k) ?? { total: 0, vezes: 0 };
    a.total += r.amount; a.vezes += 1; m.set(k, a);
  }
  return [...m.entries()].map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.total - a.total);
}

const maiuscula = (t: string) => t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1);

export interface EntradaDashboard { expenses: Expense[]; incomes: Income[]; now: Date }

/** `null` quando não há nenhum gasto (o bot responde com a dica de como anotar). */
export function dashboardDoMes({ expenses, incomes, now }: EntradaDashboard): string | null {
  if (expenses.length === 0) return null;
  const local = new Date(now.getTime() - 3 * 3_600_000); // Brasília
  const saiu = soma(expenses);
  const entrou = soma(incomes);
  const linhas: string[] = [`📊 *Seu mês · ${MESES[local.getUTCMonth()]}*`, ''];

  linhas.push(`📥 Entrou: ${entrou > 0 ? brl(entrou) : '_ainda não anotou_'}`, `📤 Saiu: ${brl(saiu)}`);
  if (entrou > 0) {
    const sobra = entrou - saiu;
    linhas.push(sobra >= 0 ? `🟢 Sobrou: ${brl(sobra)}` : `🔴 Faltou: ${brl(-sobra)} (saiu mais do que entrou)`);
  }

  // para onde foi
  const cats = agrupar(expenses, (r) => r.category);
  linhas.push('', '*Para onde foi*');
  for (const c of cats.slice(0, 6)) linhas.push(`${categoryEmoji(c.nome)} ${c.nome}\n${barra(c.total, saiu)} ${pct(c.total, saiu)}% · ${brl0(c.total)}`);
  if (cats.length > 6) {
    const resto = cats.slice(6);
    linhas.push(`➕ Outras ${resto.length}: ${brl0(soma(resto.map((c) => ({ amount: c.total }))))}`);
  }

  // o que mais pesou (por descrição: "mercado", "uber"…)
  const itens = agrupar(expenses, (r) => (r.description || r.category).trim().toLocaleLowerCase('pt-BR').slice(0, 30)).filter((i) => i.vezes >= 1).slice(0, 3);
  if (itens.length) {
    linhas.push('', '*O que mais pesou*');
    for (const [i, it] of itens.entries()) linhas.push(`${['🥇', '🥈', '🥉'][i]} ${maiuscula(it.nome)}: ${brl0(it.total)}${it.vezes > 1 ? ` (${it.vezes}x)` : ''}`);
  }

  // o que dá para cortar, sem julgar
  const corte = expenses.filter(ehGastoDeCorte);
  const totalCorte = soma(corte);
  if (totalCorte > 0) {
    const top = agrupar(corte, (r) => (r.description || r.category).trim().toLocaleLowerCase('pt-BR').slice(0, 30)).slice(0, 3);
    linhas.push('', `🎯 *Dá pra segurar*: ${brl0(totalCorte)} (${pct(totalCorte, saiu)}% do que saiu)`, `_${top.map((t) => `${t.nome} ${brl0(t.total)}`).join(' · ')}_`);
  }

  // como pagou
  if (expenses.some((r) => r.payment_method)) {
    const formas = agrupar(expenses.filter((r) => r.payment_method), (r) => r.payment_method as string);
    linhas.push('', `💳 *Como pagou*: ${formas.slice(0, 3).map((f) => `${f.nome} ${brl0(f.total)}`).join(' · ')}`);
  }

  // uma dica só, a que mais ajuda agora
  const topo = cats[0];
  let dica: string;
  if (entrou > 0 && saiu > entrou) dica = `Antes da próxima compra, veja o que cabe: ${siteLink('compra')}`;
  else if (totalCorte > 0 && pct(totalCorte, saiu) >= 20) dica = `Se segurar metade disso, sobram uns ${brl0(totalCorte / 2)} no mês.`;
  else if (topo && pct(topo.total, saiu) >= 45 && topo.nome !== 'Moradia') dica = `${topo.nome} é ${pct(topo.total, saiu)}% do que saiu. Vale olhar com calma.`;
  else dica = 'Continue anotando: quanto mais completo, mais certo fica o seu mês.';
  linhas.push('', `💡 ${dica}`, '', `👉 Painel completo, igual a este: ${siteLink('painel')}`);
  return linhas.join('\n');
}
