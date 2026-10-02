import { ensureFonts, wrapLines, spaced, roundRect } from './storyCard';

// Cartão da "Frase do dia": story (1080×1920) ou post do feed (1080×1350).

export type QuoteFormat = 'story' | 'feed';
export type QuoteTheme = 'minimal' | 'salvia' | 'rose' | 'ouro' | 'areia' | 'lapis' | 'terracota';

interface QuotePalette {
  label: string;
  bg: [string, string];
  fg: string;
  accent: string;
  muted: string;
  line: string;
}

export const QUOTE_THEMES: Record<QuoteTheme, QuotePalette> = {
  minimal: { label: 'Minimal', bg: ['#FAF8F3', '#EFEBE2'], fg: '#1F1B16', accent: '#9A7B4F', muted: '#7D746A', line: 'rgba(31,27,22,0.14)' },
  salvia: { label: 'Sálvia', bg: ['#C9D3C0', '#9FAF97'], fg: '#22301F', accent: '#FBF6EC', muted: '#3F5139', line: 'rgba(34,48,31,0.2)' },
  rose: { label: 'Rosé', bg: ['#F3DFD6', '#E2BFB2'], fg: '#4A2A22', accent: '#A65A47', muted: '#7A5045', line: 'rgba(74,42,34,0.18)' },
  ouro: { label: 'Noite dourada', bg: ['#2E2213', '#0F0B06'], fg: '#FBF6EC', accent: '#E0B04A', muted: '#CDBB91', line: 'rgba(224,176,74,0.28)' },
  areia: { label: 'Areia', bg: ['#F8EED3', '#E3CD95'], fg: '#241A0F', accent: '#8A5A12', muted: '#6B5D42', line: 'rgba(122,83,17,0.22)' },
  lapis: { label: 'Lápis-lazúli', bg: ['#1F5A82', '#0A2133'], fg: '#F6EEDA', accent: '#E8C25A', muted: '#AFC6DA', line: 'rgba(232,194,90,0.26)' },
  terracota: { label: 'Terracota', bg: ['#D88A69', '#7C3A24'], fg: '#FFF6EC', accent: '#FFE0A8', muted: '#F6D2C0', line: 'rgba(255,224,168,0.3)' },
};

export const QUOTE_SIZES: Record<QuoteFormat, { w: number; h: number; label: string }> = {
  story: { w: 1080, h: 1920, label: 'Story' },
  feed: { w: 1080, h: 1350, label: 'Feed' },
};

function drawOrnament(ctx: CanvasRenderingContext2D, cx: number, y: number, color: string) {
  // linha — losango — linha, no espírito das inscrições antigas
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 110, y);
  ctx.lineTo(cx - 22, y);
  ctx.moveTo(cx + 22, y);
  ctx.lineTo(cx + 110, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, y - 11);
  ctx.lineTo(cx + 11, y);
  ctx.lineTo(cx, y + 11);
  ctx.lineTo(cx - 11, y);
  ctx.closePath();
  ctx.fill();
}

export async function renderQuoteCard(
  quote: string,
  opts: { theme: QuoteTheme; format: QuoteFormat; dateLabel: string; siteUrl: string }
): Promise<HTMLCanvasElement> {
  await ensureFonts();
  const p = QUOTE_THEMES[opts.theme];
  const { w, h } = QUOTE_SIZES[opts.format];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const cx = w / 2;
  const isStory = opts.format === 'story';

  const bg = ctx.createLinearGradient(0, 0, w * 0.3, h);
  bg.addColorStop(0, p.bg[0]);
  bg.addColorStop(1, p.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // textura de grão bem leve — dá cara de papel/foto
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  ctx.strokeStyle = p.line;
  ctx.lineWidth = 2;
  roundRect(ctx, 48, 48, w - 96, h - 96, 32);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // topo
  const top = isStory ? 190 : 150;
  ctx.fillStyle = p.muted;
  ctx.font = '500 28px "IBM Plex Sans", system-ui, sans-serif';
  spaced(ctx, `FRASE DO DIA · ${opts.dateLabel.toUpperCase()}`, cx, top, 5);

  // frase, com fonte que se ajusta ao tamanho do texto
  const maxW = w - 220;
  const areaTop = isStory ? 420 : 300;
  const areaBottom = isStory ? 1500 : 1050;
  let size = isStory ? 92 : 82;
  let lines: string[] = [];
  let lineH = 0;
  for (; size >= 48; size -= 4) {
    ctx.font = `500 ${size}px "EB Garamond", Georgia, serif`;
    lines = wrapLines(ctx, quote, maxW);
    lineH = size * 1.22;
    if (lines.length * lineH <= areaBottom - areaTop - 140) break;
  }
  const blockH = lines.length * lineH;
  let y = areaTop + (areaBottom - areaTop - blockH) / 2 + size * 0.8;

  // aspas grandes
  ctx.fillStyle = p.accent;
  ctx.font = `500 ${Math.round(size * 2.2)}px Cinzel, Georgia, serif`;
  ctx.fillText('“', cx, y - size * 0.9);

  ctx.fillStyle = p.fg;
  ctx.font = `500 ${size}px "EB Garamond", Georgia, serif`;
  for (const l of lines) {
    ctx.fillText(l, cx, y);
    y += lineH;
  }

  drawOrnament(ctx, cx, y + 40, p.accent);

  // rodapé
  const footY = h - (isStory ? 210 : 150);
  ctx.fillStyle = p.accent;
  ctx.font = '600 30px "IBM Plex Sans", system-ui, sans-serif';
  spaced(ctx, 'GRANA SÉRIA', cx, footY, 9);
  ctx.fillStyle = p.muted;
  ctx.font = '500 27px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillText(opts.siteUrl, cx, footY + 50);

  return canvas;
}
