// Categorias dos lançamentos (spec v2, 7.2 "Anotar"): os mesmos nomes, as mesmas palavras e a mesma ordem do
// assistente do WhatsApp (server/whatsapp/parse.ts). Assim o que é anotado aqui e lá cai no mesmo lugar.
// Puro: sem DOM e sem localStorage (os ícones são só componentes do lucide).

import {
  ArrowDownLeft,
  Briefcase,
  Car,
  Coins,
  Gift,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
  House,
  PawPrint,
  PiggyBank,
  Receipt,
  Scissors,
  ShoppingBag,
  Tag,
  Ticket,
  TrendingUp,
  Undo2,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

export const GUARDADO = 'Guardado';
export const OUTROS = 'Outros';

export interface Categoria {
  nome: string; // o nome gravado (igual ao do WhatsApp)
  rotulo: string; // como aparece na tela
  palavras: string[];
}

/** Gastos, na ordem do bot (a primeira que bate ganha: "reserva do hotel" é Lazer, "reserva" sozinha é Guardado). */
export const CATEGORIAS_SAIDA: Categoria[] = [
  {
    nome: 'Alimentação',
    rotulo: 'Comida',
    palavras: [
      'mercado', 'mercad', 'supermercado', 'ifood', 'ifod', 'almoço', 'almoco', 'janta', 'jantar', 'lanche', 'padaria', 'restaurante',
      'almocei', 'jantei', 'lanchei', 'comi', 'pão', 'pao', 'açaí', 'acai', 'bebida', 'refrigerante', 'salgado', 'lanchonete', 'churrasco', 'atacadão', 'atacadao', 'quitanda', 'rappi',
      'comida', 'pizza', 'café', 'cafe', 'hamburguer', 'açougue', 'acougue', 'feira', 'hortifruti', 'marmita', 'delivery', 'sorvete', 'doce',
    ],
  },
  {
    nome: 'Transporte',
    rotulo: 'Transporte',
    palavras: [
      'uber', 'uberr', 'abasteci', 'gasolina', 'gasosa', 'combustível', 'combustivel', 'etanol', 'álcool', 'alcool', 'ônibus', 'onibus', 'metrô', 'metro', 'trem',
      'estacionamento', 'pedágio', 'pedagio', 'taxi', 'táxi', 'passagem', 'oficina', 'mecânico', 'mecanico', 'ipva', 'posto',
      'carro', 'moto', 'pneu', 'revisão', 'revisao', 'lava jato', 'lavagem', '99', 'bilhete único', 'cartão de transporte',
    ],
  },
  {
    nome: 'Moradia',
    rotulo: 'Casa',
    palavras: ['aluguel', 'luz', 'energia', 'água', 'agua', 'internet', 'condomínio', 'condominio', 'gás', 'gas', 'iptu', 'faxina', 'diarista'],
  },
  {
    nome: 'Saúde',
    rotulo: 'Saúde',
    palavras: ['farmácia', 'farmacia', 'remédio', 'remedio', 'médico', 'medico', 'consulta', 'exame', 'dentista', 'academia', 'plano de saúde', 'plano de saude', 'psicólogo', 'psicologo'],
  },
  {
    nome: 'Lazer',
    rotulo: 'Lazer',
    palavras: ['cinema', 'bar', 'cerveja', 'show', 'netflix', 'spotify', 'viagem', 'jogo', 'balada', 'festa', 'passeio', 'hotel', 'streaming', 'ingresso', 'role', 'rolê'],
  },
  {
    nome: 'Compras',
    rotulo: 'Compras',
    palavras: ['roupa', 'tênis', 'tenis', 'sapato', 'shopping', 'amazon', 'shopee', 'mercado livre', 'presente', 'eletrônico', 'eletronico', 'celular', 'loja'],
  },
  {
    nome: 'Educação',
    rotulo: 'Educação',
    palavras: ['curso', 'livro', 'faculdade', 'escola', 'mensalidade', 'material escolar', 'apostila'],
  },
  { nome: 'Pets', rotulo: 'Pets', palavras: ['pet', 'pet shop', 'petshop', 'ração', 'racao', 'veterinário', 'veterinario', 'banho e tosa', 'areia do gato'] },
  {
    nome: 'Cuidados pessoais',
    rotulo: 'Cuidados pessoais',
    palavras: ['cabelo', 'cabeleireiro', 'cabeleireira', 'barbearia', 'barbeiro', 'salão', 'salao', 'manicure', 'unha', 'unhas', 'sobrancelha', 'depilação', 'depilacao', 'perfume', 'maquiagem', 'skincare'],
  },
  { nome: 'Doações', rotulo: 'Doações', palavras: ['dízimo', 'dizimo', 'oferta', 'doação', 'doacao', 'vaquinha', 'caridade'] },
  {
    nome: GUARDADO,
    rotulo: 'Guardado',
    palavras: ['guardei', 'guardar', 'investi', 'investimento', 'poupança', 'poupanca', 'reserva', 'tesouro', 'tesouro direto', 'cdb', 'caixinha', 'aplicação', 'aplicacao', 'apliquei'],
  },
  { nome: OUTROS, rotulo: 'Outros', palavras: [] },
];

/** De onde veio o dinheiro (entradas), como o bot: a primeira que bate ganha. */
export const FONTES_ENTRADA: { nome: string; re: RegExp[] }[] = [
  { nome: 'Salário', re: [/\bsalario\b/] },
  { nome: 'Renda extra', re: [/\b(decimo terceiro|bonus|ferias|plr|premio|participacao)\b/, /\b(freela(nce|s)?|bico|extra|servico|trabalho)\b/] },
  { nome: 'Venda', re: [/\b(vendi|venda|vendas)\b/] },
  { nome: 'Reembolso', re: [/\b(reembolso|reembolsaram|devolucao|restituicao)\b/] },
  { nome: 'Presente', re: [/\b(presente|mesada)\b/] },
  { nome: 'Rendimento', re: [/\b(rendimento|juros|dividendos?|cashback)\b/] },
  { nome: OUTROS, re: [] },
];

/** Como foi pago, na ordem do bot ("cartão de crédito" é Crédito; só "cartão", Cartão). */
const FORMAS: { nome: string; re: RegExp }[] = [
  { nome: 'Crédito', re: /\b(?:cart[aã]o\s+(?:de\s+)?)?cr[eé]dito\b/i },
  { nome: 'Débito', re: /\b(?:cart[aã]o\s+(?:de\s+)?)?d[eé]bito\b/i },
  { nome: 'Pix', re: /\bpix\b/i },
  { nome: 'Dinheiro', re: /\b(?:dinheiro|esp[eé]cie|cash)\b/i },
  { nome: 'Boleto', re: /\bboleto\b/i },
  { nome: 'Vale', re: /\bvale[\s-]?(?:refei[cç][aã]o|alimenta[cç][aã]o)\b|\b(?:vr|vt)\b/i },
  { nome: 'Cartão', re: /\bcart[aã]o\b/i },
];

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A categoria do gasto pelas palavras da descrição. null: nenhuma palavra conhecida (a tela mantém a escolha). */
export function detectarCategoria(texto: string): string | null {
  const t = ` ${normalizar(texto)} `;
  if (!t.trim()) return null;
  for (const c of CATEGORIAS_SAIDA) {
    for (const p of c.palavras) {
      // palavra inteira (aceitando plural), pra "bar" não pegar "barbearia"
      if (new RegExp(`[^a-z0-9]${escapar(normalizar(p))}s?[^a-z0-9]`).test(t)) return c.nome;
    }
  }
  return null;
}

/** De onde veio a entrada, pelas palavras. null se não souber. */
export function detectarFonte(texto: string): string | null {
  const t = normalizar(texto);
  if (!t) return null;
  return FONTES_ENTRADA.find((f) => f.re.some((re) => re.test(t)))?.nome ?? null;
}

/** "mercado no pix" → Pix. null se a descrição não disser. */
export function detectarForma(texto: string): string | null {
  return FORMAS.find((f) => f.re.test(texto))?.nome ?? null;
}

/** Como a categoria aparece na tela ("Alimentação" → "Comida"). Categoria desconhecida fica como veio. */
export function rotuloCategoria(nome: string): string {
  return CATEGORIAS_SAIDA.find((c) => c.nome === nome)?.rotulo ?? nome;
}

/** O nome gravado a partir do nome ou do rótulo, sem ligar pra acento e maiúscula ("comida" → "Alimentação"). */
export function categoriaPorNome(texto: string): string | null {
  const t = normalizar(texto);
  if (!t) return null;
  return CATEGORIAS_SAIDA.find((c) => normalizar(c.nome) === t || normalizar(c.rotulo) === t)?.nome ?? null;
}

/* ---------- ícones (os mesmos emojis do bot, em traço fino) ---------- */

export const ICONES_SAIDA: Record<string, LucideIcon> = {
  Alimentação: Utensils,
  Transporte: Car,
  Moradia: House,
  Saúde: HeartPulse,
  Lazer: Ticket,
  Compras: ShoppingBag,
  Educação: GraduationCap,
  Pets: PawPrint,
  'Cuidados pessoais': Scissors,
  Doações: HeartHandshake,
  Guardado: PiggyBank,
  Outros: Receipt,
};

export const ICONES_ENTRADA: Record<string, LucideIcon> = {
  Salário: Briefcase,
  'Renda extra': Coins,
  Venda: Tag,
  Reembolso: Undo2,
  Presente: Gift,
  Rendimento: TrendingUp,
  Outros: ArrowDownLeft,
};

export function iconeCategoria(nome: string, tipo: 'out' | 'in' = 'out'): LucideIcon {
  return (tipo === 'in' ? ICONES_ENTRADA[nome] ?? ArrowDownLeft : ICONES_SAIDA[nome]) ?? Receipt;
}
