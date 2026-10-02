import { ShoppingBag, TrendingDown, Award, CalendarCheck, TrendingUp, Target, Scale, LucideIcon } from 'lucide-react';

export type ToolId = 'impulse' | 'debts' | 'selos' | 'checkin' | 'longterm' | 'goal' | 'loan';

export interface ToolInfo {
  id: ToolId;
  title: string;
  short: string; // rótulo curto pra menus e chips
  description: string;
  icon: LucideIcon;
  // tom do ícone — mantém a paleta da marca (ouro, lápis, sálvia, terracota)
  tone: 'gold' | 'lapis' | 'sage' | 'clay';
  // ferramentas que dependem do diagnóstico ganham uma etiqueta pra não frustrar quem chega direto
  needsDiagnosis?: boolean;
}

export const TOOLS: ToolInfo[] = [
  {
    id: 'impulse',
    title: 'Vale a pena comprar isso?',
    short: 'Freio de impulso',
    description: 'Antes de uma compra por impulso, veja o que ela custa em dias de trabalho e na sua meta de poupança.',
    icon: ShoppingBag,
    tone: 'clay',
  },
  {
    id: 'longterm',
    title: 'Simulador de longo prazo',
    short: 'Longo prazo',
    description: 'Ajuste aporte, taxa e prazo e veja aonde sua poupança chega em 10, 20 ou 30 anos.',
    icon: TrendingUp,
    tone: 'sage',
  },
  {
    id: 'goal',
    title: 'Calculadora de meta',
    short: 'Meta',
    description: 'Diga aonde quer chegar — viagem, entrada de imóvel — e veja quanto guardar por mês.',
    icon: Target,
    tone: 'gold',
  },
  {
    id: 'loan',
    title: 'Comparador de empréstimo',
    short: 'Empréstimo',
    description: 'Antes de contratar, compare duas propostas de empréstimo ou financiamento lado a lado.',
    icon: Scale,
    tone: 'lapis',
  },
  {
    id: 'debts',
    title: 'Avalanche vs. bola de neve',
    short: 'Quitar dívidas',
    description: 'Duas estratégias pra decidir qual dívida atacar primeiro, a partir das dívidas do diagnóstico.',
    icon: TrendingDown,
    tone: 'clay',
    needsDiagnosis: true,
  },
  {
    id: 'checkin',
    title: 'Check-in mensal',
    short: 'Check-in',
    description: 'Registre seus números todo mês e acompanhe se a sua taxa de poupança está subindo.',
    icon: CalendarCheck,
    tone: 'sage',
  },
  {
    id: 'selos',
    title: 'Meus selos',
    short: 'Selos',
    description: 'Veja quais das quatro leis do livro você já desbloqueou ao completar o diagnóstico.',
    icon: Award,
    tone: 'gold',
    needsDiagnosis: true,
  },
];

export function getTool(id: ToolId): ToolInfo {
  return TOOLS.find((t) => t.id === id)!;
}
