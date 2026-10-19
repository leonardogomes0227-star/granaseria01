// Peças comuns das conversas do WhatsApp: tipos, leitura de valores e dados do perfil.
// Fica separado de hub.ts e tools.ts pra os dois poderem usar sem importar um ao outro.

import type { Outgoing } from './meta.js';
import type { StateSnapshot } from '../account/db.js';
import { formatBRL } from '../../src/calculations.js';
import { INITIAL_DATA, type WizardData, type DebtItem, type DebtKind } from '../../src/types.js';
import { type LeakSelection } from '../../src/leaks.js';
import { parseAmount } from './parse.js';

export type Flow = 'diag' | 'extra' | 'leaks' | 'compra' | 'meta' | 'longo' | 'emprestimo' | 'dividas' | 'checkin' | 'fatura' | 'erase' | 'feedback';

export interface Session {
  flow: Flow;
  step: string;
  data: Record<string, unknown>;
}

/** O que a pessoa anotou nos últimos 30 dias (entradas e gastos), pra pré-preencher o diagnóstico. */
export interface History {
  income: number;
  spent: number;
  byCategory: Record<string, number>; // gastos por categoria do registro (Alimentação, Moradia…)
  days: number; // quantos dias os registros cobrem (1 a 30)
}

export interface HubInput {
  text: string; // texto digitado, ou o id do botão/linha tocado
  session: Session | null;
  profile: StateSnapshot; // mesmo formato do que o site guarda (selos-wizard-progress, selos-tracking, selos-leaks…)
  now: Date;
  faturaEnabled?: boolean; // mostra "Ler minha fatura" no menu
  name?: string | null; // primeiro nome da pessoa, se der pra usar
  history?: History; // só carregado quando a pessoa abre o diagnóstico ou o começo rápido
  balance?: { income: number; spent: number }; // entradas e gastos do mês (só carregado quando a pessoa pergunta se pode comprar)
  expensesThisMonth?: number; // quantos gastos ela já anotou no mês (pra sugerir o próximo passo)
  shortcuts?: [string, string][]; // as ferramentas que ela mais usa (id, título), pra oferecer no "oi"
}

export interface HubResult {
  out: Outgoing[];
  session: Session | null; // null = conversa encerrada
  profile?: StateSnapshot; // só quando mudou
  event?: string; // pra medir o uso (ex.: diag_done)
  note?: string; // texto do feedback "não ajudou"
  erase?: boolean; // apagar todos os dados deste número (quem executa é o webhook)
}

/* ---------- utilitários ---------- */

/**
 * Primeiro nome pra chamar a pessoa. O nome do WhatsApp pode ser apelido, emoji ou frase:
 * só usamos se parecer um nome mesmo (letras, até 20 caracteres), senão a conversa segue sem nome.
 */
export function firstName(raw?: string | null): string | null {
  const first = raw?.trim().split(/\s+/)[0] ?? '';
  if (!/^[\p{L}][\p{L}'-]{1,19}$/u.test(first)) return null;
  return first.charAt(0).toLocaleUpperCase('pt-BR') + first.slice(1).toLocaleLowerCase('pt-BR');
}


/** Linhas do menu de gastos → o comando que o registro de gastos já entende. */
export const GASTOS_BUTTON_TEXT: Record<string, string> = {
  'gastos:hoje': 'hoje',
  'gastos:ontem': 'ontem',
  'gastos:semana': 'semana',
  'gastos:mes': 'mês',
  'gastos:sobra': 'quanto ainda posso gastar',
  'gastos:ultimos': 'últimos',
  'gastos:desfazer': 'apagar',
  'gastos:entradas': 'entradas',
  'gastos:saldo': 'saldo',
  'gastos:formas': 'formas de pagamento',
  'gastos:resumo': 'resumo semanal',
};

export const txt = (text: string): Outgoing => ({ kind: 'text', text });
export const buttons = (text: string, b: [string, string][]): Outgoing => ({ kind: 'buttons', text, buttons: b.map(([id, title]) => ({ id, title })) });
export const brl = (n: number) => formatBRL(n);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[º°]/g, 'o')
    .replace(/ª/g, 'a')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[!?.]+$/, '')
    .trim();
}

