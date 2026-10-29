import { STORY_H, STORY_THEMES, STORY_W, roundRect, shareOrDownload, wrapLines } from '../storyCard';

/* ---------- Imagem de story: "Quitei R$ X" no mesmo preto e dourado do app. Só o que a pessoa fez: nenhum dado pessoal além do nome da dívida. ---------- */

export async function imagemQuitou(p: { nome: string; valor: string; faltam: number; siteUrl: string }): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (document.fonts?.load) await Promise.race([Promise.allSettled([document.fonts.load('900 120px Inter'), document.fonts.load('600 40px Inter')]), new Promise((r) => setTimeout(r, 1500))]);
  const t = STORY_THEMES.ouro;
  const canvas = document.createElement('canvas');
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext('2d')!;
  const cx = STORY_W / 2;
  const fundo = ctx.createLinearGradient(0, 0, STORY_W * 0.3, STORY_H);
  fundo.addColorStop(0, t.bg[0]);
  fundo.addColorStop(1, t.bg[1]);
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, STORY_W, STORY_H);
  ctx.textAlign = 'center';

  ctx.fillStyle = t.accent;
  ctx.font = '600 40px Inter, system-ui, sans-serif';
  ctx.fillText('DÍVIDA QUITADA', cx, 560);

  ctx.fillStyle = t.fg;
  ctx.font = '900 150px Inter, system-ui, sans-serif';
  ctx.fillText('Quitei', cx, 760);
  ctx.fillStyle = t.accent;
  ctx.fillText(p.valor, cx, 920);

  ctx.fillStyle = t.muted;
  ctx.font = '600 46px Inter, system-ui, sans-serif';
  const linhas = wrapLines(ctx, p.nome, STORY_W - 240).slice(0, 2);
  linhas.forEach((l, i) => ctx.fillText(l, cx, 1010 + i * 62));

  const msg = p.faltam > 0 ? `${p.faltam === 1 ? 'Falta' : 'Faltam'} ${p.faltam} ${p.faltam === 1 ? 'dívida' : 'dívidas'}. Uma de cada vez.` : 'Foi a última. Livre das dívidas.';
  ctx.fillStyle = t.fg;
  ctx.font = '600 44px Inter, system-ui, sans-serif';
  const y = 1010 + linhas.length * 62 + 90;
  roundRect(ctx, cx - 400, y - 62, 800, 100, 50);
  ctx.strokeStyle = t.line;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillText(msg, cx, y);

  ctx.fillStyle = t.muted;
  ctx.font = '600 34px Inter, system-ui, sans-serif';
  ctx.fillText(p.siteUrl, cx, 1790);
  return shareOrDownload(canvas, 'quitei.png', 'Dívida quitada');
}
