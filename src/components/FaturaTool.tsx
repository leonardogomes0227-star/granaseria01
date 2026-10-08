import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileUp, Check, ArrowRight, Lock } from 'lucide-react';
import { WizardData } from '../types';
import { formatBRL } from '../calculations';
import { getLeakSelection, saveLeakSelection, LEAKS } from '../leaks';
import { useSession } from '../account';
import { accountsEnabled } from '../supabase';
import { track } from '../analytics';
import { ToolShell, ToolNavProps } from './Tools';

/* ---------- Leitor de fatura com IA ---------- */

interface FaturaResult {
  e_documento_financeiro: boolean;
  periodo: string;
  total: number;
  categorias: { nome: string; total: number }[];
  cobrancas: { descricao: string; valor: number; tipo: 'assinatura' | 'seguro' | 'tarifa' | 'anuidade' | 'juros_multa' | 'outro'; dica: string }[];
  parcelados: { descricao: string; parcela: number; parcelas_restantes: number }[];
  alertas: string[];
}

const TYPE_LABEL: Record<FaturaResult['cobrancas'][number]['tipo'], string> = {
  assinatura: 'Assinatura',
  seguro: 'Seguro',
  tarifa: 'Tarifa',
  anuidade: 'Anuidade',
  juros_multa: 'Juros/multa',
  outro: 'Outro',
};

// tipo de cobrança → item do caça-vazamentos
const TYPE_TO_LEAK: Partial<Record<FaturaResult['cobrancas'][number]['tipo'], string>> = {
  assinatura: 'assinaturas',
  seguro: 'seguros',
  tarifa: 'tarifa',
  anuidade: 'anuidade',
  juros_multa: 'atraso',
};

// categorias da fatura que existem no diagnóstico, pra comparar o estimado com o real
const DIAG_CATEGORY: Record<string, keyof WizardData['expenses']> = {
  Alimentação: 'alimentacao',
  Transporte: 'transporte',
  Moradia: 'moradia',
  Lazer: 'lazer',
};

