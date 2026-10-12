// As ferramentas do site, conversando pelo WhatsApp.
//
// Tudo aqui é função pura: recebe (conversa em andamento, perfil, mensagem) e devolve (respostas, nova conversa,
// novo perfil). Quem lê e grava no banco é o api/whatsapp.ts. Assim dá pra testar sem Supabase e sem Meta.
// Os cálculos são os mesmos do site (src/plan.ts, src/leaks.ts, src/calculations.ts): o que o bot responde bate
// com o que a pessoa vê na tela.

import type { Outgoing } from './meta.js';
import type { StateSnapshot } from '../account/db.js';
import { buildPlan, simulateLumpSum, monthLong, effectiveRate, type LumpResult } from '../../src/plan.js';
import { LEAKS, RIGHTS, relevantRights, leaksMonthlyTotal, type LeakSelection } from '../../src/leaks.js';
import { calculateDiagnosis, calculateHealthScore } from '../../src/calculations.js';
import { getArchetype } from '../../src/archetypes.js';
import { calcMenu, maisMenu, startCompra, startMeta, startLongo, startEmprestimo, startDividas, startCheckin, selosOut, fraseOut, toolStep } from './tools.js';
import type { WizardData, DebtItem } from '../../src/types.js';
import type { Tracking } from '../../src/tracking.js';
import { parseAmount } from './parse.js';
import { diagnosisFrom, leaksFrom, normalize, parseDebt, parseMoney, txt, buttons, brl, type Session, type HubInput, type HubResult } from './hubcore.js';

export { parseMoney, parseDebt, diagnosisFrom, normalize } from './hubcore.js';
export type { Session, HubInput, HubResult, Flow } from './hubcore.js';

/* ---------- menu ---------- */

export function menu(faturaEnabled = false): Outgoing[] {
  const rows = [
    { id: 'menu:plano', title: '📋 Meu plano', description: 'O que pagar este mês' },
    { id: 'menu:diag', title: '📊 Fazer diagnóstico', description: 'Nota, plano e datas em uns 2 minutos' },
    { id: 'menu:gastos', title: '💸 Registrar gastos', description: 'Como anotar o que você gastou' },
    { id: 'menu:13o', title: '🎁 13º e dinheiro extra', description: 'Onde colocar cada real' },
    { id: 'menu:vazamentos', title: '🔎 Caça-vazamentos', description: 'Dinheiro que escapa todo mês' },
    { id: 'menu:direitos', title: '⚖️ Meus direitos', description: 'O que a lei garante com banco e dívida' },
    { id: 'menu:calc', title: '🧮 Calculadoras', description: 'Compra, meta, longo prazo, empréstimo, dívidas' },
    { id: 'menu:checkin', title: '📅 Check-in do mês', description: 'Acompanhe sua evolução' },
    ...(faturaEnabled ? [{ id: 'menu:fatura', title: '🧾 Ler minha fatura', description: 'Acho cobranças escondidas' }] : []),
    { id: 'menu:mais', title: '✨ Selos e frase do dia', description: 'Suas conquistas e uma frase' },
  ];
  return [
    {
      kind: 'list',
      text: '👋 Oi! Eu sou o assistente da *Grana Séria*.\n\nPra anotar um gasto, é só me mandar, tipo *gastei 35 no mercado*. Pro resto, escolha uma opção:',
      button: 'Ver opções',
      rows,
    },
  ];
}

const EXPIRED = txt('Essa opção já expirou. Mande *menu* pra ver as opções de novo. 🙂');

/* ---------- diagnóstico ---------- */

type DiagStep = 'income' | 'moradia' | 'alimentacao' | 'transporte' | 'lazer' | 'debts' | 'reserve' | 'savings';

