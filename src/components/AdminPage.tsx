import { useEffect, useState } from 'react';
import { RefreshCw, LogOut, Megaphone, ShieldCheck } from 'lucide-react';
import { TOOLS } from '../tools';

/* ---------- Painel do dono: uso do assistente do WhatsApp (só com a senha ADMIN_SECRET) ---------- */

interface Stats {
  generatedAt: string;
  totals: { people: number; messages: number; activeToday: number; active7d: number; active30d: number };
  daily: { day: string; newPeople: number; activePeople: number; messages: number }[];
  usage: { avgActiveDays: number; avgSpanDays: number; returned: number; returnedPct: number; buckets: { label: string; people: number }[] };
  funnel: { key: string; label: string; people: number }[];
  tools: { tool: string; people: number; times: number }[];
  goals: { goal: string; people: number; times: number }[];
  feedback: { up: number; down: number; asked: number; answeredAsk: number; recent: { at: string; kind: 'up' | 'down' | 'note'; tool: string; note: string | null }[] };
  people?: { name: string | null; phone: string; lastSeen: string | null; site: boolean; tools: string[] }[];
}

/** "site-debts" → "🌐 Avalanche vs. bola de neve"; o resto fica como veio do bot. */
const toolLabel = (t: string) => {
  const site = /^site-(.+)$/.exec(t);
  if (!site) return t;
  if (site[1] === 'diagnostico') return '🌐 Diagnóstico';
  return `🌐 ${TOOLS.find((x) => x.id === site[1])?.title ?? site[1]}`;
};

