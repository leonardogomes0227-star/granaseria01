// "+ Anotar" de qualquer lugar do app: o botão central da barra, o card da Início, o Meu mês.
// Abre a tela de anotar (src/components/AnotarSheet.tsx) quando ela está montada; senão, o WhatsApp.

import { openWhatsApp } from '../whatsapp';

export const EVENTO_ANOTAR = 'gs-anotar';
/** Avisado depois de anotar, editar, apagar ou desfazer: as telas recarregam os lançamentos. */
export const EVENTO_LANCAMENTOS = 'gs-lancamentos';
let temSheet = false;

export const registrarSheetAnotar = (on: boolean) => {
  temSheet = on;
};

/** Um lançamento como o api/lancamentos.ts devolve (gasto ou entrada, com id pra editar e apagar). */
export interface Lancamento {
  id: number;
  kind: 'out' | 'in';
  amount: number;
  category: string; // gasto: categoria · entrada: de onde veio
  description: string;
  method: string | null;
  created_at: string;
  origem?: 'site' | 'whatsapp';
}

export interface PedidoAnotar {
  tipo?: 'out' | 'in';
  origem?: string;
  editar?: Lancamento; // abre a folha preenchida, pra corrigir (salva com PATCH)
}

export function abrirAnotar(p: PedidoAnotar = {}) {
  if (temSheet) {
    window.dispatchEvent(new CustomEvent<PedidoAnotar>(EVENTO_ANOTAR, { detail: p }));
    return;
  }
  void openWhatsApp(p.origem ?? 'inicio');
}

/** Avisa as telas abertas que os lançamentos mudaram. */
export function avisarLancamentos(detail?: { lancamento?: Lancamento; acao: 'anotou' | 'editou' | 'apagou' | 'voltou' }) {
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_LANCAMENTOS, { detail }));
  } catch {
    // fora do navegador (testes)
  }
}