const DIAG_QUESTION: Record<DiagStep, string> = {
  income: '💰 *1 de 8 — Renda.* Quanto você recebe por mês, já líquido (o que cai na conta)?\n\nResponda só o valor, ex.: *3500*',
  moradia: '🏠 *2 de 8 — Moradia.* Quanto você gasta por mês com aluguel ou prestação, condomínio, luz, água e internet?',
  alimentacao: '🍽️ *3 de 8 — Alimentação.* Mercado, restaurante, delivery… quanto vai por mês?',
  transporte: '🚗 *4 de 8 — Transporte.* Combustível, ônibus, aplicativo, manutenção… quanto por mês?',
  lazer: '🎉 *5 de 8 — Lazer.* Saídas, streaming, viagens, compras de prazer… quanto por mês?',
  debts:
    '💳 *6 de 8 — Dívidas.* Mande uma por mensagem: o tipo e o valor que ainda falta pagar.\n\nEx.: *cartão 4500*\nEx.: *empréstimo 3000 parcela 250*\nSe souber os juros: *cheque especial 800 juros 8*\n\nSe não tem dívida, mande *não tenho*.',
  reserve: '🛟 *7 de 8 — Reserva.* Quanto você tem guardado só pra imprevistos (dinheiro de fácil saque)? Se não tem, *0*.',
  savings: '🐖 *8 de 8 — Quanto sobra.* Em média, quanto você consegue guardar por mês? Se não sobra nada, *0*.',
};

const MONEY_HINT = 'Não entendi o valor. 🤔 Responda só o número, ex.: *1200* (ou *cancelar* pra sair).';

function startDiag(then?: 'extra'): HubResult {
  return {
    out: [
      txt('📊 *Diagnóstico rápido.* São 8 perguntas, uns 2 minutos. Seus números ficam só com você. Pode mandar *cancelar* a qualquer hora.'),
      txt(DIAG_QUESTION.income),
    ],
    session: { flow: 'diag', step: 'income', data: then ? { then } : {} },
  };
}

function diagSummary(data: WizardData, now: Date): string {
  const d = calculateDiagnosis(data);
  const score = calculateHealthScore(data, d);
  const plan = buildPlan(data, { start: now });
  const archetype = getArchetype(data, d);
  const lines = [`📊 *Seu diagnóstico*`, `Nota: *${score.score}/100* — ${score.label}`, `Perfil: *${archetype.name}*`, ''];
  lines.push(`Renda ${brl(data.monthlyIncome)} · gastos ${brl(d.totalExpenses)} (${Math.round((d.totalExpenses / data.monthlyIncome) * 100)}% da renda)`);

  if (plan.debts.length > 0) {
    const total = plan.debts.reduce((s, x) => s + x.balance, 0);
    if (plan.stuck) lines.push(`💳 Dívidas: ${brl(total)} — ⚠️ hoje o valor do plano não cobre nem os juros. Renegociar é o primeiro passo.`);
    else if (plan.debtFreeMonth !== null) lines.push(`💳 Dívidas: ${brl(total)} — livre em *${monthLong(plan.start, plan.debtFreeMonth)}*.`);
    else lines.push(`💳 Dívidas: ${brl(total)}.`);
  } else lines.push('💳 Sem dívidas. 👏');

  if (plan.reserve.alreadyDone) lines.push(`🛟 Reserva completa (${brl(plan.reserve.target)}). 👏`);
  else if (plan.reserve.doneMonth !== null) lines.push(`🛟 Reserva: ${brl(plan.reserve.current)} de ${brl(plan.reserve.target)} — pronta em ${monthLong(plan.start, plan.reserve.doneMonth)}.`);
  else lines.push(`🛟 Reserva: ${brl(plan.reserve.current)} de ${brl(plan.reserve.target)}.`);

  lines.push(`💪 Valor mensal do seu plano: *${brl(plan.monthlyPower)}*${plan.powerAssumed ? ' (estimado em 10% da renda)' : ''}`);
  if (plan.unaccounted >= Math.max(200, data.monthlyIncome * 0.1)) {
    lines.push(`🕵️ *${brl(plan.unaccounted)} da sua renda por mês não aparecem em nenhum gasto que você me contou.* Pra descobrir pra onde vai, me mande cada gasto aqui (ex.: *gastei 35 no mercado*) por 30 dias.`);
  }
  const steps = plan.steps.slice(0, 3);
  if (steps.length > 0) {
    lines.push('', '*Primeiros passos:*');
    steps.forEach((s, i) => lines.push(`${i + 1}. ${s.title}`));
  }
  return lines.join('\n');
}

