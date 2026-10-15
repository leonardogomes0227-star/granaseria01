import { useEffect, useState } from 'react';
import { RefreshCw, LogOut } from 'lucide-react';

/* ---------- Painel do dono: uso do assistente do WhatsApp (só com a senha ADMIN_SECRET) ---------- */

interface Stats {
  generatedAt: string;
  totals: { people: number; messages: number; activeToday: number; active7d: number; active30d: number };
  daily: { day: string; newPeople: number; activePeople: number; messages: number }[];
  usage: { avgActiveDays: number; avgSpanDays: number; returned: number; returnedPct: number; buckets: { label: string; people: number }[] };
  funnel: { key: string; label: string; people: number }[];
  tools: { tool: string; people: number; times: number }[];
  feedback: { up: number; down: number; asked: number; answeredAsk: number; recent: { at: string; kind: 'up' | 'down'; tool: string; note: string | null }[] };
}

const KEY = 'gs_admin';
const readKey = () => {
  try {
    return sessionStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
};
const num = (n: number) => n.toLocaleString('pt-BR');
const shortDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function AdminPage() {
  const [secret, setSecret] = useState(readKey);
  const [input, setInput] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'wrong' | 'error'>('idle');

  // página privada: fora do Google
  useEffect(() => {
    const tag = document.createElement('meta');
    tag.name = 'robots';
    tag.content = 'noindex, nofollow';
    document.head.appendChild(tag);
    return () => tag.remove();
  }, []);

  const load = async (key: string) => {
    setState('loading');
    try {
      const res = await fetch('/api/admin', { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
      if (res.status === 401) {
        try {
          sessionStorage.removeItem(KEY);
        } catch {
          // sem storage, segue
        }
        setSecret('');
        setStats(null);
        setState('wrong');
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setStats((await res.json()) as Stats);
      setSecret(key);
      try {
        sessionStorage.setItem(KEY, key);
      } catch {
        // sem storage, segue
      }
      setState('idle');
    } catch {
      setState('error');
    }
  };

  useEffect(() => {
    if (secret) void load(secret);
    // só na abertura da página
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = () => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // sem storage, segue
    }
    setSecret('');
    setStats(null);
  };

  if (!stats) {
    return (
      <div className="page-wrap anim-in account-page">
        <div className="kicker"><span className="wedge" />Painel</div>
        <h1>Painel do assistente</h1>
        <p className="wizard-sub">Área restrita. Digite a senha do painel pra ver o uso do WhatsApp.</p>
        <form
          className="account-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) void load(input.trim());
          }}
        >
          <label className="field-label" htmlFor="admin-secret">Senha</label>
          <input id="admin-secret" className="field-input" type="password" autoComplete="current-password" value={input} onChange={(e) => setInput(e.target.value)} />
          <button className="btn btn-primary" type="submit" disabled={state === 'loading'}>
            {state === 'loading' ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        {state === 'wrong' && <div className="insight insight-warn" role="alert">Senha incorreta.</div>}
        {state === 'error' && <div className="insight insight-warn" role="alert">Não consegui carregar. Confira se o painel está configurado (ADMIN_SECRET e o SQL de métricas) e tente de novo.</div>}
      </div>
    );
  }

  const maxActive = Math.max(1, ...stats.daily.map((d) => d.activePeople));
  const maxFunnel = Math.max(1, ...stats.funnel.map((f) => f.people));
  const maxBucket = Math.max(1, ...stats.usage.buckets.map((b) => b.people));
  const asked = stats.feedback.up + stats.feedback.down;

  return (
    <div className="page-wrap anim-in admin-page">
      <div className="kicker"><span className="wedge" />Painel</div>
      <div className="admin-head">
        <h1>Uso do assistente</h1>
        <div className="admin-actions">
          <button className="btn btn-ghost" onClick={() => void load(secret)} disabled={state === 'loading'}>
            <RefreshCw size={15} /> Atualizar
          </button>
          <button className="btn btn-ghost" onClick={logout}>
            <LogOut size={15} /> Sair
          </button>
        </div>
      </div>
      <p className="wizard-sub">Atualizado em {when(stats.generatedAt)}. Só mostra comportamento: o telefone nunca é guardado nas métricas.</p>
      {state === 'error' && <div className="insight insight-warn" role="alert">Não consegui atualizar agora.</div>}

      <div className="admin-grid">
        <Card label="Pessoas (total)" value={num(stats.totals.people)} />
        <Card label="Ativas hoje" value={num(stats.totals.activeToday)} />
        <Card label="Ativas em 7 dias" value={num(stats.totals.active7d)} />
        <Card label="Ativas em 30 dias" value={num(stats.totals.active30d)} />
        <Card label="Mensagens (desde o painel)" value={num(stats.totals.messages)} />
        <Card label="Voltaram em outro dia" value={`${stats.usage.returnedPct}%`} sub={`${num(stats.usage.returned)} pessoas`} />
      </div>

      <h2 className="admin-h2">Últimos 14 dias</h2>
      <div className="admin-chart" role="img" aria-label="Pessoas ativas por dia">
        {stats.daily.map((d) => (
          <div className="admin-col" key={d.day} title={`${shortDay(d.day)}: ${d.activePeople} ativas, ${d.newPeople} novas, ${d.messages} mensagens`}>
            <span className="admin-val">{d.activePeople}</span>
            <div className="admin-bar" style={{ height: `${Math.max(4, (d.activePeople / maxActive) * 100)}%` }} />
            <span className="admin-day">{shortDay(d.day)}</span>
          </div>
        ))}
      </div>
      <p className="admin-note">Cada barra é o número de pessoas que falaram com o bot no dia. Passe o dedo ou o mouse pra ver novas e mensagens.</p>

      <h2 className="admin-h2">Quanto tempo usam</h2>
      <div className="admin-grid">
        <Card label="Dias de uso por pessoa (média)" value={String(stats.usage.avgActiveDays).replace('.', ',')} />
        <Card label="Do primeiro ao último contato (média)" value={`${String(stats.usage.avgSpanDays).replace('.', ',')} dias`} />
      </div>
      {stats.usage.buckets.map((b) => (
        <div className="bar-row" key={b.label}>
          <span className="bar-label">{b.label}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(b.people / maxBucket) * 100}%` }} /></div>
          <span className="admin-count">{b.people}</span>
        </div>
      ))}

      <h2 className="admin-h2">Onde as pessoas chegam</h2>
      {stats.funnel.map((f) => (
        <div className="bar-row" key={f.key}>
          <span className="bar-label admin-wide">{f.label}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(f.people / maxFunnel) * 100}%` }} /></div>
          <span className="admin-count">{f.people}</span>
        </div>
      ))}

      <h2 className="admin-h2">Ferramentas mais abertas</h2>
      {stats.tools.length === 0 ? (
        <p className="admin-note">Ainda sem registros.</p>
      ) : (
        <table className="admin-table">
          <thead><tr><th>Ferramenta</th><th>Pessoas</th><th>Vezes</th></tr></thead>
          <tbody>
            {stats.tools.map((t) => (
              <tr key={t.tool}><td>{t.tool}</td><td>{t.people}</td><td>{t.times}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="admin-h2">Feedback</h2>
      <div className="admin-grid">
        <Card label="👍 Ajudou" value={num(stats.feedback.up)} />
        <Card label="👎 Não ajudou" value={num(stats.feedback.down)} />
        <Card label="Respostas ao 👍/👎" value={num(asked)} />
        <Card label="Pedidos de feedback enviados" value={num(stats.feedback.asked)} sub={`${num(stats.feedback.answeredAsk)} pessoas responderam`} />
      </div>
      {stats.feedback.recent.length === 0 ? (
        <p className="admin-note">Ninguém avaliou ainda.</p>
      ) : (
        <ul className="admin-feed">
          {stats.feedback.recent.map((f, i) => (
            <li key={`${f.at}-${i}`}>
              <b>{f.kind === 'up' ? '👍' : '👎'}</b> <span className="admin-tool">{f.tool === 'geral' ? 'pedido do bot' : f.tool}</span> · {when(f.at)}
              {f.note && <div className="admin-quote">“{f.note}”</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="admin-card">
      <div className="admin-label">{label}</div>
      <div className="admin-value">{value}</div>
      {sub && <div className="admin-sub">{sub}</div>}
    </div>
  );
}
