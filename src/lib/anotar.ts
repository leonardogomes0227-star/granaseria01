// "+ Anotar" de qualquer lugar do app: o botão central da barra, o card da Início, o Meu mês.
// Abre a tela de anotar (src/components/AnotarSheet.tsx) quando ela está montada; senão, o WhatsApp.

import { openWhatsApp } from '../whatsapp';

export const EVENTO_ANOTAR = 'gs-anotar';
let temSheet = false;

export const registrarSheetAnotar = (on: boolean) => {
  temSheet = on;
};

export interface PedidoAnotar {
  tipo?: 'out' | 'in';
  origem?: string;
}

export function abrirAnotar(p: PedidoAnotar = {}) {
  if (temSheet) {
    window.dispatchEvent(new CustomEvent<PedidoAnotar>(EVENTO_ANOTAR, { detail: p }));
    return;
  }
  void openWhatsApp(p.origem ?? 'inicio');
}
