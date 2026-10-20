import { useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { sendFeedback } from '../painel';
import { track } from '../analytics';

/* ---------- "Isso te ajudou?" sem precisar escrever ---------- */
// Um toque: 👍 ou 👎. Só no 👎 aparece um campo opcional pra dizer o que faltou. Vai pro painel do dono.

const doneKey = (tool: string) => `gs-fb-${tool}`;
const wasDone = (tool: string) => {
  try {
    return localStorage.getItem(doneKey(tool)) === '1';
  } catch {
    return false;
  }
};

export function SiteFeedback({ tool, question = 'Essa ferramenta te ajudou?' }: { tool: string; question?: string }) {
  const [state, setState] = useState<'ask' | 'note' | 'done'>(() => (wasDone(tool) ? 'done' : 'ask'));
  const [note, setNote] = useState('');
  const finish = (kind: 'up' | 'down', text?: string) => {
    void sendFeedback(tool, kind, text);
    track('feedback_site', { ferramenta: tool, voto: kind });
    try {
      localStorage.setItem(doneKey(tool), '1');
    } catch {
      // segue
    }
    setState('done');
  };

  if (state === 'done') return <div className="site-feedback done">Obrigado pela opinião!</div>;
  if (state === 'note') {
    return (
      <div className="site-feedback">
        <p>O que faltou? <small>(opcional)</small></p>
        <textarea className="field-input" rows={2} maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: queria ver a data em que fico livre" />
        <div className="site-feedback-row">
          <button type="button" className="btn-primary" onClick={() => finish('down', note)}>Enviar</button>
          <button type="button" className="btn-outline" onClick={() => finish('down')}>Pular</button>
        </div>
      </div>
    );
  }
  return (
    <div className="site-feedback">
      <p>{question}</p>
      <div className="site-feedback-row">
        <button type="button" className="btn-outline" onClick={() => finish('up')}><ThumbsUp size={15} /> Ajudou</button>
        <button type="button" className="btn-outline" onClick={() => setState('note')}><ThumbsDown size={15} /> Faltou algo</button>
      </div>
    </div>
  );
}