/** "3500", "3.500,50", "R$ 3500", "3 mil", "3k"; "zero/nada/não" = 0. null se não achar valor. */
export function parseMoney(raw: string): number | null {
  const t = normalize(raw);
  if (/^(0|zero|nada|nenhum|nenhuma|nao tenho|nao|sem)$/.test(t)) return 0;
  const m = t.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s*(mil|k)\b)?/);
  if (!m) return null;
  const n = parseAmount(m[1]);
  if (n === null) return null;
  return Math.round((m[2] ? n * 1000 : n) * 100) / 100;
}

export const KIND_SHORT: Record<DebtKind, string> = {
  cartao: 'Cartão',
  cheque: 'Cheque especial',
  emprestimo: 'Empréstimo',
  consignado: 'Consignado',
  financiamento: 'Financiamento',
  outro: 'Outra dívida',
};

function detectKind(t: string): DebtKind {
  if (/\b(cartao|fatura|rotativo)\b/.test(t)) return 'cartao';
  if (/\bcheque\b/.test(t)) return 'cheque';
  if (/\bconsignado\b/.test(t)) return 'consignado';
  if (/\b(financiamento|carro|moto|casa|imovel|apartamento)\b/.test(t)) return 'financiamento';
  if (/\b(emprestimo|credito pessoal)\b/.test(t)) return 'emprestimo';
  return 'outro';
}

/** "cartão nubank 4500", "empréstimo 3000 parcela 250 juros 5": uma dívida por mensagem. */
export function parseDebt(raw: string, id: string): DebtItem | null {
  const t = normalize(raw);
  const inst = t.match(/parcelas?\s*(?:de)?\s*(?:r\$)?\s*([\d.,]+)/);
  const rate = t.match(/juros?\s*(?:de)?\s*([\d.,]+)\s*%?/);
  const rest = t.replace(inst?.[0] ?? '', ' ').replace(rate?.[0] ?? '', ' ');
  const value = parseMoney(rest);
  if (value === null || value <= 0) return null;
  const kind = detectKind(t);
  const extra = rest
    .replace(/[\d.,%]+|\b(mil|k|reais|real|r\$|de|do|da|no|na|em|com|um|uma|e)\b/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(cartao|cheque|especial|consignado|financiamento|emprestimo|fatura|rotativo|credito|pessoal|divida)$/.test(w))
    .join(' ')
    .trim();
  const debt: DebtItem = { id, description: extra ? `${KIND_SHORT[kind]} ${extra}` : KIND_SHORT[kind], value, kind };
  const installment = inst ? parseAmount(inst[1]) : null;
  if (installment) debt.installment = installment;
  const r = rate ? parseAmount(rate[1]) : null;
  if (r && r < 100) debt.interestRate = r;
  return debt;
}

/** O diagnóstico salvo (pelo site ou por aqui), se tiver. */
export function diagnosisFrom(profile: StateSnapshot): WizardData | null {
  try {
    const raw = profile['selos-wizard-progress'];
    if (!raw) return null;
    const data = (JSON.parse(raw) as { data?: Partial<WizardData> }).data;
    if (!data || !(Number(data.monthlyIncome) > 0)) return null;
    return { ...INITIAL_DATA, ...data, expenses: { ...INITIAL_DATA.expenses, ...(data.expenses ?? {}) }, debts: data.debts ?? [] } as WizardData;
  } catch {
    return null;
  }
}

export function leaksFrom(profile: StateSnapshot): LeakSelection {
  try {
    return profile['selos-leaks'] ? (JSON.parse(profile['selos-leaks']) as LeakSelection) : {};
  } catch {
    return {};
  }
}

