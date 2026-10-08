import { useEffect } from 'react';
import { useMetaDescription } from '../meta';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { GUIDES, Guide } from '../guides';
import { track } from '../analytics';

export function GuidesIndex() {
  useMetaDescription('Guias rápidos e diretos sobre dívidas, cartão de crédito, 13º salário, reserva de emergência e seus direitos com o banco.');
  return (
    <div className="page-wrap anim-in guides">
      <div className="kicker"><span className="wedge" />Guias</div>
      <h1>Guias pra resolver sua vida financeira</h1>
      <p className="wizard-sub">Respostas diretas pras dúvidas mais comuns — e a ferramenta certa pra resolver cada uma.</p>
      <div className="guide-list stagger">
        {GUIDES.map((g) => (
          <Link className="guide-item" key={g.slug} to={`/guias/${g.slug}`}>
            <span className="guide-kicker">{g.kicker}</span>
            <b>{g.title}</b>
            <span>{g.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function GuidePage({ guide, onStart }: { guide: Guide; onStart: () => void }) {
  useMetaDescription(guide.description);
  useEffect(() => {
    track('guia_lido', { guia: guide.slug });
  }, [guide.slug]);
  const others = GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 3);

  return (
    <article className="page-wrap anim-in guide">
      <div className="kicker"><span className="wedge" />{guide.kicker}</div>
      <h1>{guide.title}</h1>
      <div className="page-body">
        {guide.sections.map((s, i) => (
          <section key={i}>
            {s.h && <h2>{s.h}</h2>}
            {s.p?.map((p, j) => <p key={j}>{p}</p>)}
            {s.list && (
              <ul>
                {s.list.map((li, j) => <li key={j}>{li}</li>)}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="guide-cta">
        <p>{guide.cta.text}</p>
        {guide.cta.tool ? (
          <Link className="btn-primary" to={`/ferramentas/${guide.cta.tool}`}>
            {guide.cta.label} <ArrowRight size={16} className="arrow" />
          </Link>
        ) : (
          <button type="button" className="btn-primary" onClick={onStart}>
            {guide.cta.label} <ArrowRight size={16} className="arrow" />
          </button>
        )}
      </div>

      <p className="field-hint" style={{ marginTop: 18 }}>Conteúdo educativo, não substitui orientação financeira ou jurídica individual.</p>

      <div className="guide-more">
        <p className="diag-label"><BookOpen size={14} style={{ verticalAlign: '-2px' }} /> Leia também</p>
        {others.map((g) => (
          <Link key={g.slug} to={`/guias/${g.slug}`}>{g.title}</Link>
        ))}
      </div>
    </article>
  );
}
