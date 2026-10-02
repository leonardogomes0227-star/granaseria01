// Entende as mensagens que chegam pelo WhatsApp.
// Sem IA de propósito: regras simples resolvem "gastei 35 no mercado" e não custam nada por mensagem.

export type Command =
  | { kind: 'expense'; amount: number; category: string; description: string }
  | { kind: 'today' }
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

export const OTHER_CATEGORY = { name: 'Outros', emoji: '📌' };

export function categoryEmoji(name: string): string {
  return CATEGORIES.find((c) => c.name === name)?.emoji ?? OTHER_CATEGORY.emoji;
}

function normalize(text: string): string {
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

const FILLER = new Set([
  'gastei', 'gasto', 'paguei', 'pago', 'comprei', 'compra', 'foi', 'deu', 'custou', 'saiu',
  'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'em', 'com', 'pra', 'para', 'pro', 'um', 'uma', 'o', 'a', 'e',
  'r$', 'reais', 'real', 'conto', 'contos', 'pila', 'hoje', 'agora',
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

export function parseMessage(input: string): Command {
  const text = input.trim();
  const t = normalize(text).replace(/[!?.]+$/, '');

  if (/^(oi|ola|menu|ajuda|help|comandos|inicio|comecar|\?)$/.test(t)) return { kind: 'help' };
  if (/^(hoje|gastos de hoje|quanto gastei hoje)$/.test(t)) return { kind: 'today' };
  if (/^(semana|essa semana|esta semana|gastos da semana)$/.test(t)) return { kind: 'week' };
  if (/^(mes|esse mes|este mes|resumo|extrato|gastos do mes|total)$/.test(t)) return { kind: 'month' };
  if (/^(apagar|apaga|desfazer|desfaz|cancelar|apagar ultimo|apaga o ultimo|errei)$/.test(t)) return { kind: 'undo' };

  const m = pickAmount(text);
  if (!m) return { kind: 'unknown' };
  const amount = parseAmount(m[2]);
  if (amount === null) return { kind: 'unknown' };

  const rest = (text.slice(0, m.index) + ' ' + text.slice((m.index ?? 0) + m[0].length))
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(normalize(w)))
    .join(' ')
    .replace(/^[-–:,\s]+|[-–:,\s]+$/g, '')
    .slice(0, 80);

  return {
    kind: 'expense',
    amount,
    category: detectCategory(rest || text),
    description: rest || 'Sem descrição',
  };
}
