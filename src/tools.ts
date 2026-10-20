import { Receipt, Landmark, ClipboardCheck, ScanText, ShoppingBag, TrendingDown, Award, CalendarCheck, TrendingUp, Target, Scale, Quote, Gift, Droplets, ShieldCheck, LucideIcon } from 'lucide-react';

export type ToolId = 'bills' | 'richdad' | 'quote' | 'impulse' | 'debts' | 'selos' | 'checkin' | 'longterm' | 'goal' | 'loan' | 'extra' | 'leaks' | 'rights' | 'tracker' | 'fatura';

export interface ToolInfo {
  id: ToolId;
  slug: string; // endereço da ferramenta: /ferramentas/<slug>
  title: string;
  short: string; // rótulo curto pra menus e chips
  description: string;
  icon: LucideIcon;
  // tom do ícone — mantém a paleta da marca (ouro, lápis, sálvia, terracota)
  tone: 'gold' | 'lapis' | 'sage' | 'clay';
  // ferramentas que dependem do diagnóstico ganham uma etiqueta pra não frustrar quem chega direto
  needsDiagnosis?: boolean;
  // o sentido de cada ferramenta, em linguagem simples: aparece no topo dela e na lista do início
  guide: { serve: string; quando: string; recebe: string };
}

export const TOOLS: ToolInfo[] = [
  {
    id: 'bills',
    slug: 'minhas-contas',
    title: 'Contas a pagar',
    short: 'Contas',
    description: 'Cadastre cada conta e parcela com o vencimento, marque o que pagou e veja multa e juros quando atrasar.',
    icon: Receipt,
    tone: 'clay',
    guide: {
      serve: 'Não esquecer nenhuma conta e saber o que pagar primeiro quando o dinheiro entra aos poucos.',
      quando: 'Sempre que entrar um dinheiro ou chegar uma conta. Uma olhada por semana.',
      recebe: 'O que já pagou, o que vence e quando, quanto o atraso custou e um lembrete na véspera.',
    },
  },
  {
    id: 'richdad',
    slug: 'placar-pai-rico',
    title: 'Viver de renda',
    short: 'Viver de renda',
    description: 'Quanto tempo você viveria sem trabalhar e quanto falta pro seu dinheiro pagar suas contas sozinho.',
    icon: Landmark,
    tone: 'lapis',
    guide: { serve: 'Ver quanto falta pro seu dinheiro pagar suas contas sem você trabalhar (a ideia do livro Pai Rico, Pai Pobre).', quando: 'Uma vez por mês, ou quando guardar dinheiro ou quitar uma dívida.', recebe: 'Seu placar e quanto tempo falta pro seu dinheiro pagar suas contas.' },
  },
  {
    id: 'tracker',
    slug: 'meu-plano',
    title: 'Acompanhar meu plano',
    short: 'Meu plano',
    description: 'Feche cada mês dizendo quanto pagou. O plano se recalcula sozinho e mostra se você está adiantado ou atrasado.',
    icon: ClipboardCheck,
    tone: 'clay',
    needsDiagnosis: true,
    guide: { serve: 'Acompanhar o seu plano de ação, mês por mês.', quando: 'Todo mês, depois que o salário cair e você pagar as contas.', recebe: 'Se você está em dia, adiantado ou atrasado, e a data nova de cada meta.' },
  },
  {
    id: 'extra',
    slug: 'decimo-terceiro',
    title: 'Usar bem o 13º e extras',
    short: '13º',
    description: 'Recebeu 13º, restituição ou FGTS? Veja onde colocar cada real e quantos meses antes você sai das dívidas.',
    icon: Gift,
    tone: 'gold',
    guide: { serve: 'Decidir onde colocar um dinheiro que entrou a mais.', quando: 'Quando cair 13º, restituição, FGTS, bônus ou uma venda.', recebe: 'Quanto vai pra cada coisa e quantos meses isso adianta no seu plano.' },
  },
  {
    id: 'fatura',
    slug: 'leitor-de-fatura',
    title: 'Analisar minha fatura',
    short: 'Fatura',
    description: 'Mande o PDF da fatura ou do extrato: a IA acha assinaturas, seguros, tarifas e juros escondidos e organiza seus gastos.',
    icon: ScanText,
    tone: 'clay',
    guide: { serve: 'Achar cobranças escondidas na fatura do cartão ou no extrato.', quando: 'Quando a fatura vier mais alta do que você esperava.', recebe: 'A lista de assinaturas, tarifas e juros, e seus gastos separados por categoria.' },
  },
  {
    id: 'leaks',
    slug: 'caca-vazamentos',
    title: 'Cortar gastos escondidos',
    short: 'Gastos escondidos',
    description: 'Tarifas, seguros que você não pediu, assinaturas esquecidas: ache o dinheiro que escapa todo mês, com a mensagem pronta pra cancelar.',
    icon: Droplets,
    tone: 'lapis',
    guide: { serve: 'Achar dinheiro que sai todo mês sem você perceber.', quando: 'Quando o dinheiro some e você não sabe pra onde.', recebe: 'Quanto dá pra economizar por mês (entra no seu plano) e a mensagem pronta pra cancelar.' },
  },
  {
    id: 'rights',
    slug: 'seus-direitos',
    title: 'Negociar com o banco',
    short: 'Negociar',
    description: 'Portabilidade, desconto pra quitar antes, teto de juros do cartão: o que a lei já garante e a mensagem pra pedir.',
    icon: ShieldCheck,
    tone: 'sage',
    guide: { serve: 'Saber o que a lei garante quando você tem dívida ou problema com banco.', quando: 'Antes de renegociar, quitar uma dívida ou reclamar de uma cobrança.', recebe: 'O direito que vale pro seu caso e a mensagem pronta pra mandar pro banco.' },
  },
  {
    id: 'quote',
    slug: 'frase-do-dia',
    title: 'Frase do dia',
    short: 'Frase do dia',
    description: 'Uma frase nova todo dia sobre dinheiro e disciplina, em cartões prontos pra postar no story ou no feed.',
    icon: Quote,
    tone: 'lapis',
    guide: { serve: 'Uma frase sobre dinheiro pra te lembrar do plano.', quando: 'Todo dia, ou quando quiser postar algo.', recebe: 'Um cartão bonito pronto pro story ou pro feed.' },
  },
  {
    id: 'impulse',
    slug: 'vale-a-pena-comprar',
    title: 'Posso comprar isso?',
    short: 'Comprar',
    description: 'Antes de uma compra por impulso, veja o que ela custa em dias de trabalho e na sua meta de poupança.',
    icon: ShoppingBag,
    tone: 'clay',
    guide: { serve: 'Pensar duas vezes antes de uma compra.', quando: 'Antes de comprar algo que você não tinha planejado.', recebe: 'Quantos dias de trabalho a compra custa e quanto ela atrasa sua meta.' },
  },
  {
    id: 'longterm',
    slug: 'simulador-longo-prazo',
    title: 'Simulador de longo prazo',
    short: 'Longo prazo',
    description: 'Veja quanto o que você guarda por mês vira em 10, 20 ou 30 anos.',
    icon: TrendingUp,
    tone: 'sage',
    guide: { serve: 'Ver quanto o que você guarda vira com os anos.', quando: 'Quando quiser saber se vale a pena começar a investir agora.', recebe: 'Quanto você teria em 10, 20 ou 30 anos.' },
  },
  {
    id: 'goal',
    slug: 'calculadora-de-meta',
    title: 'Juntar pra um objetivo',
    short: 'Objetivo',
    description: 'Diga aonde quer chegar — viagem, entrada de imóvel — e veja quanto guardar por mês.',
    icon: Target,
    tone: 'gold',
    guide: { serve: 'Saber quanto guardar por mês pra chegar num valor.', quando: 'Quando tiver um sonho com preço: viagem, carro, entrada da casa.', recebe: 'O valor por mês. Salvando, a meta entra no seu plano de ação.' },
  },
  {
    id: 'loan',
    slug: 'comparador-de-emprestimo',
    title: 'Comparar empréstimos',
    short: 'Empréstimo',
    description: 'Antes de contratar, compare duas propostas de empréstimo ou financiamento lado a lado.',
    icon: Scale,
    tone: 'lapis',
    guide: { serve: 'Descobrir qual proposta de empréstimo sai mais barata.', quando: 'Antes de assinar um empréstimo ou financiamento.', recebe: 'Quanto cada uma custa no total e qual escolher.' },
  },
  {
    id: 'debts',
    slug: 'quitar-dividas',
    title: 'Sair das dívidas',
    short: 'Dívidas',
    description: 'Por qual dívida começar, quando você fica livre e quanto paga de juros.',
    icon: TrendingDown,
    tone: 'clay',
    needsDiagnosis: true,
    guide: { serve: 'Decidir a ordem certa de pagar suas dívidas.', quando: 'Quando você tem mais de uma dívida e não sabe por qual começar.', recebe: 'Por qual dívida começar, quando você fica livre e quanto vai pagar de juros.' },
  },
  {
    id: 'checkin',
    slug: 'check-in-mensal',
    title: 'Check-in mensal',
    short: 'Check-in',
    description: 'Registre seus números todo mês e acompanhe se a sua taxa de poupança está subindo.',
    icon: CalendarCheck,
    tone: 'sage',
    guide: { serve: 'Ver se você está guardando mais a cada mês.', quando: 'Uma vez por mês, no fim do mês.', recebe: 'A sua evolução mês a mês.' },
  },
  {
    id: 'selos',
    slug: 'meus-selos',
    title: 'Meus selos',
    short: 'Selos',
    description: 'Veja quais das quatro leis do livro você já desbloqueou ao completar o diagnóstico.',
    icon: Award,
    tone: 'gold',
    needsDiagnosis: true,
    guide: { serve: 'Ver suas conquistas com as leis do livro.', quando: 'Depois do diagnóstico, pra se motivar.', recebe: 'Os selos que você já ganhou e o que falta pros outros.' },
  },
];

export function getTool(id: ToolId): ToolInfo {
  return TOOLS.find((t) => t.id === id)!;
}

export function getToolBySlug(slug: string | undefined): ToolInfo | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

// Saíram da lista (a página continua abrindo por link antigo): o check-in e os selos viraram parte do
// "Meu plano, mês a mês", o simulador virou parte do passo "Comece a investir" do plano e a frase do dia é conteúdo.
const UNLISTED: ToolId[] = ['checkin', 'selos', 'quote', 'longterm'];
export const LISTED_TOOLS = TOOLS.filter((t) => !UNLISTED.includes(t.id));

/** O leitor de fatura só aparece com a IA ligada na Vercel (GET /api/fatura). */
let faturaCheck: Promise<boolean> | null = null;
export function faturaEnabled(): Promise<boolean> {
  faturaCheck ??= fetch('/api/fatura')
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((d: { enabled?: boolean }) => Boolean(d.enabled))
    .catch(() => false);
  return faturaCheck;
}
