// Começar pelo objetivo da pessoa, não pela lista de ferramentas: "o que você quer resolver?".
// Cada objetivo leva direto pra ferramenta certa. Também entende quem escreve o objetivo com as próprias palavras
// ("quero sair das dívidas", "preciso juntar dinheiro pra viajar"). Funções puras, sem banco.

import type { Outgoing } from './meta.js';

export type GoalId = 'divida' | 'guardar' | 'gastos' | 'sobra' | 'extra' | 'comprar' | 'direitos' | 'emprestimo' | 'organizar';

export interface Goal {
  id: GoalId;
  title: string; // até 24 caracteres (limite do WhatsApp)
  description: string; // até 72
  intro: string; // o que o bot diz ao escolher, antes de abrir a ferramenta
}

export const GOALS: Goal[] = [
  { id: 'divida', title: 'Sair das dívidas', description: 'Descubra qual pagar primeiro e como negociar', intro: '🎯 *Seu objetivo: sair das dívidas.* O primeiro passo é saber qual dívida pagar antes. Me conta as suas e eu mostro a ordem.' },
  { id: 'guardar', title: 'Juntar dinheiro', description: 'Veja quanto guardar por mês pra chegar lá', intro: '🎯 *Seu objetivo: juntar dinheiro.* Vou calcular quanto você precisa guardar por mês pra chegar na sua meta.' },
  { id: 'gastos', title: 'Controlar meus gastos', description: 'Anote o que gasta e veja pra onde o dinheiro vai', intro: '🎯 *Seu objetivo: controlar os gastos.* Só dá pra controlar o que a gente enxerga. É simples: você me manda o que gastou e eu anoto e somo pra você.' },
  { id: 'sobra', title: 'Achar dinheiro que sobra', description: 'Assinaturas, tarifas e cobranças que você nem vê', intro: '🎯 *Seu objetivo: achar dinheiro que sobra.* Muita gente paga todo mês por coisas que nem usa. Vamos caçar isso.' },
  { id: 'extra', title: 'Usar o 13º ou um extra', description: 'Onde colocar cada real que entrou a mais', intro: '🎯 *Seu objetivo: usar bem um dinheiro extra* (13º, restituição, bônus). Vou mostrar a melhor ordem pra cada real.' },
  { id: 'comprar', title: 'Decidir uma compra', description: 'Vale a pena? Quanto custa em dias de trabalho', intro: '🎯 *Seu objetivo: decidir uma compra.* Vou mostrar quanto ela pesa no seu bolso, pra você decidir com calma.' },
  { id: 'emprestimo', title: 'Comparar empréstimos', description: 'Qual proposta sai mais barata no total', intro: '🎯 *Seu objetivo: escolher um empréstimo.* Vou mostrar quanto cada proposta custa de verdade no final.' },
  { id: 'direitos', title: 'Conhecer meus direitos', description: 'Banco, cartão e dívida: o que a lei garante', intro: '🎯 *Seu objetivo: conhecer seus direitos.* Muita cobrança pode ser contestada. Escolha o assunto e eu explico, com mensagem pronta.' },
  { id: 'organizar', title: 'Organizar tudo', description: 'Não sei por onde começar: 3 perguntas rápidas', intro: '🎯 *Seu objetivo: organizar o dinheiro.* Ótimo começo! Com 3 perguntas rápidas eu mostro onde você está.' },
];

export const goalById = (id: string): Goal | undefined => GOALS.find((g) => g.id === id);

/** A lista "o que você quer resolver?". O texto de cima muda: apresentação na 1ª vez, pergunta curta depois. */
export function goalsMenu(text: string): Outgoing {
  const rows = [
    ...GOALS.map((g) => ({ id: `goal:${g.id}`, title: g.title, description: g.description })),
    { id: 'menu:menu', title: 'Ver todas as opções', description: 'A lista completa de tudo que eu faço' },
  ];
  return { kind: 'list', text, button: 'Escolher meu objetivo', rows };
}