function withDiagnosis(profile: StateSnapshot, data: WizardData): StateSnapshot {
  // step 6 = tela de revisão do diagnóstico no site; quem abrir o site continua dali
  return { ...profile, 'selos-wizard-progress': JSON.stringify({ data, step: 6 }), 'selos-diagnosis-completed': 'true' };
}

function stepDiag(session: Session, text: string, profile: StateSnapshot, now: Date): HubResult {
  const step = session.step as DiagStep | 'follow';
  const d = session.data as { income?: number; moradia?: number; alimentacao?: number; transporte?: number; lazer?: number; debts?: DebtItem[]; reserve?: number; savings?: number; then?: 'extra'; ready?: WizardData };
  const t = normalize(text);

  if (step === 'follow') {
    const data = d.ready;
    if (t === 'diag:follow' && data) {
      const tracking: Tracking = { createdAt: now.toISOString(), baseline: data, months: [] };
      return {
        out: [txt('✅ Combinado! Todo mês eu te lembro do que pagar. Mande *plano* pra ver o mês atual e *paguei* quando cumprir.')],
        session: null,
        profile: { ...profile, 'selos-tracking': JSON.stringify(tracking) },
      };
    }
    return { out: [txt('Beleza, sem pressa. Quando quiser seguir o plano, mande *diagnóstico* de novo ou veja o site. Mande *menu* pra mais opções.')], session: null };
  }

  const next = (patch: Record<string, unknown>, to: DiagStep): HubResult => ({
    out: [txt(DIAG_QUESTION[to])],
    session: { flow: 'diag', step: to, data: { ...session.data, ...patch } },
  });

  if (step === 'income') {
    const v = parseMoney(text);
    if (v === null || v <= 0) return { out: [txt('Preciso de um valor maior que zero. Ex.: *3500*')], session };
    return next({ income: v }, 'moradia');
  }
  if (step === 'moradia' || step === 'alimentacao' || step === 'transporte' || step === 'lazer') {
    const v = parseMoney(text);
    if (v === null) return { out: [txt(MONEY_HINT)], session };
    const order: DiagStep[] = ['moradia', 'alimentacao', 'transporte', 'lazer', 'debts'];
    return next({ [step]: v }, order[order.indexOf(step) + 1]);
  }

  if (step === 'debts') {
    const debts = d.debts ?? [];
    const none = /^(nao tenho|nao|nenhuma|nenhum|sem dividas?|nao tenho dividas?)$/.test(t);
    const done = /^(pronto|acabou|so isso|so essas|e isso|fim|ok|so)$/.test(t);
    if (none || done) return next({ debts }, 'reserve');
    const debt = debts.length < 8 ? parseDebt(text, `wa-${debts.length + 1}`) : null;
    if (!debt) {
      return {
        out: [txt(debts.length >= 8 ? 'Já anotei 8 dívidas, é o máximo por aqui. Mande *pronto*.' : 'Não entendi. 🤔 Mande o tipo e o valor, ex.: *cartão 4500* ou *empréstimo 3000 parcela 250*. Ou *pronto* se acabou.')],
        session,
      };
    }
    const { rate, assumed } = effectiveRate(debt);
    const all = [...debts, debt];
    return {
      out: [
        txt(
          `✅ Anotei: *${debt.description}* — ${brl(debt.value)}${debt.installment ? `, parcela de ${brl(debt.installment)}` : ''}. Juros ${assumed ? 'típicos' : 'de'} ${rate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% ao mês.\n\nTem outra? Mande agora. Se acabou, mande *pronto*.`
        ),
      ],
      session: { ...session, data: { ...session.data, debts: all } },
    };
  }

  if (step === 'reserve') {
    const v = parseMoney(text);
    if (v === null) return { out: [txt(MONEY_HINT)], session };
    return next({ reserve: v }, 'savings');
  }

  // savings: última pergunta
  const v = parseMoney(text);
  if (v === null) return { out: [txt(MONEY_HINT)], session };
  const data: WizardData = {
    monthlyIncome: d.income ?? 0,
    currentSavings: v,
    expenses: { moradia: d.moradia ?? 0, alimentacao: d.alimentacao ?? 0, transporte: d.transporte ?? 0, lazer: d.lazer ?? 0 },
    debts: d.debts ?? [],
    emergencyFund: d.reserve ?? 0,
  };
  const saved = withDiagnosis(profile, data);
  const summary = txt(diagSummary(data, now));

  if (d.then === 'extra') {
    return {
      out: [summary, txt('🎁 Agora sim! Quanto de dinheiro extra vai entrar (13º, restituição do IR, FGTS, bônus)? Responda só o valor, ex.: *3000*')],
      session: { flow: 'extra', step: 'amount', data: {} },
      profile: saved,
    };
  }
  return {
    out: [summary, buttons('Quer que eu acompanhe seu plano mês a mês e te lembre do que pagar?', [['diag:follow', 'Sim, seguir plano'], ['diag:skip', 'Agora não']])],
    session: { flow: 'diag', step: 'follow', data: { ready: data } },
    profile: saved,
  };
}

