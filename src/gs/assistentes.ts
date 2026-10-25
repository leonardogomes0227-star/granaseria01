// Os assistentes do app (nomes funcionais) e o mapa de cada um pra ferramenta dele.

export type AssistenteId = 'contas' | 'gastos' | 'dividas' | 'reserva' | 'assinaturas' | 'renda' | 'emprestimos' | 'extras' | 'investimentos';

export interface Assistente {
  id: AssistenteId;
  nome: string;
  curto: string;
  descricao: string;
  rota: string;
  cor: string; // token de cor do avatar
  inicial: string;
}

export const ASSISTENTES: Assistente[] = [
  { id: 'contas', nome: 'Assistente de Contas', curto: 'Contas', descricao: 'Avisa antes de cada conta vencer.', rota: '/mes', cor: 'var(--gold-strong)', inicial: 'C' },
  { id: 'gastos', nome: 'Assistente de Gastos', curto: 'Gastos', descricao: 'Mostra quanto você pode gastar por dia.', rota: '/mes?aba=dia', cor: 'var(--ink)', inicial: 'G' },
  { id: 'dividas', nome: 'Assistente de Dívidas', curto: 'Dívidas', descricao: 'Monta o caminho pra quitar tudo.', rota: '/plano/dividas', cor: 'var(--danger)', inicial: 'D' },
  { id: 'reserva', nome: 'Assistente de Reserva', curto: 'Reserva', descricao: 'Separa uma parte do salário pra você.', rota: '/plano/reserva', cor: 'var(--success)', inicial: 'R' },
  { id: 'assinaturas', nome: 'Assistente de Assinaturas', curto: 'Assinaturas', descricao: 'Acha os gastos escondidos todo mês.', rota: '/plano/assinaturas', cor: 'var(--gold)', inicial: 'A' },
  { id: 'renda', nome: 'Assistente de Renda', curto: 'Renda', descricao: 'Quanto falta pra viver de renda.', rota: '/plano/renda', cor: 'var(--ink-muted)', inicial: 'R' },
  { id: 'emprestimos', nome: 'Assistente de Empréstimos', curto: 'Empréstimos', descricao: 'Compara ofertas pelo custo real.', rota: '/plano/emprestimos', cor: 'var(--gold-strong)', inicial: 'E' },
  { id: 'extras', nome: 'Assistente de Extras', curto: 'Extras', descricao: 'Dá destino ao 13º e ao dinheiro extra.', rota: '/plano/extras', cor: 'var(--success)', inicial: 'X' },
  { id: 'investimentos', nome: 'Assistente de Investimentos', curto: 'Investimentos', descricao: 'Conversa sobre onde pôr o dinheiro.', rota: '/investir', cor: 'var(--ink)', inicial: 'I' },
];

export const assistentePorId = (id: string) => ASSISTENTES.find((a) => a.id === id);
