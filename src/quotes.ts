// Frases do dia — textos próprios da Grana Séria, inspirados nos princípios de
// O Homem Mais Rico da Babilônia (não são citações literais de nenhuma tradução publicada).

export const QUOTES: string[] = [
  'Uma parte de tudo o que você ganha é sua. Guarde-a antes de pagar qualquer outra pessoa.',
  'Riqueza não é o que entra. É o que fica.',
  'Toda fortuna começou com uma moeda que alguém decidiu não gastar.',
  'Quem não sabe para onde vai o dinheiro, trabalha para ele — e não o contrário.',
  'O ouro foge de quem o gasta sem pensar e fica com quem o protege.',
  'Uma semente plantada hoje vale mais que uma floresta prometida amanhã.',
  'Pague-se primeiro. O resto do mundo pode esperar.',
  'Desejos não têm fim. Seu salário tem. Escolha bem.',
  'Disciplina é lembrar o que você quer de verdade quando o cartão está na mão.',
  'Dívida é uma corrente. Cada parcela paga é um elo que se quebra.',
  'A pressa compra caro. A paciência compra duas vezes.',
  'Coloque seu dinheiro para trabalhar, para que um dia você não precise.',
  'Pequenas economias, repetidas todo mês, constroem muralhas.',
  'Não é sobre ganhar mais. É sobre perder menos pelo caminho.',
  'Proteja seu tesouro de promessas de lucro fácil.',
  'Quem guarda 10% de tudo nunca começa do zero.',
  'Sua casa é seu primeiro patrimônio. Cuide dela como um investimento.',
  'Planeje o futuro enquanto ainda é presente.',
  'Aprenda com quem já construiu riqueza, não com quem só fala sobre ela.',
  'A sorte sorri para quem está preparado para ela.',
  'Toda grande muralha começou com um único tijolo.',
  'O dinheiro respeita quem o respeita.',
  'Gastar menos do que se ganha é a primeira lei — e a mais esquecida.',
  'Seu eu do futuro está contando com as escolhas de hoje.',
  'Uma reserva de emergência é paz guardada em forma de dinheiro.',
  'Não compre com dinheiro que você ainda não tem.',
  'Antes de comprar, pergunte: quantas horas da minha vida isso custa?',
  'Riqueza silenciosa vale mais que luxo barulhento.',
  'Quem anota os gastos governa o próprio dinheiro.',
  'Cada real investido é um soldado trabalhando por você.',
  'Juros compostos são a magia mais lenta e mais poderosa que existe.',
  'O melhor momento para começar era ontem. O segundo melhor é hoje.',
  'Ser rico é ter tempo. Dinheiro é só o caminho.',
  'Primeiro a reserva. Depois os sonhos. Os dois chegam.',
  'Orçamento não é prisão. É o mapa da liberdade.',
  'Saber onde você quer chegar transforma gasto em escolha.',
  'Ganhe, guarde, multiplique. Nessa ordem.',
  'Você não precisa de muito para começar. Precisa começar para ter muito.',
  'A tentação de hoje é a dívida de amanhã.',
  'Constância vence intensidade. Todo mês, um pouco.',
  'Quem planta disciplina colhe liberdade.',
  'Não deixe seu padrão de vida crescer mais rápido que sua renda.',
  'Antes de investir no que não entende, invista em entender.',
  'Uma dívida quitada é um aumento de salário que ninguém te dá.',
  'Dinheiro guardado é escolha guardada.',
  'O luxo que você não compra hoje é a tranquilidade que você terá amanhã.',
  'Seus hábitos financeiros falam mais alto que seu salário.',
  'Prosperidade é um hábito, não um evento.',
  'Uma moeda bem guardada trabalha melhor que dez mal gastas.',
  'O primeiro passo da riqueza é decidir que ela é possível.',
  'Cuide dos pequenos gastos. As grandes fortunas moram neles.',
  'Quem tem reserva negocia. Quem não tem, aceita.',
  'Liberdade financeira é poder dizer não.',
  'Sua renda é uma ferramenta. Sua disciplina é quem a usa.',
  'Quem guarda com propósito não sente que está abrindo mão de nada.',
  'Faça o dinheiro trabalhar para os seus sonhos, não para os desejos dos outros.',
  'Riqueza começa na cabeça antes de chegar ao bolso.',
  'Hoje, guarde uma moeda. Amanhã, ela traz outra.',
  'Não existe atalho. Existe constância.',
  'A Babilônia não foi construída num dia. Seu patrimônio também não.',
];

/** Data de hoje no horário de Brasília (o "dia" muda à meia-noite daqui, não à do servidor). */
export function todayBRT(now = new Date()): Date {
  return new Date(now.getTime() - 3 * 60 * 60 * 1000);
}

/** Índice da frase do dia: muda todo dia e é igual pra todo mundo. */
export function dailyQuoteIndex(now = new Date()): number {
  const d = todayBRT(now);
  const dayNumber = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000);
  return ((dayNumber % QUOTES.length) + QUOTES.length) % QUOTES.length;
}

export function formatDayLabel(now = new Date()): string {
  const d = todayBRT(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12)).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export const CAPTION_HASHTAGS = '#granaseria #educacaofinanceira #financaspessoais #ohomemmaisricodababilonia #mentalidade';
