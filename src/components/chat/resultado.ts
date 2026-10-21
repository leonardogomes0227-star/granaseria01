// O que o cartão de resultado do chat mostra (spec v2, seção 6; design 6.5): as linhas numeradas em romano (os
// roteiros escrevem "1. ", "2. "), os itens da lista em nome e detalhe, o tamanho das barras do gráfico e os nomes
// dos agentes. Funções puras, sem DOM: dá pra testar.

import { brlCurto } from '../../chat/engine';

const ROMANOS: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** 1 → "I", 4 → "IV", 12 → "XII". Zero, negativo ou quebrado vira ''. */
export function romano(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return '';
  let resto = n;
  let out = '';
  for (const [valor, letra] of ROMANOS) {
    while (resto >= valor) {
      out += letra;
      resto -= valor;
    }
  }
  return out;
}

/** Tira o "1. " (ou "1) ") que os roteiros põem no começo da linha. */
export const semNumero = (linha: string) => linha.replace(/^\s*\d+\s*[.)]\s*/, '');

/** "Cartão · quitada em mar/27" → nome "Cartão", detalhe "quitada em mar/27". Sem " · ", fica tudo no nome. */
export function partesDoItem(item: string): { nome: string; detalhe: string | null } {
  const i = item.indexOf(' · ');
  if (i <= 0) return { nome: item.trim(), detalhe: null };
  return { nome: item.slice(0, i).trim(), detalhe: item.slice(i + 3).trim() || null };
}

export interface Barra {
  rotulo: string;
  valor: number;
  texto: string; // "R$ 12.000"
  pct: number; // 0 a 100, em relação à maior barra
}

/** As barras do gráfico do cartão: a maior ocupa tudo; valor positivo pequeno ainda aparece (no mínimo 4%). */
export function barras(grafico: { rotulo: string; valor: number }[] | undefined): Barra[] {
  const ok = (grafico ?? []).filter((g) => g && Number.isFinite(g.valor));
  const maior = ok.reduce((m, g) => Math.max(m, g.valor), 0);
  return ok.map((g) => {
    const v = Math.max(0, g.valor);
    const pct = maior > 0 && v > 0 ? Math.max(4, Math.min(100, Math.round((v / maior) * 100))) : 0;
    return { rotulo: g.rotulo, valor: g.valor, texto: brlCurto(g.valor), pct };
  });
}

/** ["Dabasir", "Arkad", "Nomasir"] → "Dabasir, Arkad e Nomasir". */
export function juntarNomes(nomes: string[]): string {
  const n = nomes.filter(Boolean);
  if (n.length <= 1) return n[0] ?? '';
  return `${n.slice(0, -1).join(', ')} e ${n[n.length - 1]}`;
}

/** A chave que liga o chip tocado ao balão da pessoa (o chip "voa" pro balão): resposta, posição e valor. */
export function chaveDoVoo(indice: number, valor: unknown): string | undefined {
  if (typeof valor === 'string' || typeof valor === 'number') return `resposta-${indice}-${String(valor)}`;
  return undefined;
}