const MAX_FILE = 3 * 1024 * 1024;

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function FaturaTool({ data, ...nav }: { data: WizardData } & ToolNavProps) {
  const session = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'reading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<FaturaResult | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [added, setAdded] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file || !session) return;
    if (file.size > MAX_FILE) {
      setState('error');
      setError('Arquivo grande demais (máximo 3 MB). Tente mandar só as páginas dos lançamentos.');
      return;
    }
    setState('reading');
    setAdded(false);
    try {
      const res = await fetch('/api/fatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ mediaType: file.type, data: await toBase64(file) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Não consegui ler agora. Tenta de novo.');
      setResult(body.result as FaturaResult);
      setRemaining(typeof body.remaining === 'number' ? body.remaining : null);
      setState('done');
      track('fatura_lida');
    } catch (e) {
      setState('error');
      setError(e instanceof Error ? e.message : 'Não consegui ler agora. Tenta de novo.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const leakTotals = result
    ? result.cobrancas.reduce<Record<string, number>>((acc, c) => {
        const id = TYPE_TO_LEAK[c.tipo];
        if (id) acc[id] = (acc[id] || 0) + c.valor;
        return acc;
      }, {})
    : {};
  const leakSum = Object.values(leakTotals).reduce((s, v) => s + v, 0);

  const addToLeaks = () => {
    const sel = getLeakSelection();
    for (const [id, v] of Object.entries(leakTotals)) sel[id] = Math.round(v * 100) / 100;
    saveLeakSelection(sel);
    setAdded(true);
  };

  return (
    <ToolShell id="fatura" {...nav}>
      <p className="wizard-sub">
        Mande o PDF da fatura do cartão ou do extrato (ou uma foto). A IA encontra assinaturas, seguros, tarifas e juros escondidos e organiza seus gastos por categoria.
      </p>

      {!accountsEnabled ? (
        <div className="result-empty">O leitor de fatura ainda não foi ativado.</div>
      ) : !session ? (
        <div className="result-card">
          <p className="plan-step-title"><Lock size={15} style={{ verticalAlign: '-2px' }} /> Entre na sua conta pra usar</p>
          <p className="field-hint" style={{ marginTop: 4 }}>É grátis, sem senha — mandamos um link pro seu e-mail.</p>
          <Link className="btn-primary" to="/conta" style={{ marginTop: 12 }}>
            Entrar <ArrowRight size={16} className="arrow" />
          </Link>
        </div>
      ) : (
        <>
          <label className={`fatura-drop ${state === 'reading' ? 'busy' : ''}`}>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={state === 'reading'}
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <FileUp size={26} />
            <b>{state === 'reading' ? 'Lendo sua fatura… (leva uns 30 segundos)' : 'Escolher PDF ou foto da fatura'}</b>
            <small>Até 3 MB. O arquivo é lido e descartado — não fica guardado.</small>
          </label>
          {state === 'error' && <p className="field-error" style={{ marginTop: 10 }}>{error}</p>}
        </>
      )}

      {state === 'done' && result && !result.e_documento_financeiro && (
        <div className="insight insight-warn" style={{ marginTop: 16 }}>Esse arquivo não parece uma fatura de cartão nem um extrato. Tenta com outro.</div>
      )}

      {state === 'done' && result && result.e_documento_financeiro && (
        <div className="fatura-result">
          <div className="result-card">
            <p className="diag-label">{result.periodo ? `Gastos de ${result.periodo}` : 'Gastos do período'}</p>
            <p className="result-big">{formatBRL(result.total)}</p>
            {leakSum > 0 && (
              <p className="field-hint" style={{ marginTop: 0 }}>
                Achamos <b>{formatBRL(leakSum)}/mês</b> em cobranças que dá pra cortar ou contestar — {formatBRL(leakSum * 12)} por ano.
              </p>
            )}
          </div>

          {result.cobrancas.length > 0 && (
            <div className="stat-card" style={{ marginTop: 14 }}>
              <p className="diag-label" style={{ marginBottom: 6 }}>Cobranças pra revisar</p>
              {result.cobrancas.map((c, i) => (
                <div className="fatura-row" key={i}>
                  <span className={`fatura-tag tag-${c.tipo}`}>{TYPE_LABEL[c.tipo]}</span>
                  <span className="fatura-desc">
                    <b>{c.descricao}</b>
                    <small>{c.dica}</small>
                  </span>
                  <span className="fatura-val">{formatBRL(c.valor)}</span>
                </div>
              ))}
              {leakSum > 0 && (
                <button type="button" className="btn-primary" onClick={addToLeaks} disabled={added} style={{ marginTop: 12 }}>
                  {added ? <Check size={16} /> : null} {added ? 'Adicionado ao seu plano' : `Adicionar ${formatBRL(leakSum)}/mês ao caça-vazamentos`}
                </button>
              )}
              {added && (
                <p className="field-hint">
                  Pronto: esse valor entra no seu plano de ação. No caça-vazamentos tem a mensagem pronta pra cancelar cada um ({LEAKS.filter((l) => l.id in leakTotals).map((l) => l.title.toLowerCase()).join(', ')}).
                </p>
              )}
            </div>
          )}

          {result.categorias.length > 0 && (
            <div className="stat-card" style={{ marginTop: 14 }}>
              <p className="diag-label" style={{ marginBottom: 6 }}>Por categoria</p>
              {[...result.categorias].sort((a, b) => b.total - a.total).map((c) => {
                const key = DIAG_CATEGORY[c.nome];
                const said = key && data.monthlyIncome > 0 ? data.expenses[key] : 0;
                return (
                  <div className="plan-row" key={c.nome}>
                    <span style={{ gridColumn: 'span 2' }}>{c.nome}</span>
                    <span className="plan-row-left">
                      {formatBRL(c.total)}
                      {said > 0 && c.total > said * 1.15 && <small className="tone-text-warn"> · no diagnóstico: {formatBRL(said)}</small>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {result.parcelados.length > 0 && (
            <div className="stat-card" style={{ marginTop: 14 }}>
              <p className="diag-label" style={{ marginBottom: 6 }}>Parcelas em andamento</p>
              {result.parcelados.map((p, i) => (
                <div className="plan-row" key={i}>
                  <span style={{ gridColumn: 'span 2' }}>{p.descricao}</span>
                  <span className="plan-row-left">
                    {formatBRL(p.parcela)}
                    {p.parcelas_restantes > 0 && <small> · faltam {p.parcelas_restantes}</small>}
                  </span>
                </div>
              ))}
            </div>
          )}

          {result.alertas.length > 0 && (
            <div className="insight insight-bad" style={{ marginTop: 14 }}>
              {result.alertas.map((a, i) => (
                <p key={i}>⚠️ {a}</p>
              ))}
            </div>
          )}

          {remaining !== null && <p className="field-hint" style={{ marginTop: 12 }}>Você ainda tem {remaining} leitura(s) este mês.</p>}
        </div>
      )}
    </ToolShell>
  );
}
