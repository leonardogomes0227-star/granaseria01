import { useEffect, useRef, useState } from 'react';
import { Download, Instagram, Check } from 'lucide-react';
import { Archetype } from '../archetypes';
import { STORY_THEMES, StoryTheme, renderStoryCard, shareOrDownload } from '../storyCard';

const THEME_KEY = 'selos-story-theme';

function siteHost(): string {
  return typeof window !== 'undefined' ? window.location.host.replace(/^www\./, '') : 'granaseria01.vercel.app';
}

function loadTheme(): StoryTheme {
  try {
    const t = localStorage.getItem(THEME_KEY) as StoryTheme | null;
    return t && t in STORY_THEMES ? t : 'ouro';
  } catch {
    return 'ouro';
  }
}

export function ArchetypeShare({ archetype, score }: { archetype: Archetype; score: number }) {
  const [theme, setTheme] = useState<StoryTheme>(loadTheme);
  const [showScore, setShowScore] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let alive = true;
    renderStoryCard(archetype, theme, { score: showScore ? score : null, siteUrl: siteHost() }).then((c) => {
      if (!alive) return;
      canvasRef.current = c;
      setPreview(c.toDataURL('image/jpeg', 0.82));
    });
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // sem localStorage, só não lembra a escolha
    }
    return () => {
      alive = false;
    };
  }, [archetype, theme, showScore, score]);

  const share = async () => {
    if (!canvasRef.current) return;
    setStatus('working');
    const r = await shareOrDownload(canvasRef.current, `meu-arquetipo-grana-seria.png`, archetype.name);
    setStatus(r === 'cancelled' ? 'idle' : 'done');
    if (r !== 'cancelled') setTimeout(() => setStatus('idle'), 2500);
  };

  return (
    <div className="archetype">
      <div className="archetype-copy">
        <p className="diag-label" style={{ marginBottom: 2 }}>Seu arquétipo financeiro</p>
        <h3 className="archetype-name">{archetype.name}</h3>
        <p className="archetype-tagline">{archetype.tagline}</p>
        <div className="archetype-facts">
          <p><b>Seu poder:</b> {archetype.power}</p>
          <p><b>Sua próxima missão:</b> {archetype.quest}</p>
        </div>

        <p className="field-label" style={{ marginTop: 18 }}>Escolha a vibe do seu story</p>
        <div className="theme-swatches" role="radiogroup" aria-label="Estilo do cartão">
          {(Object.keys(STORY_THEMES) as StoryTheme[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={theme === t}
              className={`swatch ${theme === t ? 'active' : ''}`}
              onClick={() => setTheme(t)}
              title={STORY_THEMES[t].label}
            >
              <i style={{ background: `linear-gradient(160deg, ${STORY_THEMES[t].bg[0]}, ${STORY_THEMES[t].bg[1]})` }}>
                {theme === t && <Check size={14} color={STORY_THEMES[t].fg} />}
              </i>
              <span>{STORY_THEMES[t].label}</span>
            </button>
          ))}
        </div>

        <label className="toggle">
          <input type="checkbox" checked={showScore} onChange={(e) => setShowScore(e.target.checked)} />
          <span /> Mostrar minha nota no cartão
        </label>
        <p className="field-hint">O cartão nunca mostra valores em reais — só o seu perfil.</p>

        <div className="archetype-actions">
          <button className="btn-primary btn-shine" type="button" onClick={share} disabled={!preview || status === 'working'}>
            {status === 'done' ? <Check size={17} /> : <Instagram size={17} />}
            {status === 'done' ? 'Pronto!' : 'Postar no story'}
          </button>
          <a
            className="btn-ghost"
            href={preview ?? undefined}
            download="meu-arquetipo-grana-seria.jpg"
            aria-disabled={!preview}
          >
            <Download size={15} /> Baixar imagem
          </a>
        </div>
      </div>

      <div className="phone" aria-label="Prévia do story">
        <div className="phone-screen">
          {preview ? <img key={preview.length + theme} src={preview} alt={`Cartão: ${archetype.name}`} /> : <div className="phone-loading" />}
        </div>
      </div>
    </div>
  );
}
