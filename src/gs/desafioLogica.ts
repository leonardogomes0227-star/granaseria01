// Desafio de juntar dinheiro: uma grade de quadradinhos cujos valores somam exatamente a meta.
// Valores crescentes (o primeiro é pequeno, para começar fácil), arredondados a um passo "redondo" (1, 5 ou 10 reais).
// Puro e testado.

export const QUANTIDADES: { n: number; rotulo: string; dica: string }[] = [
  { n: 30, rotulo: '30', dica: 'um por dia, em um mês' },
  { n: 52, rotulo: '52', dica: 'um por semana, em um ano' },
  { n: 100, rotulo: '100', dica: 'no seu ritmo' },
  { n: 365, rotulo: '365', dica: 'um por dia, em um ano' },
];
export const METAS_SUGERIDAS = [1000, 5000, 10000, 40000];

/** O passo de arredondamento: valores médios pequenos ficam em 1 real; médios, em 5; grandes, em 10. */
export function passoDe(alvo: number, n: number): number {
  const medio = alvo / n;
  return medio < 20 ? 1 : medio < 200 ? 5 : 10;
}

/** Gera `n` valores inteiros, crescentes (do menor ao maior), todos positivos, que somam exatamente `alvo`. */
export function gerarCelulas(alvo: number, n: number): number[] {
  const total = Math.round(alvo);
  if (!(n >= 1) || !(total >= n)) return [];
  const passo = passoDe(total, n);
  const T = (n * (n + 1)) / 2;
  // valor de cada quadradinho proporcional à posição (1, 2, 3…), arredondado ao passo e nunca menor que o passo
  const v = Array.from({ length: n }, (_, i) => Math.max(passo, Math.round(((i + 1) * total) / T / passo) * passo));
  let falta = total - v.reduce((a, b) => a + b, 0);
  // acerta a diferença no passo, dos maiores para os menores (sobra pouco: o arredondamento erra só um passo por quadradinho)
  for (let k = n - 1, voltas = 0; Math.abs(falta) >= passo && voltas < n * 50; k = k === 0 ? n - 1 : k - 1, voltas++) {
    const d = falta > 0 ? passo : -passo;
    if (v[k] + d >= passo) { v[k] += d; falta -= d; }
  }
  // o que sobra (menos que um passo) vai no último quadradinho, para a soma bater no centavo do real
  v[n - 1] += falta;
  return v.sort((a, b) => a - b);
}

export interface ProgressoDesafio { guardado: number; alvo: number; pct: number; marcadas: number; total: number; falta: number }
export function progresso(celulas: number[], marcadas: number[]): ProgressoDesafio {
  const set = new Set(marcadas.filter((i) => i >= 0 && i < celulas.length));
  const guardado = [...set].reduce((t, i) => t + celulas[i], 0);
  const alvo = celulas.reduce((a, b) => a + b, 0);
  return { guardado, alvo, pct: alvo > 0 ? Math.round((guardado / alvo) * 100) : 0, marcadas: set.size, total: celulas.length, falta: Math.max(0, alvo - guardado) };
}

/** Sorteia um quadradinho ainda livre (com `aleatorio` injetável para os testes). Null quando a grade está completa. */
export function sortear(celulas: number[], marcadas: number[], aleatorio = Math.random): number | null {
  const set = new Set(marcadas);
  const livres = celulas.map((_, i) => i).filter((i) => !set.has(i));
  return livres.length ? livres[Math.floor(aleatorio() * livres.length)] : null;
}

/** Marcos que pedem comemoração quando o progresso passa por eles. */
export const MARCOS = [25, 50, 75, 100];
export const marcoAtingido = (antes: number, depois: number) => MARCOS.find((m) => antes < m && depois >= m) ?? null;

/** "1,2 mil" para caber no quadradinho. */
export function valorCurto(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1).replace('.', ',')} mil`;
  return String(v);
}
