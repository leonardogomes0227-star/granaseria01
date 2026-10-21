// Frases dos agentes por situação (spec v2, seção 9): sem culpa, sem medo, comemorando o pequeno. Há variações pra
// não repetir a mesma frase duas vezes seguidas (a última dita fica guardada só neste aparelho).

import type { AgenteId } from '../chat/engine';

export type Situacao = 'em_dia' | 'atrasado' | 'perto_da_meta' | 'meta_batida' | 'mes_estourado' | 'primeira_vez' | 'passo' | 'dica';

type Banco = Record<Situacao, string[]>;

const PADRAO: Banco = {
  em_dia: ['Você está em dia. Isso é Babilônia pura.', 'No ritmo certo. Mês a mês, a bolsa enche.', 'Tudo no lugar. Continue assim.'],
  atrasado: ['Acontece. A data mudou, o caminho continua.', 'Recomeçar também é parte. Vamos de novo este mês?', 'Um mês fraco não apaga os outros. Segue o plano.'],
  perto_da_meta: ['Falta pouco. Dá pra ver a linha de chegada.', 'Quase lá. Não para agora.'],
  meta_batida: ['Você conseguiu. Que orgulho!', 'Missão cumprida. A próxima fica mais fácil.'],
  mes_estourado: ['O mês apertou. Vamos ver onde dá pra segurar até o fim?', 'Passou do limite, tudo bem. Agora é segurar os próximos dias.'],
  primeira_vez: ['Primeiro passo dado. É assim que começa.', 'Começou. O mais difícil já foi.'],
  passo: ['Mais uma moeda no lugar certo.', 'Feito. Um passo de cada vez.', 'Anotado. Assim que se faz.'],
  dica: ['Guarde primeiro, gaste depois.', 'Gasto pequeno que se repete é o que mais pesa.', 'Antes de assinar, olhe o total.'],
};

const DO_AGENTE: Partial<Record<AgenteId, Partial<Banco>>> = {
  arkad: {
    em_dia: ['Uma moeda de cada dez, todo mês. Você está fazendo.', 'Sem pressa e sem parar. Assim a bolsa enche.'],
    dica: ['De cada dez moedas que entram, uma fica com você.', 'Uma reserva é o que separa um imprevisto de uma crise.'],
    passo: ['Mais uma moeda na bolsa.', 'Calma e constância. Muito bem.'],
  },
  dabasir: {
    em_dia: ['Uma de cada vez. Você está saindo.', 'Pagando em dia, quem cobra para de cobrar.'],
    atrasado: ['Eu também atrasei. O que importa é voltar a pagar.', 'Sem julgamento. Mês que vem a gente retoma.'],
    dica: ['Enquanto a gente paga, nada de dívida nova.', 'Sete partes pra viver, duas pra quem você deve, uma pra você.'],
    passo: ['Uma parcela a menos te prendendo.', 'Pago. A corrente afrouxa.'],
  },
  nomasir: {
    em_dia: ['Nada escapando. Do jeito que tem que ser.', 'Os gastos estão no limite. Bom trabalho.'],
    mes_estourado: ['Vamos ver onde dá pra segurar até o dia 30?', 'Passou. Eu também passava. Agora é segurar.'],
    dica: ['Gasto pequeno que se repete é o que mais pesa.', 'Assinatura que você não usa é dinheiro saindo dormindo.'],
  },
  bansir: {
    em_dia: ['Contas em dia, cabeça leve.', 'Nada vencendo esquecido. Assim que é.'],
    dica: ['Saber o que vence e quando muda tudo.'],
  },
  sharru: {
    dica: ['Primeiro a reserva, depois a gente faz o ouro trabalhar.', 'Dinheiro guardado trabalha. Dinheiro parado dorme.'],
  },
  rodan: {
    dica: ['Dinheiro extra sem destino some.', 'Dê um destino ao ouro antes que ele escolha sozinho.'],
  },
  mathon: {
    dica: ['Antes de assinar, olhe quanto vai pagar no total.', 'Ouro fácil costuma sair caro.'],
  },
};

const ULTIMA_KEY = 'gs-ultima-frase';

/** Uma frase do agente pra situação, sem repetir a última que ele disse nessa situação. */
export function fraseAgente(agente: AgenteId, situacao: Situacao): string {
  const opcoes = DO_AGENTE[agente]?.[situacao] ?? PADRAO[situacao];
  if (opcoes.length === 1) return opcoes[0];
  let ultimas: Record<string, string> = {};
  try {
    ultimas = JSON.parse(localStorage.getItem(ULTIMA_KEY) || '{}') as Record<string, string>;
  } catch {
    ultimas = {};
  }
  const k = `${agente}:${situacao}`;
  const livres = opcoes.filter((o) => o !== ultimas[k]);
  const escolhida = livres[Math.floor(Math.random() * livres.length)] ?? opcoes[0];
  try {
    localStorage.setItem(ULTIMA_KEY, JSON.stringify({ ...ultimas, [k]: escolhida }));
  } catch {
    // sem localStorage
  }
  return escolhida;
}
