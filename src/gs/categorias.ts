// Cores e limites sugeridos por categoria do dia a dia.

export const COR_CATEGORIA: Record<string, string> = {
  Assinaturas: '#6B5B8A',
  Casa: '#8F6A0E',
  Mercado: '#3F7A4A',
  Comida: '#B8832B',
  Transporte: '#5C7A99',
  Lazer: '#7A6A8A',
  Saúde: '#9A3F31',
  Compras: '#2C221E',
  Outros: '#8B8174',
};
export const corDe = (c: string) => COR_CATEGORIA[c] ?? '#8B8174';

/** Parte da renda sugerida pra cada categoria (soma ~ 45%, o resto é fixo, guardar e imprevisto). */
export const PARTE_SUGERIDA: Record<string, number> = { Mercado: 0.14, Comida: 0.07, Transporte: 0.07, Lazer: 0.05, Saúde: 0.04, Compras: 0.05, Casa: 0.02, Outros: 0.03 };
export const limiteSugerido = (categoria: string, renda: number) => Math.round(((PARTE_SUGERIDA[categoria] ?? 0.03) * renda) / 10) * 10;

export type Grupo = 'necessidades' | 'desejos';
export const GRUPO: Record<string, Grupo> = { Casa: 'necessidades', Mercado: 'necessidades', Saúde: 'necessidades', Transporte: 'necessidades', Comida: 'desejos', Lazer: 'desejos', Compras: 'desejos', Outros: 'desejos' };

import { Car, HeartPulse, House, Repeat, ShoppingBag, ShoppingCart, Tag, Ticket, Utensils, type LucideIcon } from 'lucide-react';
/** Ícone de cada categoria do dia a dia. */
export const ICONE_CATEGORIA: Record<string, LucideIcon> = { Comida: Utensils, Transporte: Car, Mercado: ShoppingCart, Lazer: Ticket, Saúde: HeartPulse, Compras: ShoppingBag, Casa: House, Assinaturas: Repeat, Outros: Tag };
export const iconeDe = (c: string): LucideIcon => ICONE_CATEGORIA[c] ?? Tag;