/* ---------- 13º e dinheiro extra ---------- */

const GENERIC_ORDER = [
  '*A ordem que mais rende pra qualquer dinheiro extra:*',
  '',
  '1. *Dívidas caras* — cartão, cheque especial, empréstimo pessoal cobram de 5% a 15% ao mês. Quitar é o melhor "investimento" que existe.',
  '2. *Reserva de emergência* — até ter 6 meses dos seus gastos num CDB de liquidez diária ou no Tesouro Selic.',
  '3. *Dívidas baratas* — financiamento e consignado: amortizar antes reduz os juros (é seu direito pedir o desconto).',
  '4. *Investir* — só depois disso: Tesouro IPCA+, fundos de índice.',
  '',
  'Pra eu dizer exatamente quanto vai em cada dívida e quantos meses você adianta, mande *diagnóstico*.',
].join('\n');

function extraHeadline(r: LumpResult, amount: number): string {
  const { before, after } = r;
  const start = before.start;
  if (r.unstuck) return `Com esse dinheiro, sua dívida passa a ter fim: livre em *${monthLong(start, after.debtFreeMonth ?? 0)}*. Hoje o que você paga não cobre nem os juros.`;
  if (after.stuck) {
    const b = before.debts.reduce((s, x) => s + x.balance, 0);
    const a = after.debts.reduce((s, x) => s + x.balance, 0);
    return `Ajuda, mas ainda não resolve sozinho: ${brl(b)} → ${brl(a)}. Use o extra como abaixo e renegocie também: com desconto à vista, esse dinheiro pode quitar a dívida inteira.`;
  }
  if (r.monthsSooner !== null && r.monthsSooner > 0) {
    const interest = r.interestSaved > 1 ? `, e deixa de pagar ${brl(r.interestSaved)} de juros` : '';
    return `Você sai das dívidas *${r.monthsSooner} ${r.monthsSooner === 1 ? 'mês' : 'meses'} antes*: em ${monthLong(start, after.debtFreeMonth ?? 0)} em vez de ${monthLong(start, before.debtFreeMonth ?? 0)}${interest}.`;
  }
  const reserveSooner = before.reserve.doneMonth !== null && after.reserve.doneMonth !== null ? before.reserve.doneMonth - after.reserve.doneMonth : 0;
  if (reserveSooner > 0) return `Sua reserva fica pronta *${reserveSooner} ${reserveSooner === 1 ? 'mês' : 'meses'} antes*: em ${monthLong(start, after.reserve.doneMonth ?? 0)}.`;
  return `Seu plano já está adiantado: sem dívidas e com a reserva completa, ${brl(amount)} podem ir direto pros investimentos.`;
}

