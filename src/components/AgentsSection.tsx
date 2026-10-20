import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { AGENTS, CUSTOM_AGENTS_KEY, customPlan, type CustomAgent } from '../agents';
import { getAnswers, recommend } from '../profile';
import { saveGoal, setToolTasks } from '../results';
import { formatBRL } from '../calculations';
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

export function AgentsSection({ hasDiagnosis }: { hasDiagnosis: boolean }) {
  const navigate = useNavigate();
  const answers = getAnswers();
  // os indicados pelas perguntas da entrada vêm primeiro
  const picked = answers ? recommend(answers, hasDiagnosis).map((p) => AGENTS.find((a) => a.tool === p.tool)?.id).filter(Boolean) : ['dabasir', 'bansir', 'arkad'];
  const order = [...AGENTS].sort((a, b) => (picked.indexOf(a.id) === -1 ? 99 : picked.indexOf(a.id)) - (picked.indexOf(b.id) === -1 ? 99 : picked.indexOf(b.id)));
  const [custom, setCustom] = useState<CustomAgent[]>(loadCustom);
  const [creating, setCreating] = useState(false);

  return (
    <section className="section agents" id="conselheiros">
      <div className="section-head center">
        <div className="kicker">Seus conselheiros</div>
        <h2>Escolha quem vai te ajudar</h2>
        <p>Cada um cuida de um problema, com as lições de O Homem Mais Rico da Babilônia e de Pai Rico, Pai Pobre. Ele conversa com você, monta o seu plano e te lembra no WhatsApp.</p>
      </div>

      <div className="agents-grid">
        {order.map((a) => {
          const Icon = a.icon;
          const rec = picked.includes(a.id);
          return (
            <button key={a.id} type="button" className={`agent-card ${rec ? 'rec' : ''}`} onClick={() => navigate(`/conselheiros/${a.id}`)}>
              <span className="agent-cover" style={{ background: `linear-gradient(150deg, hsl(${a.hue} 55% 38%), hsl(${(a.hue + 30) % 360} 40% 16%))` }}>
                <Icon size={30} strokeWidth={1.6} />
                {rec && <em>Indicado pra você</em>}
              </span>
              <span className="agent-copy">
                <b>{a.name}</b>
                <span>{a.role}</span>
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
            <span>Um conselheiro só pro seu objetivo: juntar pra algo, quitar uma dívida ou gastar menos com uma coisa.</span>
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

function CreateAgent({ onDone, onCancel }: { onDone: (c: CustomAgent) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CustomAgent['kind']>('juntar');
  const [what, setWhat] = useState('');
  const [amount, setAmount] = useState(0);
  const [months, setMonths] = useState(12);
  const [freq, setFreq] = useState<CustomAgent['freq']>('mes');
  const ok = name.trim() && what.trim() && amount > 0 && months > 0;
  const preview = ok ? customPlan({ id: '', name, kind, what, amount, months, freq, createdAt: '' }).lines[0] : null;
  return (
    <div className="stat-card agent-create">
      <p className="field-label" style={{ fontWeight: 700 }}>Criar o meu conselheiro</p>
      <div className="field-group">
        <label className="field-label" htmlFor="ag-name">Nome dele</label>
        <input id="ag-name" className="field-input" placeholder="Ex.: Meta da moto" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="seg" role="tablist" aria-label="O que ele vai fazer" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {([['juntar', 'Juntar pra algo'], ['divida', 'Quitar uma dívida'], ['gasto', 'Gastar menos']] as [CustomAgent['kind'], string][]).map(([k, l]) => (
          <button key={k} type="button" className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>{l}</button>
        ))}
      </div>
      <div className="field-group">
        <label className="field-label" htmlFor="ag-what">{kind === 'juntar' ? 'Pra quê?' : kind === 'divida' ? 'Qual dívida?' : 'Gastar menos com o quê?'}</label>
        <input id="ag-what" className="field-input" placeholder={kind === 'juntar' ? 'Ex.: moto, viagem' : kind === 'divida' ? 'Ex.: cartão Nubank' : 'Ex.: delivery'} value={what} maxLength={40} onChange={(e) => setWhat(e.target.value)} />
      </div>
      <MoneyField label={kind === 'gasto' ? 'Quanto quer gastar no máximo, no total do período' : 'Valor'} value={amount} onChange={setAmount} />
      <div className="field-group">
        <label className="field-label" htmlFor="ag-months">Em quantos meses?</label>
        <DecimalInput id="ag-months" decimals={0} max={240} value={months} onChange={(v) => setMonths(Math.max(1, v))} />
      </div>
      <div className="seg" role="tablist" aria-label="Lembrete" style={{ marginBottom: 12 }}>
        <button type="button" className={freq === 'mes' ? 'active' : ''} onClick={() => setFreq('mes')}>Lembrar todo mês</button>
        <button type="button" className={freq === 'semana' ? 'active' : ''} onClick={() => setFreq('semana')}>Toda semana</button>
      </div>
      {preview && <p className="insight insight-info" style={{ marginTop: 0 }}>{preview}</p>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-primary"
          disabled={!ok}
          onClick={() => onDone({ id: `c-${Date.now()}`, name: name.trim(), kind, what: what.trim(), amount, months, freq, createdAt: new Date().toISOString() })}
        >
          Criar {name.trim() ? `o ${name.trim()}` : 'o conselheiro'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
      {amount > 0 && <p className="field-hint" style={{ marginTop: 8 }}>Total: {formatBRL(amount)} em {months} meses.</p>}
    </div>
  );
}
