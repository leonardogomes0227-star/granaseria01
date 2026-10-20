import { Coins, HandCoins, Landmark, PiggyBank, Receipt, Scale, SearchCheck, type LucideIcon } from 'lucide-react';
import type { ToolId } from './tools';
import type { WizardData } from './types';
import type { NewTask } from './coach';
import { formatBRL } from './calculations';

// Os conselheiros: cada um cuida de uma dor, com a voz de um personagem de O Homem Mais Rico da Babilônia
// (domínio público) e as ideias de Pai Rico, Pai Pobre. A conversa tem 3 perguntas; as respostas viram
// o plano dele (frases) e os próximos passos do coach, com lembrete. A ferramenta de cada um faz as contas.

export interface AgentQuestion {
  key: string;
  q: string;
  options: [string, string][];
}

export interface Agent {
  id: string;
  name: string;
  role: string; // o que ele faz, numa linha
  does: string; // o que ele vigia e avisa, numa frase só (aparece nos cartões)
  extra?: ToolId[]; // outras telas que ele abre quando ajuda (a lista de ferramentas não existe mais)
  story: string; // quem ele é no livro, numa frase
  intro: string; // o que ele diz ao começar
  tool: ToolId;
  icon: LucideIcon;
  hue: number; // cor do cartão
  questions: AgentQuestion[];
}

