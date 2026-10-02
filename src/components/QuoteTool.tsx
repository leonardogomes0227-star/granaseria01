import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Check, Download, Instagram, Shuffle } from 'lucide-react';
import { ToolShell, ToolNavProps } from './Tools';
import { QUOTES, dailyQuoteIndex, formatDayLabel, CAPTION_HASHTAGS } from '../quotes';
import { QUOTE_THEMES, QUOTE_SIZES, QuoteFormat, QuoteTheme, renderQuoteCard } from '../quoteCard';
import { shareOrDownload } from '../storyCard';

const PREFS_KEY = 'selos-quote-prefs';

function loadPrefs(): { theme: QuoteTheme; format: QuoteFormat } {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return {
      theme: p.theme in QUOTE_THEMES ? p.theme : 'minimal',
      format: p.format in QUOTE_SIZES ? p.format : 'story',
    };
  } catch {
    return { theme: 'minimal', format: 'story' };
  }
}

export function QuoteTool(nav: ToolNavProps) {
  const today = dailyQuoteIndex();
  const [index, setIndex] = useState(today);
  const [{ theme, format }, setPrefs] = useState(loadPrefs);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const quote = QUOTES[index];
  const isToday = index === today;

  useEffect(() => {
    let alive = true;
    renderQuoteCard(quote, {
      theme,
      format,
      dateLabel: isToday ? formatDayLabel() : 'Grana Séria',
      siteUrl: window.location.host.replace(/^www\./, ''),
    }).then((c) => {
      if (!alive) return;
      canvasRef.current = c;
      setPreview(c.toDataURL('image/jpeg', 0.85));
    });
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ theme, format }));
    } catch {
      // sem localStorage, só não lembra a escolha
    }
    return () => {
      alive = false;
    };
  }, [quote, theme, format, isToday]);

  const step = (d: number) => setIndex((i) => (i + d + QUOTES.length) % QUOTES.length);
  const shuffle = () => {
    let next = index;
    while (next === index) next = Math.floor(Math.random() * QUOTES.length);
    setIndex(next);
  };

  const share = async () => {
    if (!canvasRef.current) return;
    setStatus('working');
    const r = await shareOrDownload(canvasRef.current, `frase-grana-seria-${format}.png`, 'Frase do dia — Grana Séria');
    setStatus(r === 'cancelled' ? 'idle' : 'done');
    if (r !== 'cancelled') setTimeout(() => setStatus('idle'), 2500);
  };

  const caption = `"${quote}"\n\n✨ Frase do dia da Grana Séria — faça seu diagnóstico financeiro grátis: ${window.location.host.replace(/^www\./, '')}\n\n${CAPTION_HASHTAGS}`;
  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard bloqueado: mostra a legenda pra copiar na mão
      window.prompt('Copie a legenda:', caption);
    }
  };

  return (
    <ToolShell id="quote" {...nav}>
      <p className="wizard-sub">Uma frase nova todo dia, pronta pra postar. Escolha a vibe e o formato.</p>

      <div className="quote-layout">
        <div className={`phone quote-phone ${format}`}>
          <div className="phone-screen">
            {preview ? <img key={preview.length} src={preview} alt={quote} /> : <div className="phone-loading" />}
          </div>
        </div>

        <div className="quote-controls">
          <div className="quote-nav">
            <button type="button" className="icon-btn" aria-label="Frase anterior" onClick={() => step(-1)}>
              <ChevronLeft size={18} />
            </button>
            <span className={`quote-badge ${isToday ? 'today' : ''}`}>
              {isToday ? `Hoje · ${formatDayLabel()}` : `Frase ${index + 1} de ${QUOTES.length}`}
            </span>
            <button type="button" className="icon-btn" aria-label="Próxima frase" onClick={() => step(1)}>
              <ChevronRight size={18} />
            </button>
            <button type="button" className="icon-btn" aria-label="Frase aleatória" onClick={shuffle} title="Sortear">
              <Shuffle size={16} />
            </button>
          </div>
          {!isToday && (
            <button type="button" className="btn-ghost" style={{ marginTop: -4, marginBottom: 8 }} onClick={() => setIndex(today)}>
              Voltar pra frase de hoje
            </button>
          )}

          <p className="field-label">Formato</p>
          <div className="seg" role="radiogroup" aria-label="Formato">
            {(Object.keys(QUOTE_SIZES) as QuoteFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={format === f}
                className={format === f ? 'active' : ''}
                onClick={() => setPrefs((p) => ({ ...p, format: f }))}
              >
                {QUOTE_SIZES[f].label} <small>{f === 'story' ? '9:16' : '4:5'}</small>
              </button>
            ))}
          </div>

          <p className="field-label" style={{ marginTop: 16 }}>Vibe</p>
          <div className="theme-swatches" role="radiogroup" aria-label="Estilo">
            {(Object.keys(QUOTE_THEMES) as QuoteTheme[]).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={theme === t}
                className={`swatch ${theme === t ? 'active' : ''}`}
                onClick={() => setPrefs((p) => ({ ...p, theme: t }))}
              >
                <i style={{ background: `linear-gradient(160deg, ${QUOTE_THEMES[t].bg[0]}, ${QUOTE_THEMES[t].bg[1]})` }}>
                  {theme === t && <Check size={14} color={QUOTE_THEMES[t].fg} />}
                </i>
                <span>{QUOTE_THEMES[t].label}</span>
              </button>
            ))}
          </div>

          <div className="archetype-actions">
            <button className="btn-primary btn-shine" type="button" onClick={share} disabled={!preview || status === 'working'}>
              {status === 'done' ? <Check size={17} /> : <Instagram size={17} />}
              {status === 'done' ? 'Pronto!' : 'Postar'}
            </button>
            <button className="btn-outline" type="button" onClick={copyCaption}>
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Legenda copiada' : 'Copiar legenda'}
            </button>
            <a className="btn-ghost" href={preview ?? undefined} download={`frase-grana-seria-${format}.jpg`}>
              <Download size={15} /> Baixar
            </a>
          </div>
          <p className="field-hint">Volte amanhã: a frase do dia muda à meia-noite.</p>
        </div>
      </div>
    </ToolShell>
  );
}
