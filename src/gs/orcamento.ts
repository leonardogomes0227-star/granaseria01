// Orçamento: o quanto de cada categoria já foi e a regra 50/30/20 com os números da pessoa. Pura, com teste.

import { COR_CATEGORIA, GRUPO } from './categorias';
import { arred, brl0, diasNoMes, diasRestantes } from './datas';
import { lancamentosDoMes, limiteDiario, livreParaGastar, totalFixos, totalVariaveis } from './selectores';
import type { Estado } from './tipos';

export interface LinhaCategoria {
  categoria: string;
  gasto: number;
  limite: number | null;
  pct: number | null;
  tom: 'ok' | 'aviso' | 'perigo' | 'sem';
}

export function gastoPorCategoria(e: Estado, mes: string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const l of lancamentosDoMes(e, mes)) m[l.categoria] = arred((m[l.categoria] ?? 0) + l.valor);
  return m;
}

/** Normal abaixo de 80%, âmbar de 80% a 100%, vermelho acima. Sem limite: nunca mostra barra cheia. */
export function linhasDeCategoria(e: Estado, mes: string): LinhaCategoria[] {
  const g = gastoPorCategoria(e, mes);
  const nomes = [...new Set([...Object.keys(COR_CATEGORIA), ...Object.keys(g)])].filter((c) => c !== 'Casa' || (g.Casa ?? 0) > 0 || e.limites.Casa);
  return nomes
    .map((categoria) => {
      const gasto = g[categoria] ?? 0;
      const limite = e.limites[categoria] ?? null;
      const pct = limite ? (gasto / limite) * 100 : null;
      const tom: LinhaCategoria['tom'] = pct === null ? 'sem' : pct > 100 ? 'perigo' : pct >= 80 ? 'aviso' : 'ok';
      return { categoria, gasto, limite, pct, tom };
    })
    .sort((a, b) => b.gasto - a.gasto);
}

export interface Regra {
  nome: string;
  pct: number;
  ideal: number;
  menorMelhor: boolean;
  ok: boolean;
}
export function regra503020(e: Estado, mes: string): Regra[] {
  const renda = e.config.renda;
  if (renda <= 0) return [];
  const g = gastoPorCategoria(e, mes);
  const fixas = totalFixos(e, mes);
  let nec = fixas;
  let des = 0;
  for (const [c, v] of Object.entries(g)) {
    if (GRUPO[c] === 'desejos') des += v;
    else nec += v;
  }
  const guardar = Math.max(0, renda - nec - des);
  const mk = (nome: string, valor: number, ideal: number, menorMelhor: boolean): Regra => {
    const pct = (valor / renda) * 100;
    return { nome, pct, ideal, menorMelhor, ok: menorMelhor ? pct <= ideal : pct >= ideal };
  };
  return [mk('Necessidades', nec, 50, true), mk('Desejos', des, 30, true), mk('Guardar', guardar, 20, false)];
}

/* ---------- painel do mês: ritmo, o que fazer agora e meses sem estourar ---------- */


export interface ResumoMes {
  gastoVar: number;
  livre: number;
  orcamento: number; // renda - fixos - guardado: o que o dia a dia pode gastar no mês
  pctUsado: number;
  pctMes: number;
  porDia: number;
  restam: number; // dias
  ritmo: number; // gasto projetado pro mês inteiro, no ritmo de agora
  sobraProjetada: number;
}
export function resumoDoMes(e: Estado, mes: string, hoje: string): ResumoMes {
  const gastoVar = totalVariaveis(e, mes);
  const livre = livreParaGastar(e, mes);
  const orcamento = Math.max(0, arred(livre + gastoVar));
  const dn = diasNoMes(mes);
  const passados = mes === hoje.slice(0, 7) ? Math.max(1, Number(hoje.slice(8, 10))) : dn;
  const ritmo = arred((gastoVar / passados) * dn);
  return {
    gastoVar,
    livre,
    orcamento,
    pctUsado: orcamento > 0 ? Math.min(100, (gastoVar / orcamento) * 100) : gastoVar > 0 ? 100 : 0,
    pctMes: (passados / dn) * 100,
    porDia: limiteDiario(e, mes, hoje),
    restam: diasRestantes(mes, hoje),
    ritmo,
    sobraProjetada: arred(orcamento - ritmo),
  };
}

export interface AcaoOrcamento {
  tom: 'ok' | 'aviso' | 'perigo';
  texto: string;
  rota?: string;
}
/** A coisa mais importante agora: estouro, quase estouro, ritmo alto, começar ou seguir. */
export function acaoOrcamento(e: Estado, mes: string, hoje: string): AcaoOrcamento {
  const linhas = linhasDeCategoria(e, mes);
  const r = resumoDoMes(e, mes, hoje);
  const estourada = linhas.filter((l) => l.tom === 'perigo').sort((a, b) => b.gasto - b.limite! - (a.gasto - a.limite!))[0];
  if (estourada) return { tom: 'perigo', texto: `${estourada.categoria} passou ${brl0(estourada.gasto - estourada.limite!)} do limite. Segure o resto do mês.` };
  const quase = linhas.filter((l) => l.tom === 'aviso').sort((a, b) => b.pct! - a.pct!)[0];
  if (quase) {
    const sobra = quase.limite! - quase.gasto;
    return { tom: 'aviso', texto: `${quase.categoria} já usou ${Math.round(quase.pct!)}%. Restam ${brl0(sobra)} pra ${r.restam} ${r.restam === 1 ? 'dia' : 'dias'} (${brl0(sobra / r.restam)} por dia).` };
  }
  if (e.lancamentos.filter((l) => l.data.slice(0, 7) === mes).length === 0) return { tom: 'aviso', texto: 'Ainda não tem gasto anotado neste mês. Anote o primeiro pelo WhatsApp ou aqui no app.', rota: '/mes?aba=dia' };
  if (!linhas.some((l) => l.limite)) return { tom: 'aviso', texto: 'Defina limites pelas categorias. Com 1 toque eu sugiro os valores.' };
  if (r.orcamento > 0 && r.sobraProjetada < 0) return { tom: 'aviso', texto: `No ritmo de agora você passa ${brl0(-r.sobraProjetada)} do que sobra no mês. Gaste uns ${brl0(Math.max(0, r.porDia))} por dia daqui pra frente.` };
  return { tom: 'ok', texto: r.orcamento > 0 ? `No trilho. Você pode gastar ${brl0(Math.max(0, r.porDia))} por dia até o fim do mês.` : 'No trilho.' };
}

/** Meses seguidos sem passar de nenhum limite (com gasto anotado). O mês atual conta se ainda não estourou. */
export function mesesNoLimite(e: Estado, mes: string): number {
  const limites = Object.entries(e.limites).filter(([, v]) => v > 0);
  if (limites.length === 0) return 0;
  const dentro = (m: string) => {
    const g = gastoPorCategoria(e, m);
    return Object.keys(g).length > 0 && limites.every(([c, l]) => (g[c] ?? 0) <= l);
  };
  const voltar = (m: string) => {
    const [a, n] = m.split('-').map(Number);
    return n === 1 ? `${a - 1}-12` : `${a}-${String(n - 1).padStart(2, '0')}`;
  };
  let m = dentro(mes) ? mes : voltar(mes);
  let n = 0;
  while (n < 60 && dentro(m)) {
    n++;
    m = voltar(m);
  }
  return n;
}
