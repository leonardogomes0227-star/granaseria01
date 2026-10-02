import { Archetype } from './archetypes';

// Desenha o cartão do arquétipo no formato de story (1080×1920) num <canvas>.
// Fica em canvas (e não print de HTML) pra gerar um PNG de verdade, pronto pra postar.

export type StoryTheme = 'ouro' | 'areia' | 'lapis' | 'terracota';

export interface Palette {
  label: string;
  bg: [string, string];
  fg: string;
  accent: string;
  muted: string;
  line: string;
  coin: [string, string, string];
  coinInk: string;
}

export const STORY_THEMES: Record<StoryTheme, Palette> = {
  ouro: {
    label: 'Noite dourada',
    bg: ['#2E2213', '#0F0B06'],
    fg: '#FBF6EC',
    accent: '#E0B04A',
    muted: '#CDBB91',
    line: 'rgba(224,176,74,0.28)',
    coin: ['#F0C46A', '#C6842A', '#8A5A12'],
    coinInk: '#4A2F08',
  },
  areia: {
    label: 'Areia',
    bg: ['#F8EED3', '#E3CD95'],
    fg: '#241A0F',
    accent: '#8A5A12',
    muted: '#6B5D42',
    line: 'rgba(122,83,17,0.22)',
    coin: ['#E8B45C', '#C6842A', '#93611A'],
    coinInk: '#4A2F08',
  },
  lapis: {
    label: 'Lápis-lazúli',
    bg: ['#1F5A82', '#0A2133'],
    fg: '#F6EEDA',
    accent: '#E8C25A',
    muted: '#AFC6DA',
    line: 'rgba(232,194,90,0.26)',
    coin: ['#F0C46A', '#C6842A', '#8A5A12'],
    coinInk: '#4A2F08',
  },
  terracota: {
    label: 'Terracota',
    bg: ['#D88A69', '#7C3A24'],
    fg: '#FFF6EC',
    accent: '#FFE0A8',
    muted: '#F6D2C0',
    line: 'rgba(255,224,168,0.3)',
    coin: ['#FFE3A6', '#E7B562', '#B57A2E'],
    coinInk: '#5A3410',
  },
};

export const STORY_W = 1080;
export const STORY_H = 1920;

export async function ensureFonts() {
  if (!document.fonts?.load) return;
  const loads = [
    document.fonts.load('500 80px Cinzel'),
    document.fonts.load('600 40px Cinzel'),
    document.fonts.load('italic 400 50px "EB Garamond"'),
    document.fonts.load('600 30px "IBM Plex Sans"'),
    document.fonts.load('500 30px "IBM Plex Sans"'),
  ];
  // não trava o cartão se a fonte demorar (rede ruim): desenha com a reserva
  await Promise.race([Promise.allSettled(loads), new Promise((r) => setTimeout(r, 1500))]);
}