export const AGENTS: Agent[] = [
  {
    id: 'dabasir',
    name: 'Dabasir',
    role: 'Te tira das dívidas, uma por uma',
    does: 'Te lembra de pagar as dívidas, uma por uma',
    story: 'Vendedor de camelos que se afundou em dívidas e saiu delas pagando um pouco a cada credor, todo mês.',
    intro: 'Eu já devi pra muita gente e sei como pesa. O caminho que me tirou: viver com 70% do que ganho, guardar 10% e usar 20% pra pagar quem eu devia. Vamos montar o seu.',
    tool: 'debts',
    extra: ['rights'],
    icon: HandCoins,
    hue: 14,
    questions: [
      { key: 'quantas', q: 'Quantas dívidas você tem hoje?', options: [['1', 'Uma'], ['2-3', 'Duas ou três'], ['4+', 'Quatro ou mais']] },
      { key: 'atraso', q: 'Alguma está atrasada?', options: [['nao', 'Não, pago em dia'], ['algumas', 'Algumas'], ['todas', 'Quase todas']] },
      { key: 'cobranca', q: 'Os credores estão te cobrando?', options: [['nao', 'Não'], ['sim', 'Sim, toda hora']] },
    ],
  },
  {
    id: 'bansir',
    name: 'Bansir',
    role: 'Organiza as contas do mês pra nada vencer esquecido',
    does: 'Avisa no WhatsApp antes de cada conta vencer',
    story: 'Fazia carruagens, trabalhava de sol a sol e mesmo assim nunca sobrava nada. Até aprender pra onde o dinheiro ia.',
    intro: 'Eu trabalhava muito e o dinheiro sumia. Quando passei a anotar cada conta e cada vencimento, parei de pagar multa e comecei a sobrar. Vamos organizar as suas.',
    tool: 'bills',
    icon: Receipt,
    hue: 36,
    questions: [
      { key: 'recebe', q: 'Como o dinheiro entra pra você?', options: [['fixo', 'Salário fixo, uma vez no mês'], ['picado', 'Aos poucos, durante o mês'], ['variavel', 'Varia muito']] },
      { key: 'esquece', q: 'Você já pagou multa por esquecer uma conta?', options: [['nao', 'Nunca'], ['as-vezes', 'Às vezes'], ['sempre', 'Quase todo mês']] },
      { key: 'quantas', q: 'Quantas contas fixas você tem?', options: [['poucas', 'Até 5'], ['muitas', 'Mais de 5']] },
    ],
  },
  {
    id: 'arkad',
    name: 'Arkad',
    role: 'Te ensina a guardar, mesmo ganhando pouco',
    does: 'Te lembra de guardar quando o salário cai',
    story: 'O homem mais rico da Babilônia. Começou guardando uma moeda de cada dez que ganhava.',
    intro: 'Uma parte de tudo o que você ganha é sua pra guardar. Não o que sobra: o que você separa primeiro. Comece com 10%, ou com o que der. Vamos ver o seu caso.',
    tool: 'tracker',
    extra: ['goal'],
    icon: PiggyBank,
    hue: 44,
    questions: [
      { key: 'sobra', q: 'No fim do mês, sobra dinheiro?', options: [['sobra', 'Sobra um pouco'], ['zero', 'Fica no zero'], ['falta', 'Falta']] },
      { key: 'reserva', q: 'Você tem dinheiro guardado pra emergência?', options: [['nada', 'Nada'], ['pouco', 'Um pouco'], ['meses', 'Pra uns meses']] },
      { key: 'quanto', q: 'Quanto você topa separar todo mês?', options: [['10', '10% do que ganho'], ['5', '5%, pra começar'], ['fixo', 'Um valor fixo pequeno']] },
    ],
  },
  {
    id: 'nomasir',
    name: 'Nomasir',
    role: 'Acha o dinheiro que escapa sem você ver',
    does: 'Te lembra de cortar o que você não usa',
    story: 'Filho de Arkad, perdeu todo o ouro confiando em quem não devia. Aprendeu a vigiar cada moeda.',
    intro: 'Eu perdi tudo por não prestar atenção. Hoje eu olho tarifa, assinatura e seguro que ninguém lembra que paga. Vamos achar o que está escapando de você.',
    tool: 'leaks',
    extra: ['fatura'],
    icon: SearchCheck,
    hue: 200,
    questions: [
      { key: 'assinaturas', q: 'Você paga assinaturas (streaming, apps, academia)?', options: [['nao', 'Não'], ['poucas', 'Uma ou duas'], ['varias', 'Várias']] },
      { key: 'fatura', q: 'Você confere a fatura do cartão todo mês?', options: [['sim', 'Confiro'], ['nao', 'Não confiro']] },
      { key: 'tarifa', q: 'Paga pacote de tarifa no banco?', options: [['nao', 'Não'], ['sim', 'Pago'], ['nao-sei', 'Não sei']] },
    ],
  },
  {
    id: 'mathon',
    name: 'Mathon',
    role: 'Te protege antes de pegar empréstimo',
    does: 'Compara empréstimos antes de você assinar',
    story: 'O emprestador de ouro da Babilônia. Sabia que o empréstimo bom é o que a pessoa consegue devolver.',
    intro: 'Já emprestei muito ouro e vi gente se perder em parcela. Antes de assinar, a gente olha o custo total e se cabe no seu mês. Me conta.',
    tool: 'loan',
    icon: Scale,
    hue: 260,
    questions: [
      { key: 'pra-que', q: 'Pra que é o empréstimo?', options: [['divida', 'Pagar outra dívida'], ['compra', 'Uma compra'], ['emergencia', 'Uma emergência']] },
      { key: 'propostas', q: 'Você já tem propostas?', options: [['uma', 'Uma só'], ['varias', 'Duas ou mais'], ['nenhuma', 'Nenhuma ainda']] },
      { key: 'parcela', q: 'Sabe quanto ficaria a parcela?', options: [['sim', 'Sei'], ['nao', 'Não sei']] },
    ],
  },
  {
    id: 'rodan',
    name: 'Rodan',
    role: 'Faz o 13º e o dinheiro extra render de verdade',
    does: 'Dá destino ao 13º e ao dinheiro extra',
    story: 'Fazedor de lanças que ganhou 50 moedas de ouro de uma vez e quase perdeu tudo sem saber o que fazer.',
    intro: 'Dinheiro extra some rápido se não tiver destino. Antes de cair, a gente decide onde vai cada real. Vamos lá.',
    tool: 'extra',
    icon: Coins,
    hue: 120,
    questions: [
      { key: 'tipo', q: 'Que dinheiro extra vai entrar?', options: [['13', '13º salário'], ['ir', 'Restituição do IR'], ['outro', 'Bônus, venda ou outro']] },
      { key: 'dividas', q: 'Você tem dívida com juros alto (cartão, cheque especial)?', options: [['sim', 'Tenho'], ['nao', 'Não tenho']] },
      { key: 'reserva', q: 'Já tem reserva de emergência?', options: [['nao', 'Não'], ['sim', 'Tenho']] },
    ],
  },
  {
    id: 'sharru',
    name: 'Sharru Nada',
    role: 'Te mostra o caminho pra viver de renda',
    does: 'Mostra quanto falta pra viver de renda',
    story: 'Mercador que fez o ouro trabalhar por ele. Ou, como diz o Pai Rico: compre ativos, não passivos.',
    intro: 'Rico não é quem ganha muito, é quem tem dinheiro entrando sem precisar trabalhar. Vamos ver quanto falta pra você e o primeiro passo.',
    tool: 'richdad',
    icon: Landmark,
    hue: 165,
    questions: [
      { key: 'dividas', q: 'Você ainda tem dívidas?', options: [['sim', 'Tenho'], ['nao', 'Não tenho']] },
      { key: 'investe', q: 'Você já investe algum dinheiro?', options: [['nao', 'Não'], ['pouco', 'Um pouco'], ['sim', 'Todo mês']] },
      { key: 'prazo', q: 'Em quanto tempo você quer viver de renda?', options: [['10', 'Uns 10 anos'], ['20', 'Uns 20 anos'], ['30', 'Mais de 20 anos']] },
    ],
  },
];

