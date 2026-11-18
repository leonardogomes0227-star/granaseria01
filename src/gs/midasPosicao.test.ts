import { describe, expect, it } from 'vitest';
import { aoLadoDoAlvo, areaCruze, casaDoMidas, cruza, lugarDaFala, type Caixa } from './midasPosicao';

const navDe = (vw: number, vh: number): Caixa => ({ l: 12, t: vh - 86, r: vw - 12, b: vh - 10 });

function corpo(p: { x: number; y: number }): Caixa {
  return { l: p.x - 4, t: p.y - 4, r: p.x + 64, b: p.y + 68 };
}

describe('lugar do Midas', () => {
  for (const [vw, vh] of [[360, 740], [390, 844], [1280, 800]] as const) {
    it(`cabe na tela ${vw}×${vh} sem sentar na barra`, () => {
      const nav = vw >= 1000 ? null : navDe(vw, vh);
      const casa = casaDoMidas(vw, vh, nav);
      expect(casa.x).toBeGreaterThanOrEqual(8);
      expect(casa.x + 70).toBeLessThanOrEqual(vw);
      expect(casa.y).toBeGreaterThanOrEqual(8);
      if (nav) {
        expect(cruza(corpo(casa), nav, 0)).toBe(false);
        expect(casa.y + 68).toBeLessThanOrEqual(nav.t);
      }
      const fala = lugarDaFala(168, 96, casa.x, casa.y, vw, vh, [], nav);
      const caixa: Caixa = { l: fala.l, t: fala.t, r: fala.l + 168, b: fala.t + 96 };
      expect(caixa.l).toBeGreaterThanOrEqual(8);
      expect(caixa.r).toBeLessThanOrEqual(vw - 8);
      expect(caixa.t).toBeGreaterThanOrEqual(8);
      if (nav) {
        expect(caixa.b).toBeLessThanOrEqual(nav.t - 8);
        expect(areaCruze(caixa, nav)).toBe(0);
      } else {
        expect(caixa.b).toBeLessThanOrEqual(vh - 8);
      }
    });
  }

  it('não cobre o alvo nem a barra quando aponta um botão baixo', () => {
    const vw = 360;
    const vh = 740;
    const nav = navDe(vw, vh);
    const alvo: Caixa = { l: 16, t: 520, r: 168, b: 590 };
    const lado = aoLadoDoAlvo(alvo, vw, vh, nav);
    expect(cruza(corpo(lado), nav, 0)).toBe(false);
    expect(lado.x).toBeGreaterThanOrEqual(8);
    expect(lado.x + 70).toBeLessThanOrEqual(vw);
    const fala = lugarDaFala(150, 88, lado.x, lado.y, vw, vh, [alvo], nav);
    const caixa: Caixa = { l: fala.l, t: fala.t, r: fala.l + 150, b: fala.t + 88 };
    expect(areaCruze(caixa, nav)).toBe(0);
    expect(areaCruze(caixa, alvo)).toBe(0);
  });

  it('sempre devolve um ponto, mesmo com a tela cheia de obstáculos', () => {
    const nav = navDe(390, 844);
    const cheio: Caixa[] = [];
    for (let y = 0; y < 844; y += 40) for (let x = 0; x < 390; x += 40) cheio.push({ l: x, t: y, r: x + 36, b: y + 36 });
    const fala = lugarDaFala(140, 80, 300, 700, 390, 844, cheio, nav);
    expect(Number.isFinite(fala.l)).toBe(true);
    expect(Number.isFinite(fala.t)).toBe(true);
    expect(fala.t + 80).toBeLessThanOrEqual(nav.t - 8);
  });
});