export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  // texto com espaçamento entre letras, centralizado em x
  const chars = [...text];
  const total = chars.reduce((s, c) => s + ctx.measureText(c).width, 0) + spacing * (chars.length - 1);
  let cx = x - total / 2;
  ctx.textAlign = 'left';
  for (const c of chars) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + spacing;
  }
  ctx.textAlign = 'center';
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCoin(ctx: CanvasRenderingContext2D, p: Palette, cx: number, cy: number, r: number, numeral: string) {
  // anéis decorativos atrás da moeda
  ctx.strokeStyle = p.line;
  ctx.lineWidth = 2;
  for (const k of [1.55, 1.3]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  // raios
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 48; i++) {
    ctx.rotate((Math.PI * 2) / 48);
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.12);
    ctx.lineTo(0, -r * (i % 2 ? 1.2 : 1.27));
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 26;
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
  g.addColorStop(0, p.coin[0]);
  g.addColorStop(0.55, p.coin[1]);
  g.addColorStop(1, p.coin[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // serrilhado da borda
  ctx.strokeStyle = p.coinInk;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 14;
  ctx.setLineDash([4, 11]);
  ctx.beginPath();
  ctx.arc(cx, cy, r - 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // zigurate + numeral
  ctx.fillStyle = p.coinInk;
  const steps = [0.62, 0.46, 0.3];
  steps.forEach((w, i) => ctx.fillRect(cx - (r * w) / 2, cy + r * 0.42 - i * r * 0.11, r * w, r * 0.075));
  ctx.font = `500 ${Math.round(r * 0.62)}px Cinzel, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(numeral, cx, cy + r * 0.12);
}

export async function renderStoryCard(
  archetype: Archetype,
  theme: StoryTheme,
  opts: { score?: number | null; siteUrl: string }
): Promise<HTMLCanvasElement> {
  await ensureFonts();
  const p = STORY_THEMES[theme];
  const canvas = document.createElement('canvas');
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext('2d')!;
  const cx = STORY_W / 2;

  // fundo
  const bg = ctx.createLinearGradient(0, 0, STORY_W * 0.4, STORY_H);
  bg.addColorStop(0, p.bg[0]);
  bg.addColorStop(1, p.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STORY_W, STORY_H);
  const glow = ctx.createRadialGradient(cx, 760, 0, cx, 760, 760);
  glow.addColorStop(0, 'rgba(255,220,150,0.18)');
  glow.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, STORY_W, STORY_H);

  // moldura fina
  ctx.strokeStyle = p.line;
  ctx.lineWidth = 2;
  roundRect(ctx, 48, 48, STORY_W - 96, STORY_H - 96, 36);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = p.accent;
  ctx.font = '600 30px "IBM Plex Sans", system-ui, sans-serif';
  spaced(ctx, 'GRANA SÉRIA', cx, 168, 9);

  ctx.fillStyle = p.muted;
  ctx.font = '500 30px "IBM Plex Sans", system-ui, sans-serif';
  spaced(ctx, 'MEU ARQUÉTIPO FINANCEIRO', cx, 300, 6);

  drawCoin(ctx, p, cx, 690, 230, archetype.numeral);

  // nome
  ctx.fillStyle = p.fg;
  ctx.font = '500 86px Cinzel, Georgia, serif';
  const nameLines = wrapLines(ctx, archetype.name, 880);
  let y = 1135;
  for (const l of nameLines) {
    ctx.fillText(l, cx, y);
    y += 100;
  }

  // frase
  ctx.fillStyle = p.muted;
  ctx.font = 'italic 400 50px "EB Garamond", Georgia, serif';
  for (const l of wrapLines(ctx, archetype.tagline, 860)) {
    y += 8;
    ctx.fillText(l, cx, y);
    y += 58;
  }

  // traços
  y += 50;
  ctx.font = '500 30px "IBM Plex Sans", system-ui, sans-serif';
  const pads = 34;
  const widths = archetype.traits.map((t) => ctx.measureText(t).width + pads * 2);
  const gap = 18;
  const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
  if (total <= 940) {
    let x = cx - total / 2;
    archetype.traits.forEach((t, i) => {
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, widths[i], 68, 34);
      ctx.stroke();
      ctx.fillStyle = p.fg;
      ctx.fillText(t, x + widths[i] / 2, y + 45);
      x += widths[i] + gap;
    });
    y += 68;
  } else {
    archetype.traits.forEach((t) => {
      ctx.fillStyle = p.fg;
      ctx.fillText(`✦ ${t}`, cx, y + 40);
      y += 54;
    });
  }

  // nota opcional
  if (opts.score != null) {
    y += 56;
    ctx.fillStyle = p.accent;
    ctx.font = '600 34px "IBM Plex Sans", system-ui, sans-serif';
    spaced(ctx, `NOTA ${opts.score}/100`, cx, y + 20, 4);
  }

  // chamada final
  ctx.strokeStyle = p.line;
  ctx.beginPath();
  ctx.moveTo(cx - 140, 1650);
  ctx.lineTo(cx + 140, 1650);
  ctx.stroke();
  ctx.fillStyle = p.muted;
  ctx.font = 'italic 400 44px "EB Garamond", Georgia, serif';
  ctx.fillText('Descubra o seu', cx, 1730);
  ctx.fillStyle = p.fg;
  ctx.font = '600 36px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillText(opts.siteUrl, cx, 1790);

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar imagem'))), 'image/png')
  );
}

/** Abre o menu de compartilhar do celular (aparece Instagram, WhatsApp…); no computador, baixa o PNG. */
export async function shareOrDownload(canvas: HTMLCanvasElement, filename: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
      // outro erro: cai pro download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
