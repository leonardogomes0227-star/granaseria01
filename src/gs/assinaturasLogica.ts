// Assinaturas: o que você paga, o que usa de verdade e quanto sobra se cortar o resto. Pura, com teste.

import { arred } from './datas';
import type { Assinatura } from './tipos';

/** Revisão vale pro mês em que foi feita; no mês seguinte volta a perguntar. */
export const revisada = (a: Assinatura, mes: string) => Boolean(a.uso && a.revisadaEm?.slice(0, 7) === mes);

export interface ResumoAssinaturas {
  total: number;
  anual: number;
  cortado: number;
  pendentes: Assinatura[];
  naoUsa: Assinatura[];
  poucoUsa: Assinatura[];
  economiaAnual: number; // se cortar o que não usa
  pctRevisado: number;
}
export function resumoAssinaturas(lista: Assinatura[], mes: string): ResumoAssinaturas {
  const ativas = lista.filter((a) => a.ativa);
  const total = arred(ativas.reduce((t, a) => t + a.valor, 0));
  const naoUsa = ativas.filter((a) => revisada(a, mes) && a.uso === 'nao');
  const poucoUsa = ativas.filter((a) => revisada(a, mes) && a.uso === 'pouco');
  const pendentes = ativas.filter((a) => !revisada(a, mes));
  return {
    total,
    anual: arred(total * 12),
    cortado: arred(lista.filter((a) => !a.ativa).reduce((t, a) => t + a.valor, 0)),
    pendentes,
    naoUsa,
    poucoUsa,
    economiaAnual: arred(naoUsa.reduce((t, a) => t + a.valor, 0) * 12),
    pctRevisado: ativas.length ? ((ativas.length - pendentes.length) / ativas.length) * 100 : 0,
  };
}

export interface AcaoAssinaturas {
  tom: 'ok' | 'aviso';
  texto: string;
  alvo?: Assinatura;
  tipo: 'vazio' | 'revisar' | 'cortar' | 'ok';
}
export function acaoAssinaturas(lista: Assinatura[], mes: string): AcaoAssinaturas {
  const r = resumoAssinaturas(lista, mes);
  if (lista.filter((a) => a.ativa).length === 0) return { tipo: 'vazio', tom: 'aviso', texto: lista.length ? 'Você cortou todas. Sem gasto escondido por enquanto.' : 'Marque as assinaturas que você paga. Quase todo mundo esquece pelo menos uma.' };
  if (r.naoUsa[0]) return { tipo: 'cortar', tom: 'aviso', texto: `Você não usa ${r.naoUsa[0].nome}. Cortar ${r.naoUsa.length > 1 ? `as ${r.naoUsa.length} que não usa` : 'essa'} economiza ${Math.round(r.economiaAnual)} reais por ano.`, alvo: r.naoUsa[0] };
  if (r.pendentes[0]) return { tipo: 'revisar', tom: 'aviso', texto: `Você usou ${r.pendentes[0].nome} este mês?`, alvo: r.pendentes[0] };
  return { tipo: 'ok', tom: 'ok', texto: 'Tudo revisado neste mês. Volto a perguntar no mês que vem.' };
}

export function conquistasAssinaturas(lista: Assinatura[], mes: string): string[] {
  const r = resumoAssinaturas(lista, mes);
  const c: string[] = [];
  if (lista.some((a) => !a.ativa)) c.push('Primeira assinatura cortada');
  if (r.cortado * 12 >= 100) c.push('Mais de R$ 100 por ano economizados');
  if (r.cortado * 12 >= 500) c.push('Mais de R$ 500 por ano economizados');
  if (lista.some((a) => a.ativa) && r.pendentes.length === 0) c.push('Tudo revisado');
  return c;
}