function startExtra(profile: StateSnapshot): HubResult {
  if (diagnosisFrom(profile)) {
    return {
      out: [txt('🎁 *Dinheiro extra* é a chance de pular meses do seu plano. Quanto vai entrar (13º, restituição do IR, FGTS, bônus)?\n\nResponda só o valor, ex.: *3000*')],
      session: { flow: 'extra', step: 'amount', data: {} },
    };
  }
  return {
    out: [
      buttons('🎁 Pra eu dizer onde colocar cada real e quantos meses você adianta, preciso conhecer sua situação (renda, gastos e dívidas). Leva uns 2 minutos aqui mesmo.', [
        ['extra:diag', 'Fazer agora'],
        ['extra:generic', 'Só a regra geral'],
      ]),
    ],
    session: { flow: 'extra', step: 'need-diag', data: {} },
  };
}

function stepExtra(session: Session, text: string, profile: StateSnapshot, now: Date): HubResult {
  const t = normalize(text);
  if (session.step === 'need-diag') {
    if (t === 'extra:diag') return startDiag('extra');
    return { out: [txt(GENERIC_ORDER)], session: null };
  }
  const amount = parseMoney(text);
  if (amount === null || amount <= 0) return { out: [txt('Não entendi o valor. 🤔 Responda só o número, ex.: *3000* (ou *cancelar*).')], session };
  const data = diagnosisFrom(profile);
  if (!data) return startExtra(profile);
  const result = simulateLumpSum(data, amount, { start: now, extraMonthly: leaksMonthlyTotal(leaksFrom(profile)) });
  const alloc = result.allocation.map((a, i) => `${i + 1}. *${a.label}: ${brl(a.amount)}*\n   ${a.why}`);
  return {
    out: [
      txt([`🎁 *${brl(amount)} de dinheiro extra*`, '', extraHeadline(result, amount), '', '*Onde colocar cada real:*', ...alloc].join('\n')),
      txt('⚠️ Não comprometa o extra com compras parceladas novas: o 13º acaba em dezembro, mas as parcelas continuam até o meio do ano.'),
    ],
    session: null,
  };
}

/* ---------- caça-vazamentos ---------- */

function startLeaks(): HubResult {
  const list = LEAKS.map((l, i) => `${i + 1}. *${l.title}* (~${brl(l.typical)}/mês)\n   ${l.what}`).join('\n\n');
  return {
    out: [txt(`🔎 *Caça-vazamentos* — dinheiro que sai todo mês sem você perceber.\n\nResponda com os números do que acontece com você (ex.: *1, 3, 4*), ou *nenhum*:\n\n${list}`)],
    session: { flow: 'leaks', step: 'pick', data: {} },
  };
}

