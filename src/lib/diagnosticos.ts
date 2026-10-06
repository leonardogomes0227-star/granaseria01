import { supabase } from './supabase';
import { WizardData } from '../types';
import { Diagnosis, calculateHealthScore, HealthScore } from '../calculations';
import { getArchetype } from '../archetypes';

// Persistência do diagnóstico. Não recalcula nada por conta própria: guarda o que o wizard
// já calculou (calculateDiagnosis / calculateHealthScore / getArchetype).

export interface DiagnosticoResultado {
  diagnostico: Diagnosis;
  plano_de_acao: string[];
  saude: HealthScore;
  arquetipo: string;
}

export interface DiagnosticoRow {
  id: string;
  user_id: string;
  respostas: WizardData;
  resultado: DiagnosticoResultado;
  selos: string[];
  criado_em: string;
}

export const SELOS = [
  { id: 'pague-se-primeiro', numeral: 'I', label: 'Pague-se primeiro' },
  { id: 'controle-os-gastos', numeral: 'II', label: 'Controle os gastos' },
  { id: 'construa-sua-reserva', numeral: 'III', label: 'Construa sua reserva' },
  { id: 'proteja-se-de-perdas', numeral: 'IV', label: 'Proteja-se de perdas' },
] as const;

/** Selo conquistado = a lei correspondente está "na meta" no resultado (os mesmos critérios dos cartões do diagnóstico). */
export function selosConquistados(data: WizardData, d: Diagnosis): string[] {
  const keys = Object.keys(d.idealExpenses) as (keyof Diagnosis['idealExpenses'])[];
  const earned: Record<(typeof SELOS)[number]['id'], boolean> = {
    'pague-se-primeiro': d.savingsRate >= d.savingsGoalRate,
    'controle-os-gastos': keys.every((k) => data.expenses[k] <= d.idealExpenses[k]),
    'construa-sua-reserva': d.emergencyProgress >= 100,
    'proteja-se-de-perdas': d.totalDebt <= 0,
  };
  return SELOS.filter((s) => earned[s.id]).map((s) => s.id);
}

export async function fetchLatestDiagnostico(userId: string): Promise<DiagnosticoRow | null> {
  const { data, error } = await supabase
    .from('diagnosticos')
    .select('id, user_id, respostas, resultado, selos, criado_em')
    .eq('user_id', userId)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as DiagnosticoRow | null) ?? null;
}

export async function saveDiagnostico(userId: string, data: WizardData, diagnosis: Diagnosis): Promise<DiagnosticoRow> {
  const resultado: DiagnosticoResultado = {
    diagnostico: diagnosis,
    plano_de_acao: diagnosis.actionPlan,
    saude: calculateHealthScore(data, diagnosis),
    arquetipo: getArchetype(data, diagnosis).id,
  };
  const { data: row, error } = await supabase
    .from('diagnosticos')
    .insert({ user_id: userId, respostas: data, resultado, selos: selosConquistados(data, diagnosis) })
    .select('id, user_id, respostas, resultado, selos, criado_em')
    .single();
  if (error) throw error;
  return row as DiagnosticoRow;
}
