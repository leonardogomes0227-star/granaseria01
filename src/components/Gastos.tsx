import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RotateCcw, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIAS, Gasto, addGasto, categoriaEmoji, fetchGastosDoMes, localISODate, monthRange } from '../lib/gastos';
import { translateDbError } from '../lib/authErrors';
import { DecimalInput } from './DecimalInput';
import { CountUp } from './motion';

function formatBRLCents(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDay(iso: string, today: string): string {
  if (iso === today) return 'Hoje';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export function GastosPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const today = localISODate();
  const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [valor, setValor] = useState(0);
  const [categoria, setCategoria] = useState<string>(CATEGORIAS[0].name);
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(today);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setStatus('loading');
    setLoadError(null);
    try {
      setGastos(await fetchGastosDoMes(userId));
      setStatus('ready');
    } catch (e) {
      setLoadError(translateDbError(e));
      setStatus('error');
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalMes = useMemo(() => gastos.reduce((s, g) => s + g.valor, 0), [gastos]);
  const totalDia = useMemo(() => gastos.filter((g) => g.data === today).reduce((s, g) => s + g.valor, 0), [gastos, today]);

  const grouped = useMemo(() => {
    const map = new Map<string, Gasto[]>();
    gastos.forEach((g) => map.set(g.data, [...(map.get(g.data) ?? []), g]));
    return Array.from(map.entries());
  }, [gastos]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId || saving) return;
    setSaveError(null);
    setNotice(null);
    if (valor <= 0) {
      setSaveError('Informe um valor maior que zero.');
      return;
    }
    if (!data) {
      setSaveError('Informe a data do gasto.');
      return;
    }
    setSaving(true);
    try {
      const novo = await addGasto(userId, { valor, categoria, descricao, data });
      const { start, end } = monthRange();
      if (novo.data >= start && novo.data <= end) {
        setGastos((prev) =>
          [novo, ...prev].sort((a, b) => (a.data === b.data ? b.criado_em.localeCompare(a.criado_em) : b.data.localeCompare(a.data)))
        );
        setNotice('Gasto anotado.');
      } else {
        setNotice('Gasto anotado — ele é de outro mês, por isso não aparece na lista deste mês.');
      }
      setValor(0);
      setDescricao('');
      setData(today);
    } catch (err) {
      setSaveError(translateDbError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wizard-wrap">
      <div className="tool-page">
        <div className="wizard-card anim-in" style={{ maxWidth: 'none' }}>
          <div className="tool-head">
            <span className="tool-icon tone-gold lg"><Wallet size={24} strokeWidth={1.9} /></span>
            <div>
              <div className="wizard-kicker" style={{ marginBottom: 4 }}>Sua conta</div>
              <h1 className="wizard-h2">Meus gastos</h1>
            </div>
          </div>
          <p className="wizard-sub">Anote cada gasto em segundos. O que você anota pelo WhatsApp aparece aqui também.</p>

          <div className="result-split gastos-totals">
            <div className="stat-card">
              <p className="diag-label">Hoje</p>
              <p className="diag-number">
                {status === 'ready' ? <CountUp value={totalDia} format={formatBRLCents} /> : '—'}
              </p>
            </div>
            <div className="stat-card">
              <p className="diag-label">{monthLabel}</p>
              <p className="diag-number">
                {status === 'ready' ? <CountUp value={totalMes} format={formatBRLCents} /> : '—'}
              </p>
            </div>
          </div>

          <form className="gasto-form" onSubmit={onSubmit} noValidate>
            <p className="diag-label">Novo gasto</p>
            <div className="gasto-grid">
              <div className="field-group">
                <label className="field-label" htmlFor="gasto-valor">Valor</label>
                <div className="input-prefix">
                  <span>R$</span>
                  <DecimalInput id="gasto-valor" value={valor} onChange={setValor} placeholder="0,00" autoFocus />
                </div>
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="gasto-data">Data</label>
                <input
                  id="gasto-data"
                  className="field-input"
                  type="date"
                  value={data}
                  max={today}
                  onChange={(e) => setData(e.target.value)}
                />
              </div>
            </div>

            <div className="field-group">
              <span className="field-label" id="gasto-cat-label">Categoria</span>
              <div className="chip-row" role="radiogroup" aria-labelledby="gasto-cat-label">
                {CATEGORIAS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    role="radio"
                    aria-checked={categoria === c.name}
                    className={`chip ${categoria === c.name ? 'active' : ''}`}
                    onClick={() => setCategoria(c.name)}
                  >
                    <span aria-hidden="true">{c.emoji}</span> {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="gasto-desc">Descrição <span className="optional">(opcional)</span></label>
              <input
                id="gasto-desc"
                className="field-input"
                type="text"
                value={descricao}
                maxLength={120}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: almoço, uber, farmácia"
              />
            </div>

            {saveError && <div className="insight insight-bad" role="alert">{saveError}</div>}
            {notice && !saveError && <div className="insight insight-good" role="status">{notice}</div>}

            <button className="btn-primary" type="submit" disabled={saving || valor <= 0}>
              {saving ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" /> Salvando…
                </>
              ) : (
                <>
                  <Plus size={16} /> Adicionar gasto
                </>
              )}
            </button>
          </form>

          <div className="diag-section" style={{ marginTop: 32, marginBottom: 0 }}>
            <p className="diag-label">Gastos do mês</p>

            {status === 'loading' && (
              <div className="auth-loading" role="status" style={{ padding: '18px 0' }}>
                <span className="btn-spinner gold" aria-hidden="true" /> Carregando seus gastos…
              </div>
            )}

            {status === 'error' && (
              <div className="insight insight-bad" role="alert">
                {loadError}{' '}
                <button type="button" className="link-btn" onClick={load}>
                  <RotateCcw size={13} /> Tentar de novo
                </button>
              </div>
            )}

            {status === 'ready' && gastos.length === 0 && (
              <div className="result-empty" style={{ marginTop: 8 }}>
                Nenhum gasto anotado neste mês ainda. Comece pelo formulário acima.
              </div>
            )}

            {status === 'ready' &&
              grouped.map(([dia, itens]) => (
                <div className="gasto-day" key={dia}>
                  <div className="gasto-day-head">
                    <span>{formatDay(dia, today)}</span>
                    <span>{formatBRLCents(itens.reduce((s, g) => s + g.valor, 0))}</span>
                  </div>
                  {itens.map((g) => (
                    <div className="gasto-row" key={g.id}>
                      <span className="gasto-emoji" aria-hidden="true">{categoriaEmoji(g.categoria)}</span>
                      <span className="gasto-info">
                        <b>{g.descricao || g.categoria}</b>
                        <span>
                          {g.categoria}
                          {g.origem === 'whatsapp' && ' · via WhatsApp'}
                        </span>
                      </span>
                      <span className="gasto-valor">{formatBRLCents(g.valor)}</span>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
