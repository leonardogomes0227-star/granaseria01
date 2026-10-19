import { Compass, MessageCircle, TrendingDown, ShieldCheck, Target, Gift, Droplets, ShoppingBag, LayoutDashboard, LucideIcon } from 'lucide-react';
import type { ToolId } from './tools';

// "O que você quer fazer?": a primeira coisa do site. A pessoa escolhe pelo que quer resolver, não pelo nome da
// ferramenta. Os seis primeiros aparecem logo de cara; o resto fica em "Mais ferramentas".
// O dia a dia do dinheiro (gastos e entradas) fica no WhatsApp; o resto abre a ferramenta certa aqui no site.

export type GoalAction = { kind: 'tool'; tool: ToolId } | { kind: 'diag' } | { kind: 'whatsapp' } | { kind: 'painel' };

export interface SiteGoal {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: 'gold' | 'lapis' | 'sage' | 'clay';
  action: GoalAction;
}

export const SITE_GOALS: SiteGoal[] = [
  { id: 'organizar', title: 'Organizar minhas finanças', description: 'Umas perguntas e você recebe sua nota e um plano de ação com valores e datas.', icon: Compass, tone: 'gold', action: { kind: 'diag' } },
  { id: 'painel', title: 'Ver como está meu mês', description: 'Seu painel: o que entrou, o que saiu e quanto ainda dá pra gastar.', icon: LayoutDashboard, tone: 'lapis', action: { kind: 'painel' } },
  { id: 'gastos', title: 'Anotar meus gastos', description: 'Mande no WhatsApp do seu jeito, tipo "mercado 80 no pix".', icon: MessageCircle, tone: 'sage', action: { kind: 'whatsapp' } },
  { id: 'dividas', title: 'Sair das dívidas', description: 'Qual pagar primeiro e quando você fica livre.', icon: TrendingDown, tone: 'clay', action: { kind: 'tool', tool: 'debts' } },
  { id: 'guardar', title: 'Juntar dinheiro', description: 'Quanto guardar por mês pra chegar na sua meta.', icon: Target, tone: 'gold', action: { kind: 'tool', tool: 'goal' } },
  { id: 'comprar', title: 'Decidir uma compra', description: 'Se cabe no seu mês e quanto custa em dias de trabalho.', icon: ShoppingBag, tone: 'clay', action: { kind: 'tool', tool: 'impulse' } },
  { id: 'renegociar', title: 'Renegociar com o banco', description: 'O que a lei garante e a mensagem pronta pra pedir juros menores.', icon: ShieldCheck, tone: 'lapis', action: { kind: 'tool', tool: 'rights' } },
  { id: 'extra', title: 'Usar bem o 13º ou um extra', description: 'Onde colocar cada real que entrou a mais.', icon: Gift, tone: 'gold', action: { kind: 'tool', tool: 'extra' } },
  { id: 'sobra', title: 'Achar dinheiro perdido', description: 'Assinaturas, tarifas e seguros que você nem vê.', icon: Droplets, tone: 'sage', action: { kind: 'tool', tool: 'leaks' } },
];

/** Quantos objetivos aparecem logo de cara (o resto vai pra "Mais ferramentas"). */
export const MAIN_GOALS = 6;
