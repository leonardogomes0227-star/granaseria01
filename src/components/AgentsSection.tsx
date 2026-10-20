import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Plus, Trash2 } from 'lucide-react';
import { AGENTS, CUSTOM_AGENTS_KEY, customPlan, loadChosen, saveChosen, type CustomAgent } from '../agents';
import { getAnswers, recommend } from '../profile';
import { saveGoal, setToolTasks } from '../results';
import { AgentAvatar } from './AgentPage';
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

export function AgentsSection({ hasDiagnosis }: { hasDiagnosis: boolean; bare?: boolean }) {
  const navigate = useNavigate();
  const answers = getAnswers();
  // os indicados pelas perguntas da entrada vêm primeiro entre os disponíveis
  const picked = answers ? recommend(answers, hasDiagnosis).map((p) => AGENTS.find((a) => a.tool === p.tool)?.id).filter(Boolean) : ['dabasir', 'bansir', 'arkad'];
  const rank = (id: string) => (picked.indexOf(id) === -1 ? 99 : picked.indexOf(id));
  const [custom, setCustom] = useState<CustomAgent[]>(loadCustom);
  const [chosen, setChosen] = useState<string[]>(loadChosen);
  const [creating, setCreating] = useState(() => window.location.hash === '#criar');
  useEffect(() => {
    if (creating) window.setTimeout(() => document.getElementById('criar')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  }, [creating]);
  const toggle = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    setChosen(next);
    saveChosen(next);
  };
  const mine = AGENTS.filter((a) => chosen.includes(a.id));
  const free = AGENTS.filter((a) => !chosen.includes(a.id)).sort((x, y) => rank(x.id) - rank(y.id));

  const row = (a: (typeof AGENTS)[number], on: boolean) => (
    <li key={a.id} className="agent-row">
      <button type="button" className="agent-row-main" onClick={() => navigate(`/conselheiros/${a.id}`)}>
        <AgentAvatar id={a.id} name={a.name} hue={a.hue} size={48} />
        <span>
          <b>{a.name}</b>
          <small>{a.does}</small>
        </span>
      </button>
      <button type="button" className={`agent-pick ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(a.id)}>
        {on ? <><Check size={14} /> No meu app</> : <><Plus size={14} /> Adicionar</>}
      </button>
    </li>
  );

  return (
    <section className="agents-page" id="conselheiros">
      {(mine.length > 0 || custom.length > 0) && (
        <>
          <p className="section-label">Meus agentes</p>
          <ul className="agent-rows">
            {mine.map((a) => row(a, true))}
            {custom.map((c) => (
              <li key={c.id} className="agent-row">
                <span className="agent-row-main static">
                  <AgentAvatar name={c.name} hue={45} size={48} />
                  <span>
                    <b>{c.name}</b>
                    <small>{customPlan(c).lines[0]}</small>
                  </span>
                </span>
                <button
                  type="button"
                  className="agent-pick remove"
                  aria-label={`Remover ${c.name}`}
                  onClick={() => {
                    const next = custom.filter((x) => x.id !== c.id);
                    setCustom(next);
                    saveCustom(next);
                    setToolTasks('goal', []);
                  }}
                >
                  <Trash2 size={14} /> Remover
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {free.length > 0 && (
        <>
          {(mine.length > 0 || custom.length > 0) && <p className="section-label">Disponíveis</p>}
          <ul className="agent-rows">{free.map((a) => row(a, false))}</ul>
        </>
      )}

      <button type="button" className="agent-row create" onClick={() => setCreating(true)}>
        <span className="agent-row-main static">
          <span className="agent-create-icon"><Plus size={22} /></span>
          <span>
            <b>Criar o meu</b>
            <small>Você escolhe o que ele vigia e quando avisa</small>
          </span>
        </span>
      </button>

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
