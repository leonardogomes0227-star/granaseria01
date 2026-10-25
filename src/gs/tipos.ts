// Modelo de dados do app (chave 'grana-seria:v1'). Mês sempre 'AAAA-MM', data 'AAAA-MM-DD'.

export const SCHEMA_VERSION = 1;

export type CategoriaFixa = 'Aluguel' | 'Carro' | 'Financiamento' | 'Cartão' | 'Luz' | 'Água' | 'Internet' | 'Outros';
export const CATEGORIAS_FIXAS: CategoriaFixa[] = ['Aluguel', 'Carro', 'Financiamento', 'Cartão', 'Luz', 'Água', 'Internet', 'Outros'];
export const CATEGORIAS_DIA: string[] = ['Comida', 'Transporte', 'Mercado', 'Lazer', 'Saúde', 'Compras', 'Casa', 'Outros'];

export interface Config {
  nome?: string;
  renda: number;
  horasMes: number;
  diaSalario?: number;
  avisos: { antecedenciaDias: number; horario: string };
  onboardingFeito: boolean;
  reservaPct: number; // quanto guardar quando o salário cai (padrão 10%)
}

export interface Pagamento {
  valorPago: number;
  pagoEm: string;
}
export interface GastoFixo {
  id: string;
  nome: string;
  valor: number;
  diaVencimento: number;
  categoria: string;
  pagamentos: Record<string, Pagamento>;
}
export interface Lancamento {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  categoria: string;
  serverId?: number; // veio do WhatsApp (api/lancamentos)
}
export type OrigemAporte = 'manual' | 'reserva' | 'meta' | 'extra' | 'investimento';
export interface Aporte {
  id: string;
  data: string;
  valor: number;
  origem: OrigemAporte;
  agenteId?: string;
}
export interface PagamentoDivida {
  data: string;
  valor: number;
}
export interface Divida {
  id: string;
  nome: string;
  saldo: number; // saldo quando foi cadastrada; o atual = saldo - pagamentos (com juros: ver dividas.ts)
  jurosMensal: number; // % ao mês
  parcelaMinima: number;
  pagamentos: PagamentoDivida[];
  cadastradaEm?: string;
}
export type Estrategia = 'bola-de-neve' | 'maior-juro';
export interface PlanoDividas {
  estrategia: Estrategia;
  pagamentoMensal: number;
  criadoEm: string;
  passo?: number; // onde parou no assistente
}
export interface Desejo {
  id: string;
  item: string;
  valor: number;
  criadoEm: string; // ISO com hora
  terminaEm: string; // ISO com hora (72h depois)
  status: 'esperando' | 'comprou' | 'desistiu';
}
export interface Assinatura {
  id: string;
  nome: string;
  valor: number;
  ativa: boolean;
  personalizada: boolean;
  canceladaEm?: string;
}
export interface AgenteCfg {
  ativo: boolean;
  config: Record<string, number | string | boolean>;
}
export type TipoAgente = 'juntar' | 'lembrar' | 'metodo' | 'personalizado';
export interface ProgressoAgente {
  data: string;
  valor: number;
}
export interface AgenteCustom {
  id: string;
  tipo: TipoAgente;
  nome: string;
  avatar: string;
  cor: string;
  config: Record<string, number | string | boolean | string[]>;
  progresso: ProgressoAgente[];
  criadoEm: string;
  ativo: boolean;
  concluidoEm?: string;
}
export type PerfilRisco = 'conservador' | 'moderado' | 'arrojado';
export interface Posicao {
  id: string;
  ativo: 'BTC' | 'USD';
  lado: 'long' | 'short';
  margem: number;
  alavancagem: number;
  precoEntrada: number;
  abertaEm: string;
  stop?: number;
  alvo?: number;
}
export interface OperacaoFechada {
  id: string;
  ativo: 'BTC' | 'USD';
  lado: 'long' | 'short';
  margem: number;
  alavancagem: number;
  precoEntrada: number;
  precoSaida: number;
  resultado: number;
  motivo: 'manual' | 'stop' | 'alvo' | 'liquidado';
  abertaEm: string;
  fechadaEm: string;
}
export interface Investir {
  perfilRisco?: PerfilRisco;
  respostasQuiz?: number[];
  aporteMensalPlanejado?: number;
  simulacao: { saldoVirtual: number; posicoes: Posicao[]; historico: OperacaoFechada[] };
  chat: { role: 'user' | 'assistant'; content: string; ts: number }[];
  mensagensHoje: { data: string; qtd: number };
}

export interface Estado {
  schemaVersion: number;
  config: Config;
  gastosFixos: GastoFixo[];
  lancamentos: Lancamento[];
  aportes: Aporte[];
  dividas: Divida[];
  planoDividas: PlanoDividas | null;
  desejos: Desejo[];
  assinaturas: Assinatura[];
  agentes: Record<string, AgenteCfg>;
  agentesCustom: AgenteCustom[];
  investir: Investir;
  semanaVista?: string; // segunda-feira da última semana mostrada
}

export const ESTADO_INICIAL = (): Estado => ({
  schemaVersion: SCHEMA_VERSION,
  config: { renda: 0, horasMes: 220, avisos: { antecedenciaDias: 2, horario: '09:00' }, onboardingFeito: false, reservaPct: 10 },
  gastosFixos: [],
  lancamentos: [],
  aportes: [],
  dividas: [],
  planoDividas: null,
  desejos: [],
  assinaturas: [],
  agentes: {},
  agentesCustom: [],
  investir: { simulacao: { saldoVirtual: 10000, posicoes: [], historico: [] }, chat: [], mensagensHoje: { data: '', qtd: 0 } },
});