const KEY = 'gs_admin';
const readKey = () => {
  try {
    return sessionStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
};
const ICON = { up: '👍', down: '👎', note: '💬' } as const;
const SOURCE: Record<string, string> = { geral: 'pedido do bot', livre: 'mandou por conta própria' };
const GOAL_LABEL: Record<string, string> = {
  divida: 'Sair das dívidas',
  guardar: 'Juntar dinheiro',
  gastos: 'Controlar os gastos',
  sobra: 'Achar dinheiro que sobra',
  extra: 'Usar o 13º ou um extra',
  comprar: 'Decidir uma compra',
  emprestimo: 'Comparar empréstimos',
  direitos: 'Conhecer os direitos',
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
        // este aparelho é do dono: o atalho "Painel do dono" passa a aparecer na aba Mais
        localStorage.setItem('gs-dono', '1');
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
  const people = stats.people ?? [];
  const written = stats.feedback.recent.filter((f) => f.note);

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

      <DadosDasPessoas secret={secret} />
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

      <h2 className="admin-h2">O que as pessoas querem resolver</h2>
      {stats.goals.length === 0 ? (
        <p className="admin-note">Ainda sem registros. Aparece quando alguém escolhe um objetivo na lista do bot (ou escreve, por exemplo, "quero sair das dívidas").</p>
      ) : (
        <table className="admin-table">
          <thead><tr><th>Objetivo</th><th>Pessoas</th><th>Vezes</th></tr></thead>
          <tbody>
            {stats.goals.map((g) => (
              <tr key={g.goal}><td>{GOAL_LABEL[g.goal] ?? g.goal}</td><td>{g.people}</td><td>{g.times}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="admin-h2">Pessoas</h2>
      {people.length === 0 ? (
        <p className="admin-note">Ainda ninguém. Aparece aqui quem já usou o bot; o nome vem do login no site.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Nome</th><th>WhatsApp</th><th>Último uso</th><th>Site</th><th>Usou</th></tr></thead>
            <tbody>
              {people.slice(0, 200).map((p) => (
                <tr key={p.phone + (p.lastSeen ?? '')}>
                  <td>{p.name ?? '—'}</td>
                  <td>{p.phone}</td>
                  <td>{p.lastSeen ? when(p.lastSeen) : '—'}</td>
                  <td>{p.site ? '✅' : '—'}</td>
                  <td className="admin-tools">{p.tools.map(toolLabel).join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Broadcast secret={secret} />

      <h2 className="admin-h2">Ferramentas mais abertas</h2>
      {stats.tools.length === 0 ? (
        <p className="admin-note">Ainda sem registros.</p>
      ) : (
        <table className="admin-table">
          <thead><tr><th>Ferramenta</th><th>Pessoas</th><th>Vezes</th></tr></thead>
          <tbody>
            {stats.tools.map((t) => (
              <tr key={t.tool}><td>{toolLabel(t.tool)}</td><td>{t.people}</td><td>{t.times}</td></tr>
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
      <h2 className="admin-h2">O que as pessoas escreveram</h2>
      {written.length === 0 ? (
        <p className="admin-note">Ainda ninguém escreveu. O bot pede depois de alguns dias de uso, e quem quiser pode mandar <b>feedback</b> a qualquer hora.</p>
      ) : (
        <ul className="admin-feed">
          {written.map((f, i) => (
            <li key={`${f.at}-${i}`}>
              <b>{ICON[f.kind]}</b> <span className="admin-tool">{SOURCE[f.tool] ?? toolLabel(f.tool)}</span> · {when(f.at)}
              <div className="admin-quote">“{f.note}”</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Avisar todo mundo que já usou o bot de que as ferramentas foram pro site (modelo da Meta, uma vez por pessoa). */
function Broadcast({ secret }: { secret: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [result, setResult] = useState('');
  const send = async () => {
    if (!window.confirm('Mandar o aviso "as ferramentas agora estão no site" pra todo mundo que já usou o bot? Cada pessoa recebe uma vez só.')) return;
    setState('sending');
    try {
      const res = await fetch('/api/admin?acao=avisar', { method: 'POST', headers: { Authorization: `Bearer ${secret}` } });
      const r = (await res.json()) as { sent: number; direct: number; viaTemplate: number; skipped: number; errors: string[] };
      setResult(
        `Enviado pra ${r.sent} pessoa(s): ${r.direct} direto (falaram com o bot nas últimas 24h) e ${r.viaTemplate} pelo modelo da Meta. ${r.skipped} já tinham recebido.${r.errors.length ? ` Não foi pra ${r.errors.length}+: ${r.errors[0]}` : ''}`
      );
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
      setResult('Não consegui enviar agora.');
    }
  };
  return (
    <div className="admin-card admin-broadcast">
      <div className="admin-label"><Megaphone size={14} style={{ verticalAlign: '-2px' }} /> Avisar quem já usa</div>
      <p className="admin-note">
        Manda no WhatsApp, pra cada pessoa, o aviso de que as ferramentas agora ficam no site, com o passo a passo e o <b>link de acesso dela</b> (já
        logado). Quem falou com o bot nas últimas 24h recebe na hora; os outros, pelo modelo <b>novidade_site</b> aprovado na Meta. Quem não receber
        vê o aviso na próxima mensagem que mandar.
      </p>
      <button className="btn-primary" type="button" onClick={() => void send()} disabled={state === 'sending'}>
        {state === 'sending' ? 'Enviando…' : 'Avisar todo mundo'}
      </button>
      {result && <p className={state === 'error' ? 'field-error' : 'field-hint'}>{result}</p>}
    </div>
  );
}

interface Auditoria { total: number; comDados: number; emBranco: number; comCopia: number; perderam: { id: string; onde: string; nome: string | null; rotulo: string; atual: number; copia: number; copiaEm: string }[] }

/** Alguém perdeu dados? Compara o que cada conta tem agora com a maior cópia de segurança guardada, e devolve com um toque. */
function DadosDasPessoas({ secret }: { secret: string }) {
  const [a, setA] = useState<Auditoria | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro' | 'restaurando'>('carregando');
  const [msg, setMsg] = useState('');
  const conferir = async () => {
    setEstado('carregando');
    try {
      const res = await fetch('/api/admin?acao=dados', { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      setA((await res.json()) as Auditoria);
      setEstado('ok');
    } catch {
      setEstado('erro');
    }
  };
  useEffect(() => { void conferir(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [secret]);
  const restaurar = async (ids?: string[]) => {
    const n = ids ? ids.length : a?.perderam.length ?? 0;
    if (!window.confirm(`Devolver a cópia maior para ${n} conta(s)? O que elas têm agora fica guardado como cópia, então dá para desfazer.`)) return;
    setEstado('restaurando');
    try {
      const res = await fetch('/api/admin?acao=restaurar', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify(ids ? { ids } : {}) });
      const r = (await res.json()) as { restauradas: number; erros: string[] };
      setMsg(`${r.restauradas} conta(s) restaurada(s).${r.erros.length ? ` Erros: ${r.erros.join(' | ')}` : ''} A pessoa vê os dados de volta na próxima vez que abrir o app.`);
    } catch {
      setMsg('Não consegui restaurar agora.');
    }
    await conferir();
  };
  const quando = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  return (
    <div className="admin-card" style={{ marginBottom: 16 }}>
      <div className="admin-label"><ShieldCheck size={14} style={{ verticalAlign: '-2px' }} /> Dados das pessoas</div>
      {estado === 'carregando' && <p className="admin-note">Conferindo as contas…</p>}
      {estado === 'erro' && <p className="field-error">Não consegui conferir agora. <button type="button" className="btn-ghost" onClick={() => void conferir()}>Tentar de novo</button></p>}
      {a && estado !== 'carregando' && estado !== 'erro' && (
        <>
          <div className="admin-value" style={{ color: a.perderam.length ? '#A8473A' : undefined }}>{a.perderam.length === 0 ? 'Ninguém com perda detectada' : `${a.perderam.length} conta(s) com perda de dados`}</div>
          <p className="admin-note">
            {a.total} contas guardadas: {a.comDados} com dados, {a.emBranco} em branco, {a.comCopia} com cópia de segurança. Conta com perda = existe uma cópia guardada com mais que o dobro dos registros de agora.
            Só enxerga perdas depois de 10/11 às 23:54 (quando as cópias começaram); antes disso não ficou rastro.
          </p>
          {a.perderam.length > 0 && (
            <>
              <div className="admin-table-wrap"><table className="admin-table">
                <thead><tr><th>Pessoa</th><th>Agora</th><th>Cópia</th><th>Guardada em</th><th /></tr></thead>
                <tbody>
                  {a.perderam.map((p) => (
                    <tr key={p.id}><td>{p.nome ?? 'sem nome'} · {p.rotulo}</td><td>{p.atual}</td><td><b>{p.copia}</b></td><td>{quando(p.copiaEm)}</td>
                      <td><button type="button" className="btn-ghost" disabled={estado === 'restaurando'} onClick={() => void restaurar([p.id])}>Restaurar</button></td></tr>
                  ))}
                </tbody>
              </table></div>
              <button className="btn-primary" type="button" disabled={estado === 'restaurando'} onClick={() => void restaurar()}>{estado === 'restaurando' ? 'Restaurando…' : `Restaurar as ${a.perderam.length}`}</button>
            </>
          )}
          {msg && <p className="field-hint">{msg}</p>}
        </>
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
