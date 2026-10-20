// Os três coaches. O roteiro tem a mesma estrutura pra todos; muda o jeito de falar e o foco.

export type CoachId = 'arkad' | 'nomasir' | 'sharru';

export interface Coach {
  id: CoachId;
  name: string;
  hue: number;
  tone: string; // como ele fala
  focus: string; // no que ele ajuda
  pitch: string; // a frase de apresentação
}

export const COACHES: Coach[] = [
  { id: 'arkad', name: 'Arkad', hue: 38, tone: 'Calmo', focus: 'Reserva', pitch: 'Sem pressa: primeiro guardamos uma parte de tudo que entra, depois o resto se ajeita.' },
  { id: 'nomasir', name: 'Nomasir', hue: 215, tone: 'Direto', focus: 'Gastos', pitch: 'Vou direto ao ponto: pra onde o seu dinheiro vai e o que dá pra cortar.' },
  { id: 'sharru', name: 'Sharru Nada', hue: 165, tone: 'Ambicioso', focus: 'Investir', pitch: 'Vamos fazer o seu dinheiro trabalhar por você, um passo de cada vez.' },
];

export const getCoach = (id: string | null | undefined): Coach | null => COACHES.find((c) => c.id === id) ?? null;

/** Um texto em três vozes. */
export type Voices = Record<CoachId, string>;
