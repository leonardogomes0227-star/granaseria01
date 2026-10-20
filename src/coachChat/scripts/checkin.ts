// Roteiro "Check-in do mês": o coach pergunta quanto da meta daquele mês foi guardado, grava e comenta o resultado.

import type { Answers, Script } from '../engine';
import { brl } from '../engine';
import { monthName, currentMonth } from '../months';
import { project, statusOf, whenText, type Aporte, type Plan } from '../plan';

export interface CheckinContext {
  mes: string; // 'AAAA-MM' do check-in
  plan: Plan;
  aportes: Aporte[]; // os já registrados (o deste mês, se existir, é substituído)
}

export const checkinScriptId = (mes: string) => `checkin:${mes}`;

export function checkinExpected(ctx: CheckinContext): number {
  const others = ctx.aportes.filter((a) => a.mes !== ctx.mes);
  return project(ctx.plan, others, currentMonth()).expected;
}

/** O valor que o check-in registra, a partir das respostas. */
export function checkinValue(ctx: CheckinContext, a: Answers): number {
  if (a.resultado === 'tudo') return checkinExpected(ctx);
  if (a.resultado === 'parte') return Number(a.valor);
  return 0;
}

export function makeCheckinScript(ctx: CheckinContext): Script {
  const expected = checkinExpected(ctx);
  const mes = monthName(ctx.mes);
  return {
    id: checkinScriptId(ctx.mes),
    first: 'resultado',
    steps: [
      {
        id: 'resultado',
        say: {
          arkad: [`Vamos ver como foi ${mes}.`, `Conseguiu guardar os ${brl(expected)} de ${mes}?`],
          nomasir: [`Check-in de ${mes}.`, `Guardou os ${brl(expected)}?`],
          sharru: [`Hora de olhar o resultado de ${mes}.`, `Você conseguiu guardar os ${brl(expected)} de ${mes}?`],
        },
        ask: {
          kind: 'buttons',
          options: [
            { value: 'tudo', label: 'Sim, tudo' },
            { value: 'parte', label: 'Só uma parte' },
            { value: 'nao', label: 'Não deu' },
          ],
        },
        next: (v) => (v === 'parte' ? 'valor' : 'fim'),
      },
      {
        id: 'valor',
        say: {
          arkad: ['Tudo bem, uma parte já é um passo. Quanto você guardou?'],
          nomasir: ['Quanto você guardou?'],
          sharru: ['Qualquer valor conta. Quanto você guardou?'],
        },
        ask: { kind: 'money', min: 1, max: 10_000_000, placeholder: 'R$ 0,00' },
        validate: (v) => (Number(v) >= expected ? `Você disse "só uma parte", mas esse valor cobre a meta de ${brl(expected)}. Volte e escolha "Sim, tudo".` : null),
        next: () => 'fim',
      },
      {
        id: 'fim',
        say: (a, coach) => {
          const valor = checkinValue(ctx, a);
          const next = [...ctx.aportes.filter((x) => x.mes !== ctx.mes), { mes: ctx.mes, valor, origem: 'site' as const }];
          const st = statusOf(ctx.plan, next, currentMonth());
          const saved = brl(project(ctx.plan, next, currentMonth()).saved);
          if (st.ok && valor < expected) {
            return [
              coach === 'nomasir'
                ? `Anotado: ${brl(valor)}, abaixo dos ${brl(expected)} combinados. A data se mantém em ${whenText(ctx.plan.previsao)}, mas não vira rotina. Compense no próximo mês.`
                : `Anotado: ${brl(valor)} em ${mes}. É menos que os ${brl(expected)} combinados, mas a previsão segue em ${whenText(ctx.plan.previsao)}. Se der, compense um pouco no próximo mês.`,
            ];
          }
          if (st.ok) {
            return [
              coach === 'arkad'
                ? `Anotado: ${brl(valor)} em ${mes}. Você está em dia, e isso é o que mais importa. Reserva pronta em ${whenText(ctx.plan.previsao)}.`
                : coach === 'nomasir'
                  ? `Anotado: ${brl(valor)}. Em dia. Reserva pronta em ${whenText(ctx.plan.previsao)}. Segue assim.`
                  : `Anotado: ${brl(valor)} em ${mes}. Você segue em dia, com ${saved} guardados. Reserva pronta em ${whenText(ctx.plan.previsao)}.`,
            ];
          }
          const nova = whenText(st.novaPrevisao);
          return [
            coach === 'arkad'
              ? `Anotado: ${brl(valor)} em ${mes}. Faz parte do caminho. Com isso, a reserva passa a ficar pronta em ${nova}. No próximo mês a gente retoma.`
              : coach === 'nomasir'
                ? `Anotado: ${brl(valor)}. Isso muda a data: reserva pronta em ${nova}. Olha o que dá pra cortar no próximo mês e recupera.`
                : `Anotado: ${brl(valor)} em ${mes}. A nova previsão da reserva é ${nova}. Ainda dá pra recuperar: guardar um pouco a mais nos próximos meses encurta o prazo.`,
          ];
        },
        ask: null,
        next: () => null,
      },
    ],
  };
}
