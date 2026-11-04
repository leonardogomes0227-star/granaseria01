// Entende as mensagens que chegam pelo WhatsApp.
// Sem IA de propósito: regras simples resolvem "gastei 35 no mercado" e não custam nada por mensagem.

export type Command =
  | { kind: 'expense'; amount: number; category: string; description: string; method?: string; daysAgo?: number }
  | { kind: 'multi'; items: { amount: number; category: string; description: string; method?: string }[]; daysAgo?: number }
  | { kind: 'categoryQuery'; term: string }
  | { kind: 'thanks' }
  | { kind: 'income'; amount: number; source: string; description: string; method?: string }
  | { kind: 'incomes' }
  | { kind: 'balance' }
  | { kind: 'methods' }
  | { kind: 'undoIncome' }
  | { kind: 'weekly' }
  | { kind: 'weeklyOff' }
  | { kind: 'today' }
  | { kind: 'yesterday' }
  | { kind: 'recent' }
  | { kind: 'budget' }
  | { kind: 'week' }
  | { kind: 'month' }
  | { kind: 'undo' }
  | { kind: 'help' }
  | { kind: 'unknown' };

export const CATEGORIES: { name: string; emoji: string; keywords: string[] }[] = [
  {
    name: 'Alimentação',
    emoji: '🍽️',
    keywords: [
      'mercado', 'supermercado', 'ifood', 'almoço', 'almoco', 'janta', 'jantar', 'lanche', 'padaria', 'restaurante',
      'comida', 'pizza', 'café', 'cafe', 'hamburguer', 'açougue', 'acougue', 'feira', 'hortifruti', 'marmita', 'delivery', 'sorvete', 'doce',
    ],
  },
  {
    name: 'Transporte',
    emoji: '🚗',
    keywords: [
      'uber', 'gasolina', 'combustível', 'combustivel', 'etanol', 'álcool', 'alcool', 'ônibus', 'onibus', 'metrô', 'metro', 'trem',
      'estacionamento', 'pedágio', 'pedagio', 'taxi', 'táxi', 'passagem', 'oficina', 'mecânico', 'mecanico', 'ipva', 'posto',
      'carro', 'moto', 'pneu', 'revisão', 'revisao', 'lava jato', 'lavagem', '99', 'bilhete único', 'cartão de transporte',
    ],
  },
  {
    name: 'Moradia',
    emoji: '🏠',
    keywords: ['aluguel', 'luz', 'energia', 'água', 'agua', 'internet', 'condomínio', 'condominio', 'gás', 'gas', 'iptu', 'faxina', 'diarista'],
  },
  {
    name: 'Saúde',
    emoji: '💊',
    keywords: ['farmácia', 'farmacia', 'remédio', 'remedio', 'médico', 'medico', 'consulta', 'exame', 'dentista', 'academia', 'plano de saúde', 'plano de saude', 'psicólogo', 'psicologo'],
  },
  {
    name: 'Lazer',
    emoji: '🎉',
    keywords: [
      'cinema', 'bar', 'cerveja', 'show', 'netflix', 'spotify', 'viagem', 'jogo', 'balada', 'festa', 'passeio', 'hotel', 'streaming', 'ingresso', 'role', 'rolê',
    ],
  },
  {
    name: 'Compras',
    emoji: '🛍️',
    keywords: ['roupa', 'tênis', 'tenis', 'sapato', 'shopping', 'amazon', 'shopee', 'mercado livre', 'presente', 'eletrônico', 'eletronico', 'celular', 'loja'],
  },
  {
    name: 'Educação',
    emoji: '📚',
    keywords: ['curso', 'livro', 'faculdade', 'escola', 'mensalidade', 'material escolar', 'apostila'],
  },
];

// depois das categorias principais: "reserva do hotel" é Lazer, "reserva" sozinha é dinheiro guardado
CATEGORIES.push(
  { name: 'Pets', emoji: '🐾', keywords: ['pet', 'pet shop', 'petshop', 'ração', 'racao', 'veterinário', 'veterinario', 'banho e tosa', 'areia do gato'] },
  {
    name: 'Cuidados pessoais',
    emoji: '💇',
    keywords: ['cabelo', 'cabeleireiro', 'cabeleireira', 'barbearia', 'barbeiro', 'salão', 'salao', 'manicure', 'unha', 'unhas', 'sobrancelha', 'depilação', 'depilacao', 'perfume', 'maquiagem', 'skincare'],
  },
  { name: 'Doações', emoji: '🤲', keywords: ['dízimo', 'dizimo', 'oferta', 'doação', 'doacao', 'vaquinha', 'caridade'] },
  {
    name: 'Guardado',
    emoji: '🐖',
    keywords: ['guardei', 'guardar', 'investi', 'investimento', 'poupança', 'poupanca', 'reserva', 'tesouro', 'tesouro direto', 'cdb', 'caixinha', 'aplicação', 'aplicacao', 'apliquei'],
  }
);