function leaksFinish(sel: LeakSelection, profile: StateSnapshot, now: Date): HubResult {
  const total = leaksMonthlyTotal(sel);
  const lines = [`🔎 *Você achou ${brl(total)}/mês* — ${brl(total * 12)} por ano.`];
  const diag = diagnosisFrom(profile);
  if (diag && total > 0) {
    const before = buildPlan(diag, { start: now });
    const after = buildPlan(diag, { start: now, extraMonthly: total });
    if (before.debts.length > 0 && before.debtFreeMonth !== null && after.debtFreeMonth !== null && before.debtFreeMonth - after.debtFreeMonth > 0) {
      const n = before.debtFreeMonth - after.debtFreeMonth;
      lines.push(`Isso tira ${n} ${n === 1 ? 'mês' : 'meses'} do seu caminho pra sair das dívidas, e já entra no seu plano.`);
    } else if (before.stuck && !after.stuck) lines.push('Com esse dinheiro, sua dívida passa a ter fim.');
    else lines.push('Esse valor entra no seu plano de ação.');
  } else lines.push('Mande *diagnóstico* e esse valor entra no seu plano de ação.');
  lines.push('', 'Agora, como resolver cada um: 👇');

  const out: Outgoing[] = [txt(lines.join('\n'))];
  for (const l of LEAKS.filter((x) => x.id in sel)) {
    out.push(txt(`*${l.title}*\n${l.fix}`));
    if (l.message) out.push(txt(`Mensagem pronta (é só copiar e mandar):\n\n${l.message}`));
  }
  return { out, session: null, profile: { ...profile, 'selos-leaks': JSON.stringify(sel) } };
}

function stepLeaks(session: Session, text: string, profile: StateSnapshot, now: Date): HubResult {
  const t = normalize(text);
  const picked = (session.data.picked as string[] | undefined) ?? [];
  const values = (session.data.values as LeakSelection | undefined) ?? {};

  if (session.step === 'pick') {
    if (/^(nenhum|nenhuma|nada|nao|nao acontece)$/.test(t)) return { out: [txt('Ótimo, nada vazando por aqui! 👏 Mande *menu* pra ver outras opções.')], session: null };
    const nums = [...new Set((t.match(/\d+/g) ?? []).map(Number))].filter((n) => n >= 1 && n <= LEAKS.length);
    if (nums.length === 0) return { out: [txt(`Mande os números do que acontece com você, ex.: *1, 3, 4* (de 1 a ${LEAKS.length}), ou *nenhum*.`)], session };
    const ids = nums.map((n) => LEAKS[n - 1].id);
    const vals: LeakSelection = Object.fromEntries(ids.map((id) => [id, LEAKS.find((l) => l.id === id)!.typical]));
    return adjustPrompt({ ...session, step: 'adjust', data: { picked: ids, values: vals } });
  }

  // adjust
  if (/^(ok|pronto|certo|isso|pode ser|seguir|ver)$/.test(t)) return leaksFinish(values, profile, now);
  const pairs = [...t.matchAll(/(\d+)\s*[:=-]?\s*(?:r\$)?\s*(\d+(?:[.,]\d+)?)/g)];
  const next: LeakSelection = { ...values };
  let changed = 0;
  for (const [, idx, val] of pairs) {
    const leak = LEAKS[Number(idx) - 1];
    const v = parseAmount(val);
    if (leak && picked.includes(leak.id) && v !== null) {
      next[leak.id] = v;
      changed++;
    }
  }
  if (changed === 0) return { out: [txt('Pra ajustar, mande o número e o valor, ex.: *1 70* (o item 1 custa R$ 70). Ou *ok* pra seguir.')], session };
  return adjustPrompt({ ...session, data: { picked, values: next } });
}

function adjustPrompt(session: Session): HubResult {
  const picked = session.data.picked as string[];
  const values = session.data.values as LeakSelection;
  const lines = picked.map((id) => `• ${LEAKS.find((l) => l.id === id)!.title}: ${brl(values[id])}/mês`);
  return {
    out: [
      txt(
        `Anotei:\n${lines.join('\n')}\n\nTotal estimado: *${brl(leaksMonthlyTotal(values))}/mês*.\n\nSe algum valor for diferente, mande o número e o valor, ex.: *1 70* (o item 1 custa R$ 70). Ou mande *ok* pra ver como resolver cada um.`
      ),
    ],
    session,
  };
}

/* ---------- direitos ---------- */

const RIGHT_TITLE: Record<string, string> = {
  portabilidade: 'Portabilidade de crédito',
  quitacao: 'Desconto ao quitar antes',
  rotativo: 'Teto dos juros do cartão',
  cheque: 'Teto do cheque especial',
  superendividamento: 'Superendividamento',
  cobranca: 'Cobrança indevida',
  negativacao: 'Nome negativado: prazo',
};

