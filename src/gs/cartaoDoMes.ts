// A imagem do mês para postar (1080×1920): esmeralda e ouro, com a pilha de moedas. Por padrão NÃO mostra valores em reais:
// só porcentagens e contagens, para a pessoa poder postar sem expor quanto ganha ou deve.

import { ensureFonts, roundRect, shareOrDownload, STORY_H, STORY_W } from '../storyCard';

export interface DadosCartaoMes {
  mes: string; // "Novembro de 2026"
  sobraPct: number | null; // % da renda que sobrou (negativo = passou)
  dias: number; // dias seguidos anotando
  saude: number | null; // nota 0 a 100
  reservaPct: number | null; // % da reserva de emergência
  moedas: number; // altura da pilha de ouro
}

export async function desenharCartaoMes(d: DadosCartaoMes): Promise<HTMLCanvasElement> {
  await ensureFonts();
  await Promise.race([Promise.allSettled([document.fonts.load('500 200px Fraunces'), document.fonts.load('600 36px "Plus Jakarta Sans"')]), new Promise((r) => setTimeout(r, 1500))]);
  const c = document.createElement('canvas');
  c.width = STORY_W; c.height = STORY_H;
  const x = c.getContext('2d')!;
  const bg = x.createLinearGradient(0, 0, 0, STORY_H);
  bg.addColorStop(0, '#0C1512'); bg.addColorStop(1, '#050807');
  x.fillStyle = bg; x.fillRect(0, 0, STORY_W, STORY_H);
  const l1 = x.createRadialGradient(220, 80, 10, 220, 80, 900); l1.addColorStop(0, 'rgba(230,199,122,.30)'); l1.addColorStop(1, 'rgba(230,199,122,0)');
  x.fillStyle = l1; x.fillRect(0, 0, STORY_W, STORY_H);
  const l2 = x.createRadialGradient(1080, 1500, 10, 1080, 1500, 900); l2.addColorStop(0, 'rgba(28,107,80,.55)'); l2.addColorStop(1, 'rgba(28,107,80,0)');
  x.fillStyle = l2; x.fillRect(0, 0, STORY_W, STORY_H);

  x.textAlign = 'center';
  x.fillStyle = '#EBCF8B'; x.font = '700 34px "Plus Jakarta Sans", system-ui, sans-serif';
  const marca = 'G R A N A   S É R I A'; x.fillText(marca, STORY_W / 2, 170);
  x.fillStyle = 'rgba(246,241,228,.65)'; x.font = '500 38px "Plus Jakarta Sans", system-ui, sans-serif';
  x.fillText(d.mes, STORY_W / 2, 236);

  const grande = d.sobraPct === null ? '—' : d.sobraPct >= 0 ? `${d.sobraPct}%` : 'Apertado';
  const g = x.createLinearGradient(0, 330, 0, 620); g.addColorStop(0, '#FFF6D8'); g.addColorStop(1, '#DDB257');
  x.fillStyle = g; x.font = '500 330px Fraunces, Georgia, serif';
  x.fillText(grande, STORY_W / 2, 590);
  x.fillStyle = '#F6F1E4'; x.font = '600 52px "Plus Jakarta Sans", system-ui, sans-serif';
  x.fillText(d.sobraPct === null ? 'comecei a anotar meu dinheiro' : d.sobraPct >= 0 ? 'da minha renda sobrou este mês' : 'mas anotei cada gasto', STORY_W / 2, 700);

  const chips: string[] = [];
  if (d.reservaPct !== null) chips.push(`Reserva ${d.reservaPct}%`);
  if (d.dias > 0) chips.push(`${d.dias} ${d.dias === 1 ? 'dia' : 'dias'} anotando`);
  if (d.saude !== null) chips.push(`Saúde ${d.saude}/100`);
  x.font = '650 34px "Plus Jakarta Sans", system-ui, sans-serif';
  const lg = chips.map((t) => x.measureText(t).width + 52);
  let cx = (STORY_W - (lg.reduce((a2, b2) => a2 + b2, 0) + (chips.length - 1) * 14)) / 2;
  chips.forEach((t, i) => {
    x.fillStyle = 'rgba(235,207,139,.12)'; roundRect(x, cx, 790, lg[i], 86, 43); x.fill();
    x.strokeStyle = 'rgba(235,207,139,.55)'; x.lineWidth = 2; roundRect(x, cx, 790, lg[i], 86, 43); x.stroke();
    x.fillStyle = '#F6F1E4'; x.fillText(t, cx + lg[i] / 2, 846); cx += lg[i] + 14;
  });

  // cartão de ouro inclinado
  x.save(); x.translate(STORY_W / 2, 1290); x.rotate(-0.07);
  const W = 800; const H = 440;
  x.shadowColor = 'rgba(0,0,0,.85)'; x.shadowBlur = 80; x.shadowOffsetY = 50;
  const ouro = x.createLinearGradient(-W / 2, -H / 2, W / 2, H / 2);
  [[0, '#FBEBB8'], [0.2, '#E0B759'], [0.42, '#A67A26'], [0.6, '#F5DE9C'], [0.78, '#CFA24A'], [1, '#FFF4D2']].forEach(([o, col]) => ouro.addColorStop(o as number, col as string));
  x.fillStyle = ouro; roundRect(x, -W / 2, -H / 2, W, H, 50); x.fill();
  x.shadowColor = 'transparent';
  const brilho = x.createLinearGradient(-W / 2, 0, W / 2, 0); brilho.addColorStop(0.3, 'rgba(255,255,255,0)'); brilho.addColorStop(0.5, 'rgba(255,255,255,.45)'); brilho.addColorStop(0.7, 'rgba(255,255,255,0)');
  x.save(); roundRect(x, -W / 2, -H / 2, W, H, 50); x.clip(); x.fillStyle = brilho; x.fillRect(-W / 2, -H / 2, W, H);
  x.strokeStyle = 'rgba(110,74,12,.22)'; x.lineWidth = 2;
  for (let r = 40; r < 340; r += 26) { x.beginPath(); x.arc(W / 2 - 80, -H / 2 + 80, r, 0, Math.PI * 2); x.stroke(); } x.restore();
  x.textAlign = 'left'; x.fillStyle = '#6E4A0C'; x.font = '700 30px "Plus Jakarta Sans", sans-serif'; x.fillText('G R A N A   S É R I A', -W / 2 + 56, -H / 2 + 80);
  x.font = '500 76px Fraunces, Georgia, serif'; x.fillText('Meu mês em dia', -W / 2 + 56, 40);
  x.font = '700 26px "Plus Jakarta Sans", sans-serif'; x.fillText(`MEMBRO ${new Date().getFullYear()}`, -W / 2 + 56, H / 2 - 50);
  x.restore();

  x.textAlign = 'center';
  x.fillStyle = 'rgba(246,241,228,.6)'; x.font = '500 36px "Plus Jakarta Sans", system-ui, sans-serif';
  x.fillText('Organize seu dinheiro sem complicar', STORY_W / 2, 1700);
  x.fillStyle = '#EBCF8B'; x.font = '700 46px "Plus Jakarta Sans", system-ui, sans-serif';
  x.fillText('granaseria.com.br', STORY_W / 2, 1772);
  return c;
}

export async function compartilharMes(d: DadosCartaoMes) {
  const canvas = await desenharCartaoMes(d);
  return shareOrDownload(canvas, 'meu-mes-grana-seria.png', 'Meu mês na Grana Séria');
}
