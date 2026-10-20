import type { ToolId } from './tools';

// Perguntas rápidas da entrada: com elas o site indica as ferramentas que a pessoa vai usar de verdade.
// As respostas ficam salvas (e sincronizam com o WhatsApp) em gs-perfil.

export interface Answers {
  dividas: 'nao' | 'em-dia' | 'apertando' | 'nome-sujo';
  sobra: 'sobra' | 'zero' | 'falta';
  reserva: 'nada' | 'pouco' | 'meses';
  quer: 'juntar' | 'aperto' | 'investir' | 'organizar';
  extra: 'sim' | 'nao';
  grande: 'emprestimo' | 'compra' | 'nada';
}

export const QUESTIONS: { id: keyof Answers; q: string; options: [string, string][] }[] = [
  { id: 'dividas', q: 'Você tem dívidas?', options: [['nao', 'Não tenho'], ['em-dia', 'Tenho, mas pago em dia'], ['apertando', 'Tenho e estão apertando'], ['nome-sujo', 'Estou com o nome sujo']] },
  { id: 'sobra', q: 'No fim do mês, como fica o dinheiro?', options: [['sobra', 'Sobra um pouco'], ['zero', 'Fica no zero'], ['falta', 'Falta dinheiro']] },
  { id: 'reserva', q: 'Você tem dinheiro guardado pra uma emergência?', options: [['nada', 'Não tenho nada'], ['pouco', 'Tenho um pouco'], ['meses', 'Tenho pra uns meses']] },
  { id: 'quer', q: 'O que você mais quer agora?', options: [['aperto', 'Parar de passar aperto'], ['juntar', 'Juntar dinheiro pra algo'], ['investir', 'Começar a investir'], ['organizar', 'Organizar tudo']] },
  { id: 'extra', q: 'Vai receber 13º, restituição ou outro dinheiro extra?', options: [['sim', 'Vou'], ['nao', 'Não']] },
  { id: 'grande', q: 'Vai pegar empréstimo ou fazer uma compra grande?', options: [['emprestimo', 'Pegar empréstimo'], ['compra', 'Uma compra grande'], ['nada', 'Nenhum dos dois']] },
];

const KEY = 'gs-perfil';

export function getAnswers(): Answers | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Answers) : null;
  } catch {
    return null;
  }
}
export function saveAnswers(a: Answers | null) {
  try {
    if (a) localStorage.setItem(KEY, JSON.stringify(a));
    else localStorage.removeItem(KEY);
  } catch {
    // segue sem salvar
  }
  window.dispatchEvent(new Event('gs-perfil'));
}

export interface Pick {
  tool: ToolId;
  why: string;
}

/** As ferramentas dessa pessoa, na ordem em que fazem mais diferença, cada uma com o motivo. No máximo 4. */
export function recommend(a: Answers, hasDiagnosis: boolean): Pick[] {
  const out: Pick[] = [];
  const add = (tool: ToolId, why: string) => {
    if (!out.some((p) => p.tool === tool)) out.push({ tool, why });
  };
  if (a.dividas === 'nome-sujo' || a.dividas === 'apertando') add('rights', 'Suas dívidas estão apertando: a lei te dá jeitos de pagar menos juros, e a mensagem pro banco já vem pronta.');
  if (a.dividas !== 'nao') add('debts', 'Você tem dívidas: veja por qual começar e quando fica livre.');
  if (a.grande === 'emprestimo') add('loan', 'Você vai pegar um empréstimo: compare antes de assinar e pague menos.');
  if (a.sobra !== 'sobra' || a.quer === 'aperto') add('leaks', 'O dinheiro não está sobrando: ache assinaturas e tarifas que comem seu salário sem você ver.');
  if (a.extra === 'sim') add('extra', 'Vai entrar dinheiro extra: decida antes onde cada real vai, pra ele não sumir.');
  if (a.grande === 'compra') add('impulse', 'Vai fazer uma compra grande: veja se cabe no mês antes de passar o cartão.');
  if (a.quer === 'juntar') add('goal', 'Você quer juntar dinheiro: descubra quanto guardar por mês e salve a meta no plano.');
  if (a.quer === 'investir' || a.reserva === 'meses') add('richdad', 'Você quer fazer o dinheiro trabalhar: veja quanto falta pra não depender só do salário.');
  if (hasDiagnosis && (a.reserva !== 'meses' || a.quer === 'organizar')) add('tracker', 'Acompanhe o seu plano todo mês e veja se está em dia.');
  if (out.length < 3) add('goal', 'Ter uma meta com valor e data é o que faz guardar dinheiro dar certo.');
  if (out.length < 3) add('richdad', 'Veja quanto tempo você viveria sem trabalhar e quanto falta pra isso.');
  return out.slice(0, 4);
}