/** Dinheiro guardado sai da conta, mas não é gasto: entra no saldo, e o bot comemora em vez de contar como despesa. */
export const SAVED_CATEGORY = 'Guardado';

export const OTHER_CATEGORY = { name: 'Outros', emoji: '📌' };

export function categoryEmoji(name: string): string {
  return CATEGORIES.find((c) => c.name === name)?.emoji ?? OTHER_CATEGORY.emoji;
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// "35", "35,50", "1.234,56", "1234.5", "R$ 35", "35 reais", "r$35"
const AMOUNT_RE = /(r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(\s*(?:reais|real|conto|contos|pila)\b)?/gi;

// Com mais de um número ("2 pizzas 80"), vale o marcado com R$/reais; senão, o último.
function pickAmount(text: string): RegExpExecArray | null {
  const all = [...text.matchAll(AMOUNT_RE)] as RegExpExecArray[];
  if (all.length === 0) return null;
  return all.find((m) => m[1] || m[3]) ?? all[all.length - 1];
}

export function parseAmount(raw: string): number | null {
  // número "1.234,56" → 1234.56 · "12,5" → 12.5 · "12.5" → 12.5
  let s = raw;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  if (!isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return Math.round(n * 100) / 100;
}

// Como foi pago (ou como o dinheiro caiu). Ordem importa: "cartão de crédito" vale como Crédito, só "cartão" como Cartão.
const METHODS: { name: string; re: RegExp }[] = [
  { name: 'Crédito', re: /\b(?:cart[aã]o\s+(?:de\s+)?)?cr[eé]dito\b/i },
  { name: 'Débito', re: /\b(?:cart[aã]o\s+(?:de\s+)?)?d[eé]bito\b/i },
  { name: 'Pix', re: /\bpix\b/i },
  { name: 'Dinheiro', re: /\b(?:dinheiro|esp[eé]cie|cash)\b/i },
  { name: 'Boleto', re: /\bboleto\b/i },
  { name: 'Vale', re: /\bvale[\s-]?(?:refei[cç][aã]o|alimenta[cç][aã]o)\b|\b(?:vr|vt)\b/i },
  { name: 'Cartão', re: /\bcart[aã]o\b/i },
];

/** Tira "no pix", "cartão de crédito", "em dinheiro"… do texto e diz qual foi. */
export function extractMethod(text: string): { method?: string; text: string } {
  for (const m of METHODS) {
    if (m.re.test(text)) return { method: m.name, text: text.replace(m.re, ' ') };
  }
  return { text };
}

const FILLER = new Set([
  'gastei', 'gasto', 'paguei', 'pago', 'comprei', 'compra', 'foi', 'deu', 'custou', 'saiu', 'via',
  'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'em', 'com', 'pra', 'para', 'pro', 'um', 'uma', 'o', 'a', 'e',
  'r$', 'reais', 'real', 'conto', 'contos', 'pila', 'hoje', 'agora', 'por', 'na', 'num', 'numa',
]);

export function detectCategory(text: string): string {
  const t = ` ${normalize(text)} `;
  for (const cat of CATEGORIES) {
    for (const kw of cat.keywords) {
      // palavra inteira (aceitando plural), pra "bar" não pegar "barbearia"
      const k = normalize(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`[^a-z0-9]${k}s?[^a-z0-9]`).test(t)) return cat.name;
    }
  }
  return OTHER_CATEGORY.name;
}

/** "2 mil" → "2000", "1,5k" → "1500": o valor por extenso vira número antes de procurar o valor. */
export function expandThousands(text: string): string {
  return text.replace(/(\d+(?:[.,]\d{1,3})?)\s*(mil|k)\b/gi, (_, n: string) => {
    const v = parseFloat(n.replace(/\./g, '').replace(',', '.'));
    if (!isFinite(v)) return n;
    return String(Math.round(v * 1000));
  });
}

/** "parcelado em 3x", "em 10 vezes": o número de parcelas não é valor. Devolve o texto sem ele e quantas parcelas. */
export function extractInstallments(text: string): { text: string; installments?: number } {
  const m = text.match(/\b(?:parcelad[oa]\s+)?(?:em\s+)?(\d{1,2})\s*(?:x|vezes)\b/i);
  if (!m) return { text };
  const n = Number(m[1]);
  return n >= 2 && n <= 48 ? { text: text.replace(m[0], ' '), installments: n } : { text };
}

/** "ontem", "anteontem": quantos dias atrás foi, e o texto sem a palavra. */
export function extractDaysAgo(text: string): { text: string; daysAgo?: number } {
  const t = normalize(text);
  if (/\banteontem\b/.test(t)) return { text: text.replace(/\banteontem\b/i, ' '), daysAgo: 2 };
  if (/\bontem\b/.test(t)) return { text: text.replace(/\bontem\b/i, ' '), daysAgo: 1 };
  return { text };
}

/** "13º", "13o salário", "1ª parcela": o número de ordem não é valor. "13º" vira "décimo terceiro". */
export function stripOrdinals(text: string): string {
  return text.replace(/\b13\s*(?:[º°]|o\b)(?:\s*sal[aá]rio)?|\b13\s+sal[aá]rio/gi, ' décimo terceiro ').replace(/\b\d+\s*[º°ª]/g, ' ');
}

const PAID_WORDS = /\b(gastei|paguei|comprei|pago|pagamento de)\b/;
const INCOME_WORDS = /\b(recebi|recebido|ganhei|entrou|caiu|salario|renda extra|freela(?:nce|s)?|bico|vendi|me pagaram|me depositaram|depositaram|reembolso|reembolsaram)\b/;
const INCOME_FILLER = new Set(['recebi', 'recebido', 'ganhei', 'entrou', 'caiu', 'me', 'pagaram', 'depositaram', 'reembolsaram', 'que', 'meu', 'minha', 'mais', 'um', 'uma', 'o', 'a', 'de', 'do', 'da', 'no', 'na', 'em', 'com', 'e', 'pra', 'para', 'r$', 'reais', 'real', 'conto', 'contos', 'pila', 'hoje', 'agora']);

const INCOME_SOURCES: [string, RegExp][] = [
  ['Salário', /\bsalario\b/],
  ['Renda extra', /\b(decimo terceiro|bonus|ferias|plr|premio|participacao)\b/],
  ['Renda extra', /\b(freela(nce|s)?|bico|extra|servico|trabalho)\b/],
  ['Venda', /\b(vendi|venda|vendas)\b/],
  ['Reembolso', /\b(reembolso|reembolsaram|devolucao|restituicao)\b/],
  ['Presente', /\b(presente|mesada)\b/],
  ['Rendimento', /\b(rendimento|juros|dividendos?|cashback)\b/],
];

export function detectIncomeSource(text: string): string {
  const t = normalize(text);
  return INCOME_SOURCES.find(([, re]) => re.test(t))?.[0] ?? 'Outros';
}

/** "recebi 200 de freela", "caiu 1500 no pix", "salário 3000": dinheiro que entrou, não gasto. */
function parseIncome(rawText: string): Command | null {
  const text = stripOrdinals(rawText);
  const t = normalize(text);
  if (PAID_WORDS.test(t) || !INCOME_WORDS.test(t)) return null;
  const { method, text: noMethod } = extractMethod(text);
  const m = pickAmount(noMethod);
  const amount = m ? parseAmount(m[2]) : null;
  if (!m || amount === null) return null;
  const rest = (noMethod.slice(0, m.index) + ' ' + noMethod.slice((m.index ?? 0) + m[0].length))
    .split(/\s+/)
    .filter((w) => w && !INCOME_FILLER.has(normalize(w)))
    .join(' ')
    .replace(/^[-–:,\s]+|[-–:,\s]+$/g, '')
    .slice(0, 80);
  const source = detectIncomeSource(text);
  return { kind: 'income', amount, source, description: rest || (source === 'Outros' ? 'Entrada' : source), ...(method ? { method } : {}) };
}

export function parseMessage(input: string): Command {
  const text = input.trim();
  const t = normalize(text).replace(/[!?.]+$/, '');

  if (/^(oi|ola|menu|ajuda|help|comandos|inicio|comecar|como funciona|como usar|\?)$/.test(t)) return { kind: 'help' };
  if (/^(obrigad[oa]|muito obrigad[oa]|brigad[oa]|valeu|vlw|show|top|massa|beleza|blz|ok|okay|certo|perfeito|otimo|tmj|👍|🙏|❤️|😊|🙂|👏)+$/u.test(t)) return { kind: 'thanks' };
  if (/^(hoje|gastos de hoje|quanto gastei hoje)$/.test(t)) return { kind: 'today' };
  if (/^(ontem|gastos de ontem|quanto gastei ontem)$/.test(t)) return { kind: 'yesterday' };
  if (/^(ultimos|ultimos gastos|meus ultimos gastos|lista|listar)$/.test(t)) return { kind: 'recent' };
  if (/^(quanto (ainda )?(posso|da pra|sobra pra) gastar|quanto (ainda )?(sobra|falta)|orcamento|meu orcamento|quanto ainda posso gastar neste mes)$/.test(t)) return { kind: 'budget' };
  if (/^(semana|essa semana|esta semana|gastos da semana|quanto (eu )?gastei (na|nesta|nessa|essa|esta) semana)$/.test(t)) return { kind: 'week' };
  if (/^(mes|esse mes|este mes|resumo|extrato|gastos do mes|total|quanto (eu )?gastei( no| neste| nesse| esse| este)? mes|quanto (eu )?gastei no total|quanto (eu )?gastei ate agora)$/.test(t)) return { kind: 'month' };
  const cq = t.match(/^quanto (?:eu )?(?:ja )?gastei (?:com|de|em|no|na|nos|nas) (.+?)( (neste|nesse|esse|este|no) mes)?$/);
  if (cq) return { kind: 'categoryQuery', term: cq[1] };
  if (/^(apagar|apaga|desfazer|desfaz|cancelar|apagar ultimo|apaga o ultimo|errei)$/.test(t)) return { kind: 'undo' };
  if (/^(apagar|apaga|desfazer|desfaz) (a )?(ultima )?(entrada|receita)( anotada)?$/.test(t)) return { kind: 'undoIncome' };
  if (/^(entradas|minhas entradas|entradas do mes|receitas|minhas receitas|receitas do mes|ganhos|quanto recebi|quanto entrou|dinheiro que entrou)$/.test(t)) return { kind: 'incomes' };
  if (/^(saldo|meu saldo|saldo do mes|balanco|balanco do mes|entrou e saiu|quanto sobrou)$/.test(t)) return { kind: 'balance' };
  if (/^(resumo semanal|resumo da semana|minha semana|ligar resumo|ligar o resumo|receber resumo|quero o resumo|quero resumo)$/.test(t)) return { kind: 'weekly' };
  if (/^(parar resumo|parar o resumo|desligar resumo|desligar o resumo|sem resumo|nao quero resumo|cancelar resumo)$/.test(t)) return { kind: 'weeklyOff' };
  if (/^(formas de pagamento|forma de pagamento|gastos por forma de pagamento|gastos por pagamento|como paguei|pagamentos|por pagamento)$/.test(t)) return { kind: 'methods' };

  // pergunta ("pq 155?") não é gasto, mesmo que tenha número
  if (text.includes('?')) return { kind: 'unknown' };

  const income = parseIncome(expandThousands(text));
  if (income) return income;

  // vários gastos numa frase: "40 na feira e 20 na padaria", "uber 20, almoço 35"
  const prepared = extractDaysAgo(expandThousands(stripOrdinals(text)));
  // a vírgula separa gastos ("uber 20, almoço 35"), mas não quando é a do decimal ("uber 18,50")
  const parts = prepared.text.split(/\s*(?:,(?!\d)|;|\+|\be\b|\bmais\b)\s*/i).filter((p) => p.trim());
  if (parts.length >= 2 && parts.every((p) => (p.match(/\d/g) ? [...p.matchAll(AMOUNT_RE)].length === 1 : false))) {
    const items = parts.map((p) => parseOneExpense(p)).filter((x): x is NonNullable<typeof x> => x !== null);
    if (items.length === parts.length) {
      const shared = extractMethod(prepared.text).method;
      return { kind: 'multi', items: items.map((it) => ({ ...it, method: it.method ?? shared })), ...(prepared.daysAgo ? { daysAgo: prepared.daysAgo } : {}) };
    }
  }

  const one = parseOneExpense(prepared.text);
  if (!one) return { kind: 'unknown' };
  return { kind: 'expense', ...one, ...(prepared.daysAgo ? { daysAgo: prepared.daysAgo } : {}) };
}

/** Um gasto: valor, categoria, descrição, forma de pagamento e parcelas. null se não achar valor. */
function parseOneExpense(raw: string): { amount: number; category: string; description: string; method?: string } | null {
  const inst = extractInstallments(raw);
  const { method, text: noMethod } = extractMethod(inst.text);
  const m = pickAmount(noMethod);
  if (!m) return null;
  const amount = parseAmount(m[2]);
  if (amount === null) return null;

  const rest = (noMethod.slice(0, m.index) + ' ' + noMethod.slice((m.index ?? 0) + m[0].length))
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(normalize(w)))
    .join(' ')
    .replace(/^[-–:,\s]+|[-–:,\s]+$/g, '')
    .slice(0, 80);

  const what = rest || 'Sem descrição';
  return {
    amount,
    category: detectCategory(rest || raw),
    description: inst.installments ? `${what} (${inst.installments}x)` : what,
    ...(method ? { method } : {}),
  };
}
