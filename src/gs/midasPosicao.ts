// Onde o Midas pode ficar e onde a fala cabe, sem cobrir o menu de baixo.
// Puro: sem DOM, para o mesmo cálculo valer no celular (360 e 390) e no computador.

export type Caixa = { l: number; t: number; r: number; b: number };
export type Ponto = { x: number; y: number };

const MARGEM = 8;

export function cruza(a: Caixa, b: Caixa, folga = 4): boolean {
  return !(a.r + folga <= b.l || a.l >= b.r + folga || a.b + folga <= b.t || a.t >= b.b + folga);
}

export function areaCruze(a: Caixa, b: Caixa): number {
  const l = Math.max(a.l, b.l);
  const t = Math.max(a.t, b.t);
  const r = Math.min(a.r, b.r);
  const btm = Math.min(a.b, b.b);
  if (r <= l || btm <= t) return 0;
  return (r - l) * (btm - t);
}

/** Canto de casa: acima da barra de baixo, com folga para o corpo e os botões. */
export function casaDoMidas(vw: number, vh: number, nav: Caixa | null): Ponto {
  const acima = nav ? nav.t : vh - 10;
  return {
    x: Math.max(MARGEM, vw - 78),
    y: Math.max(MARGEM, acima - 88),
  };
}

/** Ao lado do alvo, sem descer por cima da barra. */
export function aoLadoDoAlvo(alvo: Caixa, vw: number, vh: number, nav: Caixa | null): Ponto {
  const limite = (nav ? nav.t : vh) - 80;
  let x = alvo.l - 74;
  if (x < MARGEM) x = Math.min(alvo.r + 12, vw - 74);
  x = Math.max(MARGEM, Math.min(x, vw - 70));
  let y = alvo.t + (alvo.b - alvo.t) / 2 - 28;
  y = Math.max(MARGEM, Math.min(y, Math.max(MARGEM, limite)));
  return { x, y };
}

/**
 * Sempre devolve um lugar. Antes a busca em grade desistia e a fala ficava invisível
 * (o guia travava, sem "Próximo"). Agora escolhe o candidato que menos cobre botões e a barra.
 */
export function lugarDaFala(
  w: number,
  h: number,
  px: number,
  py: number,
  vw: number,
  vh: number,
  obstaculos: Caixa[],
  nav: Caixa | null,
): { l: number; t: number } {
  const largura = Math.max(48, w);
  const altura = Math.max(36, h);
  const maxB = (nav ? nav.t : vh) - MARGEM;
  const maxR = vw - MARGEM;
  const maxL = Math.max(MARGEM, maxR - largura);
  const maxT = Math.max(MARGEM, maxB - altura);
  const clamp = (l: number, t: number) => ({
    l: Math.max(MARGEM, Math.min(l, maxL)),
    t: Math.max(MARGEM, Math.min(t, maxT)),
  });
  // Perto do mascote. Um canto vazio do outro lado da tela perde: a fala tem que parecer dele.
  const preferido = { l: px - largura + 36, t: py - altura - 16 };
  const brutos = [
    preferido,
    { l: px - largura - 8, t: py - altura + 8 },
    { l: px - 8, t: py - altura - 16 },
    { l: px + 58, t: py - altura - 8 },
    { l: px - largura + 20, t: py + 62 },
    { l: px + 58, t: py + 8 },
  ];
  let melhor = clamp(preferido.l, preferido.t);
  let melhorNota = Number.POSITIVE_INFINITY;
  for (const bruto of brutos) {
    const p = clamp(bruto.l, bruto.t);
    const c: Caixa = { l: p.l, t: p.t, r: p.l + largura, b: p.t + altura };
    let nota = Math.hypot(p.l - preferido.l, p.t - preferido.t) * 4;
    for (const o of obstaculos) nota += Math.min(areaCruze(c, o), 420);
    if (nav) nota += areaCruze(c, nav) * 40;
    if (c.b > maxB + 0.5) nota += 8000;
    if (c.r > vw - MARGEM + 0.5 || c.l < MARGEM - 0.5) nota += 8000;
    if (nota < melhorNota) {
      melhorNota = nota;
      melhor = p;
    }
  }
  return melhor;
}
