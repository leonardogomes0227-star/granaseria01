import { WizardData } from './types.js';
import { Diagnosis } from './calculations.js';

// Arquétipos financeiros — o resultado do diagnóstico como "personagem" da Babilônia,
// feito pra ser postado. Nunca mostra valores em reais: só o perfil.

export type ArchetypeId = 'guardiao' | 'construtor' | 'semeador' | 'escriba' | 'guerreiro' | 'viajante';

export interface Archetype {
  id: ArchetypeId;
  numeral: string;
  name: string;
  tagline: string;
  traits: [string, string, string];
  power: string; // ponto forte
  quest: string; // próximo passo
}

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  guardiao: {
    id: 'guardiao',
    numeral: 'I',
    name: 'O Guardião do Tesouro',
    tagline: 'Seu ouro trabalha enquanto você dorme.',
    traits: ['Disciplina', 'Reserva cheia', 'Zero dívidas'],
    power: 'Você já vive as leis do livro: guarda primeiro, controla e se protege.',
    quest: 'Fazer o ouro multiplicar: investir com paciência.',
  },
  construtor: {
    id: 'construtor',
    numeral: 'II',
    name: 'O Construtor de Muralhas',
    tagline: 'Tijolo por tijolo, a muralha sobe.',
    traits: ['Constância', 'Pague-se primeiro', 'Visão longa'],
    power: 'Você já guarda pelo menos 10% de tudo que ganha.',
    quest: 'Completar a muralha: 6 meses de reserva.',
  },
  semeador: {
    id: 'semeador',
    numeral: 'III',
    name: 'O Semeador',
    tagline: 'Toda árvore começa com uma semente.',
    traits: ['Começo forte', 'Paciência', 'Crescimento'],
    power: 'Você já guarda alguma coisa todo mês — o hábito existe.',
    quest: 'Chegar aos 10% da renda guardados.',
  },
  escriba: {
    id: 'escriba',
    numeral: 'IV',
    name: 'O Escriba Disciplinado',
    tagline: 'Quem anota, governa.',
    traits: ['Controle', 'Gastos em ordem', 'Clareza'],
    power: 'Seus gastos estão dentro do teto ideal.',
    quest: 'Transformar o controle em moedas guardadas.',
  },
  guerreiro: {
    id: 'guerreiro',
    numeral: 'V',
    name: 'O Guerreiro em Batalha',
    tagline: 'Toda dívida vencida é uma muralha derrubada.',
    traits: ['Coragem', 'Foco', 'Recomeço'],
    power: 'Você encarou os números de frente — o primeiro passo da vitória.',
    quest: 'Vencer a dívida mais cara primeiro.',
  },
  viajante: {
    id: 'viajante',
    numeral: 'VI',
    name: 'O Viajante do Deserto',
    tagline: 'A jornada mais rica começa com um passo.',
    traits: ['Recomeço', 'Curiosidade', 'Potencial'],
    power: 'Você decidiu olhar pro próprio dinheiro — poucos fazem isso.',
    quest: 'Guardar a primeira moeda: qualquer valor, todo mês.',
  },
};

export function getArchetype(data: WizardData, d: Diagnosis): Archetype {
  const income = data.monthlyIncome || 0;
  const keys = Object.keys(d.idealExpenses) as (keyof typeof d.idealExpenses)[];
  const expensesOk = keys.every((k) => data.expenses[k] <= d.idealExpenses[k]);

  if (d.totalDebt > 0 && d.totalDebt > income) return ARCHETYPES.guerreiro;
  if (d.savingsRate >= 10 && d.emergencyProgress >= 100 && d.totalDebt <= 0) return ARCHETYPES.guardiao;
  if (d.savingsRate >= 10) return ARCHETYPES.construtor;
  if (d.savingsRate > 0) return ARCHETYPES.semeador;
  if (expensesOk && d.totalExpenses > 0) return ARCHETYPES.escriba;
  return ARCHETYPES.viajante;
}