function rightsList(profile: StateSnapshot, now: Date): Outgoing[] {
  const data = diagnosisFrom(profile);
  const mine = data && data.debts.length > 0 ? relevantRights(buildPlan(data, { start: now })) : [];
  const sorted = [...RIGHTS].sort((a, b) => Number(mine.includes(b.id)) - Number(mine.includes(a.id)));
  return [
    {
      kind: 'list',
      text: `⚖️ *Seus direitos com banco e dívida.* Escolha um pra ver a lei e a mensagem pronta.${mine.length > 0 ? '\n\nOs marcados com ⭐ valem pro seu caso, pelo seu diagnóstico.' : ''}`,
      button: 'Ver direitos',
      rows: sorted.map((r) => ({
        id: `dir:${r.id}`,
        title: `${mine.includes(r.id) ? '⭐ ' : ''}${RIGHT_TITLE[r.id] ?? r.title}`,
        description: r.law,
      })),
    },
  ];
}

function rightDetail(id: string): Outgoing[] {
  const r = RIGHTS.find((x) => x.id === id);
  if (!r) return [EXPIRED];
  const out: Outgoing[] = [txt(`⚖️ *${r.title}*\n_${r.law}_\n\n${r.summary}`)];
  if (r.message) out.push(txt(`Mensagem pronta (é só copiar e mandar):\n\n${r.message}`));
  out.push(txt('Se o banco não resolver, reclame no consumidor.gov.br, no Procon ou no Banco Central (bcb.gov.br/meubc).\n\nMande *direitos* pra ver outro. Conteúdo informativo, não substitui orientação jurídica.'));
  return out;
}

/* ---------- ponto de entrada ---------- */

const GREETING = /^(oi|ola|inicio|comecar|bom dia|boa tarde|boa noite|menu|opcoes)$/;

const GASTOS_HELP = txt(
  '💸 *Registrar gastos* é só me mandar o que gastou:\n\n• *gastei 35 no mercado*\n• *uber 18,50*\n• *ontem gastei 50 na farmácia*\n\nComandos: *hoje*, *semana*, *mês* (resumo por categoria) e *apagar* (desfaz o último).'
);

/** Palavras exatas que abrem uma ferramenta. Valem mesmo no meio de outra conversa (troca de assunto). */
function shortcutStart(t: string, profile: StateSnapshot, now: Date): HubResult | null {
  if (/^(13o|13 salario|decimo terceiro|dinheiro extra|restituicao( do ir)?|extra)$/.test(t)) return startExtra(profile);
  if (/^(vazamentos?|caca vazamentos?|cacar vazamentos?)$/.test(t)) return startLeaks();
  if (/^(direitos?|meus direitos|seus direitos)$/.test(t)) return { out: rightsList(profile, now), session: null };
  if (/^(diagnostico|fazer diagnostico|meu diagnostico|refazer diagnostico)$/.test(t)) return startDiag();
  const buy = t.match(/^vale a pena( comprar)?(?: (.*))?$/);
  if (buy) {
    const price = buy[2] ? parseMoney(buy[2]) : null;
    return startCompra(profile, price && price > 0 ? price : undefined);
  }
  if (/^(meta|minha meta|calculadora de meta)$/.test(t)) return startMeta();
  if (/^(longo prazo|simulador|aposentadoria|simulador de longo prazo)$/.test(t)) return startLongo(profile);
  if (/^(emprestimo|comparar emprestimos?|financiamento)$/.test(t)) return startEmprestimo();
  if (/^(dividas|qual divida pagar|avalanche|bola de neve|avalanche x bola de neve)$/.test(t)) return startDividas(profile);
  if (/^(calculadoras?|calcular)$/.test(t)) return { out: calcMenu(), session: null };
  if (/^check[ -]?in( do mes)?$/.test(t)) return startCheckin(profile);
  if (/^(selos|meus selos|perfil|meu perfil)$/.test(t)) return { out: selosOut(profile), session: null };
  if (/^(frase|frase do dia)$/.test(t)) return { out: fraseOut(null, now), session: null };

  return null;
}

