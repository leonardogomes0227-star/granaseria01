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

function moeda(x: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, esp: number) {
  const lado = x.createLinearGradient(cx - rx, 0, cx + rx, 0);
  lado.addColorStop(0, '#7A5614'); lado.addColorStop(0.3, '#E8C46A'); lado.addColorStop(0.55, '#B98625'); lado.addColorStop(1, '#6A4A0E');
  x.fillStyle = lado;
  x.beginPath(); x.ellipse(cx, cy + esp, rx, ry, 0, 0, Math.PI); x.lineTo(cx - rx, cy); x.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true); x.closePath(); x.fill();
  const topo = x.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, 4, cx, cy, rx);
  topo.addColorStop(0, '#FFF1BF'); topo.addColorStop(0.55, '#E2B24A'); topo.addColorStop(1, '#A87820');
  x.fillStyle = topo;
  x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(255, 238, 170, .65)'; x.lineWidth = 3;
  x.beginPath(); x.ellipse(cx, cy, rx * 0.84, ry * 0.84, 0, 0, Math.PI * 2); x.stroke();
}

export async function desenharCartaoMes(d: DadosCartaoMes): Promise<HTMLCanvasElement> {
  await ensureFonts();
  const c = document.createElement('canvas');
  c.width = STORY_W; c.height = STORY_H;
  const x = c.getContext('2d')!;
  const bg = x.createLinearGradient(0, 0, 0, STORY_H);
  bg.addColorStop(0, '#0A2A21'); bg.addColorStop(0.55, '#05160F'); bg.addColorStop(1, '#030D09');
  x.fillStyle = bg; x.fillRect(0, 0, STORY_W, STORY_H);
  const luz = x.createRadialGradient(260, 260, 20, 260, 260, 820);
  luz.addColorStop(0, 'rgba(46, 170, 124, .38)'); luz.addColorStop(1, 'rgba(46, 170, 124, 0)');
  x.fillStyle = luz; x.fillRect(0, 0, STORY_W, STORY_H);
  const ouroLuz = x.createRadialGradient(540, 1320, 10, 540, 1320, 620);
  ouroLuz.addColorStop(0, 'rgba(232, 196, 106, .28)'); ouroLuz.addColorStop(1, 'rgba(232, 196, 106, 0)');
  x.fillStyle = ouroLuz; x.fillRect(0, 700, STORY_W, 1100);

  x.textAlign = 'center';
  x.fillStyle = '#EBCF8B'; x.font = '600 36px "IBM Plex Sans", system-ui, sans-serif';
  x.fillText('GRANA SÉRIA', STORY_W / 2, 170);
  x.fillStyle = 'rgba(243, 239, 227, .7)'; x.font = '500 40px "IBM Plex Sans", system-ui, sans-serif';
  x.fillText(d.mes, STORY_W / 2, 236);

  const grande = d.sobraPct === null ? '—' : d.sobraPct >= 0 ? `${d.sobraPct}%` : 'Apertado';
  const g = x.createLinearGradient(0, 330, 0, 560);
  g.addColorStop(0, '#FFF3CF'); g.addColorStop(1, '#E1B861');
  x.fillStyle = g; x.font = '800 230px "IBM Plex Sans", system-ui, sans-serif';
  x.fillText(grande, STORY_W / 2, 520);
  x.fillStyle = '#F3EFE3'; x.font = '600 52px "IBM Plex Sans", system-ui, sans-serif';
  x.fillText(d.sobraPct === null ? 'comecei a anotar meu dinheiro' : d.sobraPct >= 0 ? 'da minha renda sobrou este mês' : 'mas anotei cada gasto', STORY_W / 2, 610);

  // a pilha de ouro (a altura mostra a reserva)
  const n = Math.max(4, Math.min(22, d.moedas));
  const base = 1450; const rx = 190; const ry = 56; const esp = 26;
  x.fillStyle = 'rgba(0, 0, 0, .45)';
  x.beginPath(); x.ellipse(STORY_W / 2, base + esp + 14, rx * 1.35, ry * 0.9, 0, 0, Math.PI * 2); x.fill();
  for (let i = 0; i < n; i++) moeda(x, STORY_W / 2 + ((i * 7) % 5 - 2) * 2, base - i * (esp - 2), rx, ry, esp);
  moeda(x, STORY_W / 2 - 330, base + 14, rx * 0.62, ry * 0.62, esp * 0.7);
  moeda(x, STORY_W / 2 + 340, base + 22, rx * 0.62, ry * 0.62, esp * 0.7);

  // faixas com os números
  const chips: string[] = [];
  if (d.reservaPct !== null) chips.push(`Reserva ${d.reservaPct}%`);
  if (d.dias > 0) chips.push(`${d.dias} ${d.dias === 1 ? 'dia' : 'dias'} anotando`);
  if (d.saude !== null) chips.push(`Saúde ${d.saude}/100`);
  x.font = '650 34px "IBM Plex Sans", system-ui, sans-serif';
  const larguras = chips.map((t) => x.measureText(t).width + 52);
  const total = larguras.reduce((a, b) => a + b, 0) + (chips.length - 1) * 14;
  let cx = (STORY_W - total) / 2;
  chips.forEach((t, i) => {
    x.fillStyle = 'rgba(216, 178, 90, .14)'; roundRect(x, cx, 720, larguras[i], 86, 43); x.fill();
    x.strokeStyle = 'rgba(235, 207, 139, .55)'; x.lineWidth = 2; roundRect(x, cx, 720, larguras[i], 86, 43); x.stroke();
    x.fillStyle = '#F3EFE3'; x.fillText(t, cx + larguras[i] / 2, 775);
    cx += larguras[i] + 14;
  });

  x.fillStyle = 'rgba(243, 239, 227, .6)'; x.font = '500 36px "IBM Plex Sans", system-ui, sans-serif';
  x.fillText('Organize seu dinheiro sem complicar', STORY_W / 2, 1700);
  x.fillStyle = '#EBCF8B'; x.font = '700 46px "IBM Plex Sans", system-ui, sans-serif';
  x.fillText('granaseria.com.br', STORY_W / 2, 1772);
  return c;
}

export async function compartilharMes(d: DadosCartaoMes) {
  const canvas = await desenharCartaoMes(d);
  return shareOrDownload(canvas, 'meu-mes-grana-seria.png', 'Meu mês na Grana Séria');
}