export const GOALS_HELLO = (hi: string) =>
  `${hi}Eu sou o assistente da *Grana Séria*. 🪙\n\nEu ajudo você a organizar o dinheiro, um passo de cada vez, com as ideias do livro *O Homem Mais Rico da Babilônia*.\n\nPra ajudar do jeito certo, me conta: *o que você quer resolver agora?* Toque em *Escolher meu objetivo*. Se não sabe por onde começar, escolha *Organizar tudo*.`;

export const GOALS_ASK = '🎯 *O que você quer resolver agora?* Toque em *Escolher meu objetivo* e eu abro a ferramenta certa.';

/** Palavras que abrem a lista de objetivos. */
export const GOALS_WORDS = /^(objetivo|objetivos|meu objetivo|meus objetivos|o que voce faz|o que voce pode fazer)$/;

// Frases que declaram um objetivo ("quero...", "preciso...", "como faço pra..."). Só com esse começo é que tentamos
// entender, pra nunca confundir com um gasto ("gastei 35 no cartão") ou com resposta de uma conversa.
const GOAL_OPENER = /^(eu )?(quero|preciso|gostaria|queria|tenho que|tenho vontade|como (eu )?(faco|posso|consigo|saio|pago|junto|guardo|economizo|controlo|organizo)|me ajuda|me ajude|ajuda( com| a| pra)?|nao sei|to|estou|ando|tenho)\b/;

const KEYWORDS: [GoalId, RegExp][] = [
  ['emprestimo', /(pegar|fazer|comparar|simular|contratar|escolher).*(emprestimo|financiamento|consignado)|(emprestimo|financiamento|consignado).*(comparar|simular|qual)/],
  ['direitos', /(direito|procon|indevid|abusiv|cobraram a mais|me cobrou|banco (me )?(cobr|negou))/],
  ['extra', /(13|decimo|bonus|restituicao|dinheiro extra|ganhei um dinheiro|recebi um dinheiro)/],
  ['comprar', /(comprar|compra|vale a pena|trocar de (celular|carro|moto))/],
  ['divida', /(divid|devendo|devo |no vermelho|nome sujo|negativ|cartao estourado|pagar (o )?cartao|rotativo|cheque especial|emprestimo|atrasad)/],
  ['sobra', /(sobrar|sobra|assinatura|tarifa|cortar|reduzir|economizar no|desconto|cobranca|vazamento|desperdicio)/],
  ['guardar', /(juntar|guardar|poupar|economizar|reserva|viajar|viagem|sonho|meta|casa propria|comprar um carro|aposentad|investir|futuro)/],
  ['gastos', /(gasto|despesa|controlar|anotar|registrar|pra onde (vai|foi|esta indo) (o |meu )?dinheiro|nao sei (onde|pra onde))/],
  ['organizar', /(organizar|comecar|planejar|plano|diagnostico|vida financeira|nao sei|dinheiro|financas|ajuda)/],
];

/** Entende o objetivo escrito. null = não parece um objetivo; 'menu' = parece, mas não deu pra escolher (mostra a lista). */
export function goalFromText(normalized: string): GoalId | 'menu' | null {
  if (!GOAL_OPENER.test(normalized)) return null;
  // pedido de ajuda sem dizer o quê: mostra a lista pra a pessoa escolher
  if (/^(me ajuda|me ajude|ajuda|quero ajuda|preciso de ajuda)( com (o )?dinheiro)?$/.test(normalized)) return 'menu';
  for (const [id, re] of KEYWORDS) {
    if (!re.test(normalized)) continue;
    // "tenho 35 de gasto no mercado" é um gasto a anotar, não um objetivo
    if (id === 'gastos' && /\d/.test(normalized)) return null;
    return id;
  }
  return /^(me ajuda|me ajude|ajuda|quero ajuda|preciso de ajuda)/.test(normalized) ? 'menu' : null;
}