/** Decide se a mensagem é do hub. Devolve null quando não é: aí vale o fluxo antigo (gastos, plano). */
export function hubStep(input: HubInput): HubResult | null {
  const { text, session, profile, now } = input;
  const t = normalize(text);

  // saídas
  if (session && /^(cancelar|sair|parar|voltar)$/.test(t)) {
    return { out: [txt('Tudo bem, parei por aqui. Mande *menu* quando quiser continuar. 🙂')], session: null };
  }
  if (GREETING.test(t) || t === 'menu:menu') return { out: menu(input.faturaEnabled), session: null };

  // ids de botões e listas
  if (t.startsWith('dir:')) return { out: rightDetail(t.slice(4)), session: null };
  if (t === 'menu:gastos') return { out: [GASTOS_HELP], session: null };
  if (t === 'menu:diag') return startDiag();
  if (t === 'menu:13o') return startExtra(profile);
  if (t === 'menu:vazamentos') return startLeaks();
  if (t === 'menu:direitos') return { out: rightsList(profile, now), session: null };
  if (t === 'menu:calc') return { out: calcMenu(), session: null };
  if (t === 'menu:mais') return { out: maisMenu(), session: null };
  if (t === 'menu:checkin') return startCheckin(profile);
  if (t === 'calc:compra') return startCompra(profile);
  if (t === 'calc:meta') return startMeta();
  if (t === 'calc:longo') return startLongo(profile);
  if (t === 'calc:emprestimo') return startEmprestimo();
  if (t === 'calc:dividas') return startDividas(profile);
  if (t === 'mais:selos') return { out: selosOut(profile), session: null };
  if (t === 'mais:frase') return { out: fraseOut(null, now), session: null };
  if (t.startsWith('frase:')) return { out: fraseOut(Number(t.slice(6)), now), session: null };
  if (t === 'menu:fatura') {
    return {
      out: [txt('🧾 Mande aqui o *PDF ou a foto* da fatura do cartão (ou do extrato) e eu procuro assinaturas, tarifas e juros escondidos.')],
      session: null,
    };
  }

  // conversa em andamento: toda resposta vai pra ela (um "3000" aqui é resposta, não gasto)
  const shortcut = shortcutStart(t, profile, now);
  if (shortcut) return shortcut;

  if (session && session.flow === 'fatura') {
    // só vale pros botões da leitura da fatura; qualquer outra coisa segue o fluxo normal
    if (t === 'fatura:add') {
      const found = (session.data.leaks as LeakSelection | undefined) ?? {};
      const merged = { ...leaksFrom(profile), ...found };
      return {
        out: [txt(`✅ Adicionei *${brl(leaksMonthlyTotal(found))}/mês* ao seu caça-vazamentos. Mande *vazamentos* pra ver como resolver cada um.`)],
        session: null,
        profile: { ...profile, 'selos-leaks': JSON.stringify(merged) },
      };
    }
    if (t === 'fatura:skip') return { out: [txt('Beleza! Mande *menu* quando quiser algo mais.')], session: null };
  } else if (session) {
    if (session.flow === 'diag') return stepDiag(session, text, profile, now);
    if (session.flow === 'extra') return stepExtra(session, text, profile, now);
    if (session.flow === 'leaks') return stepLeaks(session, text, profile, now);
    const tool = toolStep(session, text, profile, now);
    if (tool) return tool;
  }

  // botões antigos, de uma conversa que já terminou
  if (/^(menu|dir|extra|diag|calc|mais|frase|fatura):\S+$/.test(t)) return { out: [EXPIRED], session: null };

  return null;
}
