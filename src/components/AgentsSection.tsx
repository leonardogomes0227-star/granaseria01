import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { AGENTS, CUSTOM_AGENTS_KEY, customPlan, type CustomAgent } from '../agents';
import { getAnswers, recommend } from '../profile';
import { saveGoal, setToolTasks } from '../results';
import { AgentAvatar } from './AgentPage';
import { AgentArt } from './AgentArt';
import { MoneyField } from './Tools';
import { DecimalInput } from './DecimalInput';

/* ---------- Seus conselheiros: um pra cada dor, e o que a pessoa cria ---------- */

function loadCustom(): CustomAgent[] {
  try {
    const v = JSON.parse(localStorage.getItem(CUSTOM_AGENTS_KEY) || '[]') as CustomAgent[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function saveCustom(list: CustomAgent[]) {
  try {
    localStorage.setItem(CUSTOM_AGENTS_KEY, JSON.stringify(list));
  } catch {
    // segue sem salvar
  }
}

export function AgentsSection({ hasDiagnosis, bare = false }: { hasDiagnosis: boolean; bare?: boolean }) {
  const navigate = useNavigate();
  const answers = getAnswers();
  // os indicados pelas perguntas da entrada vêm primeiro
  const picked = answers ? recommend(answers, hasDiagnosis).map((p) => AGENTS.find((a) => a.tool === p.tool)?.id).filter(Boolean) : ['dabasir', 'bansir', 'arkad'];
  const order = [...AGENTS].sort((a, b) => (picked.indexOf(a.id) === -1 ? 99 : picked.indexOf(a.id)) - (picked.indexOf(b.id) === -1 ? 99 : picked.indexOf(b.id)));
  const [custom, setCustom] = useState<CustomAgent[]>(loadCustom);
  const [creating, setCreating] = useState(() => window.location.hash === '#criar');
  useEffect(() => {
    if (creating) window.setTimeout(() => document.getElementById('criar')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  }, [creating]);

  return (
    <section className={bare ? 'agents bare' : 'section agents'} id="conselheiros">
      {!bare && <div className="section-head center">
        <div className="kicker">Seus conselheiros</div>
        <h2>Escolha quem vai te ajudar</h2>
        <p>Cada um cuida de um problema, com as lições de O Homem Mais Rico da Babilônia e de Pai Rico, Pai Pobre. Ele conversa com você, monta o seu plano e te lembra no WhatsApp.</p>
      </div>}

      <div className="agents-grid">
        {order.map((a) => {
          const rec = picked.includes(a.id);
          return (
            <button key={a.id} type="button" className={`agent-card ${rec ? 'rec' : ''}`} onClick={() => navigate(`/conselheiros/${a.id}`)}>
              <span className="agent-cover">
                <AgentArt id={a.id} hue={a.hue} />
                {rec && <em>Indicado pra você</em>}
              </span>
              <span className="agent-copy">
                <b>{a.name}</b>
                <span>{a.does}</span>
              </span>
            </button>
          );
        })}
        {custom.map((c) => (
          <div key={c.id} className="agent-card mine">
            <span className="agent-cover mine-cover">
              <AgentAvatar name={c.name} hue={45} size={52} />
            </span>
            <span className="agent-copy">
              <b>{c.name}</b>
              <span>{customPlan(c).lines[0]}</span>
              <button
                type="button"
                className="plan-more danger"
                onClick={() => {
                  const next = custom.filter((x) => x.id !== c.id);
                  setCustom(next);
                  saveCustom(next);
                  setToolTasks('goal', []);
                }}
              >
                <Trash2 size={13} /> apagar
              </button>
            </span>
          </div>
        ))}
        <button type="button" className="agent-card create" onClick={() => setCreating(true)}>
          <span className="agent-cover create-cover"><Plus size={30} /></span>
          <span className="agent-copy">
            <b>Criar o meu</b>
            <span>Escolha o que ele vigia e quando te avisa no WhatsApp.</span>
          </span>
        </button>
      </div>

      {creating && (
        <CreateAgent
          onCancel={() => setCreating(false)}
          onDone={(c) => {
            const next = [...custom, c];
            setCustom(next);
            saveCustom(next);
            const plan = customPlan(c);
            setToolTasks('goal', plan.tasks);
            if (c.kind === 'juntar') saveGoal({ name: c.what, target: c.amount, monthly: Math.ceil(c.amount / Math.max(1, c.months)), months: c.months });
            setCreating(false);
          }}
        />
      )}
    </section>
  );
}

const KINDS: { kind: CustomAgent['kind']; title: string; text: string; whatLabel: string; placeholder: string }[] = [
  { kind: 'juntar', title: 'Juntar dinheiro', text: 'Te avisa na hora de guardar pro seu objetivo.', whatLabel: 'Pra quê?', placeholder: 'Ex.: moto, viagem' },
  { kind: 'divida', title: 'Quitar uma dívida', text: 'Te avisa na hora de pagar um valor a mais.', whatLabel: 'Qual dívida?', placeholder: 'Ex.: cartão Nubank' },
  { kind: 'gasto', title: 'Gastar menos', text: 'Te avisa na hora de conferir o seu limite.', whatLabel: 'Com o quê?', placeholder: 'Ex.: delivery' },
];
const AGENT_NAME: Record<CustomAgent['kind'], string> = { juntar: 'Meta', divida: 'Dívida', gasto: 'Limite' };

/** Criar um agente em dois toques: escolhe o que ele vigia, preenche o essencial e vê "Quando… então…" antes de ativar. */
function CreateAgent({ onDone, onCancel }: { onDone: (c: CustomAgent) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<CustomAgent['kind'] | null>(null);
  const [what, setWhat] = useState('');
  const [amount, setAmount] = useState(0);
  const [months, setMonths] = useState(12);
  const [freq, setFreq] = useState<CustomAgent['freq']>('mes');
  const info = KINDS.find((k) => k.kind === kind);
  const ok = Boolean(kind && what.trim() && amount > 0 && (kind === 'gasto' || months > 0));
  const draft: CustomAgent | null = kind
    ? { id: `c-${Date.now()}`, name: `${AGENT_NAME[kind]}: ${what.trim() || '…'}`, kind, what: what.trim(), amount, months: kind === 'gasto' ? 1 : months, freq, createdAt: new Date().toISOString() }
    : null;
  const notice = ok && draft ? customPlan(draft).tasks[0]?.text : null;

  return (
    <div className="stat-card agent-create" id="criar">
      <div className="agent-create-head">
        <p className="field-label" style={{ fontWeight: 700, margin: 0 }}>{kind ? info?.title : 'O que o seu agente vai vigiar?'}</p>
        <button type="button" className="link-btn" onClick={kind ? () => setKind(null) : onCancel}>{kind ? 'Trocar' : 'Cancelar'}</button>
      </div>

      {!kind ? (
        <div className="trigger-options">
          {KINDS.map((k) => (
            <button key={k.kind} type="button" className="trigger-option" onClick={() => setKind(k.kind)}>
              <b>{k.title}</b>
              <small>{k.text}</small>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="field-group">
            <label className="field-label" htmlFor="ag-what">{info?.whatLabel}</label>
            <input id="ag-what" className="field-input" placeholder={info?.placeholder} value={what} maxLength={40} autoFocus onChange={(e) => setWhat(e.target.value)} />
          </div>
          <MoneyField label={kind === 'gasto' ? 'Limite por mês' : 'Valor total'} value={amount} onChange={setAmount} />
          {kind !== 'gasto' && (
            <div className="field-group">
              <label className="field-label" htmlFor="ag-months">Em quantos meses?</label>
              <DecimalInput id="ag-months" decimals={0} max={240} value={months} onChange={(v) => setMonths(Math.max(1, v))} />
            </div>
          )}
          <p className="field-label" style={{ marginBottom: 6 }}>Quando o agente te avisa?</p>
          <div className="seg" role="tablist" aria-label="Quando avisar" style={{ marginBottom: 14 }}>
            <button type="button" className={freq === 'mes' ? 'active' : ''} onClick={() => setFreq('mes')}>Todo mês</button>
            <button type="button" className={freq === 'semana' ? 'active' : ''} onClick={() => setFreq('semana')}>Toda semana</button>
          </div>

          <div className={`when-then ${notice ? 'on' : ''}`} aria-live="polite">
            <span><small>Quando</small><b>{freq === 'semana' ? 'Chegar a semana' : 'Chegar o mês'}</b></span>
            <span><small>O agente</small><b>{notice ? `te avisa no WhatsApp: ${notice}` : 'Preencha acima pra ver o aviso.'}</b></span>
          </div>

          <button type="button" className="btn-primary agent-create-go" disabled={!ok} onClick={() => draft && onDone(draft)}>
            Ativar agente
          </button>
        </>
      )}
    </div>
  );
}
