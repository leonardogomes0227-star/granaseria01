import { useEffect, useState } from 'react';
import { Mail, MessageCircle, LogOut, Trash2, Check, Bell } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase, accountsEnabled, WHATSAPP_NUMBER } from '../supabase';
import { clearLocalData, stopSync } from '../sync';
import { track } from '../analytics';

/* ---------- Minha conta: entrar, sincronizar, vincular WhatsApp ---------- */

export function AccountPage({ session }: { session: Session | null }) {
  if (!accountsEnabled) {
    return (
      <div className="page-wrap anim-in">
        <div className="kicker"><span className="wedge" />Conta</div>
        <h1>Em breve</h1>
        <p className="wizard-sub">A conta (pra salvar seu plano em qualquer aparelho e receber lembretes no WhatsApp) ainda não foi ativada.</p>
      </div>
    );
  }
  return (
    <div className="page-wrap anim-in account-page">
      <div className="kicker"><span className="wedge" />Conta</div>
      {session ? <LoggedIn session={session} /> : <Login />}
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !/^\S+@\S+\.\S+$/.test(email)) return;
    setState('sending');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/conta` },
    });
    setState(error ? 'error' : 'sent');
    if (!error) track('login_link_enviado');
  };

  return (
    <>
      <h1>Entrar</h1>
      <p className="wizard-sub">
        Sem senha: mandamos um link pro seu e-mail. Com a conta, seu diagnóstico e seu plano ficam salvos em qualquer aparelho, e você pode receber os lembretes do plano no WhatsApp.
      </p>
      {state === 'sent' ? (
        <div className="insight insight-good">
          <b>Link enviado!</b> Abra seu e-mail ({email}) e toque no link pra entrar. Pode fechar esta aba.
        </div>
      ) : (
        <form className="account-form" onSubmit={send} noValidate>
          <label className="field-label" htmlFor="account-email">Seu e-mail</label>
          <input
            id="account-email"
            className="field-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="voce@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {state === 'error' && <p className="field-error">Não consegui mandar o link agora. Confere o e-mail e tenta de novo.</p>}
          <button className="btn-primary" type="submit" disabled={state === 'sending'}>
            <Mail size={16} /> {state === 'sending' ? 'Enviando…' : 'Mandar link de acesso'}
          </button>
        </form>
      )}
      <p className="field-hint" style={{ marginTop: 14 }}>
        Os números que você já preencheu neste aparelho vão junto pra sua conta.
      </p>
    </>
  );
}

interface Row {
  phone: string | null;
  link_code: string | null;
  link_code_expires: string | null;
  reminder_day: number | null;
  reminders: boolean;
}

function maskPhone(p: string) {
  const d = p.replace(/\D/g, '');
  return d.length >= 12 ? `(${d.slice(2, 4)}) •••••-${d.slice(-4)}` : p;
}

function LoggedIn({ session }: { session: Session }) {
  const [row, setRow] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [erroCodigo, setErroCodigo] = useState('');

  const load = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('user_state')
      .select('phone, link_code, link_code_expires, reminder_day, reminders')
      .eq('user_id', session.user.id)
      .maybeSingle();
    setRow((data as Row | null) ?? { phone: null, link_code: null, link_code_expires: null, reminder_day: null, reminders: true });
  };

  useEffect(() => {
    track('login_feito');
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez por sessão
  }, [session.user.id]);

  const codeValid = row?.link_code && row.link_code_expires && new Date(row.link_code_expires) > new Date();

  // enquanto o código está na tela, confere se o WhatsApp já foi vinculado
  useEffect(() => {
    if (!codeValid || row?.phone) return;
    const id = window.setInterval(load, 4000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeValid, row?.phone]);

  useEffect(() => {
    if (row?.phone) track('whatsapp_vinculado');
  }, [row?.phone]);

  const save = async (patch: Partial<Row>) => {
    if (!supabase) return;
    setBusy(true);
    await supabase.from('user_state').upsert({ user_id: session.user.id, ...patch });
    await load();
    setBusy(false);
  };

  const newCode = async () => {
    if (!supabase) return;
    setBusy(true);
    setErroCodigo('');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const res = token
      ? await fetch('/api/painel?acao=vincular', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
      : null;
    if (!res?.ok) setErroCodigo(res?.status === 429 ? 'Você gerou vários códigos. Espere um pouco e tente de novo.' : 'Não consegui gerar o código agora. Tente de novo em instantes.');
    await load();
    setBusy(false);
  };

  const unlink = async () => {
    if (!supabase) return;
    setBusy(true);
    await supabase.rpc('unlink_whatsapp');
    await load();
    setBusy(false);
  };

  const signOut = async () => {
    stopSync();
    await supabase?.auth.signOut();
  };

  const deleteAll = async () => {
    if (!supabase) return;
    if (!window.confirm('Apagar todos os seus dados da conta e deste aparelho? Isso não tem volta.')) return;
    stopSync();
    await supabase.from('user_state').delete().eq('user_id', session.user.id);
    clearLocalData();
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const waLink = row?.link_code && WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`VINCULAR ${row.link_code}`)}` : null;

  return (
    <>
      <h1>Minha conta</h1>
      <div className="insight insight-good" style={{ marginBottom: 18 }}>
        <Check size={16} style={{ verticalAlign: '-3px' }} /> Conectado como <b>{session.user.email}</b>. Seu diagnóstico, seu plano e os vazamentos achados estão salvos na conta.
      </div>

      <div className="stat-card account-card">
        <p className="diag-label" style={{ marginBottom: 6 }}><MessageCircle size={14} style={{ verticalAlign: '-2px' }} /> Lembretes no WhatsApp</p>
        {row === null ? (
          <p className="field-hint">Carregando…</p>
        ) : row.phone ? (
          <>
            <p className="account-line">WhatsApp vinculado: <b>{maskPhone(row.phone)}</b></p>
            <label className="field-label" htmlFor="reminder-day" style={{ marginTop: 12 }}>
              <Bell size={13} style={{ verticalAlign: '-2px' }} /> Dia do lembrete (o dia em que seu salário cai)
            </label>
            <select
              id="reminder-day"
              className="field-input"
              value={row.reminder_day ?? ''}
              disabled={busy}
              onChange={(e) => void save({ reminder_day: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Escolha o dia</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>Todo dia {d}</option>
              ))}
            </select>
            <label className="toggle" style={{ marginTop: 12 }}>
              <input type="checkbox" checked={row.reminders} disabled={busy} onChange={(e) => void save({ reminders: e.target.checked })} />
              <span />
              Receber o lembrete do plano todo mês
            </label>
            <p className="field-hint">
              No WhatsApp você também pode mandar <b>plano</b> pra ver o mês, <b>paguei</b> quando fizer o que o plano pede no mês, ou registrar gastos (“gastei 35 no mercado”).
            </p>
            <button type="button" className="plan-more" onClick={unlink} disabled={busy}>Desvincular este WhatsApp</button>
          </>
        ) : codeValid && row.link_code ? (
          <>
            <p className="account-line">Mande esta mensagem pro WhatsApp da Grana Séria:</p>
            <p className="account-code">VINCULAR {row.link_code}</p>
            {waLink && (
              <a className="btn-primary" href={waLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={16} /> Abrir o WhatsApp com a mensagem pronta
              </a>
            )}
            <p className="field-hint">O código vale por 30 minutos. Esta tela atualiza sozinha quando o vínculo for feito.</p>
          </>
        ) : (
          <>
            <p className="account-line">Receba no dia do pagamento o que fazer no mês e responda “paguei” quando fizer.</p>
            <button type="button" className="btn-primary" onClick={() => void newCode()} disabled={busy}>
              <MessageCircle size={16} /> Vincular meu WhatsApp
            </button>
            {erroCodigo && <p className="field-error">{erroCodigo}</p>}
          </>
        )}
      </div>

      <div className="account-actions">
        <button type="button" className="btn-outline" onClick={signOut}>
          <LogOut size={15} /> Sair
        </button>
        <button type="button" className="plan-more danger" onClick={deleteAll}>
          <Trash2 size={15} /> Apagar meus dados
        </button>
      </div>
    </>
  );
}
