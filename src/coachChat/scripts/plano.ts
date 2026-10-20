// Roteiro "Montar plano": no máximo 7 perguntas (a da dívida abre duas, só pra quem tem).
// Meta da reserva, aporte, limite e previsão: src/coachChat/plan.ts.

import type { Script } from '../engine';
import { brl } from '../engine';
import { buildPlan, freeMoney, suggestedSave, whenText, type PlanAnswers } from '../plan';
import { currentMonth } from '../months';

const MAX = 10_000_000;

/** As respostas do roteiro viram as entradas do cálculo. */
export function toAnswers(a: Record<string, number | string>): PlanAnswers {
  const temDivida = a.divida === 'sim';
  return {
    renda: Number(a.renda),
    fixos: Number(a.fixos),
    sobra: Number(a.sobra),
    temDivida,
    dividaTotal: temDivida ? Number(a.dividaTotal) : 0,
    dividaParcela: temDivida ? Number(a.dividaParcela) : 0,
    guardado: Number(a.guardado),
    aporte: a.aporte === 'sug' ? suggestedSave(Number(a.renda)) : Number(a.aporteValor ?? 0),
  };
}

export const PLANO_SCRIPT: Script = {
  id: 'plano',
  first: 'renda',
  steps: [
    {
      id: 'renda',
      say: {
        arkad: ['Que bom ter você aqui. Vamos montar o seu plano com calma, em poucas perguntas.', 'Primeiro: quanto entra por mês, em média, já descontando o que é tirado do seu pagamento?'],
        nomasir: ['Vamos direto. São poucas perguntas e eu monto o plano.', 'Quanto você recebe por mês, em média?'],
        sharru: ['Ótimo, vamos construir o seu caminho. Poucas perguntas e você sai com um plano.', 'Pra começar: quanto entra por mês, em média?'],
      },
      ask: { kind: 'money', min: 1, max: MAX, placeholder: 'R$ 0,00' },
      next: () => 'fixos',
    },
    {
      id: 'fixos',
      say: {
        arkad: ['Agora os gastos que se repetem todo mês: aluguel, contas, mercado, transporte.', 'Quanto isso dá, mais ou menos?'],
        nomasir: ['Gastos fixos do mês: moradia, contas, mercado, transporte. Quanto dá?'],
        sharru: ['Agora o que você precisa pagar todo mês pra viver: moradia, contas, mercado, transporte. Quanto soma?'],
      },
      ask: { kind: 'money', min: 1, max: MAX, placeholder: 'R$ 0,00' },
      validate: (v, a) => (Number(v) > Number(a.renda) * 3 ? 'Esse valor está bem acima da sua renda. Confere e digita de novo.' : null),
      next: () => 'sobra',
    },
    {
      id: 'sobra',
      say: {
        arkad: ['E no fim do mês, costuma sobrar quanto? Pode ser zero, sem problema.'],
        nomasir: ['No fim do mês, quanto costuma sobrar? Se não sobra nada, digita zero.'],
        sharru: ['Depois de pagar tudo, quanto costuma sobrar no fim do mês? Zero também vale.'],
      },
      ask: { kind: 'money', min: 0, max: MAX, placeholder: 'R$ 0,00' },
      next: () => 'divida',
    },
    {
      id: 'divida',
      say: {
        arkad: ['Você tem alguma dívida hoje? Cartão, empréstimo, financiamento…'],
        nomasir: ['Tem dívida? Cartão, empréstimo, financiamento…'],
        sharru: ['Tem alguma dívida hoje? Isso muda a ordem do que fazemos primeiro.'],
      },
      ask: {
        kind: 'buttons',
        options: [
          { value: 'sim', label: 'Tenho' },
          { value: 'nao', label: 'Não tenho' },
        ],
      },
      next: (v) => (v === 'sim' ? 'dividaTotal' : 'guardado'),
    },
    {
      id: 'dividaTotal',
      say: {
        arkad: ['Entendo. Vamos cuidar disso primeiro, uma coisa de cada vez.', 'Somando todas, quanto você deve hoje?'],
        nomasir: ['Certo. Dívida vem antes de investir.', 'Somando tudo, quanto você deve hoje?'],
        sharru: ['Ok. Quitar dívida é o melhor investimento que existe, porque os juros pesam mais que qualquer rendimento.', 'Somando tudo, quanto você deve hoje?'],
      },
      ask: { kind: 'money', min: 1, max: MAX, placeholder: 'R$ 0,00' },
      next: () => 'dividaParcela',
    },
    {
      id: 'dividaParcela',
      say: {
        arkad: ['E por mês, quanto você paga de parcela dessas dívidas?'],
        nomasir: ['Quanto você paga por mês dessas dívidas?'],
        sharru: ['E quanto você paga por mês dessas dívidas, somando as parcelas?'],
      },
      ask: { kind: 'money', min: 1, max: MAX, placeholder: 'R$ 0,00' },
      next: () => 'guardado',
    },
    {
      id: 'guardado',
      say: {
        arkad: ['Você já tem algum dinheiro guardado? Reserva, poupança, qualquer coisa separada.'],
        nomasir: ['Já tem dinheiro guardado? Se não tem, digita zero.'],
        sharru: ['Você já tem algum dinheiro guardado ou investido? Zero também vale.'],
      },
      ask: { kind: 'money', min: 0, max: MAX, placeholder: 'R$ 0,00' },
      next: () => 'aporte',
    },
    {
      id: 'aporte',
      say: (a, coach) => {
        const sug = suggestedSave(Number(a.renda));
        const livre = freeMoney(toAnswers({ ...a, divida: a.divida }));
        const book =
          coach === 'arkad'
            ? `Aprendi uma regra simples: guarde pelo menos 10% de tudo que entra. No seu caso, ${brl(sug)} por mês.`
            : coach === 'nomasir'
              ? `A regra é 10% do que entra: ${brl(sug)} por mês.`
              : `A base é guardar 10% do que entra: ${brl(sug)} por mês. Dá pra ir além quando sobrar.`;
        const aviso = livre < sug ? ` Hoje, depois dos fixos${a.divida === 'sim' ? ' e da parcela' : ''}, sobram ${brl(Math.max(0, livre))}, então pode ser que o valor precise ser menor.` : '';
        return [`${book}${aviso}`, 'Quanto você acha que consegue guardar por mês?'];
      },
      ask: (a) => ({
        kind: 'buttons',
        options: [
          { value: 'sug', label: `${brl(suggestedSave(Number(a.renda)))} (10%)` },
          { value: 'outro', label: 'Outro valor' },
        ],
      }),
      validate: (v, a) => {
        if (v !== 'sug') return null;
        const sug = suggestedSave(Number(a.renda));
        const livre = freeMoney(toAnswers(a));
        return sug > livre ? `Depois dos gastos${a.divida === 'sim' ? ' e da parcela' : ''}, sobram só ${brl(Math.max(0, livre))}. Escolha "Outro valor" e informe um que caiba.` : null;
      },
      next: (v) => (v === 'sug' ? 'plano' : 'aporteValor'),
    },
    {
      id: 'aporteValor',
      say: {
        arkad: ['Sem problema. Qual valor cabe no seu mês, sem apertar demais?'],
        nomasir: ['Qual valor você consegue guardar todo mês, de verdade?'],
        sharru: ['Qual valor você consegue separar todo mês? Melhor um valor que dá pra cumprir.'],
      },
      ask: { kind: 'money', min: 1, max: MAX, placeholder: 'R$ 0,00' },
      validate: (v, a) => {
        const livre = freeMoney(toAnswers(a));
        return Number(v) > livre ? `Isso passa do que sobra depois dos gastos${a.divida === 'sim' ? ' e da parcela' : ''}: ${brl(Math.max(0, livre))}. Tenta um valor menor.` : null;
      },
      next: () => 'plano',
    },
    {
      id: 'plano',
      say: (a, coach) => {
        const p = buildPlan(toAnswers(a), currentMonth());
        const fim = p.previsao ? `Sua reserva fica pronta em ${whenText(p.previsao)}.` : '';
        const divida = p.temDivida ? ' Com dívida, ela vem antes: primeiro quitamos, depois a reserva cresce.' : '';
        return [
          coach === 'arkad' ? `Preparei o seu plano.${divida} ${fim}` : coach === 'nomasir' ? `Plano pronto.${divida} ${fim}` : `Preparei o seu plano.${divida} ${fim}`,
        ];
      },
      ask: null,
      next: () => null,
    },
  ],
};

export const PLANO_MAX_QUESTIONS = 7;
