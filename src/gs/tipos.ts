// Modelo de dados do app (chave 'grana-seria:v1'). Mês sempre 'AAAA-MM', data 'AAAA-MM-DD'.

export const SCHEMA_VERSION = 1;

export type CategoriaFixa = 'Aluguel' | 'Carro' | 'Financiamento' | 'Cartão' | 'Luz' | 'Água' | 'Internet' | 'Outros';
export const CATEGORIAS_FIXAS: CategoriaFixa[] = ['Aluguel', 'Carro', 'Financiamento', 'Cartão', 'Luz', 'Água', 'Internet', 'Outros'];
export const CATEGORIAS_DIA: string[] = ['Comida', 'Transporte', 'Mercado', 'Lazer', 'Saúde', 'Compras', 'Casa', 'Outros'];
export const CATEGORIAS_MOV: string[] = [...CATEGORIAS_DIA.slice(0, -1), 'Assinaturas', 'Outros'];

export interface Config {
  nome?: string;
  renda: number;
  horasMes: number;
  diaSalario?: number;
  avisos: { antecedenciaDias: number; horario: string };
  onboardingFeito: boolean;
  reservaPct: number; // quanto guardar quando o salário cai (padrão 10%)
  reservaMeses?: number; // meta da reserva em meses de gasto (padrão 6)
  reservaMensal?: number; // quanto a pessoa decidiu guardar por mês (padrão: o percentual da renda)
  rendaAlvo?: number; // quanto quer receber por mês dos rendimentos (padrão: o gasto médio)
  saldoInformado?: { valor: number; data: string }; // saldo que a própria pessoa informou (base confirmada do "pode gastar")
  objetivo?: string; // principal objetivo financeiro (onboarding)
  avisosDesligados?: string[]; // tipos de aviso que a pessoa desligou ('vencimento', 'orcamento', 'coach'...)
  checklistFeito?: string[]; // passos do checklist de configuração marcados como "agora não"
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
  criadaEm?: string; // 'AAAA-MM-DD': meses antes disso nunca contam como atrasados
}
export interface Lancamento {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  categoria: string;
  forma?: string; // pix, débito, dinheiro, cartão...
  contaId?: string;
  serverId?: number; // veio do WhatsApp (api/lancamentos)
}
/** Receita registrada. 'salario' confirma a renda do mês; 'extra' soma ao que a pessoa tem. */
export interface Receita {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  tipo: 'salario' | 'extra';
  contaId?: string;
  serverId?: number; // veio do WhatsApp
}
export interface Meta {
  id: string;
  nome: string;
  alvo: number;
  criadaEm: string;
  prazo?: string; // 'AAAA-MM-DD' (opcional)
  guardados: { data: string; valor: number }[];
}
/** Onde o dinheiro está (opcional): corrente, carteira, poupança… Só organiza; não muda o "pode gastar". */
export interface ContaBancaria {
  id: string;
  nome: string;
}
export interface Transferencia {
  id: string;
  data: string;
  valor: number;
  de: string; // id da conta
  para: string; // id da conta
  descricao?: string;
}
export type OrigemAporte = 'manual' | 'reserva' | 'meta' | 'extra' | 'investimento' | 'saque';
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
  venceDia?: number; // dia do mês em que vence a parcela (opcional)
  tipo?: 'parcelada' | 'rotativa'; // parcelada: financiamento, empréstimo, crediário (parcela fixa)
  parcelasRestantes?: number; // só nas parceladas, quando a pessoa informa
  estimado?: boolean; // a pessoa não tinha certeza do valor (Modo Recuperação marca como "valor estimado")
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
  uso?: 'sim' | 'pouco' | 'nao'; // revisão: você usou esse mês?
  revisadaEm?: string;
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

export interface ParceladoCartao {
  id: string;
  descricao: string;
  parcela: number;
  restantes: number; // parcelas que ainda vão cair nas próximas faturas
}
export interface Cartao {
  limite: number;
  usado: number; // fatura aberta
  fechaDia: number;
  venceDia: number;
  parcelados?: ParceladoCartao[];
  pagas?: { data: string; valor: number }[]; // faturas já pagas
  limitePessoal?: number; // quanto a pessoa decidiu gastar no cartão por fatura (menor que o limite do banco)
}

/** Sair do atraso: quanto a pessoa tira por mês pra pôr as contas em dia e o que já separou. */
export interface AtrasosCfg {
  porMes?: number; // quanto decidiu tirar por mês (padrão: a folga do orçamento)
  separado: number; // dinheiro já separado pro atraso e ainda não usado
  saidas: Record<string, number>; // por mês: quanto saiu do orçamento do mês pro atraso (separado + pago)
  ignorados: string[]; // chaves de atrasos que a pessoa disse que não deve
  manuais?: AtrasoManual[]; // o que a pessoa anotou: parcela de antes de usar o app, ou conta que não está cadastrada
}
export interface AtrasoManual {
  id: string;
  nome: string;
  valor: number;
  mes: string; // 'AAAA-MM'
  vencimento: string; // 'AAAA-MM-DD'
  categoria?: string;
  gastoId?: string; // quando é de uma conta fixa cadastrada
  estimado?: boolean;
}

/** Modo Recuperação: acompanhamento para quem está endividado. `raioXFeito` marca que o mapeamento inicial terminou. */
export interface Recuperacao {
  ativo: boolean;
  desde?: string; // 'AAAA-MM-DD'
  raioXFeito: boolean;
  ofertaDispensada?: boolean; // a pessoa disse "agora não" para a oferta no Início
}

export interface Estado {
  schemaVersion: number;
  config: Config;
  gastosFixos: GastoFixo[];
  lancamentos: Lancamento[];
  receitas: Receita[];
  metas: Meta[];
  contas: ContaBancaria[];
  transferencias: Transferencia[];
  aportes: Aporte[];
  dividas: Divida[];
  planoDividas: PlanoDividas | null;
  desejos: Desejo[];
  assinaturas: Assinatura[];
  agentes: Record<string, AgenteCfg>;
  agentesCustom: AgenteCustom[];
  investir: Investir;
  semanaVista?: string; // segunda-feira da última semana mostrada
  limites: Record<string, number>; // limite mensal por categoria do dia a dia
  cartao: Cartao | null;
  atrasos?: AtrasosCfg;
  recuperacao: Recuperacao;
}

export const ESTADO_INICIAL = (): Estado => ({
  schemaVersion: SCHEMA_VERSION,
  config: { renda: 0, horasMes: 220, avisos: { antecedenciaDias: 2, horario: '09:00' }, onboardingFeito: false, reservaPct: 10 },
  gastosFixos: [],
  lancamentos: [],
  receitas: [],
  metas: [],
  contas: [],
  transferencias: [],
  aportes: [],
  dividas: [],
  planoDividas: null,
  desejos: [],
  assinaturas: [],
  agentes: {},
  agentesCustom: [],
  investir: { simulacao: { saldoVirtual: 10000, posicoes: [], historico: [] }, chat: [], mensagensHoje: { data: '', qtd: 0 } },
  limites: {},
  cartao: null,
  recuperacao: { ativo: false, raioXFeito: false },
});