export const getAgent = (id: string | undefined) => AGENTS.find((a) => a.id === id);

/** O conselheiro de cada ferramenta (pra indicar pelas perguntas da entrada). */
export const agentForTool = (tool: ToolId) => AGENTS.find((a) => a.tool === tool);

export interface AgentPlan {
  lines: string[];
  tasks: NewTask[];
}

/** O plano do conselheiro: o que ele recomenda, com valores quando o diagnóstico existe, e os próximos passos. */
export function agentPlan(agent: Agent, a: Record<string, string>, data: WizardData): AgentPlan {
  const income = data.monthlyIncome;
  const pct = (p: number) => (income > 0 ? formatBRL(Math.round(income * p)) : `${Math.round(p * 100)}% do que entra`);
  const lines: string[] = [];
  const tasks: NewTask[] = [];
  switch (agent.id) {
    case 'dabasir':
      lines.push(`Viva com 70% do que ganha, guarde 10% e use 20% (${pct(0.2)} por mês) pra pagar as dívidas.`);
      lines.push(a.quantas === '1' ? 'Concentre tudo nessa dívida até ela acabar.' : 'Pague o mínimo em todas e jogue o resto na de juros mais alto. A ferramenta mostra a ordem.');
      if (a.atraso !== 'nao') lines.push('Vá até cada credor e proponha um valor que caiba nos 20%. Quem mostra plano consegue acordo.');
      if (a.cobranca === 'sim') lines.push('Cobrança abusiva (de madrugada, no trabalho, expondo você) é proibida. A mensagem pronta está em Negociar com o banco.');
      tasks.push({ text: 'Cadastrar todas as dívidas em Contas a pagar', inDays: 1 });
      tasks.push({ text: `Separar ${pct(0.2)} pras dívidas assim que o dinheiro cair`, inDays: 5, repeat: 'monthly' });
      if (a.atraso !== 'nao') tasks.push({ text: 'Falar com o credor mais atrasado e propor um valor por mês', inDays: 2 });
      break;
    case 'bansir':
      lines.push('Cadastre cada conta com o dia do vencimento. Eu te lembro na véspera.');
      if (a.recebe !== 'fixo') lines.push('Como o dinheiro entra aos poucos, use "Entrou dinheiro agora?": eu digo o que pagar primeiro com cada valor.');
      if (a.esquece !== 'nao') lines.push('Multa de atraso é dinheiro jogado fora: 2% mais juros todo mês. Com os lembretes, isso acaba.');
      lines.push('Toda semana, uma olhada de 2 minutos no que vence nos próximos dias.');
      tasks.push({ text: 'Cadastrar as contas fixas em Contas a pagar', inDays: 0 });
      tasks.push({ text: 'Olhar o que vence nos próximos 7 dias', inDays: 7, repeat: 'monthly' });
      break;
    case 'arkad': {
      const p = a.quanto === '5' ? 0.05 : 0.1;
      lines.push(a.quanto === 'fixo' ? 'Escolha um valor pequeno que você consiga todo mês, nem que seja R$ 20. O hábito vale mais que o valor.' : `Separe ${pct(p)} todo mês, no dia em que o dinheiro cair, antes de pagar qualquer coisa.`);
      if (a.sobra !== 'sobra') lines.push('Se hoje não sobra, comece cortando um gasto escondido: o Nomasir te ajuda a achar.');
      lines.push(a.reserva === 'meses' ? 'Sua reserva já existe: agora o que você guarda pode ir pra investimento.' : 'Primeiro objetivo: uma reserva de emergência, num lugar que rende e deixa sacar na hora.');
      tasks.push({ text: 'Abrir uma conta ou "caixinha" só pra guardar', inDays: 3 });
      tasks.push({ text: a.quanto === 'fixo' ? 'Guardar o valor combinado no dia do pagamento' : `Guardar ${pct(p)} no dia do pagamento`, inDays: 5, repeat: 'monthly' });
      break;
    }
    case 'nomasir':
      if (a.assinaturas !== 'nao') lines.push('Liste cada assinatura e cancele a que você não usou no último mês.');
      if (a.fatura === 'nao') lines.push('Confira a fatura todo mês: seguro e serviço que você não pediu aparecem ali. Me mande o PDF no WhatsApp que eu leio.');
      if (a.tarifa !== 'nao') lines.push('Todo banco é obrigado a oferecer uma conta sem tarifa (serviços essenciais). Peça a troca.');
      lines.push('O que você cortar entra direto no seu plano.');
      tasks.push({ text: 'Marcar o que você paga em Cortar gastos escondidos', inDays: 1 });
      if (a.fatura === 'nao') tasks.push({ text: 'Conferir a fatura do cartão (ou mandar o PDF no WhatsApp)', inDays: 7, repeat: 'monthly' });
      if (a.tarifa !== 'nao') tasks.push({ text: 'Pedir ao banco a troca pra conta sem tarifa', inDays: 3 });
      break;
    case 'mathon':
      lines.push('Compare sempre o custo total (parcela × vezes), não só o valor da parcela.');
      if (a['pra-que'] === 'divida') lines.push('Trocar dívida cara (cartão, cheque especial) por uma mais barata vale a pena, se a parcela couber e você não voltar a usar o cartão.');
      if (a['pra-que'] === 'compra') lines.push('Pra compra, o melhor empréstimo é nenhum: juntar por alguns meses quase sempre sai mais barato.');
      if (a.propostas !== 'varias') lines.push('Peça pelo menos duas propostas por escrito antes de decidir.');
      lines.push('A parcela não pode passar de 30% do que você ganha, somando tudo que já paga.');
      tasks.push({ text: 'Pedir duas propostas por escrito, com o custo total', inDays: 2 });
      tasks.push({ text: 'Comparar as propostas em Comparar empréstimos', inDays: 4 });
      break;
    case 'rodan':
      lines.push(a.dividas === 'sim' ? 'Primeiro, quite a dívida de juros mais alto: nenhum investimento rende o que o cartão cobra.' : 'Sem dívida cara: ótimo, o extra vai pra frente.');
      lines.push(a.reserva === 'nao' ? 'Depois, comece a reserva de emergência.' : 'Com a reserva pronta, uma parte pode ir pra investimento.');
      lines.push('Separe uma parte pequena (uns 10%) pra você aproveitar sem culpa.');
      tasks.push({ text: 'Simular onde vai cada real em Usar bem o 13º e extras', inDays: 1 });
      tasks.push({ text: 'No dia em que o dinheiro cair, fazer o combinado antes de gastar', inDays: a.tipo === '13' ? 30 : 10 });
      break;
    case 'sharru':
      if (a.dividas === 'sim') lines.push('Primeiro as dívidas: dívida é um passivo que tira dinheiro do seu bolso todo mês.');
      lines.push('Ativo põe dinheiro no seu bolso, passivo tira. Cada real investido é um ativo trabalhando por você.');
      lines.push(`A meta: o rendimento dos seus investimentos pagar suas contas. Em ${a.prazo === '30' ? 'mais de 20' : a.prazo} anos isso pede disciplina todo mês.`);
      if (a.investe !== 'sim') lines.push('Comece com um valor fixo todo mês, mesmo pequeno, num investimento de longo prazo como o Tesouro IPCA+.');
      tasks.push({ text: 'Ver quanto falta em Viver de renda', inDays: 1 });
      tasks.push({ text: 'Investir o valor combinado no dia do pagamento', inDays: 5, repeat: 'monthly' });
      break;
  }
  return { lines, tasks };
}

