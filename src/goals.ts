import { Compass, MessageCircle, TrendingDown, ShieldCheck, Target, Gift, Droplets, ShoppingBag, LucideIcon } from 'lucide-react';
import type { ToolId } from './tools';

// "O que você quer resolver?": a pessoa escolhe pelo problema dela, não pelo nome da ferramenta.
// O dia a dia do dinheiro (gastos e entradas) fica no WhatsApp; o resto abre a ferramenta certa no site.

export type GoalAction = { kind: 'tool'; tool: ToolId } | { kind: 'diag' } | { kind: 'whatsapp' };

export interface SiteGoal {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: 'gold' | 'lapis' | 'sage' | 'clay';
  action: GoalAction;
}

export const SITE_GOALS: SiteGoal[] = [
  { id: 'organizar', title: 'Não sei por onde começar', description: 'O diagnóstico mostra sua nota, seu perfil e o primeiro passo, em 10 minutos.', icon: Compass, tone: 'gold', action: { kind: 'diag' } },
  { id: 'gastos', title: 'Controlar meus gastos', description: 'Anote pelo WhatsApp o que gasta e o que entra e veja quanto ainda pode gastar.', icon: MessageCircle, tone: 'sage', action: { kind: 'whatsapp' } },
  { id: 'dividas', title: 'Sair das dívidas', description: 'Qual pagar primeiro e quando você fica livre.', icon: TrendingDown, tone: 'clay', action: { kind: 'tool', tool: 'debts' } },
  { id: 'renegociar', title: 'Renegociar com o banco', description: 'O que a lei garante e a mensagem pronta pra pedir juros menores.', icon: ShieldCheck, tone: 'lapis', action: { kind: 'tool', tool: 'rights' } },
  { id: 'guardar', title: 'Juntar dinheiro', description: 'Quanto guardar por mês pra chegar na sua meta.', icon: Target, tone: 'gold', action: { kind: 'tool', tool: 'goal' } },
  { id: 'extra', title: 'Usar bem o 13º ou um extra', description: 'Onde colocar cada real que entrou a mais.', icon: Gift, tone: 'gold', action: { kind: 'tool', tool: 'extra' } },
  { id: 'sobra', title: 'Achar dinheiro perdido', description: 'Assinaturas, tarifas e seguros que você nem vê.', icon: Droplets, tone: 'sage', action: { kind: 'tool', tool: 'leaks' } },
  { id: 'comprar', title: 'Decidir uma compra', description: 'Quanto ela custa em dias de trabalho, antes de passar o cartão.', icon: ShoppingBag, tone: 'clay', action: { kind: 'tool', tool: 'impulse' } },
];
