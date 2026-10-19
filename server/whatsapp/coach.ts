// O "coach": em vez de jogar um menu, olha a situação da pessoa e diz o próximo passo.
//
// A base da Grana Séria é "O Homem Mais Rico da Babilônia". As leis do ouro guiam a ordem:
//   1. conhecer o próprio ouro (diagnóstico)
//   2. pagar-se primeiro e seguir o plano, mês a mês
//   3. controlar os gastos
//   4. proteger o tesouro das perdas (vazamentos, cobranças indevidas)
// O texto é todo nosso (não cita trechos de nenhuma tradução do livro).

import type { Outgoing } from './meta.js';
import type { StateSnapshot } from '../account/db.js';
import { buildPlan, monthShort } from '../../src/plan.js';
import { trackingView, type Tracking } from '../../src/tracking.js';
import { leaksMonthlyTotal } from '../../src/leaks.js';
import type { CheckinEntry } from '../../src/types.js';
import { brl, buttons, diagnosisFrom, leaksFrom } from './hubcore.js';
import { tasksInline } from './planbot.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const CHECKIN_EVERY_DAYS = 25;

function trackingFrom(profile: StateSnapshot): Tracking | null {
  try {
    return profile['selos-tracking'] ? (JSON.parse(profile['selos-tracking']) as Tracking) : null;
  } catch {
    return null;
  }
}

function lastCheckin(profile: StateSnapshot): CheckinEntry | null {
  try {
    const list = profile['selos-checkins'] ? (JSON.parse(profile['selos-checkins']) as CheckinEntry[]) : [];
    return Array.isArray(list) ? (list.at(-1) ?? null) : null;
  } catch {
    return null;
  }
}

export interface NextStepInput {
  profile: StateSnapshot;
  now: Date;
  name?: string | null;
  expensesThisMonth?: number;
  greeting?: boolean; // é o "oi": começa cumprimentando
}

/** Um passo só, com botões. A prioridade é a ordem das leis: conhecer → seguir o plano → controlar → proteger. */
export function nextStep({ profile, now, name, expensesThisMonth = 0, greeting = false }: NextStepInput): Outgoing[] {
  const hi = greeting ? (name ? `Oi, ${name}! 👋 ` : 'Oi! 👋 ') : '';
  const diag = diagnosisFrom(profile);
  const tracking = trackingFrom(profile);
  const extraMonthly = leaksMonthlyTotal(leaksFrom(profile));

  // 1. Ainda não conheço a pessoa: o assistente se explica em três linhas, sem lista de ferramentas
  if (!diag) {
    return [
      buttons(
        `${hi}Eu sou o assistente da *Grana Séria*. 🪙 Você me conta o dinheiro que entra e o que sai, e eu mostro quanto sobra.\n\n✍️ É só escrever:\n• *gastei 35 no mercado no pix*\n• *recebi 200 de freela*\n\nEu somo tudo e digo o saldo do mês e quanto dá pra gastar por dia.`,
        [['gastos:saldo', '⚖️ Ver meu mês'], ['menu:menu', '📋 Mais opções']]
      ),
    ];
  }

  // 2. Conheço, mas o plano ainda não está andando
  if (!tracking) {
    return [
      buttons(
        `${hi}Seu diagnóstico está pronto, mas o plano ainda está só no papel. 📜\n\nQuer que eu acompanhe mês a mês e te lembre do que pagar? Guardar logo que o dinheiro cai, antes de gastar, é o primeiro hábito do livro.`,
        [['plan:start', 'Sim, acompanhar'], ['menu:menu', 'Agora não']]
      ),
    ];
  }

  // 3. O plano está andando: o que é pra fazer este mês.
  // O combinado de cada mês só entra em pauta quando o mês chega (um mês de folga: dá pra pagar já no mês anterior).
  // Sem isso o bot perguntaria "já fez?" logo depois de a pessoa dizer que fez, e nunca chegaria nas outras sugestões.
  const view = trackingView(tracking, extraMonthly);
  const created = new Date(tracking.createdAt);
  const monthLabel = monthShort(created, view.openMonth);
  const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();
  const due = monthIndex(now) >= monthIndex(created) + view.openMonth - 1;
  if (view.tasks.length > 0 && due) {
    const inline = tasksInline(tracking, extraMonthly) ?? '';
    return [
      buttons(`${hi}Neste mês do plano (${monthLabel}), o combinado é: *${inline}*.\n\nJá deu pra fazer?`, [
        ['plan:paid', 'Já fiz ✅'],
        ['plan:notpaid', 'Não consegui'],
        ['menu:plano', 'Ver o plano'],
      ]),
    ];
  }
  if (view.current.stuck) {
    return [
      buttons(
        `${hi}Hoje o valor do plano ainda não cobre nem os juros das suas dívidas. Não é culpa sua: é matemática. 🤝\n\nO primeiro passo é renegociar. Eu tenho a mensagem pronta e os direitos que a lei te dá.`,
        [['menu:direitos', 'Ver meus direitos'], ['menu:plano', 'Ver o plano']]
      ),
    ];
  }

  // 4. Renda sem destino: só anotando dá pra descobrir
  const plan = buildPlan(diag, { start: now });
  if (plan.unaccounted >= Math.max(200, diag.monthlyIncome * 0.1) && expensesThisMonth < 5) {
    return [
      buttons(
        `${hi}Tem *${brl(plan.unaccounted)}* da sua renda por mês que eu não sei pra onde vão. 🕵️\n\nSó dá pra controlar o que a gente enxerga. Por uns dias, anote cada gasto aqui do jeito mais simples, por exemplo: *gastei 35 no mercado*.`,
        [['menu:menu', 'Ver opções']]
      ),
    ];
  }

  // 5. Ainda não procurou o dinheiro que escapa
  if (!profile['selos-leaks']) {
    return [
      buttons(
        `${hi}Um jeito rápido de achar uma sobra é caçar o dinheiro que escapa sem você ver: assinatura esquecida, tarifa, seguro que ninguém pediu. 🔎\n\nProteger o que você ganha das perdas também faz parte do livro.`,
        [['menu:vazamentos', 'Caçar vazamentos'], ['menu:menu', 'Depois']]
      ),
    ];
  }

  // 6. Check-in do mês
  const last = lastCheckin(profile);
  if (!last || now.getTime() - new Date(last.date).getTime() > CHECKIN_EVERY_DAYS * DAY_MS) {
    return [
      buttons(`${hi}Já faz um tempo que a gente não confere como você está. Um check-in leva 1 minuto e mostra se o quanto você guarda está subindo. 📅`, [
        ['menu:checkin', 'Fazer check-in'],
        ['menu:menu', 'Depois'],
      ]),
    ];
  }

  // 7. Tudo em dia
  const upcoming = view.tasks.length > 0 && !due ? `\n\nO próximo combinado do plano é de *${monthLabel}*, e eu te aviso quando chegar.` : '';
  return [
    buttons(`${hi}Está tudo em dia por aqui. 🪙 Quem segue o plano mês após mês constrói riqueza sem pressa e sem susto.${upcoming}\n\nSe quiser, anote um gasto, veja uma frase ou explore as opções.`, [
      ['mais:frase', 'Frase do dia'],
      ['menu:menu', 'Ver opções'],
    ]),
  ];
}

/** Respostas aos botões "Já fiz" / "Não consegui" são tratadas como os comandos de sempre. */
export const PLAN_BUTTON_TEXT: Record<string, string> = {
  'plan:paid': 'paguei',
  'plan:notpaid': 'não paguei',
};

