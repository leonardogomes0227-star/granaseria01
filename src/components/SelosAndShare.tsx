import { ArrowRight, Share2 } from 'lucide-react';
import { hasDiagnosisCompleted } from '../config';
import { ToolShell, ToolNavProps } from './Tools';
import { Diagnosis, formatBRL } from '../calculations';

/* ---------- Painel de selos ---------- */

const ALL_SELOS = [
  { numeral: 'I', label: 'Pague-se primeiro' },
  { numeral: 'II', label: 'Controle os gastos' },
  { numeral: 'III', label: 'Construa sua reserva' },
  { numeral: 'IV', label: 'Proteja-se de perdas' },
];

export function SelosPanel({ onStart, ...nav }: { onStart: () => void } & ToolNavProps) {
  const earned = hasDiagnosisCompleted();

  return (
    <ToolShell id="selos" {...nav}>
      <p className="wizard-sub">
        {earned
          ? 'Você completou o diagnóstico e conquistou os quatro selos das leis do livro.'
          : 'Complete o diagnóstico pra desbloquear os quatro selos das leis do livro.'}
      </p>

      <div className="selos-grid">
        {ALL_SELOS.map((s, i) => (
          <div className={`selo-tile ${earned ? 'earned' : 'locked'}`} key={s.numeral} style={{ animation: `rise 0.5s var(--ease-out) both ${i * 0.1}s` }}>
            <svg width="52" height="52" viewBox="0 0 48 48" style={{ animationDelay: `${0.2 + i * 0.12}s` }}>
              <circle cx="24" cy="24" r="21" fill={earned ? '#C6842A' : '#E9DBB4'} />
              <circle cx="24" cy="24" r="21" fill="none" stroke={earned ? '#7A5311' : '#DCC996'} strokeWidth="1.5" />
              <text x="24" y="31" textAnchor="middle" fontFamily="Cinzel, serif" fontSize="17" fill={earned ? '#3A2506' : '#B7A576'}>
                {s.numeral}
              </text>
            </svg>
            <p className="selo-tile-label">{s.label}</p>
          </div>
        ))}
      </div>

      {!earned && (
        <button className="btn-primary" type="button" onClick={onStart} style={{ marginTop: 16 }}>
          Fazer diagnóstico <ArrowRight size={16} className="arrow" />
        </button>
      )}
    </ToolShell>
  );
}

/* ---------- Exportar diagnóstico como imagem ---------- */

async function drawShareImage(diagnosis: Diagnosis): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d')!;

  // fundo areia
  ctx.fillStyle = '#F7EFDC';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // faixa dourada no topo
  ctx.fillStyle = '#BD7E1E';
  ctx.fillRect(0, 0, canvas.width, 8);

  // marca
  ctx.fillStyle = '#BD7E1E';
  ctx.beginPath();
  ctx.arc(90, 100, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5A3A0A';
  ctx.fillRect(70, 116, 40, 6);
  ctx.fillRect(75, 104, 30, 6);
  ctx.fillRect(80, 92, 20, 6);

  ctx.fillStyle = '#241A0F';
  ctx.font = '500 30px Cinzel, serif';
  ctx.fillText('Grana Séria', 140, 112);

  // título
  ctx.fillStyle = '#241A0F';
  ctx.font = '500 42px Cinzel, serif';
  wrapText(ctx, 'Meu diagnóstico financeiro', 70, 220, 760, 50);

  // stats
  const stats: [string, string][] = [
    ['Taxa de poupança', `${diagnosis.savingsRate.toFixed(0)}% de ${diagnosis.savingsGoalRate}% ideal`],
    ['Dívidas', formatBRL(diagnosis.totalDebt)],
    ['Reserva de emergência', `${diagnosis.emergencyProgress.toFixed(0)}% da meta`],
    ['Projeção em 10 anos', formatBRL(diagnosis.projection10y)],
  ];

  let y = 340;
  stats.forEach(([label, value]) => {
    ctx.fillStyle = '#94875F';
    ctx.font = '400 18px "IBM Plex Sans", sans-serif';
    ctx.fillText(label, 70, y);
    ctx.fillStyle = '#241A0F';
    ctx.font = '500 40px Cinzel, serif';
    ctx.fillText(value, 70, y + 46);
    y += 130;
  });

  // rodapé
  ctx.fillStyle = '#94875F';
  ctx.font = 'italic 20px "EB Garamond", serif';
  ctx.fillText('Baseado em O Homem Mais Rico da Babilônia', 70, canvas.height - 50);

  return canvas.toDataURL('image/png');
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  words.forEach((word) => {
    const testLine = line + word + ' ';
    if (ctx.measureText(testLine).width > maxWidth && line !== '') {
      ctx.fillText(line, x, curY);
      line = word + ' ';
      curY += lineHeight;
    } else {
      line = testLine;
    }
  });
  ctx.fillText(line, x, curY);
}

export function ShareDiagnosisButton({ diagnosis }: { diagnosis: Diagnosis }) {
  const handleShare = async () => {
    const dataUrl = await drawShareImage(diagnosis);

    // no celular, tenta abrir o menu de compartilhar nativo primeiro
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'meu-diagnostico-grana-seria.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Meu diagnóstico financeiro' });
          return;
        }
      } catch {
        // se o compartilhamento nativo falhar ou for cancelado, cai pro download abaixo
      }
    }

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'meu-diagnostico-grana-seria.png';
    link.click();
  };

  return (
    <button className="btn-outline" type="button" onClick={handleShare} style={{ marginTop: 12 }}>
      <Share2 size={16} /> Compartilhar meu diagnóstico
    </button>
  );
}
