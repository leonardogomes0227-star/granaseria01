// O Midas agindo, não só respondendo: "mercado 35", "uber 18,50, almoço 30", "recebi 3000 de salário" viram lançamentos
// de verdade, sempre com "Desfazer". Usa o mesmo entendimento de frases do assistente do WhatsApp (sem IA, sem rede).

import { parseMessage } from '../../server/whatsapp/parse';
import { getEstado } from './store';
import { removerLancamento, removerReceita, restaurarLancamento, restaurarReceita, salvarLancamento, salvarReceita } from './acoes';
import { brl, somaDias } from './datas';
import { comentarioDoGasto } from './midasDicas';
import type { Lancamento, Receita } from './tipos';

export interface AcaoDoMidas {
  texto: string;
  links?: { titulo: string; rota: string }[];
  desfazer?: () => void;
}

const LIMITE = 1_000_000;

/** Entende a frase e faz a ação. Devolve null quando não é um comando (aí o Midas só responde a pergunta). */
export function agirPorFrase(frase: string, hoje: string): AcaoDoMidas | null {
  const cmd = parseMessage(frase.trim());

  if (cmd.kind === 'expense' || cmd.kind === 'multi') {
    const itens = cmd.kind === 'expense' ? [{ amount: cmd.amount, category: cmd.category, description: cmd.description, method: cmd.method }] : cmd.items;
    const data = somaDias(hoje, -Math.min(30, Math.max(0, cmd.daysAgo ?? 0)));
    const feitos: Lancamento[] = [];
    for (const i of itens) {
      if (!(i.amount > 0) || i.amount > LIMITE) continue;
      const antes = new Set(getEstado().lancamentos.map((l) => l.id));
      if (!salvarLancamento({ descricao: i.description, valor: i.amount, data, categoria: i.category, forma: i.method })) continue;
      const novo = getEstado().lancamentos.find((l) => !antes.has(l.id));
      if (novo) feitos.push(novo);
    }
    if (feitos.length === 0) return { texto: 'Não consegui anotar esse. Escreva assim: "mercado 35" ou "uber 18,50".' };
    const total = feitos.reduce((t, l) => t + l.valor, 0);
    const resumo = feitos.length === 1 ? `Anotei ${brl(total)} em ${feitos[0].categoria}${feitos[0].descricao && feitos[0].descricao !== feitos[0].categoria ? ` (${feitos[0].descricao})` : ''}` : `Anotei ${feitos.length} gastos, ${brl(total)} no total`;
    const quando = data === hoje ? '' : ` em ${data.slice(8, 10)}/${data.slice(5, 7)}`;
    const comentario = comentarioDoGasto(getEstado(), hoje, feitos[feitos.length - 1]);
    return {
      texto: `${resumo}${quando}. ${comentario ?? ''}`.trim(),
      links: [{ titulo: 'Ver lançamentos', rota: '/lancamentos' }],
      desfazer: () => feitos.forEach((l) => removerLancamento(l.id)),
    };
  }

  if (cmd.kind === 'income') {
    if (!(cmd.amount > 0) || cmd.amount > LIMITE) return null;
    const tipo: Receita['tipo'] = /sal[aá]rio/i.test(`${cmd.source} ${cmd.description}`) ? 'salario' : 'extra';
    const antes = new Set(getEstado().receitas.map((r) => r.id));
    if (!salvarReceita({ descricao: cmd.description, valor: cmd.amount, data: hoje, tipo })) return { texto: 'Não consegui anotar essa entrada. Tente: "recebi 3000 de salário".' };
    const nova = getEstado().receitas.find((r) => !antes.has(r.id));
    return {
      texto: `Anotei a entrada de ${brl(cmd.amount)}${tipo === 'salario' ? ' (salário)' : ''}. O "quanto posso gastar" já considera isso.`,
      links: [{ titulo: 'Ver lançamentos', rota: '/lancamentos' }],
      desfazer: nova ? () => removerReceita(nova.id) : undefined,
    };
  }

  if (cmd.kind === 'undo') {
    const ultimo = [...getEstado().lancamentos].pop();
    if (!ultimo) return { texto: 'Não tem nenhum gasto para desfazer.' };
    removerLancamento(ultimo.id);
    return { texto: `Desfiz o último gasto: ${brl(ultimo.valor)} em ${ultimo.categoria}.`, desfazer: () => restaurarLancamento(ultimo) };
  }

  return null;
}

/** Só para os testes e para o botão "Desfazer" de entradas: devolve a receita apagada. */
export const refazerReceita = restaurarReceita;
