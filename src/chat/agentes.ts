// O que cada agente é nos chats e nos cards (spec v2, seção 2): título com o tom, o princípio do livro (selo) e a
// função no app. Complementa src/agents.ts (nome, cor, ferramenta, perguntas antigas), sem mudar nada lá.

import { AGENTS, loadChosen } from '../agents';
import type { AgenteId } from './engine';
import type { Missao } from '../missoes';

export interface InfoAgente {
  id: AgenteId;
  nome: string;
  titulo: string; // "Calmo · foco em reserva"
  funcao: string;
  principio: string; // a cura do livro
  quemE: string; // quem ele é no livro, numa frase
  exemplo: string; // um exemplo de fala
  hue: number;
}

const BASE: Record<AgenteId, Omit<InfoAgente, 'id' | 'nome' | 'hue'>> = {
  arkad: {
    titulo: 'Calmo · foco em reserva',
    funcao: 'Reserva de emergência e pague-se primeiro',
    principio: 'Comece a encher sua bolsa',
    quemE: 'O homem mais rico da Babilônia. Começou guardando uma moeda de cada dez.',
    exemplo: 'Uma reserva é o que separa um imprevisto de uma crise.',
  },
  bansir: {
    titulo: 'Prático · contas em dia',
    funcao: 'Contas fixas e vencimentos',
    principio: 'Controle seus gastos',
    quemE: 'O construtor de carros que trabalhava muito e nunca via sobrar nada.',
    exemplo: 'Começou a mudar quando eu soube exatamente o que vencia e quando.',
  },
  nomasir: {
    titulo: 'Direto · corta o que escapa',
    funcao: 'Cortar gastos que não servem e limites por categoria',
    principio: 'Controle seus gastos',
    quemE: 'Filho de Arkad. Perdeu o ouro do pai antes de aprender as leis do ouro.',
    exemplo: 'Gasto pequeno que se repete é o que mais pesa.',
  },
  dabasir: {
    titulo: 'Firme · sai das dívidas',
    funcao: 'Quitar dívidas com o método 70/20/10',
    principio: 'Proteja seu tesouro',
    quemE: 'O mercador de camelos que saiu das dívidas pagando um pouco a cada credor.',
    exemplo: 'De tudo que sobra: 7 partes pra viver, 2 pra pagar quem eu devo e 1 pra guardar.',
  },
  mathon: {
    titulo: 'Analítico · antes de assinar',
    funcao: 'Comparar empréstimos antes de assinar',
    principio: 'Proteja seu tesouro',
    quemE: 'O emprestador de ouro da Babilônia. Desconfia de todo ouro fácil.',
    exemplo: 'Antes de assinar, olhe quanto você vai pagar no total.',
  },
  rodan: {
    titulo: 'Prudente · dinheiro extra',
    funcao: 'Dar destino ao 13º, bônus e dinheiro extra',
    principio: 'Faça seu ouro multiplicar',
    quemE: 'O fabricante de lanças que ganhou ouro do rei e quase perdeu tudo.',
    exemplo: 'Recebeu um dinheiro a mais? Vamos dar destino a ele antes que ele suma.',
  },
  sharru: {
    titulo: 'Ambicioso · investir',
    funcao: 'Investir e viver de renda',
    principio: 'Garanta renda futura',
    quemE: 'O príncipe mercador que fez o ouro trabalhar por ele.',
    exemplo: 'Primeiro a reserva, depois a gente faz o ouro trabalhar.',
  },
};

export const IDS: AgenteId[] = ['arkad', 'bansir', 'nomasir', 'dabasir', 'mathon', 'rodan', 'sharru'];

export function infoAgente(id: AgenteId): InfoAgente {
  const a = AGENTS.find((x) => x.id === id);
  return { id, nome: a?.name ?? id, hue: a?.hue ?? 40, ...BASE[id] };
}

export const ehAgente = (id: string | undefined | null): id is AgenteId => Boolean(id && (IDS as string[]).includes(id));

export type StatusAgente = 'ativo' | 'disponivel' | 'em_espera';

/**
 * ativo: está no app e tem missão andando (ou ainda não tem missão);
 * em_espera: está no app, mas a missão dele foi cumprida ou está pausada;
 * disponivel: ainda não foi ativado.
 */
export function statusAgente(id: AgenteId, missoes: Missao[], ativos: string[] = loadChosen()): StatusAgente {
  if (!ativos.includes(id)) return 'disponivel';
  const dele = missoes.filter((m) => m.agente === id && m.status !== 'arquivada' && !m.deletedAt);
  if (dele.length > 0 && dele.every((m) => m.status === 'concluida' || m.status === 'pausada')) return 'em_espera';
  return 'ativo';
}
