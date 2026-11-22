// A imagem do mês para postar (1080×1920), no estilo da carteira de luxo. Por padrão NÃO mostra valores em reais:
// só porcentagens e contagens, para a pessoa poder postar sem expor quanto ganha ou deve.

import { ensureFonts, roundRect, shareOrDownload, STORY_H, STORY_W } from '../storyCard';

export interface DadosCartaoMes {
  mes: string; // "Novembro de 2026"
  sobraPct: number | null; // % da renda que sobrou (negativo = passou)
  dias: number; // dias seguidos anotando
  saude: number | null; // nota 0 a 100
  cartoes: { rotulo: string; valor: string }[]; // até 3, já sem valores em reais
}

const OURO = ['#F3DB9C', '#D2A24A', '#8A6320'] as const;

export async function desenharCartaoMes(d: DadosCartaoMes): Promise<HTMLCanvasElement> {
  await ensureFonts();
  const c = document.createElement('canvas');
  c.width = STORY_W;
  c.height = STORY_H;
  const x = c.getContext('2d')!;
  // fundo: preto quente com luz dourada
  const bg = x.createLinearGradient(0, 0, 0, STORY_H);
  bg.addColorStop(0, '#1E1710');
  bg.addColorStop(1, '#09070A');
  x.fillStyle = bg;
  x.fillRect(0, 0, STORY_W, STORY_H);
  const luz = x.createRadialGradient(240, 220, 20, 240, 220, 760);
  luz.addColorStop(0, 'rgba(210,162,74,.38)');
  luz.addColorStop(1, 'rgba(210,162,74,0)');
  x.fillStyle = luz;
  x.fillRect(0, 0, STORY_W, STORY_H);

  x.textAlign = 'center';
  x.fillStyle = '#E8D7A8';
  x.font = '600 34px "IBM Plex Sans", system-ui, sans-serif';
  x.fillText('GRANA SÉRIA', STORY_W / 2, 150);
  x.fillStyle = 'rgba(248,241,226,.7)';
  x.font = '500 38px "IBM Plex Sans", system-ui, sans-serif';
  x.fillText(d.mes, STORY_W / 2, 214);

  // cartões que aparecem atrás da carteira
  const cores: [string, string, string][] = [[OURO[0], OURO[1], '#3B2A0A'], ['#2A2724', '#141311', '#E8D7A8'], ['#6A1B31', '#33091A', '#F6D9DF']];
  const cx = 130;
  const larg = STORY_W - 260;
  d.cartoes.slice(0, 3).forEach((k, i) => {
    const y = 470 + i * 96;
    const g = x.createLinearGradient(cx, y, cx + larg, y + 120);
    g.addColorStop(0, cores[i][0]);
    g.addColorStop(1, cores[i][1]);
    x.fillStyle = g;
    roundRect(x, cx - i * 0, y, larg, 280, 64);
    x.fill();
    x.fillStyle = cores[i][2];
    x.textAlign = 'left';
    x.font = '700 40px "IBM Plex Sans", system-ui, sans-serif';
    x.fillText(k.rotulo, cx + 56, y + 64);
    x.textAlign = 'right';
    x.fillText(k.valor, cx + larg - 56, y + 64);
  });

  // a carteira (couro escuro, costura dourada)
  const by = 720;
  const bh = 760;
  const bw = STORY_W - 120;
  const cou = x.createLinearGradient(60, by, 60, by + bh);
  cou.addColorStop(0, '#3A2A1C');
  cou.addColorStop(0.5, '#21170F');
  cou.addColorStop(1, '#120C07');
  x.fillStyle = cou;
  x.shadowColor = 'rgba(0,0,0,.6)';
  x.shadowBlur = 60;
  x.shadowOffsetY = 30;
  roundRect(x, 60, by, bw, bh, 90);
  x.fill();
  x.shadowColor = 'transparent';
  x.strokeStyle = 'rgba(232,199,122,.85)';
  x.lineWidth = 4;
  x.setLineDash([16, 14]);
  roundRect(x, 92, by + 32, bw - 64, bh - 64, 66);
  x.stroke();
  x.setLineDash([]);

  x.textAlign = 'left';
  x.fillStyle = 'rgba(248,241,226,.78)';
  x.font = '600 40px "IBM Plex Sans", system-ui, sans-serif';
  x.fillText('Meu mês', 150, by + 140);
  x.fillStyle = '#F8F1E2';
  x.font = '700 150px "IBM Plex Sans", system-ui, sans-serif';
  const grande = d.sobraPct === null ? '—' : d.sobraPct >= 0 ? `${d.sobraPct}%` : 'Apertado';
  x.fillText(grande, 144, by + 320);
  x.fillStyle = '#E8C77A';
  x.font = '600 46px "IBM Plex Sans", system-ui, sans-serif';
  x.fillText(d.sobraPct === null ? 'comecei a anotar' : d.sobraPct >= 0 ? 'da minha renda sobrou' : 'mas anotei tudo', 150, by + 390);

  const chips: string[] = [];
  if (d.dias > 0) chips.push(`${d.dias} ${d.dias === 1 ? 'dia' : 'dias'} anotando`);
  if (d.saude !== null) chips.push(`Saúde ${d.saude}/100`);
  chips.forEach((t, i) => {
    const w = 440;
    const y = by + 470 + i * 110;
    x.fillStyle = 'rgba(232,199,122,.14)';
    roundRect(x, 150, y, w, 84, 42);
    x.fill();
    x.strokeStyle = 'rgba(232,199,122,.5)';
    x.lineWidth = 2;
    roundRect(x, 150, y, w, 84, 42);
    x.stroke();
    x.fillStyle = '#F8F1E2';
    x.font = '600 38px "IBM Plex Sans", system-ui, sans-serif';
    x.fillText(t, 190, y + 56);
  });

  x.textAlign = 'center';
  x.fillStyle = 'rgba(248,241,226,.6)';
  x.font = '500 36px "IBM Plex Sans", system-ui, sans-serif';
  x.fillText('Organize seu dinheiro sem complicar', STORY_W / 2, 1640);
  x.fillStyle = '#E8D7A8';
  x.font = '700 44px "IBM Plex Sans", system-ui, sans-serif';
  x.fillText('granaseria.com.br', STORY_W / 2, 1720);
  return c;
}

export async function compartilharMes(d: DadosCartaoMes) {
  const canvas = await desenharCartaoMes(d);
  return shareOrDownload(canvas, 'meu-mes-grana-seria.png', 'Meu mês na Grana Séria');
}