/* ---------- o conselheiro que a pessoa cria ---------- */

export interface CustomAgent {
  id: string;
  name: string;
  kind: 'juntar' | 'divida' | 'gasto';
  what: string; // a meta, a dívida ou o gasto
  amount: number;
  months: number;
  freq: 'semana' | 'mes';
  createdAt: string;
}

export const CUSTOM_AGENTS_KEY = 'gs-conselheiros';

export function customPlan(c: CustomAgent): AgentPlan {
  const perMonth = c.months > 0 ? Math.ceil(c.amount / c.months) : c.amount;
  const per = c.freq === 'semana' ? Math.ceil(perMonth / 4) : perMonth;
  const when = c.freq === 'semana' ? 'por semana' : 'por mês';
  const inDays = c.freq === 'semana' ? 7 : 30;
  if (c.kind === 'juntar')
    return {
      lines: [`Pra juntar ${formatBRL(c.amount)} pra ${c.what} em ${c.months} meses: ${formatBRL(per)} ${when}.`, 'Guarde numa conta separada, longe do dinheiro do dia a dia.'],
      tasks: [{ text: `Guardar ${formatBRL(per)} pra ${c.what}`, inDays, repeat: 'monthly' }],
    };
  if (c.kind === 'divida')
    return {
      lines: [`Pra quitar ${c.what} (${formatBRL(c.amount)}) em ${c.months} meses: ${formatBRL(per)} ${when}, além da parcela mínima.`, 'Se tiver juros alto, peça ao credor desconto pra quitar antes.'],
      tasks: [{ text: `Pagar ${formatBRL(per)} a mais em ${c.what}`, inDays, repeat: 'monthly' }],
    };
  return {
    lines: [`Pra gastar menos com ${c.what}: limite de ${formatBRL(per)} ${when}.`, 'Anote cada gasto disso no WhatsApp e eu te aviso quando chegar perto.'],
    tasks: [{ text: `Conferir se gastou no máximo ${formatBRL(per)} com ${c.what}`, inDays, repeat: 'monthly' }],
  };
}


/* ---------- Os agentes que a pessoa escolheu ter no app ---------- */
// Só aparecem na Home os que ela adicionou (e os que já têm avisos rodando). Não muda lembrete nenhum: é a vitrine dela.

export const CHOSEN_KEY = 'gs-agentes';

export function loadChosen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHOSEN_KEY) || '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveChosen(list: string[]) {
  try {
    localStorage.setItem(CHOSEN_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('gs-agentes'));
  } catch {
    // segue sem salvar
  }
}

export const addChosen = (id: string) => {
  const cur = loadChosen();
  if (!cur.includes(id)) saveChosen([...cur, id]);
};
